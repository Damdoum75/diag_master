
import udsoncan
from udsoncan.connections import PythonIsoTpConnection
import isotp
import can

class SimpleUDSHandler:
    """
    Handler UDS minimal pour envoyer des requêtes UDS sur le bus CAN via python-can/isotp/udsoncan.
    """
    def __init__(self, tx_id, rx_id, channel='can0', bitrate=500000):
        self.tx_id = tx_id
        self.rx_id = rx_id
        self.channel = channel
        self.bitrate = bitrate
        self._setup()

    def _setup(self):
        # Crée le bus CAN
        self.bus = can.interface.Bus(channel=self.channel, bustype='socketcan', bitrate=self.bitrate)
        # Crée la couche ISOTP
        self.stack = isotp.CanStack(
            bus=self.bus,
            address=isotp.Address(isotp.AddressingMode.Normal_11bits, txid=self.tx_id, rxid=self.rx_id),
            params={
                'tx_padding': 0x00,
                'rx_padding': 0x00,
                'tx_data_length': 8,
                'rx_data_length': 8,
                'stmin': 0,
            }
        )
        # Crée la connexion udsoncan
        self.conn = PythonIsoTpConnection(self.stack)
        self.session = udsoncan.client.Client(self.conn, request_timeout=0.5)

    def send(self, payload, timeout=0.5):
        # Envoie une requête UDS brute et retourne la réponse (ou None)
        try:
            with self.session as client:
                response = client.send_request(bytes(payload))
                if response.positive:
                    return bytes(response.data)
                else:
                    return None
        except Exception as e:
            print(f"Erreur UDS: {e}")
            return None
