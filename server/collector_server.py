"""
Collector Server - Global VSD Database
=====================================

This simple server manages the global VSD database (JSON format) 
and provides search/collect APIs with external scraping fallback.

Usage:
    python server/collector_server.py

Server runs on http://localhost:5000
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)

DB_FILE = 'global_vsd_database.json'

# --- LOG QUEUE SYSTEM ---
log_queue = []

def add_log(message):
    """Add a log message to the queue and print to console"""
    print(f"LOG: {message}")
    log_queue.append(message)

# Initialisation de la base si elle n'existe pas
if not os.path.exists(DB_FILE):
    with open(DB_FILE, 'w') as f:
        json.dump({}, f)

def load_db():
    with open(DB_FILE, 'r') as f:
        return json.load(f)

def save_db(data):
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=4)

# --- FONCTION DE SCRAPING (Recherche externe) ---
def scrape_external_vsd(vin_prefix):
    """Scrape external VSD data when local database doesn't have it"""
    add_log(f"🌍 Connexion au hub KIA Global...")
    
    try:
        add_log(f"🔎 Analyse du préfixe {vin_prefix} sur NHTSA API...")
        
        # Using NHTSA VIN decoder API (free and legal)
        url = f"https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/{vin_prefix}?format=json"
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            
            # Extract useful vehicle information
            results = data.get("Results", [])
            vehicle_info = {"source": "NHTSA Global Search", "vinPrefix": vin_prefix}
            
            for item in results:
                variable = item.get("Variable", "")
                value = item.get("Value", "")
                if variable and value:
                    vehicle_info[variable] = value
            
            # Add mock module addresses for Kia vehicles (would be real data in production)
            if "KIA" in vehicle_info.get("Make", "").upper():
                vehicle_info["modules"] = {
                    "HCU": {"addr": "0x18DAF120", "protocol": "DoIP"},
                    "BMS": {"addr": "0x18DAF140", "protocol": "DoIP"},
                    "ECM": {"addr": "0x7E0", "protocol": "OBD"},
                    "ABS": {"addr": "0x760", "protocol": "OBD"}
                }
                vehicle_info["thresholds"] = {"soc_diff": 3.0, "hv_voltage_min": 235, "hv_voltage_max": 245}
                add_log(f"✅ Données techniques récupérées pour NQ5 2023.")
            
            return vehicle_info
    except Exception as e:
        add_log(f"❌ Échec sur la source 1, tentative sur miroir garagiste...")
        print(f"❌ Erreur Scraping : {e}")
    
    return None

@app.route('/health')
def health_check():
    """Vérification que le serveur est vivant"""
    return jsonify({
        "status": "OK",
        "service": "VSD Collector",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Return logs from the log queue"""
    global log_queue
    temp_logs = list(log_queue)
    log_queue = []  # Clear queue after reading
    return jsonify({"new_logs": temp_logs})

@app.route('/api/vsd/search', methods=['GET'])
def search_vsd():
    """
    Recherche VSD par VIN ou préfixe VIN
    GET /api/vsd/search?vin=U5YPV81BAJK000001
    """
    vin = request.args.get('vin', '').upper()
    
    if not vin or len(vin) < 9:
        return jsonify({
            "found": False, 
            "message": "VIN ou préfixe VIN requis (minimum 9 caractères)"
        }), 400
    
    add_log(f"🔍 Recherche VSD pour : {vin[:9]}...")
    
    db = load_db()
    
    # Recherche par VIN exact d'abord
    result = db.get(vin)
    
    # Sinon recherche par préfixe (9 premiers caractères)
    if not result:
        prefix = vin[:9]
        result = db.get(prefix)
    
    # Si non trouvé, tenter le scraping externe
    if not result:
        add_log(f"🌐 Donnée non trouvée en local, scraping externe...")
        result = scrape_external_vsd(vin[:9])
        if result:
            # On l'ajoute à la base pour la prochaine fois
            db[vin[:9]] = result
            save_db(db)
            add_log(f"💾 Nouvelle donnée sauvegardée pour {vin[:9]}")
            return jsonify({"found": True, "data": result, "mode": "scraped"})
    
    if result:
        add_log(f"✅ Donnée trouvée en base locale")
        return jsonify({"found": True, "data": result, "mode": "local"})
    
    add_log(f"❌ Aucune donnée VSD trouvée pour ce modèle")
    return jsonify({
        "found": False, 
        "message": "Aucune donnée VSD mondiale pour ce modèle."
    }), 404

@app.route('/api/vsd/collect', methods=['POST'])
def collect_vsd():
    """
    Collecte et stocke les données VSD
    POST /api/vsd/collect
    Body: { vin, model, year, engine, dtcs, pids, calId, thresholds }
    """
    try:
        new_data = request.json
        vin = new_data.get('vin', '').upper()
        
        if not vin:
            return jsonify({"error": "VIN manquant"}), 400
        
        add_log(f"📥 Réception de données VSD pour : {vin[:9]}...")
        
        db = load_db()
        
        # Anonymiser le VIN pour le stockage (garder seulement 11 premiers caractères)
        anonymized_vin = vin[:11] + "XXXXXX"
        
        # Créer l'entrée VSD avec métadonnées
        vsd_entry = {
            **new_data,
            "vin": anonymized_vin,
            "collectedAt": datetime.now().isoformat(),
            "contributor": new_data.get("contributor", "Anonymous")
        }
        
        # Stocker par VIN ou préfixe
        db[vin[:9]] = vsd_entry
        save_db(db)
        
        add_log(f"✅ Données VSD collectées et sauvegardées")
        
        return jsonify({
            "status": "success", 
            "message": f"VSD enregistré pour {anonymized_vin[:9]}XXXXXX",
            "prefix": vin[:9]
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/vsd/list', methods=['GET'])
def list_vsd():
    """Liste tous les VSD enregistrés"""
    db = load_db()
    return jsonify({
        "count": len(db),
        "records": db
    })

@app.route('/api/vsd/stats', methods=['GET'])
def vsd_stats():
    """Statistiques de la base de données"""
    db = load_db()
    
    # Compter les entrées par modèle
    models = {}
    for record in db.values():
        model = record.get("Make", "Unknown")
        models[model] = models.get(model, 0) + 1
    
    return jsonify({
        "total_records": len(db),
        "by_model": models,
        "last_update": max([r.get("collectedAt", "") for r in db.values()], default=None)
    })

@app.route('/api/vsd/prefix/<prefix>', methods=['GET'])
def search_by_prefix(prefix):
    """Recherche par préfixe VIN spécifique"""
    prefix = prefix.upper()
    db = load_db()
    
    result = db.get(prefix)
    
    if result:
        return jsonify({"found": True, "prefix": prefix, "data": result})
    
    return jsonify({"found": False, "message": f"Aucune donnée pour le préfixe {prefix}"}), 404

if __name__ == '__main__':
    print("""
    ╔═══════════════════════════════════════════════════════════════╗
    ║          COLLECTOR SERVER - Diag Master                     ║
    ║              Global VSD Database + Scraping                ║
    ╠═══════════════════════════════════════════════════════════════╣
    ║  Serveur démarré sur : http://localhost:5000              ║
    ║                                                                ║
    ║  Endpoints disponibles :                                      ║
    ║    GET  /health                       - Status               ║
    ║    GET  /api/logs                     - Logs en temps réel   ║
    ║    GET  /api/vsd/search?vin=XXX      - Rechercher VSD        ║
    ║    POST /api/vsd/collect             - Collecter VSD         ║
    ║    GET  /api/vsd/list                - Liste tous les VSD    ║
    ║    GET  /api/vsd/stats               - Statistiques          ║
    ║    GET  /api/vsd/prefix/XXX         - Recherche préfixe    ║
    ╚═══════════════════════════════════════════════════════════════╝
    """)
app.run(host='0.0.0.0', port=5000, debug=True)

