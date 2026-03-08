import { useState, useEffect } from 'react';
import { Cloud, CloudOff, Search, Share2, CheckCircle, AlertCircle, Loader2, Wifi } from 'lucide-react';
import { vsdCloudService, VSDSearchResult } from '@/services/vsdCloudService';

interface CloudSyncProps {
  vin?: string;
  onSearchComplete?: (result: VSDSearchResult | null) => void;
}

export default function CloudSync({ vin, onSearchComplete }: CloudSyncProps) {
  const [status, setStatus] = useState<'idle' | 'searching' | 'success' | 'error'>('idle');
  const [sharingEnabled, setSharingEnabled] = useState(vsdCloudService.isSharingEnabled());
  const [searchResult, setSearchResult] = useState<VSDSearchResult | null>(null);
  const [lastSearchTime, setLastSearchTime] = useState<Date | null>(null);

  // Update sharing preference when toggle changes
  useEffect(() => {
    vsdCloudService.setSharingEnabled(sharingEnabled);
  }, [sharingEnabled]);

  const handleGlobalSearch = async () => {
    if (!vin || vin.length < 9) {
      setStatus('error');
      return;
    }

    setStatus('searching');
    
    try {
      const result = await vsdCloudService.searchGlobalVSD(vin);
      setSearchResult(result);
      setLastSearchTime(new Date());
      
      if (result?.found) {
        setStatus('success');
      } else {
        setStatus('idle');
      }
      
      if (onSearchComplete) {
        onSearchComplete(result);
      }
    } catch (e) {
      console.error("Cloud search error:", e);
      setStatus('error');
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'searching':
        return <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Cloud className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'searching':
        return 'Recherche mondiale en cours...';
      case 'success':
        return searchResult?.source ? `Données trouvées via ${searchResult.source}` : 'Recherche terminée';
      case 'error':
        return 'Erreur de recherche';
      default:
        return 'Réseau mondial de diagnostic';
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Wifi className="w-5 h-5 text-cyan-400" />
          <span className="text-white font-semibold">Cloud Diagnostic</span>
        </div>
        <span className="px-2 py-1 text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded">
          Global VSD
        </span>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Status Display */}
        <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
          {getStatusIcon()}
          <div className="flex-1">
            <p className="text-sm text-slate-300">{getStatusText()}</p>
            {lastSearchTime && (
              <p className="text-xs text-slate-500">
                Dernière recherche: {lastSearchTime.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {/* VIN Prefix Display */}
        {vin && (
          <div className="p-3 bg-slate-900/30 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Signature VIN (WMI + Modèle)</p>
            <p className="text-lg font-mono text-cyan-400">
              {vsdCloudService.getVinPrefix(vin)}
            </p>
          </div>
        )}

        {/* Search Button */}
        <button
          onClick={handleGlobalSearch}
          disabled={status === 'searching' || !vin}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 
            disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition
            shadow-lg shadow-cyan-500/20"
        >
          {status === 'searching' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Recherche...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Rechercher données mondiales
            </>
          )}
        </button>

        {/* Results Summary */}
        {searchResult?.found && searchResult.data && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium text-green-400">VSD Trouvé!</span>
            </div>
            <div className="text-xs text-slate-300 space-y-1">
              <p>Modèle: {searchResult.data.model || 'N/A'}</p>
              <p>Année: {searchResult.data.year || 'N/A'}</p>
              {searchResult.data.dtcs && (
                <p>DTCs documentés: {searchResult.data.dtcs.length}</p>
              )}
              {searchResult.data.solutions && (
                <p>Solutions connues: {searchResult.data.solutions.length}</p>
              )}
            </div>
          </div>
        )}

        {/* Sharing Toggle */}
        <div className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
          <div className="flex items-center gap-2">
            {sharingEnabled ? (
              <Share2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <CloudOff className="w-4 h-4 text-slate-500" />
            )}
            <span className="text-sm text-slate-300">
              Partage anonyme
            </span>
          </div>
          <button
            onClick={() => setSharingEnabled(!sharingEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              sharingEnabled ? 'bg-cyan-600' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                sharingEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        
        <p className="text-xs text-slate-500">
          Partagez vos données de diagnostic anonymement pour aider la communauté. 
          Votre VIN sera masqué (ex: U5YPV81BAXXXXXX).
        </p>
      </div>
    </div>
  );
}

