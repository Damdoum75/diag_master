/**
 * Local History Service - Save diagnostic reports to local Rails API
 * 
 * This service saves diagnostic data to the local Rails database (port 3000)
 * for offline storage and future reference.
 * 
 * Architecture:
 * - Rails API: http://localhost:3000
 * - Endpoint: /service_histories
 * - Data stored in: development.sqlite3
 */

const RAILS_API_URL = "http://localhost:3000";

export interface ServiceHistoryRecord {
  car_vin: string;
  dtc_code: string;
  description: string;
  date: string;
  // Additional VSD fields
  dtc_raw?: string;
  health_report?: string;
  battery_status?: number;
  model?: string;
  year?: number;
}

/**
 * Save diagnostic record to local Rails database
 */
export const saveDiagToLocal = async (
  vin: string, 
  dtc: string, 
  advice: string,
  additionalData?: {
    dtc_raw?: string;
    health_report?: string;
    battery_status?: number;
    model?: string;
    year?: number;
  }
): Promise<{ success: boolean; message: string }> => {
  const data = {
    service_history: {
      car_vin: vin,
      dtc_code: dtc,
      description: advice,
      date: new Date().toISOString(),
      dtc_raw: additionalData?.dtc_raw || "",
      health_report: additionalData?.health_report || "",
      battery_status: additionalData?.battery_status || 0,
      model: additionalData?.model || "",
      year: additionalData?.year || 0
    }
  };

  try {
    const response = await fetch(`${RAILS_API_URL}/service_histories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Diagnostic enregistré localement:", result);
      return { success: true, message: "Rapport enregistré avec succès" };
    } else {
      const error = await response.text();
      console.error("❌ Erreur lors de l'enregistrement:", error);
      return { success: false, message: `Erreur: ${response.status}` };
    }
  } catch (error: any) {
    console.error("❌ Erreur de connexion:", error);
    return { success: false, message: "Impossible de连接到 l'API Rails (port 3000)" };
  }
};

/**
 * Fetch diagnostic history from local Rails database
 */
export const getLocalHistory = async (vin?: string): Promise<ServiceHistoryRecord[]> => {
  try {
    const url = vin 
      ? `${RAILS_API_URL}/service_histories?car_vin=${vin}`
      : `${RAILS_API_URL}/service_histories`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : data.service_histories || [];
    }
    return [];
  } catch (error) {
    console.error("❌ Erreur lors de la récupération de l'historique:", error);
    return [];
  }
};

/**
 * Check if Rails API is available
 */
export const checkRailsConnection = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${RAILS_API_URL}/service_histories`, {
      method: 'HEAD'
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
};
