import json
import time
# from udsoncan import ...  # à activer quand tu as l’interface

class KiaNQ5Discoverer:
    """Outil pour découvrir les adresses ECUs et DIDs sur Kia NQ5"""
    def __init__(self, uds_handler_factory):
        self.uds_handler_factory = uds_handler_factory

    def scan_ecu_addresses(self, can_id_range=(0x700, 0x7FF)):
        """Scan le bus CAN pour trouver les ECUs répondant à UDS"""
        found_ecus = []
        for tx_id in range(can_id_range[0], can_id_range[1] + 1):
            rx_id = tx_id + 8
            handler = self.uds_handler_factory(tx_id, rx_id)
            try:
                response = handler.send([0x10, 0x01], timeout=0.1)
                if response and response[0] == 0x50:
                    print(f"ECU trouvé: TX=0x{tx_id:X}, RX=0x{rx_id:X}")
                    found_ecus.append({'tx': tx_id, 'rx': rx_id, 'response': response})
            except Exception:
                pass
        return found_ecus

    def brute_force_dids(self, ecu_address, did_range=(0xF000, 0xF1FF)):
        """Teste une plage de DIDs sur un ECU spécifique"""
        valid_dids = []
        handler = self.uds_handler_factory(ecu_address['tx'], ecu_address['rx'])
        for did in range(did_range[0], did_range[1] + 1):
            try:
                response = handler.send([0x22, (did >> 8) & 0xFF, did & 0xFF], timeout=0.1)
                if response and response[0] == 0x62:
                    print(f"DID 0x{did:04X} valide: {response.hex()}")
                    valid_dids.append({'did': did, 'data': response[2:], 'length': len(response) - 2})
            except Exception:
                pass
        return valid_dids

if __name__ == "__main__":
    # À adapter selon ton implémentation UDS
    from simple_uds_handler import SimpleUDSHandler
    def uds_handler_factory(tx, rx):
        # Adapter le channel et le bitrate à ton interface CAN
        return SimpleUDSHandler(tx, rx, channel='can0', bitrate=500000)

    discoverer = KiaNQ5Discoverer(uds_handler_factory)
    ecus = discoverer.scan_ecu_addresses()
    with open("found_ecus.json", "w") as f:
        json.dump(ecus, f, indent=2)

    # Pour chaque ECU trouvé, brute-force les DIDs
    for ecu in ecus:
        dids = discoverer.brute_force_dids({'tx': ecu['tx'], 'rx': ecu['rx']})
        with open(f"dids_{ecu['tx']:03X}.json", "w") as f:
            json.dump(dids, f, indent=2)
