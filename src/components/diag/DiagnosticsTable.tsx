import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, Zap } from 'lucide-react'
import { DTC_DATABASE, MODULE_LIST } from '@/components/diag/dtcDatabase'

interface DiagnosticsTableProps {
  dtcs: string[]
  liveData: Record<string, any>
}

export default function DiagnosticsTable({ dtcs, liveData }: DiagnosticsTableProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/50'
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
    }
  }

  return (
    <div className="space-y-4">
      {/* Live Data */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Données en Direct
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(liveData).map(([key, value]) => (
              <div key={key} className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                <div className="text-xs text-slate-400 uppercase tracking-wider">{key}</div>
                <div className="text-lg font-bold text-white mt-1">
                  {typeof value === 'number' ? value.toFixed(2) : value}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* DTCs Found */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            Codes de Défaut Détectés
          </CardTitle>
          <CardDescription>
            {dtcs.length === 0 ? 'Aucun défaut détecté' : `${dtcs.length} code(s) trouvé(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dtcs.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-center">
              <div>
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-2" />
                <p className="text-slate-300">Aucun défaut détecté</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {dtcs.map((code) => {
                const dtcInfo = DTC_DATABASE[code as keyof typeof DTC_DATABASE]
                return (
                  <div
                    key={code}
                    className="p-4 rounded-lg border"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-mono font-bold text-lg">{code}</div>
                        {dtcInfo && (
                          <div className="text-sm font-semibold mt-1">{dtcInfo.title}</div>
                        )}
                      </div>
                      {dtcInfo && (
                        <Badge variant="outline" className="ml-2">
                          {dtcInfo.module}
                        </Badge>
                      )}
                    </div>
                    {dtcInfo && (
                      <>
                        <p className="text-sm mb-2">{dtcInfo.description}</p>
                        <div className="text-xs space-y-1">
                          <div>
                            <span className="font-semibold">Causes possibles:</span>
                            <ul className="list-disc list-inside ml-2">
                              {dtcInfo.causes.map((cause, i) => (
                                <li key={i}>{cause}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="font-semibold">Solution:</span>
                            <p className="ml-2">{dtcInfo.solution}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
