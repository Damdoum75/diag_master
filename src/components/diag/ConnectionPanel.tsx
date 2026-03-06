import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Zap, Wifi, WifiOff, Settings } from 'lucide-react'

interface ConnectionPanelProps {
  connectionMethod: 'elm327' | 'j2534'
  setConnectionMethod: (method: 'elm327' | 'j2534') => void
  useSimulator: boolean
  setUseSimulator: (use: boolean) => void
  isConnected: boolean
  onConnect: () => void
  onDisconnect: () => void
  logs: Array<{ msg: string; type: string }>
}

export default function ConnectionPanel({
  connectionMethod,
  setConnectionMethod,
  useSimulator,
  setUseSimulator,
  isConnected,
  onConnect,
  onDisconnect,
  logs,
}: ConnectionPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuration de Connexion
            </CardTitle>
            <CardDescription>Sélectionnez votre interface de diagnostic</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">
                Interface de Diagnostic
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConnectionMethod('elm327')}
                  className={connectionMethod === 'elm327' ? 'p-3 rounded-lg border-2 border-cyan-500 bg-cyan-500/10' : 'p-3 rounded-lg border-2 border-slate-600 bg-slate-700/50 hover:border-slate-500'}
                >
                  <div className="font-semibold text-white">ELM327</div>
                  <div className="text-xs text-slate-400">USB OBD-II</div>
                </button>
                <button
                  onClick={() => setConnectionMethod('j2534')}
                  className={connectionMethod === 'j2534' ? 'p-3 rounded-lg border-2 border-cyan-500 bg-cyan-500/10' : 'p-3 rounded-lg border-2 border-slate-600 bg-slate-700/50 hover:border-slate-500'}
                >
                  <div className="font-semibold text-white">J2534</div>
                  <div className="text-xs text-slate-400">PassThru</div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg border border-slate-600">
              <div>
                <div className="font-medium text-white">Mode Simulateur</div>
                <div className="text-xs text-slate-400">Pour tests sans matériel</div>
              </div>
              <button
                onClick={() => setUseSimulator(!useSimulator)}
                className={useSimulator ? 'px-3 py-1 rounded-lg text-sm font-medium bg-green-600 text-white' : 'px-3 py-1 rounded-lg text-sm font-medium bg-slate-600 text-slate-300 hover:bg-slate-500'}
              >
                {useSimulator ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg border border-slate-600">
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <Wifi className="w-5 h-5 text-green-400" />
                    <span className="text-white font-medium">Connecté</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-5 h-5 text-red-400" />
                    <span className="text-white font-medium">Déconnecté</span>
                  </>
                )}
              </div>
              <Badge variant={isConnected ? 'default' : 'secondary'}>
                {isConnected ? 'Actif' : 'Inactif'}
              </Badge>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={onConnect}
                disabled={isConnected}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600"
              >
                <Zap className="w-4 h-4 mr-2" />
                Connecter
              </Button>
              <Button
                onClick={onDisconnect}
                disabled={!isConnected}
                variant="outline"
                className="flex-1 border-slate-600 hover:bg-slate-700"
              >
                Déconnecter
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800 border-slate-700 lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-white text-sm">Journaux</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64 w-full rounded-lg border border-slate-700 bg-slate-900/50 p-2">
            <div className="space-y-1">
              {logs.length === 0 ? (
                <p className="text-xs text-slate-500">En attente de logs...</p>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={log.type === 'error' ? 'text-xs font-mono p-1 rounded text-red-400 bg-red-500/10' : log.type === 'success' ? 'text-xs font-mono p-1 rounded text-green-400 bg-green-500/10' : log.type === 'warn' ? 'text-xs font-mono p-1 rounded text-yellow-400 bg-yellow-500/10' : 'text-xs font-mono p-1 rounded text-slate-400'}
                  >
                    {log.msg}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
