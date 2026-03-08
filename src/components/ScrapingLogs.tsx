
import React, { useEffect, useState } from 'react';

export const ScrapingLogs = () => {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/logs');
        const data = await res.json();
        if (data.new_logs) {
          setLogs(prev => [...prev, ...data.new_logs].slice(-5)); // Garde les 5 derniers
        }
      } catch (e) { /* Serveur hors ligne */ }
    };

    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-4 p-3 bg-black/60 border border-blue-900/50 rounded font-mono text-[10px] text-blue-300">
      <p className="text-blue-500 font-bold mb-1 underline">🌐 ACTIVITÉ CLOUD VSD :</p>
      {logs.length === 0 ? (
        <p className="italic text-slate-500">En attente de recherche...</p>
      ) : (
        logs.map((log, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-blue-700">[{new Date().toLocaleTimeString()}]</span>
            <span>{log}</span>
          </div>
        ))
      )}
    </div>
  );
};

export default ScrapingLogs;


