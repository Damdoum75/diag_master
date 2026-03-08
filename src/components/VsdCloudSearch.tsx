import { useState } from 'react';
import { Cloud, Search, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export const VsdCloudSearch = () => {
  const [vin, setVin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (vin.length < 9) {
      setError('Veuillez entrer au moins 9 caractères du VIN');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      // Appel au serveur collector local
      const response = await fetch(`http://localhost:5000/api/vsd/search?vin=${vin}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.found) {
        setResult(data);
      } else {
        setError(data.message || 'Aucune donnée trouvée');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur. Assurez-vous que collector_server.py est lancé.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Cloud className="w-5 h-5 text-cyan-400" />
        <h3 className="text-white font-semibold">Recherche Cloud VSD</h3>
      </div>

      {/* Input & Button */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={vin}
          onChange={(e) => setVin(e.target.value.toUpperCase())}
          placeholder="VIN ou préfixe (ex: U5YPV81BA)"
          className="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg 
            text-white placeholder-slate-500 font-mono"
          maxLength={17}
        />
        <button
          onClick={handleSearch}
          disabled={loading || vin.length < 9}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 
            disabled:cursor-not-allowed text-white rounded-lg font-semibold transition flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Recherche...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Scanner le Cloud
            </>
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Success Result */}
      {result?.found && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-semibold">Données VSD Trouvées!</span>
            <span className="text-xs text-slate-400">({result.mode})</span>
          </div>

          {/* Vehicle Info */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {result.data.Make && (
              <div className="p-2 bg-slate-900/50 rounded">
                <p className="text-xs text-slate-500">Marque</p>
                <p className="text-white">{result.data.Make}</p>
              </div>
            )}
            {result.data.Model && (
              <div className="p-2 bg-slate-900/50 rounded">
                <p className="text-xs text-slate-500">Modèle</p>
                <p className="text-white">{result.data.Model}</p>
              </div>
            )}
            {result.data.ModelYear && (
              <div className="p-2 bg-slate-900/50 rounded">
                <p className="text-xs text-slate-500">Année</p>
                <p className="text-white">{result.data.ModelYear}</p>
              </div>
            )}
            {result.data.EngineSize && (
              <div className="p-2 bg-slate-900/50 rounded">
                <p className="text-xs text-slate-500">Moteur</p>
                <p className="text-white">{result.data.EngineSize}</p>
              </div>
            )}
          </div>

          {/* Module Addresses (if available) */}
          {result.data.modules && (
            <div className="mt-3">
              <p className="text-xs text-slate-400 mb-2">Modules Disponibles:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.data.modules).map(([moduleName, moduleData]: [string, any]) => (
                  <span 
                    key={moduleName} 
                    className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs font-mono"
                  >
                    {moduleName}: {moduleData.addr}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Source Info */}
          <p className="text-xs text-slate-500 mt-3">
            Source: {result.data.source || 'N/A'}
          </p>
        </div>
      )}
    </div>
  );
};

export default VsdCloudSearch;

