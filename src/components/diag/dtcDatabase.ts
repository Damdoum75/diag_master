// DTC Knowledge Base - Kia Sportage NQ5 2022 MHEV
export const DTC_DATABASE = {
  // ---- ACU / AIRBAG ----
  "B100552": {
    code: "B100552",
    module: "ACU",
    moduleName: "Airbag Control Unit",
    title: "Défaut Capteur Crash Front-Left",
    description: "Signal invalide ou absent du capteur de choc avant gauche. Ce défaut peut désactiver l'ensemble du système ADAS par protocole de sécurité CAN.",
    severity: "critical",
    causes: [
      "Connecteur J10 du capteur démonté ou oxydé",
      "Câble sectionné sous le passage de roue AV gauche",
      "Capteur lui-même défaillant (impact non détecté)"
    ],
    impacts: [
      "Désactivation du SRS (Supplemental Restraint System)",
      "Inhibition des systèmes ADAS (FCW, AEB, LKA) par réseau CAN",
      "Témoin SRS allumé en permanence"
    ],
    solution: "Inspecter connecteur J10 et faisceau. Mesurer résistance capteur (spec: 4.5-5.5 kΩ). Réinitialiser après remplacement.",
    canLink: "U116000",
    color: "#EF4444"
  },
  "B16F187": {
    code: "B16F187",
    module: "ILCU",
    moduleName: "Intelligent Lighting Control Unit",
    title: "Défaut Moteur Actuateur Phare IFS Gauche",
    description: "L'actuateur du phare adaptatif gauche ne répond pas aux commandes de rotation. Peut être lié à une sous-tension 12V (C110216).",
    severity: "high",
    causes: [
      "Tension d'alimentation 12V < 11.5V (batterie faible)",
      "Moteur actuateur bloqué (humidité / corrosion)",
      "Perte de masse sur connecteur ILCU"
    ],
    impacts: [
      "Phare gauche figé en position droite",
      "Non-conformité au contrôle technique",
      "Réduction de visibilité en virage"
    ],
    solution: "Vérifier tension 12V (min 12.4V moteur arrêté). Inspecter actuateur optique gauche. Tester signal PWM ILCU.",
    canLink: "C110216",
    color: "#F59E0B"
  },
  "C110216": {
    code: "C110216",
    module: "ESC",
    moduleName: "Electronic Stability Control",
    title: "Tension Batterie 12V Hors Plage",
    description: "La tension de la batterie principale 12V est hors plage de fonctionnement nominal (11.5V - 14.5V). Affecte de nombreux calculateurs.",
    severity: "high",
    causes: [
      "Batterie 12V dégradée ou déchargée",
      "Alternateur / DC-DC converter MHEV défaillant",
      "Consommateur parasite actif"
    ],
    impacts: [
      "Défauts en cascade sur ILCU (B16F187)",
      "Comportement erratique de l'ESP",
      "Risque de non-démarrage"
    ],
    solution: "Mesurer tension en Live Data. Tester batterie (CCA). Vérifier DC-DC converter du pack 48V.",
    canLink: "B16F187",
    color: "#F59E0B"
  },
  "U116000": {
    code: "U116000",
    module: "ADAS",
    moduleName: "Advanced Driver Assistance Systems",
    title: "Perte de Communication Module ACU",
    description: "Le module ADAS ne reçoit plus les trames CAN de l'Airbag Control Unit. Les systèmes d'aide à la conduite sont automatiquement inhibés.",
    severity: "critical",
    causes: [
      "Défaut B100552 sur l'ACU générant un silence CAN",
      "Bus CAN HS endommagé (court-circuit CAN-H/CAN-L)",
      "ACU en mode veille forcée après choc"
    ],
    impacts: [
      "AEB (Freinage Autonome d'Urgence) désactivé",
      "FCW (Avertissement Collision Frontale) désactivé",
      "LKA (Maintien de Voie) désactivé",
      "Témoin ADAS orange sur tableau de bord"
    ],
    solution: "Résoudre B100552 en priorité. Vérifier continuité CAN-H/CAN-L entre ACU et Gateway. Mesurer résistance terminale (spec: 60Ω).",
    canLink: "B100552",
    color: "#EF4444"
  },
  "C166987": {
    code: "C166987",
    module: "ABS",
    moduleName: "Anti-lock Braking System",
    title: "Timeout Communication CAN - Module ABS",
    description: "Dépassement du délai de réponse du module ABS sur le bus CAN. Souvent lié à un baudrate ELM327 incorrect ou à une vraie perte CAN.",
    severity: "medium",
    causes: [
      "Baudrate ELM327 mal configuré (38400 vs 115200)",
      "Protocole CAN incorrect (29bit vs 11bit)",
      "Masse ABS oxydée",
      "CAN-Bus chargé (trop de trames)"
    ],
    impacts: [
      "Fausse lecture de diagnostic (timeout outil)",
      "ABS potentiellement non fonctionnel",
      "ESP dégradé"
    ],
    solution: "Reconfigurer ELM327: baudrate 115200, protocole ISO 15765-4 11bit 500K. Si erreur persiste: inspecter module ABS.",
    canLink: null,
    color: "#3B82F6"
  },
  "U140187": {
    code: "U140187",
    module: "ECM",
    moduleName: "Engine Control Module",
    title: "Perte Communication Gateway CAN",
    description: "Le module moteur a perdu le contact avec le Gateway central. Interruption du flux de données entre les réseaux CAN.",
    severity: "high",
    causes: [
      "Gateway défaillant",
      "Coupure sur le CAN central",
      "Faux contact connecteur Gateway (J150)"
    ],
    impacts: [
      "Multiples défauts de communication en cascade",
      "Mode dégradé moteur possible"
    ],
    solution: "Localiser le Gateway (sous tableau de bord). Vérifier alimentation et masse. Tester résistance de terminaison CAN.",
    canLink: null,
    color: "#8B5CF6"
  }
};

export const MODULE_LIST = [
  { id: "ACU", name: "Airbag Control Unit", address: "0x7B0", icon: "Shield", color: "#EF4444", description: "Gestion SRS & capteurs crash" },
  { id: "ILCU", name: "Intelligent Lighting Control", address: "0x77D", icon: "Lightbulb", color: "#F59E0B", description: "Phares adaptatifs IFS" },
  { id: "ADAS", name: "Driver Assistance Systems", address: "0x7C6", icon: "Eye", color: "#8B5CF6", description: "Caméra / Radar FCW-AEB-LKA" },
  { id: "MHEV", name: "Mild Hybrid System (48V)", address: "0x7E4", icon: "Zap", color: "#22C55E", description: "Pack 48V & DC-DC Converter" },
  { id: "ECM", name: "Engine Control Module", address: "0x7E0", icon: "Settings", color: "#3B82F6", description: "Gestion moteur & injection" },
  { id: "ABS", name: "Anti-lock Braking System", address: "0x760", icon: "CircleOff", color: "#06B6D4", description: "Freinage ABS / ESP / ESC" },
  { id: "BCM", name: "Body Control Module", address: "0x776", icon: "Car", color: "#EC4899", description: "Confort, verrouillage, éclairage" },
  { id: "TCU", name: "Transmission Control Unit", address: "0x7E1", icon: "GitBranch", color: "#A78BFA", description: "Boîte DCT automatique" },
];

export const KNOWN_ISSUES_NQ5 = [
  {
    title: "Cascade ACU → ADAS",
    description: "Le défaut B100552 sur l'ACU provoque systématiquement U116000 sur l'ADAS, désactivant tous les systèmes d'aide à la conduite. TOUJOURS résoudre l'ACU en premier.",
    modules: ["ACU", "ADAS"],
    codes: ["B100552", "U116000"],
    priority: 1
  },
  {
    title: "Sous-tension 12V → Phares IFS",
    description: "C110216 (batterie 12V faible) génère B16F187 sur les phares adaptatifs. Vérifier la tension avant de démonter l'actuateur.",
    modules: ["ESC", "ILCU"],
    codes: ["C110216", "B16F187"],
    priority: 2
  },
  {
    title: "Timeout ELM327 → C166987",
    description: "C166987 peut être un faux défaut causé par un mauvais baudrate ELM327. Forcer 115200 bps + ISO 15765-4 11bit 500K.",
    modules: ["ABS"],
    codes: ["C166987"],
    priority: 3
  }
];
