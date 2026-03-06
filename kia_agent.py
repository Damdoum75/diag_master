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

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Autorise ton interface React à communiquer avec Python

# Configuration UDS / CAN
CAN_INTERFACE = 'can0'  # Interface CAN (à adapter selon votre configuration)
CAN_BAUDRATE = 500000  # 500K CAN pour Kia NQ5

# Adresse des calculateurs Kia NQ5
ECU_ADDRESSES = {
    'ACU': 0x7B0,    # Airbag Control Unit
    'ILCU': 0x77D,   # Intelligent Lighting Control
    'ADAS': 0x7C6,   # Advanced Driver Assistance
    'MHEV': 0x7E4,   # Mild Hybrid 48V
    'ECM': 0x7E0,    # Engine Control Module
    'ABS': 0x760,    # Anti-lock Braking
    'BCM': 0x776,    # Body Control Module
    'TCU': 0x7E1     # Transmission Control
}


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


@app.route('/health')
def health_check():
    """Vérification que le serveur est vivant"""
    return jsonify({
        "status": "OK",
        "service": "KIA Agent",
        "version": "1.0.0",
        "timestamp": time.time()
    })


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
    
    return jsonify({
        "timestamp": time.time(),
        "sensors_count": len(sensors),
        "sensors": sensors
    })


@app.route('/ecu/list')
def list_ecu():
    """Liste les calculateurs disponibles"""
    return jsonify({
        "ecus": [
            {"id": k, "address": hex(v), "name": k} 
            for k, v in ECU_ADDRESSES.items()
        ]
    })


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
    """
    if ecu_id.upper() not in ECU_ADDRESSES:
        return jsonify({"status": "ERROR", "msg": "ECU inconnu"}), 400
    
    try:
        # Simulation - Effacement réel via UDS
        # udsoncan.commands.ClearDtc(session)
        
        return jsonify({
            "status": "OK",
            "message": f"DTC effacés pour {ecu_id}",
            "ecu": ecu_id
        })
    except Exception as e:
        return jsonify({"status": "ERROR", "msg": str(e)}), 500


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
