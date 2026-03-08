"""
KIA Agent - Serveur Flask pour diagnostic avancé des capteurs Kia Sportage NQ5
==========================================================================

Ce script crée un serveur local qui permet à l'interface React de communiquer
avec les calculateurs du véhicule via UDS/OBD sans bloquer l'interface.

Installation des dépendances :
    pip install flask flask-cors python-can udsoncan

Usage :
    python kia_agent.py

Le serveur écoute sur http://localhost:5000
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import logging
import time
import requests

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Autorise ton interface React à communiquer avec Python

# Configuration UDS / CAN
CAN_INTERFACE = 'can0'  # Interface CAN (à adapter selon votre configuration)
CAN_BAUDRATE = 500000  # 500K CAN pour Kia NQ5

# Adresse des calculateurs Kia NQ5 (11-bit standard)
ECU_ADDRESSES_11BIT = {
    'ACU': 0x7B0,    # Airbag Control Unit
    'ILCU': 0x77D,   # Intelligent Lighting Control
    'ADAS': 0x7C6,   # Advanced Driver Assistance
    'MHEV': 0x7E4,   # Mild Hybrid 48V
    'ECM': 0x7E0,    # Engine Control Module
    'ABS': 0x760,    # Anti-lock Braking
    'BCM': 0x776,    # Body Control Module
    'TCU': 0x7E1     # Transmission Control
}

# Adresses DoIP 29-bit pour modules hybrides/ADAS (NQ5 2023+)
# Format: {'name': (tx_id, rx_id, is_extended)}
ECU_ADDRESSES_29BIT = {
    'HCU': (0x18DA20F1, 0x18DAF120, True),    # Hybrid Control Unit
    'BMS': (0x18DA22F1, 0x18DAF221, True),     # Battery Management System
    'OBC': (0x18DA23F1, 0x18DAF321, True),     # On-Board Charger
    'IPM': (0x18DA24F1, 0x18DAF421, True),     # Integrated Power Module
    'MGU': (0x18DA25F1, 0x18DAF521, True),     # Motor Generator Unit
}

# Alias pour compatibilité
ECU_ADDRESSES = {**ECU_ADDRESSES_11BIT, **{k: v[0] for k, v in ECU_ADDRESSES_29BIT.items()}}

# Seuils pour la santé des capteurs hybrides
HYBRID_THRESHOLDS = {
    'hv_voltage_min': 235,   # 240V ± 5V
    'hv_voltage_max': 245,
    'soc_delta_max': 3,      # Écart max entre BMS et HCU (%)
    'battery_12v_min': 11.5,
    'battery_12v_max': 14.5
}

# Variable pour suivre le cycle de repos
last_dtc_clear_time = None
require_battery_cycle = False


def init_can_connection():
    """
    Initialise la connexion CAN via python-can
    À décommenter quand l'interface physique est disponible
    """
    # try:
    #     import can
    #     bus = can.interface.Bus(channel=CAN_INTERFACE, bustype='socketcan', bitrate=CAN_BAUDRATE)
    #     return bus
    # except Exception as e:
    #     logger.error(f"Erreur connexion CAN: {e}")
    #     return None
    return None


# Instance bus CAN (initialisée à la demande)
can_bus = None


def get_can_bus():
    """Récupère ou initialise le bus CAN"""
    global can_bus
    if can_bus is None:
        can_bus = init_can_connection()
    return can_bus


# URL de l'API AutoWizard (doit être démarrée séparément)
AUTOWIZARD_URL = "http://localhost:8080/api/DTCCode"


@app.route('/health')
def health_check():
    """Vérification que le serveur est vivant"""
    return jsonify({
        "status": "OK",
        "service": "KIA Agent",
        "version": "1.0.0",
        "timestamp": time.time()
    })


@app.route('/api/expert/<dtc>', methods=['GET'])
def get_expert_advice(dtc):
    """
    Endpoint qui fait le pont entre le scanneur (ELM/J2534) 
    et la base de connaissances AutoWizard.
    
    Retourne les informations détaillées sur le DTC :
    - definition: description du code
    - suggested_fix: solution recommandée
    - severity: niveau de gravité
    - possible_causes: causes possibles
    """
    dtc = dtc.upper().strip()
    print(f"📡 Requête Expert pour DTC: {dtc}")
    
    try:
        # On interroge l'API locale AutoWizard
        response = requests.get(f"{AUTOWIZARD_URL}/{dtc}", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            # Transformer la réponse AutoWizard en format standard
            return jsonify({
                "code": dtc,
                "definition": data.get("description", "Description non disponible"),
                "suggested_fix": data.get("solutions", "Solution non disponible"),
                "possible_causes": data.get("possibleCauses", "").split(", ") if data.get("possibleCauses") else [],
                "severity": _estimate_severity(dtc),
                "source": "AutoWizard"
            })
        elif response.status_code == 404:
            # Code non trouvé dans AutoWizard, utiliser la base locale
            return jsonify({
                "code": dtc,
                "definition": "Code détecté via J2534/ELM327",
                "suggested_fix": "Vérification manuelle requise - Consultez la documentation KIA",
                "possible_causes": ["Informations non disponibles dans la base AutoWizard"],
                "severity": _estimate_severity(dtc),
                "source": "local"
            })
        else:
            return jsonify({
                "code": dtc,
                "definition": "Erreur de communication avec AutoWizard",
                "suggested_fix": "Vérification manuelle requise",
                "possible_causes": ["Service AutoWizard temporairement indisponible"],
                "severity": "medium",
                "error": f"Status: {response.status_code}"
            }), 500
            
    except requests.exceptions.ConnectionError:
        # AutoWizard pas démarré, retourner une réponse de fallback
        return jsonify({
            "code": dtc,
            "definition": "Service AutoWizard non disponible",
            "suggested_fix": "Vérification manuelle requise - Lancez l'API AutoWizard sur le port 8080",
            "possible_causes": ["AutoWizardAPI non démarré"],
            "severity": _estimate_severity(dtc),
            "source": "fallback"
        })
    except Exception as e:
        print(f"❌ Erreur AutoWizard: {e}")
        return jsonify({
            "code": dtc,
            "definition": "Erreur lors de la requête",
            "suggested_fix": "Vérification manuelle requise",
            "possible_causes": [str(e)],
            "severity": "medium",
            "error": str(e)
        }), 500


def _estimate_severity(dtc: str) -> str:
    """Estime la gravité du DTC basée sur son préfixe"""
    prefix = dtc[:1].upper() if dtc else ""
    
    severity_map = {
        'P': 'high',   # Powertrain - souvent critique
        'B': 'medium',  # Body - airbags, clim
        'C': 'medium',  # Chassis - ABS, direction
        'U': 'low'      # Network - erreurs de communication
    }
    
    return severity_map.get(prefix, 'medium')


@app.route('/sensor/crash-continuity')
def check_crash_sensor():
    """
    Vérifie la continuité du capteurs de crash (Airbag)
    Mode UDS : Read Data By Identifier (0x22)
    PID Kia : 0xB100 (Crash Sensor)
    
    Retourne la résistance en Ohms du capteurs
    """
    try:
        # Simulation de lecture - À remplacer par vraie lecture UDS
        # avec udsoncan quand l'interface CAN est disponible
        
        # Exemple de commande UDS réelle :
        # udsoncan.commands.ReadDataByIdentifier(session, 0xB100)
        
        val = 2.2  # Ohms (valeur normale: 2.0-2.5 Ohm)
        
        return jsonify({
            "status": "OK",
            "sensor": "Crash Sensor Front-Left",
            "value": val,
            "unit": "Ohm",
            "threshold": {"min": 1.8, "max": 3.0},
            "ecu": "ACU",
            "raw": "0x0222"
        })
    except Exception as e:
        logger.error(f"Erreur lecture capteur crash: {e}")
        return jsonify({
            "status": "ERROR", 
            "msg": str(e),
            "sensor": "Crash Sensor"
        }), 500


@app.route('/sensor/battery-12v')
def check_battery_12v():
    """
    Vérifie l'état de la batterie 12V
    Mode OBD : PID 0x42 (Battery Voltage)
    """
    try:
        # Simulation - Lecture réelle via OBD
        val = 12.4  # Volts
        
        status = "OK" if 11.5 <= val <= 14.5 else "WARNING"
        
        return jsonify({
            "status": status,
            "sensor": "Battery 12V",
            "value": val,
            "unit": "V",
            "threshold": {"min": 11.5, "max": 14.5},
            "ecu": "ECM",
            "pid": "0x42"
        })
    except Exception as e:
        return jsonify({"status": "ERROR", "msg": str(e)}), 500


@app.route('/sensor/coolant-temp')
def check_coolant_temp():
    """
    Vérifie la température du liquide de refroidissement
    Mode OBD : PID 0x05 (Coolant Temperature)
    """
    try:
        # Valeur simulée -40°C = capteurr débranché
        val = 78  # °C (température normale de fonctionnement)
        
        status = "OK" if -40 < val < 120 else "FAILED"
        
        return jsonify({
            "status": status,
            "sensor": "Coolant Temperature",
            "value": val,
            "unit": "°C",
            "threshold": {"min": -40, "max": 115},
            "ecu": "ECM",
            "pid": "0x05"
        })
    except Exception as e:
        return jsonify({"status": "ERROR", "msg": str(e)}), 500


@app.route('/sensor/ifs-angle')
def check_ifs_angle():
    """
    Vérifie les capteurs d'angle des phars adaptatifs IFS
    Mode UDS : Read Data By Identifier
    """
    try:
        left_angle = -2.5  # Degrés
        right_angle = 1.8  # Degrés
        
        # Si les deux sont à 0.0 = capteurs grippés
        if left_angle == 0.0 and right_angle == 0.0:
            status = "CHECK"
            msg = "Capteurs potentiellement grippés (valeurs figées)"
        else:
            status = "OK"
            msg = "Fonctionnement normal"
        
        return jsonify({
            "status": status,
            "sensor": "IFS Adaptive Lighting",
            "left_angle": left_angle,
            "right_angle": right_angle,
            "unit": "°",
            "threshold": {"min": -5.0, "max": 5.0},
            "ecu": "ILCU",
            "message": msg
        })
    except Exception as e:
        return jsonify({"status": "ERROR", "msg": str(e)}), 500


@app.route('/sensor/hv-battery')
def check_hv_battery():
    """
    Vérifie la tension de la batterie HV (haute tension) 48V système hybride
    Mode UDS : Read Data By Identifier sur BMS
    Seuil : 240V ± 5V (235V - 245V)
    """
    try:
        # Simulation - Lecture via UDS sur BMS (0x18DA22F1)
        val = 240.5  # Volts (tension normale)
        
        status = "OK"
        if val < HYBRID_THRESHOLDS['hv_voltage_min']:
            status = "LOW"
        elif val > HYBRID_THRESHOLDS['hv_voltage_max']:
            status = "HIGH"
        
        return jsonify({
            "status": status,
            "sensor": "HV Battery Voltage",
            "value": val,
            "unit": "V",
            "threshold": {
                "min": HYBRID_THRESHOLDS['hv_voltage_min'], 
                "max": HYBRID_THRESHOLDS['hv_voltage_max']
            },
            "ecu": "BMS",
            "is_extended_id": True,
            "can_tx": hex(ECU_ADDRESSES_29BIT['BMS'][0]),
            "can_rx": hex(ECU_ADDRESSES_29BIT['BMS'][1])
        })
    except Exception as e:
        return jsonify({"status": "ERROR", "msg": str(e)}), 500


@app.route('/sensor/soc-sync')
def check_soc_synchronization():
    """
    Vérifie la synchronisation SOC (State of Charge) entre BMS et HCU
    Si l'écart > 3%, il y a un problème de synchronisation
    """
    try:
        # Simulation - Lecture SOC depuis BMS et HCU
        soc_bms = 72  # State of Charge BMS
        soc_hcu = 74  # State of Charge HCU
        delta = abs(soc_bms - soc_hcu)
        
        if delta > HYBRID_THRESHOLDS['soc_delta_max']:
            status = "DESYNC"
            msg = f"Écart {delta}% - Désynchronisation détectée entre BMS et HCU"
        else:
            status = "OK"
            msg = "Synchronisation BMS-HCU normale"
        
        return jsonify({
            "status": status,
            "sensor": "SOC BMS vs HCU Sync",
            "soc_bms": soc_bms,
            "soc_hcu": soc_hcu,
            "delta": delta,
            "unit": "%",
            "threshold": {"max": HYBRID_THRESHOLDS['soc_delta_max']},
            "ecu": "BMS/HCU",
            "message": msg,
            "is_extended_id": True
        })
    except Exception as e:
        return jsonify({"status": "ERROR", "msg": str(e)}), 500


@app.route('/sensor/all', methods=['GET'])
def get_all_sensors():
    """
    Retourne l'état de tous les capteurs en une seule requête
    """
    sensors = []
    
    # Capteur crash
    try:
        crash = check_crash_sensor().get_json()
        sensors.append(crash)
    except:
        pass
    
    # Batterie 12V
    try:
        battery = check_battery_12v().get_json()
        sensors.append(battery)
    except:
        pass
    
    # Température coolant
    try:
        coolant = check_coolant_temp().get_json()
        sensors.append(coolant)
    except:
        pass
    
    # IFS
    try:
        ifs = check_ifs_angle().get_json()
        sensors.append(ifs)
    except:
        pass
    
    # HV Battery (hybride)
    try:
        hv = check_hv_battery().get_json()
        sensors.append(hv)
    except:
        pass
    
    # SOC Sync (hybride)
    try:
        soc = check_soc_synchronization().get_json()
        sensors.append(soc)
    except:
        pass
    
    return jsonify({
        "timestamp": time.time(),
        "sensors_count": len(sensors),
        "sensors": sensors
    })


@app.route('/ecu/list')
def list_ecu():
    """Liste les calculateurs disponibles avec adresses 11-bit et 29-bit"""
    ecus = []
    
    # Add 11-bit ECUs
    for name, addr in ECU_ADDRESSES_11BIT.items():
        ecus.append({
            "id": name,
            "address": hex(addr),
            "name": name,
            "is_extended": False,
            "type": "STANDARD"
        })
    
    # Add 29-bit ECUs (DoIP)
    for name, (tx, rx, ext) in ECU_ADDRESSES_29BIT.items():
        ecus.append({
            "id": name,
            "tx_address": hex(tx),
            "rx_address": hex(rx),
            "name": name,
            "is_extended": ext,
            "type": "DOIP"
        })
    
    return jsonify({"ecus": ecus})


@app.route('/ecu/<ecu_id>/dtc')
def read_ecu_dtc(ecu_id):
    """
    Lit les DTC d'un calculateur spécifique
    Mode UDS : Read DTC Information (0x19)
    """
    if ecu_id.upper() not in ECU_ADDRESSES:
        return jsonify({"status": "ERROR", "msg": "ECU inconnu"}), 400
    
    try:
        # Simulation - Lecture réelle via UDS
        # udsoncan.commands.ReadDtcInformation(session, 0x02)
        
        dtcs = []  # Liste des codes défaut
        
        return jsonify({
            "status": "OK",
            "ecu": ecu_id,
            "address": hex(ECU_ADDRESSES[ecu_id.upper()]),
            "dtcs": dtcs,
            "count": len(dtcs)
        })
    except Exception as e:
        return jsonify({"status": "ERROR", "msg": str(e)}), 500


@app.route('/ecu/<ecu_id>/clear', methods=['POST'])
def clear_ecu_dtc(ecu_id):
    """
    Efface les DTC d'un calculateur
    Mode UDS : Clear Diagnostic Information (0x14)
    
    Note importante pour les modules hybrides (HCU/BMS) :
    L'effacement n'est pas effectif sans un cycle de repos de la batterie 12V.
    """
    global last_dtc_clear_time, require_battery_cycle
    
    if ecu_id.upper() not in ECU_ADDRESSES:
        return jsonify({"status": "ERROR", "msg": "ECU inconnu"}), 400
    
    try:
        # Simulation - Effacement réel via UDS
        # udsoncan.commands.ClearDtc(session)
        
        # Enregistrer le temps d'effacement
        last_dtc_clear_time = time.time()
        
        # Pour les modules hybrides, exiger un cycle de batterie
        hybrid_modules = ['HCU', 'BMS', 'MHEV', 'OBC', 'IPM', 'MGU']
        if ecu_id.upper() in hybrid_modules:
            require_battery_cycle = True
            return jsonify({
                "status": "OK",
                "message": f"DTC effacés pour {ecu_id}",
                "ecu": ecu_id,
                "warning": "KGD_REQUIRED",
                "kgd_message": "Action requise : Débranchez la batterie 12V pendant 10 min pour valider l'auto-test du HCU/BMS.",
                "next_action": "RECONNECT_BATTERY",
                "timeout_seconds": 600
            })
        
        return jsonify({
            "status": "OK",
            "message": f"DTC effacés pour {ecu_id}",
            "ecu": ecu_id
        })
    except Exception as e:
        return jsonify({"status": "ERROR", "msg": str(e)}), 500


@app.route('/battery/cycle-status')
def get_battery_cycle_status():
    """
    Retourne le statut du cycle de batterie après effacement DTC
    Indique si un cycle de batterie est requis et le temps restant
    """
    global last_dtc_clear_time, require_battery_cycle
    
    if not require_battery_cycle or last_dtc_clear_time is None:
        return jsonify({
            "status": "IDLE",
            "require_cycle": False,
            "message": "Aucun cycle de batterie requis"
        })
    
    elapsed = time.time() - last_dtc_clear_time
    remaining = max(0, 600 - elapsed)  # 10 minutes = 600 secondes
    
    if elapsed >= 600:
        # Le cycle est complet
        require_battery_cycle = False
        return jsonify({
            "status": "COMPLETE",
            "require_cycle": False,
            "message": "Cycle de batterie terminé - Vous pouvez effectuer un nouveau scan",
            "elapsed_seconds": int(elapsed)
        })
    
    return jsonify({
        "status": "WAITING",
        "require_cycle": True,
        "message": f"Attente du cycle de batterie : {int(remaining)} secondes restantes",
        "remaining_seconds": int(remaining),
        "elapsed_seconds": int(elapsed),
        "instruction": "Débranchez la batterie 12V pendant 10 minutes, puis rebranchez-la"
    })


@app.route('/diagnose/full', methods=['POST'])
def full_diagnosis():
    """
    Effectue un diagnostic complet du véhicule
    Scan tous les calculateurs et retourne un rapport
    """
    report = {
        "timestamp": time.time(),
        "vehicle": "Kia Sportage NQ5",
        "system": "MHEV",
        "ecus_scanned": [],
        "dtcs_found": [],
        "sensors_status": []
    }
    
    # Scan de tous les ECU
    for ecu_name in ECU_ADDRESSES.keys():
        try:
            # Lecture DTC par ECU
            dtc_result = read_ecu_dtc(ecu_name).get_json()
            report["ecus_scanned"].append({
                "name": ecu_name,
                "status": "OK",
                "dtcs_count": dtc_result.get("count", 0)
            })
            
            if dtc_result.get("count", 0) > 0:
                report["dtcs_found"].extend([
                    {**d, "ecu": ecu_name} for d in dtc_result.get("dtcs", [])
                ])
        except Exception as e:
            report["ecus_scanned"].append({
                "name": ecu_name,
                "status": "ERROR",
                "error": str(e)
            })
    
    # Lecture de tous les capteurs
    try:
        all_sensors = get_all_sensors().get_json()
        report["sensors_status"] = all_sensors.get("sensors", [])
    except:
        pass
    
    # Calcul du statut global
    if len(report["dtcs_found"]) > 0:
        report["overall_status"] = "ISSUES_FOUND"
    else:
        report["overall_status"] = "OK"
    
    return jsonify(report)


if __name__ == '__main__':
    print("""
    ╔═══════════════════════════════════════════════════════════════╗
    ║                    KIA AGENT - Serveur                        ║
    ║           Diagnostic Kia Sportage NQ5 MHEV                   ║
    ╠═══════════════════════════════════════════════════════════════╣
    ║  Serveur démarré sur : http://localhost:5000               ║
    ║                                                                ║
    ║  Endpoints disponibles :                                      ║
    ║    GET  /health                      - Status du serveur     ║
    ║    GET  /sensor/all                 - Tous les capteurs     ║
    ║    GET  /sensor/crash-continuity   - Capteur crash         ║
    ║    GET  /sensor/battery-12v        - Batterie 12V          ║
    ║    GET  /sensor/coolant-temp        - Température liquide   ║
    ║    GET  /sensor/ifs-angle           - Phares adaptatifs     ║
    ║    GET  /ecu/list                   - Liste des ECU         ║
    ║    GET  /ecu/<id>/dtc              - Lire DTC ECU          ║
    ║    POST /ecu/<id>/clear             - Effacer DTC ECU       ║
    ║    POST /diagnose/full              - Diagnostic complet    ║
    ╚═══════════════════════════════════════════════════════════════╝
    """)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
