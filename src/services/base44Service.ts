import { base44 } from '@/api/base44Client'

export interface DiagnosticSession {
  id?: string
  session_date: string
  vehicle: string
  vin: string
  protocol: string
  baudrate: number
  modules_scanned: string[]
  dtcs_found: Array<{
    code: string
    module: string
    description: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    status: 'active' | 'pending' | 'cleared'
  }>
  live_data_snapshots: Array<{
    timestamp: string
    battery_12v: number
    battery_48v_voltage: number
    battery_48v_soc: number
    battery_48v_current: number
    ifs_left_angle: number
    ifs_right_angle: number
    vehicle_speed: number
  }>
  cleared_codes: string[]
  technician_notes: string
  report_generated: boolean
}

export class Base44Service {
  private apiKey = import.meta.env.VITE_API_KEY || ''
  private baseUrl = `${base44.serverUrl}/api/apps/${base44.appId}/entities/DiagnosticSession`

  async fetchDiagnosticSessions(filters?: Record<string, any>): Promise<DiagnosticSession[]> {
    try {
      const url = new URL(this.baseUrl)

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          url.searchParams.append(key, String(value))
        })
      }

      const response = await fetch(url.toString(), {
        headers: {
          'api_key': this.apiKey,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data.entities || []
    } catch (error) {
      console.error('Error fetching diagnostic sessions:', error)
      return []
    }
  }

  async createDiagnosticSession(session: Partial<DiagnosticSession>): Promise<DiagnosticSession | null> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'api_key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(session),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error creating diagnostic session:', error)
      return null
    }
  }

  async updateDiagnosticSession(
    sessionId: string,
    updates: Partial<DiagnosticSession>
  ): Promise<DiagnosticSession | null> {
    try {
      const response = await fetch(`${this.baseUrl}/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: {
          'api_key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error updating diagnostic session:', error)
      return null
    }
  }

  async filterByVIN(vin: string): Promise<DiagnosticSession[]> {
    return this.fetchDiagnosticSessions({ vin })
  }

  async filterByModule(module: string): Promise<DiagnosticSession[]> {
    return this.fetchDiagnosticSessions({ modules_scanned: module })
  }

  async filterByDTC(dtcCode: string): Promise<DiagnosticSession[]> {
    return this.fetchDiagnosticSessions({ dtcs_found: dtcCode })
  }
}

export const base44Service = new Base44Service()
