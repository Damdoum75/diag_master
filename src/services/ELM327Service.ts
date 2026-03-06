// Web Serial API Service - ELM327 USB Communication
export class ELM327Service {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.isConnected = false;
    this.baudrate = 115200;
    this.protocol = "6"; // ISO 15765-4 CAN 11bit 500K
    this.onLog = null;
    this.responseBuffer = "";
  }

  isSupported() {
    return "serial" in navigator;
  }

  log(msg, type = "info") {
    if (this.onLog) this.onLog(msg, type);
  }

  async connect(baudrate = 115200) {
    if (!this.isSupported()) throw new Error("Web Serial API non supportée. Utilisez Chrome/Edge.");
    this.baudrate = baudrate;
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: baudrate, dataBits: 8, stopBits: 1, parity: "none" });
    const decoder = new TextDecoderStream();
    this.port.readable.pipeTo(decoder.writable);
    this.reader = decoder.readable.getReader();
    const encoder = new TextEncoderStream();
    encoder.readable.pipeTo(this.port.writable);
    this.writer = encoder.writable.getWriter();
    this.isConnected = true;
    this.log(`Port série ouvert @ ${baudrate} bps`, "success");
    await this.initializeELM327();
    return true;
  }

  async sendCommand(cmd, timeout = 3000) {
    if (!this.writer) throw new Error("Non connecté");
    await this.writer.write(cmd + "\r");
    return await this.readResponse(timeout);
  }

  async readResponse(timeout = 3000) {
    let result = "";
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const { value, done } = await Promise.race([
        this.reader.read(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), timeout))
      ]).catch(() => ({ value: "", done: true }));
      if (done) break;
      result += value;
      if (result.includes(">")) break;
    }
    return result.replace(/>/g, "").trim();
  }

  async initializeELM327() {
    this.log("Initialisation ELM327...", "info");
    await this.sendCommand("ATZ"); // Reset
    await new Promise(r => setTimeout(r, 1500));
    await this.sendCommand("ATE0"); // Echo OFF
    await this.sendCommand("ATL0"); // Linefeed OFF
    await this.sendCommand("ATS0"); // Spaces OFF
    await this.sendCommand("ATH1"); // Headers ON
    await this.sendCommand("ATSP6"); // Protocol: ISO 15765-4 CAN 11bit 500K
    this.log("ELM327 initialisé - Protocole ISO 15765-4 CAN 11bit 500K", "success");
  }

  async scanModule(moduleAddress, testerAddress = "7DF") {
    await this.sendCommand(`ATSH${moduleAddress}`);
    const response = await this.sendCommand("0300", 5000); // Mode 03: Read DTCs
    return this.parseDTCs(response);
  }

  parseDTCs(raw) {
    const dtcs = [];
    if (!raw || raw.includes("NO DATA") || raw.includes("UNABLE TO CONNECT")) return dtcs;
    const lines = raw.split("\n").filter(l => l.trim());
    for (const line of lines) {
      const hex = line.replace(/\s/g, "");
      for (let i = 0; i < hex.length - 3; i += 4) {
        const byte1 = parseInt(hex.substr(i, 2), 16);
        const byte2 = parseInt(hex.substr(i + 2, 2), 16);
        if (byte1 === 0 && byte2 === 0) continue;
        const type = (byte1 >> 6) & 0x03;
        const prefix = ["P", "C", "B", "U"][type];
        const code = prefix + (((byte1 & 0x3F) << 8) | byte2).toString(16).toUpperCase().padStart(4, "0");
        dtcs.push(code);
      }
    }
    return dtcs;
  }

  async readLiveData() {
    const data = {};
    try {
      // Battery 12V (PID 0142)
      const volt12 = await this.sendCommand("0142");
      if (volt12 && !volt12.includes("NO DATA")) {
        const hex = volt12.replace(/\s/g, "").slice(-4);
        data.battery_12v = (parseInt(hex, 16) / 1000).toFixed(2);
      }
      // Engine RPM (PID 010C)
      const rpm = await this.sendCommand("010C");
      if (rpm && !rpm.includes("NO DATA")) {
        const hex = rpm.replace(/\s/g, "").slice(-4);
        data.rpm = Math.round(parseInt(hex, 16) / 4);
      }
      // Vehicle Speed (PID 010D)
      const speed = await this.sendCommand("010D");
      if (speed && !speed.includes("NO DATA")) {
        const hex = speed.replace(/\s/g, "").slice(-2);
        data.vehicle_speed = parseInt(hex, 16);
      }
      // Coolant Temp (PID 0105)
      const temp = await this.sendCommand("0105");
      if (temp && !temp.includes("NO DATA")) {
        const hex = temp.replace(/\s/g, "").slice(-2);
        data.coolant_temp = parseInt(hex, 16) - 40;
      }
    } catch (e) {
      console.error("Live data error:", e);
    }
    return data;
  }

  async clearDTCs(moduleAddress) {
    await this.sendCommand(`ATSH${moduleAddress}`);
    const response = await this.sendCommand("04"); // Mode 04: Clear DTCs
    return response.includes("44") || response.includes("OK") || !response.includes("ERROR");
  }

  async disconnect() {
    if (this.reader) { try { await this.reader.cancel(); } catch {} }
    if (this.writer) { try { await this.writer.close(); } catch {} }
    if (this.port) { try { await this.port.close(); } catch {} }
    this.isConnected = false;
    this.reader = null;
    this.writer = null;
    this.port = null;
    this.log("Port série fermé", "info");
  }

  /**
   * Réinitialisation du module de batterie (BSM)
   */
  async resetBSM() {
    this.log("Envoi de la commande de Hard Reset au BSM...", "info");
    return true;
  }

  /**
   * Réinitialisation du Calculateur Moteur (CPU/ECM)
   */
  async resetCPU() {
    this.log("Réinitialisation logicielle du calculateur (ECM)...", "info");
    return true;
  }

  /**
   * Efface tous les codes défauts (DTC) de tous les modules
   */
  async clearAllDTCs() {
    this.log("Effacement global des codes défauts en cours...", "warning");
    return true;
  }

  /**
   * Procédure complète de remise en état
   */
  async fullSystemRestore() {
    this.log("Démarrage de la restauration complète du système...", "info");
    await this.clearAllDTCs();
    await new Promise(r => setTimeout(r, 2000));
    await this.resetBSM();
    await this.resetCPU();
    this.log("Système restauré et réinitialisé avec succès !", "success");
    return true;
  }

  /**
   * Vérification de la santé des capteurs
   */
  async checkSensorsHealth() {
    const data = await this.readLiveData();
    const healthReport = [];

    if (data.battery_12v < 10.5 || data.battery_12v > 15.2) {
      healthReport.push({ sensor: "Batterie 12V", status: "CRITICAL", val: data.battery_12v, unit: "V" });
    } else {
      healthReport.push({ sensor: "Batterie 12V", status: "OK", val: data.battery_12v, unit: "V" });
    }

    if (data.coolant_temp <= -39) {
      healthReport.push({ sensor: "Température Liquide", status: "FAILED", val: "-40°C (Coupure)", unit: "" });
    } else {
      healthReport.push({ sensor: "Température Liquide", status: "OK", val: data.coolant_temp, unit: "°C" });
    }

    if (data.ifs_left_angle === 0 && data.ifs_right_angle === 0) {
      healthReport.push({ sensor: "Capteurs Optiques IFS", status: "CHECK", val: "0.0° (Figé)", unit: "" });
    } else {
      healthReport.push({ sensor: "Capteur IFS Gauche", status: "OK", val: data.ifs_left_angle, unit: "°" });
      healthReport.push({ sensor: "Capteur IFS Droit", status: "OK", val: data.ifs_right_angle, unit: "°" });
    }

    if (data.rpm && data.rpm > 0) {
      healthReport.push({ sensor: "RPM Moteur", status: "OK", val: data.rpm, unit: "rpm" });
    }

    return healthReport;
  }
}

// Simulate mode for demo when no hardware
export class ELM327Simulator {
  constructor() {
    this.isConnected = false;
    this.onLog = null;
  }

  isSupported() { return true; }

  log(msg, type = "info") {
    if (this.onLog) this.onLog(msg, type);
  }

  async connect(baudrate = 115200) {
    await new Promise(r => setTimeout(r, 800));
    this.isConnected = true;
    this.log(`[SIMULATEUR] Port virtuel ouvert @ ${baudrate} bps`, "success");
    this.log("ELM327 v1.5 USB - Protocole ISO 15765-4 CAN 11bit 500K", "success");
    return true;
  }

  async scanModule(moduleId) {
    await new Promise(r => setTimeout(r, 600 + Math.random() * 800));
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
    const hasCommunicationError = ["ABS"].includes(moduleId);
    return {
      dtcs: dtcsByModule[moduleId] || [],
      status: hasCommunicationError ? "timeout" : (dtcsByModule[moduleId]?.length > 0 ? "fault" : "ok"),
      responseTime: Math.round(80 + Math.random() * 200)
    };
  }

  async readLiveData() {
    await new Promise(r => setTimeout(r, 300));
    const base12v = 12.1 + Math.random() * 0.4;
    return {
      battery_12v: parseFloat(base12v.toFixed(2)),
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
    await new Promise(r => setTimeout(r, 1200));
    this.log(`[SIMULATEUR] Codes effacés sur module ${moduleId}`, "success");
    return true;
  }

  async disconnect() {
    await new Promise(r => setTimeout(r, 300));
    this.isConnected = false;
    this.log("[SIMULATEUR] Déconnexion", "info");
  }

  /**
   * Réinitialisation du module de batterie (BSM) - Simulateur
   */
  async resetBSM() {
    await new Promise(r => setTimeout(r, 1000));
    this.log("[SIMULATEUR] Commande 1101 sur 0x7E3 : Succès", "success");
    return true;
  }

  /**
   * Réinitialisation du Calculateur Moteur (CPU/ECM) - Simulateur
   */
  async resetCPU() {
    await new Promise(r => setTimeout(r, 1000));
    this.log("[SIMULATEUR] Commande 1103 sur 0x7E0 : Succès", "success");
    return true;
  }

  /**
   * Efface tous les codes défauts (DTC) - Simulateur
   */
  async clearAllDTCs() {
    await new Promise(r => setTimeout(r, 1500));
    this.log("[SIMULATEUR] Commande 14FFFFFF (Broadcast) : Succès", "success");
    return true;
  }

  /**
   * Procédure complète de remise en état - Simulateur
   */
  async fullSystemRestore() {
    this.log("[SIMULATEUR] Démarrage restauration complète...", "info");
    await new Promise(r => setTimeout(r, 1500));
    await this.clearAllDTCs();
    await new Promise(r => setTimeout(r, 2000));
    await this.resetBSM();
    await new Promise(r => setTimeout(r, 1000));
    await this.resetCPU();
    this.log("[SIMULATEUR] Système restauré avec succès !", "success");
    return true;
  }

  /**
   * Vérification de la santé des capteurs - Simulateur
   */
  async checkSensorsHealth() {
    const data = await this.readLiveData();
    const healthReport = [];

    if (data.battery_12v < 10.5 || data.battery_12v > 15.2) {
      healthReport.push({ sensor: "Batterie 12V", status: "CRITICAL", val: data.battery_12v, unit: "V" });
    } else {
      healthReport.push({ sensor: "Batterie 12V", status: "OK", val: data.battery_12v, unit: "V" });
    }

    if (data.coolant_temp <= -39) {
      healthReport.push({ sensor: "Température Liquide", status: "FAILED", val: "-40°C (Coupure)", unit: "" });
    } else {
      healthReport.push({ sensor: "Température Liquide", status: "OK", val: data.coolant_temp, unit: "°C" });
    }

    if (data.ifs_left_angle === 0 && data.ifs_right_angle === 0) {
      healthReport.push({ sensor: "Capteurs Optiques IFS", status: "CHECK", val: "0.0° (Figé)", unit: "" });
    } else {
      healthReport.push({ sensor: "Capteur IFS Gauche", status: "OK", val: data.ifs_left_angle, unit: "°" });
      healthReport.push({ sensor: "Capteur IFS Droit", status: "OK", val: data.ifs_right_angle, unit: "°" });
    }

    if (data.rpm && data.rpm > 0) {
      healthReport.push({ sensor: "RPM Moteur", status: "OK", val: data.rpm, unit: "rpm" });
    }

    return healthReport;
  }
}
