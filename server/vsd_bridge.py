"""
VSD Bridge Server - Web Scraping & Data Sharing for Global Diagnostic Network
===============================================================================

This optional server enables:
1. Web scraping of diagnostic forums for VSD data
2. API endpoint for sharing anonymous diagnostic data
3. Data formatting and normalization

Installation:
    pip install flask flask-cors beautifulsoup4 requests

Usage:
    python server/vsd_bridge.py

The server listens on http://localhost:5001
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import logging
import json
import time
from datetime import datetime
import requests
from bs4 import BeautifulSoup

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Autorise les requêtes cross-origin depuis React

# Configuration des sources de scraping
SCRAPING_SOURCES = {
    "kia_forums": {
        "base_url": "https://kiaforum.com",
        "search_url": "https://kiaforum.com/search",
        "enabled": False  # Désactivé par défaut (nécessite configuration)
    },
    "obd2_codes": {
        "base_url": "https://www.obd2-codes.com",
        "enabled": True
    },
    "dtc_codes": {
        "base_url": "https://www.dtc-codes.com",
        "enabled": True
    }
}

# Base de données locale (fichier JSON pour persistance simple)
VSD_DATABASE_FILE = "vsd_database.json"

# Initialize database
def init_database():
    """Initialise la base de données VSD"""
    try:
        with open(VSD_DATABASE_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {"records": [], "last_update": None}

def save_database(data):
    """Sauvegarde la base de données VSD"""
    with open(VSD_DATABASE_FILE, 'w') as f:
        json.dump(data, f, indent=2)

# Base de données en mémoire
vsd_database = init_database()


@app.route('/health')
def health_check():
    """Vérification que le serveur est vivant"""
    return jsonify({
        "status": "OK",
        "service": "VSD Bridge",
        "version": "1.0.0",
        "timestamp": time.time()
    })


@app.route('/api/vsd/search', methods=['GET'])
def search_vsd():
    """
    Recherche des données VSD par prefix VIN
    GET /api/vsd/search?prefix=U5YPV81BA
    """
    prefix = request.args.get('prefix', '').upper()
    
    if len(prefix) < 9:
        return jsonify({
            "status": "ERROR",
            "message": "Le prefix VIN doit contenir au moins 9 caractères"
        }), 400
    
    # Recherche locale
    for record in vsd_database.get("records", []):
        if record.get("vinPrefix", "").startswith(prefix):
            return jsonify({
                "status": "OK",
                "found": True,
                "data": record,
                "source": "local_db"
            })
    
    # Pas trouvé en local - essayer le scraping
    scraped_data = scrape_dtc_forums(prefix)
    
    if scraped_data:
        # Sauvegarder les données collectées
        vsd_database["records"].append(scraped_data)
        vsd_database["last_update"] = datetime.now().isoformat()
        save_database(vsd_database)
        
        return jsonify({
            "status": "OK",
            "found": True,
            "data": scraped_data,
            "source": "scraped"
        })
    
    return jsonify({
        "status": "OK",
        "found": False,
        "message": "Aucune donnée VSD trouvée pour ce prefix"
    })


@app.route('/api/vsd/share', methods=['POST'])
def share_vsd():
    """
    Partage des données VSD anonymisées
    POST /api/vsd/share
    Body: { vin, model, year, engine, dtcs, solutions }
    """
    try:
        data = request.json
        
        # Validation basique
        if not data.get("vin"):
            return jsonify({"status": "ERROR", "message": "VIN requis"}), 400
        
        # Anonymisation du VIN (garder seulement les 11 premiers caractères)
        anonymized_vin = data["vin"][:11] + "XXXXXX"
        
        # Créer l'entrée VSD
        vsd_record = {
            "vin": anonymized_vin,
            "vinPrefix": anonymized_vin[:9],
            "model": data.get("model", "Unknown"),
            "year": data.get("year", datetime.now().year),
            "engine": data.get("engine", "Unknown"),
            "dtcs": data.get("dtcs", []),
            "solutions": data.get("solutions", []),
            "liveData": data.get("liveData", {}),
            "contributor": data.get("contributor", "Anonymous"),
            "sharedAt": datetime.now().isoformat(),
            "source": "community_share"
        }
        
        # Ajouter à la base de données
        vsd_database["records"].append(vsd_record)
        vsd_database["last_update"] = datetime.now().isoformat()
        save_database(vsd_database)
        
        logger.info(f"Nouvel enregistrement VSD ajouté: {anonymized_vin[:9]}...")
        
        return jsonify({
            "status": "OK",
            "message": "Données VSD partagées avec succès",
            "record_id": len(vsd_database["records"]) - 1
        })
        
    except Exception as e:
        logger.error(f"Erreur lors du partage VSD: {e}")
        return jsonify({"status": "ERROR", "message": str(e)}), 500


@app.route('/api/vsd/list', methods=['GET'])
def list_vsd():
    """Liste tous les enregistrements VSD (pour debug)"""
    return jsonify({
        "status": "OK",
        "count": len(vsd_database.get("records", [])),
        "last_update": vsd_database.get("last_update"),
        "records": vsd_database.get("records", [])[:50]  # Limiter à 50 entrées
    })


@app.route('/api/vsd/stats', methods=['GET'])
def vsd_stats():
    """Retourne des statistiques sur la base de données"""
    records = vsd_database.get("records", [])
    
    # Compter les occurrences de chaque DTC
    dtc_counts = {}
    for record in records:
        for dtc in record.get("dtcs", []):
            dtc_counts[dtc] = dtc_counts.get(dtc, 0) + 1
    
    return jsonify({
        "status": "OK",
        "total_records": len(records),
        "last_update": vsd_database.get("last_update"),
        "top_dtcs": sorted(dtc_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    })


def scrape_dtc_forums(vin_prefix):
    """
    Scrape les forums de diagnostic pour récupérer des données VSD
    Cette fonction est un placeholder - nécessite une implémentation plus robuste
    """
    logger.info(f"Attempting to scrape diagnostic forums for prefix: {vin_prefix}")
    
    # Exemple de données simulées (à remplacer par vrai scraping)
    # Dans un vrai scénario, vous feriez:
    # 1. Rechercher sur les forums avec le prefix VIN
    # 2. Parser les pages de discussion
    # 3. Extraire les codes DTC et solutions
    
    # Données simulées pour démonstration
    simulated_data = {
        "vinPrefix": vin_prefix,
        "model": "Kia Sportage",
        "year": 2022,
        "engine": "2.0L Turbo",
        "dtcs": [],
        "solutions": [],
        "contributor": "forum_scraper",
        "sharedAt": datetime.now().isoformat(),
        "source": "forum_scraping"
    }
    
    return None  # Retourne None par défaut (pas de scraping réel)


def scrape_obd_codes(code):
    """
    Scrape les codes DTC depuis des sites spécialisés
    """
    if not SCRAPING_SOURCES["obd2_codes"]["enabled"]:
        return None
    
    try:
        url = f"{SCRAPING_SOURCES['obd2_codes']['base_url']}/code/{code}"
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            # Extraire les informations du code DTC
            # (implémentation dépend de la structure du site)
            return {
                "code": code,
                "description": "Description extraite",
                "source": "obd2-codes.com"
            }
    except Exception as e:
        logger.warning(f"Erreur scraping {code}: {e}")
    
    return None


if __name__ == '__main__':
    print("""
    ╔═══════════════════════════════════════════════════════════════╗
    ║               VSD BRIDGE SERVER - Serveur                    ║
    ║        Diagnostic Cloud - Web Scraping & Sharing             ║
    ╠═══════════════════════════════════════════════════════════════╣
    ║  Serveur démarré sur : http://localhost:5001              ║
    ║                                                                ║
    ║  Endpoints disponibles :                                      ║
    ║    GET  /health                           - Status            ║
    ║    GET  /api/vsd/search?prefix=XXX       - Rechercher VSD   ║
    ║    POST /api/vsd/share                    - Partager VSD    ║
    ║    GET  /api/vsd/list                     - Liste VSD       ║
    ║    GET  /api/vsd/stats                    - Statistiques    ║
    ╚═══════════════════════════════════════════════════════════════╝
    """)
    
    app.run(host='0.0.0.0', port=5001, debug=True)

