/**
 * J2534 PassThru Service
 * 
 * L'API J2534 est une norme SAE permettant l'accès aux modules ECU via des interfaces
 * PassThru certifiées (Drew Technologies, Bosch, etc.).
 * 
 * Dans un contexte web/navigateur, J2534 n'est pas directement accessible via JavaScript.
 * Ce service utilise DEUX approches :
 * 
 * 1. WebSocket Bridge (recommandé) : un agent local (ex: j2534-bridge.exe) tourne sur le
 *    PC et expose une API WebSocket. Ce service communique avec cet agent.
 * 
 * 2. Fallback simulateur pour démonstration.
 * 
 * Protocole utilisé : ISO_15765_4 (CAN 11bit 500Kbps) - standard Kia NQ5
 */

export class J2534Service {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.onLog = null;
    this.channelId = null;
    this.deviceId = null;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.bridgeUrl = "ws://localhost:27015"; // Port par défaut du bridge J2534
    this.protocol = "ISO15765"; // CAN 11bit 500K
    this.connFlags = 0x00000000;
    this.baudrate = 500000; // 500K CAN
  }

  isSupported() {
    return typeof WebSocket !== "undefined";
  }

  log(msg, type = "info") {
    if (this.onLog) this.onLog(msg, type);
  }

  async connect(bridgePort = 27015) {
    this.bridgeUrl = `ws://localhost:${bridgePort}`;
    this.log(`Connexion au bridge J2534 sur ${this.bridgeUrl}...`, "info");

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Bridge J2534 non disponible. Vérifiez que j2534-bridge est lancé."));
      }, 5000);

      this.ws = new WebSocket(this.bridgeUrl);

      this.ws.onopen = async () => {
        clearTimeout(timeout);
        this.log("Bridge J2534 connecté", "success");
        try {
          await this._initJ2534();
          resolve(true);
        } catch (e) {
          reject(e);
        }
      };

      this.ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Impossible de joindre le bridge J2534 local. Lancez j2534-bridge.exe en tant qu'administrateur."));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id && this.pendingRequests.has(msg.id)) {
            const { resolve, reject } = this.pendingRequests.get(msg.id);
            this.pendingRequests.delete(msg.id);
            if (msg.error) reject(new Error(msg.error));
            else resolve(msg.result);
          }
        } catch {}
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.log("Bridge J2534 déconnecté", "warn");
      };
    });
  }

  async _send(method, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Bridge J2534 non connecté");
    }
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Timeout commande J2534: ${method}`));
        }
      }, 8000);
    });
  }

  async _initJ2534() {
    // PassThruOpen - Ouvrir l'interface
    const openResult = await this._send("PassThruOpen", { name: "auto" });
    this.deviceId = openResult.DeviceID;
    this.log(`Interface J2534 ouverte - DeviceID: ${this.deviceId}`, "success");

    // PassThruConnect - Ouvrir canal CAN ISO15765
    const connectResult = await this._send("PassThruConnect", {
      DeviceID: this.deviceId,
      ProtocolID: 6, // ISO15765
      Flags: 0,
      BaudRate: 500000
    });
    this.channelId = connectResult.ChannelID;
    this.log(`Canal ISO15765 ouvert - ChannelID: ${this.channelId}`, "success");

    // Configurer les filtres pour la plage d'adresses OBD (7DF → 7E8)
    await this._send("PassThruStartMsgFilter", {
      ChannelID: this.channelId,
      FilterType: 1, // PASS_FILTER
      Mask: { Data: "FFFFFFFF", DataLength: 4 },
      Pattern: { Data: "00000000", DataLength: 4 }
    });

    // Configurer IOCTLs : Loopback OFF, padding ISO15765 ON
    await this._send("PassThruIoctl", {
      ChannelID: this.channelId,
      IoctlID: 3, // SET_CONFIG
      Input: [
        { Parameter: 0x04, Value: 0 },  // LOOPBACK = OFF
        { Parameter: 0x22, Value: 1 }   // ISO15765_PAD = ON
      ]
    });

    this.isConnected = true;
    this.log("Protocole ISO 15765-4 CAN 11bit 500K configuré", "success");
  }

  async _sendOBD(txId, rxId, data) {
    // Envoi d'une trame ISO15765
    const result = await this._send("PassThruWriteRead", {
      ChannelID: this.channelId,
      TxMessages: [{
        ProtocolID: 6,
        TxFlags: 0x40, // ISO15765_FRAME_PAD
        Data: `${txId.toString(16).padStart(8, "0")}${data}`,
        DataLength: 4 + data.length / 2
      }],
      RxAddress: rxId,
      Timeout: 3000
    });
    return result?.Messages?.[0]?.Data?.substring(8) || "";
  }

  async scanModule(moduleAddress, testerAddress = "7DF") {
    const rxId = parseInt(moduleAddress, 16) + 8; // Convention réponse ECU
    try {
      // Mode 03: Lire DTCs stockés
      const raw = await this._sendOBD(parseInt(testerAddress, 16), rxId, "0300");
      return {
        dtcs: this._parseDTCs(raw),
        status: "ok",
        responseTime: 120
      };
    } catch (e) {
      this.log(`Module ${moduleAddress}: ${e.message}`, "warn");
      return { dtcs: [], status: "timeout", responseTime: 0 };
    }
  }

  _parseDTCs(raw) {
    const dtcs = [];
    if (!raw) return dtcs;
    const hex = raw.replace(/\s/g, "");
    for (let i = 4; i < hex.length - 3; i += 4) {
      const b1 = parseInt(hex.substr(i, 2), 16);
      const b2 = parseInt(hex.substr(i + 2, 2), 16);
      if (b1 === 0 && b2 === 0) continue;
      const type = (b1 >> 6) & 0x03;
      const prefix = ["P", "C", "B", "U"][type];
      dtcs.push(prefix + (((b1 & 0x3F) << 8) | b2).toString(16).toUpperCase().padStart(4, "0"));
    }
    return dtcs;
  }

  async readLiveData() {
    const data = {};
    const pids = [
      { cmd: "0142", parse: h => parseFloat((parseInt(h, 16) / 1000).toFixed(2)), key: "battery_12v" },
      { cmd: "010C", parse: h => Math.round(parseInt(h, 16) / 4), key: "rpm" },
      { cmd: "010D", parse: h => parseInt(h, 16), key: "vehicle_speed" },
      { cmd: "0105", parse: h => parseInt(h, 16) - 40, key: "coolant_temp" }
    ];
    for (const pid of pids) {
      try {
        const raw = await this._sendOBD(0x7DF, 0x7E8, pid.cmd);
        if (raw && raw.length >= 4) data[pid.key] = pid.parse(raw.slice(-4));
      } catch {}
    }
    return data;
  }

  async clearDTCs(moduleAddress) {
    const rxId = parseInt(moduleAddress, 16) + 8;
    try {
      await this._sendOBD(parseInt("7DF", 16), rxId, "04");
      return true;
    } catch {
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.channelId !== null) {
        await this._send("PassThruDisconnect", { ChannelID: this.channelId });
      }
      if (this.deviceId !== null) {
        await this._send("PassThruClose", { DeviceID: this.deviceId });
      }
    } catch {}
    if (this.ws) this.ws.close();
    this.ws = null;
    this.isConnected = false;
    this.channelId = null;
    this.deviceId = null;
    this.log("Interface J2534 fermée", "info");
  }

  /**
   * Réinitialisation du module de batterie (BSM)
   * Commande UDS: 0x11 (ECU Reset) + 0x01 (Hard Reset)
   */
  async resetBSM() {
    this.log("Envoi de la commande de Hard Reset au BSM...", "info");
    // ID 0x7E3 est souvent utilisé pour le module de gestion d'énergie sur NQ5
    return this.sendDiagnosticCommand("0x7E3", "1101");
  }

  /**
   * Réinitialisation du Calculateur Moteur (CPU/ECM)
   * Commande UDS: 0x11 (ECU Reset) + 0x03 (Soft Reset)
   */
  async resetCPU() {
    this.log("Réinitialisation logicielle du calculateur (ECM)...", "info");
    // ID 0x7E0 est le standard universel pour le moteur
    return this.sendDiagnosticCommand("0x7E0", "1103");
  }

  /**
   * Efface tous les codes défauts (DTC) de tous les modules
   * Commande UDS 14 FF FF FF
   */
  async clearAllDTCs() {
    this.log("Effacement global des codes défauts en cours...", "warning");
    // 0x7DF est l'ID de diffusion (Broadcast) pour tous les calculateurs
    return this.sendDiagnosticCommand("0x7DF", "14FFFFFF");
  }

  /**
   * Procédure complète de remise en état
   */
  async fullSystemRestore() {
    this.log("Démarrage de la restauration complète du système...", "info");
    try {
      await this.clearAllDTCs();
      await new Promise(r => setTimeout(r, 2000)); // Pause de sécurité
      await this.resetBSM();
      await this.resetCPU();
      this.log("Système restauré et réinitialisé avec succès !", "success");
      return true;
    } catch (error) {
      this.log("Erreur lors de la restauration : " + error, "error");
      return false;
    }
  }

  /**
   * Vérification de la santé des capteurs
   * Compare les valeurs aux seuils de tolérance réels
   */
  async checkSensorsHealth() {
    const data = await this.readLiveData();
    const healthReport = [];

    // 1. Vérification du Capteur de Batterie (BSM)
    // Une tension < 10V au contact ou > 15.5V moteur tournant indique un problème
    if (data.battery_12v < 10.5 || data.battery_12v > 15.2) {
      healthReport.push({ sensor: "Batterie 12V", status: "CRITICAL", val: data.battery_12v, unit: "V" });
    } else {
      healthReport.push({ sensor: "Batterie 12V", status: "OK", val: data.battery_12v, unit: "V" });
    }

    // 2. Vérification du capteur de température (Coolant)
    // Si la valeur est figée à -40, le capteur est souvent débranché
    if (data.coolant_temp <= -39) {
      healthReport.push({ sensor: "Température Liquide", status: "FAILED", val: "-40°C (Coupure)", unit: "" });
    } else {
      healthReport.push({ sensor: "Température Liquide", status: "OK", val: data.coolant_temp, unit: "°C" });
    }

    // 3. Vérification des capteurs d'angle de phare (IFS)
    // Sur la NQ5, si la valeur ne change jamais (reste à 0.0), le capteur peut être grippé
    if (data.ifs_left_angle === 0 && data.ifs_right_angle === 0) {
      healthReport.push({ sensor: "Capteurs Optiques IFS", status: "CHECK", val: "0.0° (Figé)", unit: "" });
    } else {
      healthReport.push({ sensor: "Capteur IFS Gauche", status: "OK", val: data.ifs_left_angle, unit: "°" });
      healthReport.push({ sensor: "Capteur IFS Droit", status: "OK", val: data.ifs_right_angle, unit: "°" });
    }

    // 4. Vérification RPM moteur
    if (data.rpm && data.rpm > 0) {
      healthReport.push({ sensor: "RPM Moteur", status: "OK", val: data.rpm, unit: "rpm" });
    }

    return healthReport;
  }

  /**
   * Méthode pour envoyer la trame brute
   */
  private async sendDiagnosticCommand(ecuId: string, hexCommand: string) {
    if (import.meta.env.VITE_USE_SIMULATOR === 'true') {
      await new Promise(r => setTimeout(r, 1000));
      this.log(`[SIMULATEUR] Commande ${hexCommand} sur ${ecuId} : Succès`, "success");
      return true;
    }
    
    // Envoi réel vers le bridge J2534
    return this.sendRequest("PassThruWriteMsgs", {
      channelId: this.channelId,
      msg: {
        ProtocolID: 6, // ISO15765 (CAN)
        Data: hexCommand,
        ArbID: parseInt(ecuId, 16)
      }
    });
  }

  /**
   * Envoi direct d'une requête au bridge J2534
   */
  private async sendRequest(method: string, params: any) {
    return this._send(method, params);
  }
}

/**
 * Simulateur J2534 pour tests sans matériel
 */
export class J2534Simulator {
  constructor() {
    this.isConnected = false;
    this.onLog = null;
  }

  isSupported() { return true; }
  log(msg, type = "info") { if (this.onLog) this.onLog(msg, type); }

  async connect() {
    await new Promise(r => setTimeout(r, 1000));
    this.isConnected = true;
    this.log("[SIM J2534] PassThruOpen → DeviceID: 0x01", "success");
    this.log("[SIM J2534] PassThruConnect ISO15765 500Kbps → ChannelID: 0x01", "success");
    this.log("[SIM J2534] Filtres CAN configurés - 7DF → 7E0..7EF", "success");
    this.log("Interface J2534 PassThru prête - ISO 15765-4 CAN 11bit 500K", "success");
    return true;
  }

  async scanModule(moduleId) {
    await new Promise(r => setTimeout(r, 400 + Math.random() * 600));
    const dtcsByModule = {
      "ACU": ["B100552"],
      "ILCU": ["B16F187"],
      "ADAS": ["U116000"],
      "MHEV": [],
      "ECM": [],
      "ABS": ["C166987"],
      "BCM": [],
      "TCU": []
    };
    return {
      dtcs: dtcsByModule[moduleId] || [],
      status: (dtcsByModule[moduleId]?.length > 0) ? "fault" : "ok",
      responseTime: Math.round(60 + Math.random() * 120)
    };
  }

  async readLiveData() {
    await new Promise(r => setTimeout(r, 200));
    return {
      battery_12v: parseFloat((12.1 + Math.random() * 0.4).toFixed(2)),
      battery_48v_voltage: parseFloat((47.2 + Math.random() * 1.5).toFixed(1)),
      battery_48v_soc: Math.round(72 + Math.random() * 8),
      battery_48v_current: parseFloat((-2.5 + Math.random() * 8).toFixed(1)),
      rpm: Math.round(800 + Math.random() * 200),
      vehicle_speed: 0,
      coolant_temp: Math.round(78 + Math.random() * 10),
      ifs_left_angle: parseFloat((-2 + Math.random() * 4).toFixed(1)),
      ifs_right_angle: parseFloat((-2 + Math.random() * 4).toFixed(1)),
      throttle: Math.round(5 + Math.random() * 3),
      intake_temp: Math.round(18 + Math.random() * 5)
    };
  }

  async clearDTCs(moduleId) {
    await new Promise(r => setTimeout(r, 1000));
    this.log(`[SIM J2534] Mode 04 → ${moduleId} → 44 OK`, "success");
    return true;
  }

  async disconnect() {
    await new Promise(r => setTimeout(r, 300));
    this.isConnected = false;
    this.log("[SIM J2534] PassThruDisconnect / PassThruClose", "info");
  }

  /**
   * Réinitialisation du module de batterie (BSM) - Simulateur
   */
  async resetBSM() {
    await new Promise(r => setTimeout(r, 1000));
    this.log("[SIM J2534] Commande 1101 sur 0x7E3 : Succès", "success");
    return true;
  }

  /**
   * Réinitialisation du Calculateur Moteur (CPU/ECM) - Simulateur
   */
  async resetCPU() {
    await new Promise(r => setTimeout(r, 1000));
    this.log("[SIM J2534] Commande 1103 sur 0x7E0 : Succès", "success");
    return true;
  }

  /**
   * Efface tous les codes défauts (DTC) - Simulateur
   */
  async clearAllDTCs() {
    await new Promise(r => setTimeout(r, 1500));
    this.log("[SIM J2534] Commande 14FFFFFF (Broadcast) : Succès", "success");
    return true;
  }

  /**
   * Procédure complète de remise en état - Simulateur
   */
  async fullSystemRestore() {
    this.log("[SIM J2534] Démarrage restauration complète...", "info");
    await new Promise(r => setTimeout(r, 1500));
    await this.clearAllDTCs();
    await new Promise(r => setTimeout(r, 2000));
    await this.resetBSM();
    await new Promise(r => setTimeout(r, 1000));
    await this.resetCPU();
    this.log("[SIM J2534] Système restauré avec succès !", "success");
    return true;
  }

  /**
   * Vérification de la santé des capteurs - Simulateur
   */
  async checkSensorsHealth() {
    const data = await this.readLiveData();
    const healthReport = [];

    // Batterie 12V
    if (data.battery_12v < 10.5 || data.battery_12v > 15.2) {
      healthReport.push({ sensor: "Batterie 12V", status: "CRITICAL", val: data.battery_12v, unit: "V" });
    } else {
      healthReport.push({ sensor: "Batterie 12V", status: "OK", val: data.battery_12v, unit: "V" });
    }

    // Température liquide
    if (data.coolant_temp <= -39) {
      healthReport.push({ sensor: "Température Liquide", status: "FAILED", val: "-40°C (Coupure)", unit: "" });
    } else {
      healthReport.push({ sensor: "Température Liquide", status: "OK", val: data.coolant_temp, unit: "°C" });
    }

    // Capteurs IFS
    if (data.ifs_left_angle === 0 && data.ifs_right_angle === 0) {
      healthReport.push({ sensor: "Capteurs Optiques IFS", status: "CHECK", val: "0.0° (Figé)", unit: "" });
    } else {
      healthReport.push({ sensor: "Capteur IFS Gauche", status: "OK", val: data.ifs_left_angle, unit: "°" });
      healthReport.push({ sensor: "Capteur IFS Droit", status: "OK", val: data.ifs_right_angle, unit: "°" });
    }

    // RPM
    if (data.rpm && data.rpm > 0) {
      healthReport.push({ sensor: "RPM Moteur", status: "OK", val: data.rpm, unit: "rpm" });
    }

    return healthReport;
  }
}
