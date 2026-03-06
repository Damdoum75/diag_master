import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Zap, Radio, Brain } from 'lucide-react'
import ConnectionPanel from '@/components/diag/ConnectionPanel'
import DiagnosticsTable from '@/components/diag/DiagnosticsTable'
import AIAnalysis from '@/components/diag/AIAnalysis'
import { ELM327Service, ELM327Simulator } from '@/services/ELM327Service'
import { J2534Service, J2534Simulator } from '@/services/J2534Service'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('connection')
  const [connectionMethod, setConnectionMethod] = useState<'elm327' | 'j2534'>('elm327')
  const [isConnected, setIsConnected] = useState(false)
  const [useSimulator, setUseSimulator] = useState(true)
  const [dtcs, setDtcs] = useState<string[]>([])
  const [liveData, setLiveData] = useState<Record<string, any>>({})
  const [logs, setLogs] = useState<Array<{ msg: string; type: string }>>([])
  const [scanning, setScanning] = useState(false)

  const elm327 = useSimulator ? new ELM327Simulator() : new ELM327Service()
  const j2534 = useSimulator ? new J2534Simulator() : new J2534Service()

  const addLog = (msg: string, type: string = 'info') => {
    setLogs(prev => [...prev, { msg, type }])
  }

  const handleConnect = async () => {
    try {
      const service = connectionMethod === 'elm327' ? elm327 : j2534
      service.onLog = addLog
      await service.connect()
      setIsConnected(true)
      addLog('Connecté avec succès', 'success')
    } catch (error: any) {
      addLog(error.message, 'error')
    }
  }

  const handleScan = async () => {
    if (!isConnected) {
      addLog('Veuillez d\'abord vous connecter', 'warn')
      return
    }
    setScanning(true)
    try {
      const service = connectionMethod === 'elm327' ? elm327 : j2534
      const allDtcs: string[] = []
      
      // Scan all modules
      const modules = ['ACU', 'ILCU', 'ADAS', 'MHEV', 'ECM', 'ABS', 'BCM', 'TCU']
      for (const module of modules) {
        addLog("Scan du module " + module + "...", 'info')
        const result = await service.scanModule(module)
        if (result.dtcs && result.dtcs.length > 0) {
          allDtcs.push(...result.dtcs)
          addLog(module + ": " + result.dtcs.join(', '), 'warn')
        } else {
          addLog(module + ": OK", 'success')
        }
      }
      
      setDtcs(allDtcs)
      
      // Read live data
      addLog('Lecture des données en direct...', 'info')
      const data = await service.readLiveData()
      setLiveData(data)
      addLog('Données en direct récupérées', 'success')
      
      setActiveTab('results')
    } catch (error: any) {
      addLog(error.message, 'error')
    } finally {
      setScanning(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      const service = connectionMethod === 'elm327' ? elm327 : j2534
      await service.disconnect()
      setIsConnected(false)
      setDtcs([])
      setLiveData({})
      addLog('Déconnecté', 'info')
    } catch (error: any) {
      addLog(error.message, 'error')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Radio className="w-8 h-8 text-cyan-400" />
            <h1 className="text-4xl font-bold text-white">Diag Master</h1>
          </div>
          <p className="text-slate-400">Diagnostic Kia Sportage NQ5 - Front Radar & BSM</p>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-slate-800 border border-slate-700">
            <TabsTrigger value="connection" className="data-[state=active]:bg-cyan-600">
              <Zap className="w-4 h-4 mr-2" />
              Connexion
            </TabsTrigger>
            <TabsTrigger value="scan" className="data-[state=active]:bg-cyan-600">
              <Radio className="w-4 h-4 mr-2" />
              Scan
            </TabsTrigger>
            <TabsTrigger value="results" className="data-[state=active]:bg-cyan-600">
              <AlertCircle className="w-4 h-4 mr-2" />
              Résultats
            </TabsTrigger>
            <TabsTrigger value="analysis" className="data-[state=active]:bg-cyan-600">
              <Brain className="w-4 h-4 mr-2" />
              IA
            </TabsTrigger>
          </TabsList>

          {/* Connection Tab */}
          <TabsContent value="connection" className="space-y-4">
            <ConnectionPanel
              connectionMethod={connectionMethod}
              setConnectionMethod={setConnectionMethod}
              useSimulator={useSimulator}
              setUseSimulator={setUseSimulator}
              isConnected={isConnected}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              logs={logs}
            />
          </TabsContent>

          {/* Scan Tab */}
          <TabsContent value="scan" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Scan Diagnostic</CardTitle>
                <CardDescription>Scannez tous les modules du véhicule</CardDescription>
              </CardHeader>
              <CardContent>
                <button
                  onClick={handleScan}
                  disabled={!isConnected || scanning}
                  className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 text-white rounded-lg font-semibold transition"
                >
                  {scanning ? 'Scan en cours...' : 'Démarrer le scan'}
                </button>
              </CardContent>
            </Card>

            {/* Maintenance Section */}
            <Card className="mt-6 border-orange-500/50 bg-orange-500/5">
              <CardHeader>
                <CardTitle className="text-orange-500">Maintenance & Réinitialisation</CardTitle>
                <CardDescription>Actions directes sur les calculateurs de la Kia Sportage NQ5</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                <button
                  onClick={async () => {
                    const service = connectionMethod === 'elm327' ? elm327 : j2534;
                    if (service.resetBSM) {
                      await service.resetBSM();
                    } else {
                      addLog('Méthode resetBSM non disponible', 'warn');
                    }
                  }}
                  disabled={!isConnected}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 text-white rounded-lg font-semibold transition"
                >
                  Réinitialiser BSM
                </button>
                
                <button
                  onClick={async () => {
                    const service = connectionMethod === 'elm327' ? elm327 : j2534;
                    if (service.resetCPU) {
                      await service.resetCPU();
                    } else {
                      addLog('Méthode resetCPU non disponible', 'warn');
                    }
                  }}
                  disabled={!isConnected}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 text-white rounded-lg font-semibold transition"
                >
                  Reset CPU (ECM)
                </button>

                <button
                  onClick={async () => {
                    const service = connectionMethod === 'elm327' ? elm327 : j2534;
                    if (service.clearAllDTCs) {
                      await service.clearAllDTCs();
                    } else {
                      addLog('Méthode clearAllDTCs non disponible', 'warn');
                    }
                  }}
                  disabled={!isConnected}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-700 text-white rounded-lg font-semibold transition"
                >
                  Effacer Tous les DTCs
                </button>

                <button
                  onClick={async () => {
                    const service = connectionMethod === 'elm327' ? elm327 : j2534;
                    if (service.fullSystemRestore) {
                      await service.fullSystemRestore();
                    } else {
                      addLog('Méthode fullSystemRestore non disponible', 'warn');
                    }
                  }}
                  disabled={!isConnected}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white rounded-lg font-bold transition"
                >
                  Restauration Totale & Effacement
                </button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-4">
            <DiagnosticsTable dtcs={dtcs} liveData={liveData} />
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Analyse IA Contextuelle</CardTitle>
              </CardHeader>
              <CardContent>
                <AIAnalysis detectedCodes={dtcs} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
