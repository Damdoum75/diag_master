/**
 * AutoWizard Service - Expert Diagnostic Advice
 * 
 * This service provides access to AutoWizard's expert diagnostic database
 * for analyzing DTC codes detected via ELM327/J2534 interfaces.
 * 
 * Architecture:
 * - Calls kia_agent.py backend (/api/expert/{dtc})
 * - kia_agent.py forwards to AutoWizardAPI (port 8080)
 * - Returns definition, suggested_fix, severity, possible_causes
 */

export interface ExpertAdvice {
  code: string;
  definition: string;
  suggested_fix: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  possible_causes?: string[];
  solutions?: string[];
}

export interface AutoWizardStatus {
  available: boolean;
  apiUrl: string;
  lastCheck: number;
}

// Configuration
const AUTO_WIZARD_API_URL = 'http://localhost:5000/api/expert';
const CACHE_DURATION = 1000 * 60 * 15; // 15 minutes cache

// Cache for expert advice
const adviceCache: Map<string, { data: ExpertAdvice; timestamp: number }> = new Map();

/**
 * Check if AutoWizard service is available
 */
export async function checkAutoWizardStatus(): Promise<AutoWizardStatus> {
  try {
    const response = await fetch('http://localhost:5000/health', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    return {
      available: response.ok,
      apiUrl: AUTO_WIZARD_API_URL,
      lastCheck: Date.now()
    };
  } catch (error) {
    return {
      available: false,
      apiUrl: AUTO_WIZARD_API_URL,
      lastCheck: Date.now()
    };
  }
}

/**
 * Get expert advice for a specific DTC code
 * Uses caching to avoid repeated API calls
 */
export async function getExpertAdvice(dtc: string): Promise<ExpertAdvice | null> {
  const normalizedDtc = dtc.toUpperCase().trim();
  
  // Check cache first
  const cached = adviceCache.get(normalizedDtc);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`📦 AutoWizard advice found in cache for: ${normalizedDtc}`);
    return cached.data;
  }
  
  try {
    console.log(`🔍 Requesting AutoWizard expert advice for: ${normalizedDtc}`);
    
    const response = await fetch(`${AUTO_WIZARD_API_URL}/${normalizedDtc}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (!response.ok) {
      console.warn(`⚠️ AutoWizard returned status: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    // Cache the result
    adviceCache.set(normalizedDtc, { data, timestamp: Date.now() });
    
    console.log(`✅ AutoWizard advice received for: ${normalizedDtc}`);
    return data;
    
  } catch (error) {
    console.error(`❌ Error fetching AutoWizard advice for ${normalizedDtc}:`, error);
    return null;
  }
}

/**
 * Get expert advice for multiple DTC codes
 */
export async function getMultipleExpertAdvice(dtcs: string[]): Promise<Map<string, ExpertAdvice | null>> {
  const results = new Map<string, ExpertAdvice | null>();
  
  // Process in parallel with limit
  const batchSize = 3;
  for (let i = 0; i < dtcs.length; i += batchSize) {
    const batch = dtcs.slice(i, i + batchSize);
    const promises = batch.map(async (dtc) => {
      const advice = await getExpertAdvice(dtc);
      return { dtc, advice };
    });
    
    const batchResults = await Promise.all(promises);
    batchResults.forEach(({ dtc, advice }) => {
      results.set(dtc, advice);
    });
  }
  
  return results;
}

/**
 * Get cached advice for a DTC without making an API call
 */
export function getCachedAdvice(dtc: string): ExpertAdvice | null {
  const normalizedDtc = dtc.toUpperCase().trim();
  const cached = adviceCache.get(normalizedDtc);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  return null;
}

/**
 * Clear the advice cache
 */
export function clearAdviceCache(): void {
  adviceCache.clear();
  console.log('🗑️ AutoWizard advice cache cleared');
}

/**
 * Get all cached DTC codes
 */
export function getCachedDTCs(): string[] {
  return Array.from(adviceCache.keys());
}

// Export singleton-like functions for convenience
export const autoWizardService = {
  checkStatus: checkAutoWizardStatus,
  getAdvice: getExpertAdvice,
  getMultipleAdvice: getMultipleExpertAdvice,
  getCached: getCachedAdvice,
  clearCache: clearAdviceCache,
  getCachedDTCs: getCachedDTCs
};

export default autoWizardService;

