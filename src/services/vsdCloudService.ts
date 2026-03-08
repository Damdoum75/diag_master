/**
 * VSD Cloud Service - Global Diagnostic Data Network
 * 
 * This service enables searching and sharing Vehicle Service Data (VSD)
 * across a global network of diagnostic technicians.
 * 
 * Architecture:
 * - VIN Prefix Search: Uses first 9 characters (WMI + Model + Engine)
 * - Community Sources: Configurable API endpoints for shared data
 * - Anonymous Sharing: VIN is partially redacted before sharing
 */

export interface VSDRecord {
  vin: string;
  vinPrefix: string;
  model: string;
  year: number;
  engine: string;
  dtcs: string[];
  liveData?: Record<string, any>;
  solutions?: string[];
  contributor: string;
  timestamp: number;
  source: string;
}

export interface VSDSearchResult {
  found: boolean;
  data?: VSDRecord;
  source: string;
  timestamp: number;
}

export interface CloudSource {
  name: string;
  url: string;
  enabled: boolean;
  timeout: number;
}

// Server URL - using port 5000
const SERVER_URL = "http://localhost:5000";

// Default community sources (configurable via environment)
const DEFAULT_SOURCES: CloudSource[] = [
  {
    name: "Local Collector",
    url: `${SERVER_URL}/api/vsd/search`,
    enabled: true,
    timeout: 5000
  },
  {
    name: "Diag Community API",
    url: "https://api.diag-community.io/vsd/search",
    enabled: false,
    timeout: 3000
  },
  {
    name: "Open Diag DB",
    url: "https://raw.githubusercontent.com/open-diag-db/kia-vsd/main",
    enabled: false,
    timeout: 3000
  }
];

// Cache for VSD results (session-based)
const VSD_CACHE_KEY = "diag_master_vsd_cache";
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

class VSDCloudService {
  private sources: CloudSource[];
  private cache: Map<string, { data: VSDSearchResult; timestamp: number }>;
  private sharingEnabled: boolean;

  constructor() {
    this.sources = DEFAULT_SOURCES;
    this.cache = new Map();
    this.sharingEnabled = false;
    this.loadCache();
  }

  /**
   * Load cache from sessionStorage
   */
  private loadCache(): void {
    try {
      const cached = sessionStorage.getItem(VSD_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        this.cache = new Map(Object.entries(parsed));
      }
    } catch (e) {
      console.warn("Failed to load VSD cache:", e);
    }
  }

  /**
   * Save cache to sessionStorage
   */
  private saveCache(): void {
    try {
      const obj = Object.fromEntries(this.cache);
      sessionStorage.setItem(VSD_CACHE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn("Failed to save VSD cache:", e);
    }
  }

  /**
   * Get VIN prefix (first 9 characters)
   * Example: U5YPV81BA (Model: U5Y, Engine: PV, etc.)
   */
  getVinPrefix(vin: string): string {
    return vin.substring(0, 9).toUpperCase();
  }

  /**
   * Anonymize VIN for sharing (remove last 6 characters)
   */
  anonymizeVin(vin: string): string {
    return vin.substring(0, 11).toUpperCase() + "XXXXXX";
  }

  /**
   * Enable/disable anonymous sharing
   */
  setSharingEnabled(enabled: boolean): void {
    this.sharingEnabled = enabled;
  }

  isSharingEnabled(): boolean {
    return this.sharingEnabled;
  }

  /**
   * Update sources configuration
   */
  setSources(sources: CloudSource[]): void {
    this.sources = sources;
  }

  getSources(): CloudSource[] {
    return this.sources;
  }

  /**
   * Search for VSD data across all enabled sources
   */
  async searchGlobalVSD(vin: string): Promise<VSDSearchResult | null> {
    const vinPrefix = this.getVinPrefix(vin);
    
    console.log(`🌐 Recherche globale pour la signature : ${vinPrefix}...`);

    // Check cache first
    const cached = this.cache.get(vinPrefix);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log("📦 VSD trouvé en cache local");
      return cached.data;
    }

    // Search through all enabled sources
    for (const source of this.sources) {
      if (!source.enabled) continue;

      try {
        const result = await this.fetchFromSource(source, vinPrefix);
        if (result.found && result.data) {
          // Cache the result
          this.cache.set(vinPrefix, { data: result, timestamp: Date.now() });
          this.saveCache();
          
          console.log(`✅ VSD trouvé via ${source.name}!`);
          return result;
        }
      } catch (e) {
        console.warn(`⚠️ Source ${source.name} indisponible:`, e);
      }
    }

    console.log("❌ Aucune donnée VSD trouvée dans le réseau mondial");
    return null;
  }

  /**
   * Fetch from a single source
   */
  private async fetchFromSource(source: CloudSource, vinPrefix: string): Promise<VSDSearchResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), source.timeout);

    try {
      // Construct URL based on source type
      let url = source.url;
      
      // For GitHub raw URLs, construct the direct file URL
      if (url.includes("github.com") || url.includes("raw.githubusercontent.com")) {
        url = `${source.url}/models/${vinPrefix}.json`;
      } else {
        // For API endpoints, use query parameter
        url = `${source.url}?vin=${vinPrefix}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { found: false, source: source.name, timestamp: Date.now() };
      }

      const data = await response.json();
      
      // Check if the response indicates data was found
      if (data.found && data.data) {
        return {
          found: true,
          data: {
            ...data.data,
            vinPrefix: vinPrefix,
            source: source.name,
            timestamp: Date.now()
          },
          source: source.name,
          timestamp: Date.now()
        };
      }
      
      return { found: false, source: source.name, timestamp: Date.now() };
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  /**
   * Share VSD data anonymously to the network
   */
  async shareVsdAnonymously(vsdData: any): Promise<boolean> {
    if (!this.sharingEnabled) {
      console.log("ℹ️ Partage désactivé par l'utilisateur");
      return false;
    }

    try {
      // Anonymize VIN
      const anonymousData = {
        ...vsdData,
        vin: this.anonymizeVin(vsdData.vin || ""),
        contributor: "DiagMaster_User_Node",
        sharedAt: Date.now()
      };

      // Send to collector server (port 5000)
      const collectorUrl = `${SERVER_URL}/api/vsd/collect`;
      
      const response = await fetch(collectorUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(anonymousData)
      });

      if (response.ok) {
        console.log("✅ Données VSD partagées anonymement");
        return true;
      }

      return false;
    } catch (e) {
      console.warn("⚠️ Échec du partage VSD:", e);
      return false;
    }
  }

  /**
   * Get all cached VSD records
   */
  getCachedRecords(): VSDSearchResult[] {
    return Array.from(this.cache.values()).map(c => c.data);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    sessionStorage.removeItem(VSD_CACHE_KEY);
    console.log("🗑️ Cache VSD effacé");
  }
}

// Export singleton instance
export const vsdCloudService = new VSDCloudService();

// Export class for testing or custom instances
export { VSDCloudService };

