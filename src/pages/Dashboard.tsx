
import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Zap, Radio, Brain, Cloud } from 'lucide-react'
import ConnectionPanel from '@/components/diag/ConnectionPanel'
import DiagnosticsTable from '@/components/diag/DiagnosticsTable'
import AIAnalysis from '@/components/diag/AIAnalysis'
import CloudSync from '@/components/diag/CloudSync'
import { VsdCloudSearch } from '@/components/VsdCloudSearch'
import { ServerStatus } from '@/components/ServerStatus'
import { ScrapingLogs } from '@/components/ScrapingLogs'
import { ELM327Service, ELM327Simulator } from '@/services/ELM327Service'
import { J2534Service, J2534Simulator } from '@/services/J2534Service'
import { vsdCloudService, VSDSearchResult } from '@/services/vsdCloudService'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('connection')
  const [connectionMethod, setConnectionMethod] = useState<'elm327' | 'j2534'>('elm327')
  const [isConnected, setIsConnected] = useState(false)
  const [useSimulator, setUseSimulator] = useState(true)
  const [dtcs, setDtcs] = useState<string[]>([])
  const [liveData, setLiveData] = useState<Record<string, any>>({})
  const [logs, setLogs] = useState<Array<{ msg: string; type: string }>>([])
  const [scanning, setScanning] = useState(false)
  const [vin, setVin] = useState('')
  const [cloudResult, setCloudResult] = useState<VSDSearchResult | null>(null)

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
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3 mb-2">
              <Radio className="w-8 h-8 text-cyan-400" />
              <h1 className="text-4xl font-bold text-white">Diag Master</h1>
            </div>
            <ServerStatus />
          </div>
          <p className="text-slate-400">Diagnostic Kia Sportage NQ5 - Front Radar & BSM</p>
        </div>

        {/* VSD Cloud Search Component */}
        <div className="mb-6">
          <VsdCloudSearch />
        </div>

        {/* Scraping Logs */}
        <div className="mb-6">
          <ScrapingLogs />
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-slate-800 border border-slate-700">
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
            <TabsTrigger value="cloud" className="data-[state=active]:bg-cyan-600">
              <Cloud className="w-4 h-4 mr-2" />
              Cloud
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

          {/* Cloud Tab */}
          <TabsContent value="cloud" className="space-y-4">
            {/* VIN Input */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Recherche Mondiale VSD</CardTitle>
                <CardDescription>Entrez le VIN du véhicule pour rechercher des données de diagnostic partagées</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={vin}
                    onChange={(e) => setVin(e.target.value.toUpperCase())}
                    placeholder="Ex: U5YPV81BAJK000001"
                    className="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 font-mono"
                    maxLength={17}
                  />
                  <button
                    onClick={async () => {
                      if (vin.length >= 9) {
                        addLog(`Recherche mondiale pour VIN prefix: ${vin.substring(0, 9)}...`, 'info');
                        const result = await vsdCloudService.searchGlobalVSD(vin);
                        setCloudResult(result);
                        if (result?.found) {
                          addLog(`Données VSD trouvées via ${result.source}`, 'success');
                        } else {
                          addLog('Aucune donnée VSD trouvée', 'warn');
                        }
                      }
                    }}
                    disabled={vin.length < 9}
                    className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 text-white rounded-lg font-semibold transition"
                  >
                    Rechercher
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Cloud Sync Component */}
            <CloudSync 
              vin={vin} 
              onSearchComplete={(result) => {
                setCloudResult(result);
                if (result?.found) {
                  addLog(`VSD trouvé: ${result.source}`, 'success');
                }
              }}
            />

            {/* Cloud Results */}
            {cloudResult?.found && cloudResult.data && (
              <Card className="bg-slate-800 border-green-500/50">
                <CardHeader>
                  <CardTitle className="text-green-400">Données Mondiales Trouvées</CardTitle>
                  <CardDescription>Source: {cloudResult.source}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-900/50 rounded-lg">
                      <p className="text-xs text-slate-500">Modèle</p>
                      <p className="text-white font-medium">{cloudResult.data.model || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-slate-900/50 rounded-lg">
                      <p className="text-xs text-slate-500">Année</p>
                      <p className="text-white font-medium">{cloudResult.data.year || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-slate-900/50 rounded-lg">
                      <p className="text-xs text-slate-500">Moteur</p>
                      <p className="text-white font-medium">{cloudResult.data.engine || 'N/A'}</p>
                    </div>
                    <div className="p-3 bg-slate-900/50 rounded-lg">
                      <p className="text-xs text-slate-500">Contributeur</p>
                      <p className="text-white font-medium">{cloudResult.data.contributor || 'Anonyme'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}


