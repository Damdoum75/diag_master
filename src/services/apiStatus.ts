
/**
 * API Status Service - Checks if the Python server is running
 * Uses port 5000 for the Collector Server
 */

const SERVER_URL = "http://localhost:5000";

export const checkServerStatus = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${SERVER_URL}/api/vsd/search?vin=PING`, { 
      method: 'GET' 
    });
    // If the server responds (even with 404 error), it's online
    return response.status !== 500;
  } catch {
    return false;
  }
};

