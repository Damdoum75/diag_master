
import React, { useEffect, useState } from 'react';
import { checkServerStatus } from '@/services/apiStatus';

export const ServerStatus = () => {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Check server status immediately on mount
    const checkStatus = async () => {
      const online = await checkServerStatus();
      setIsOnline(online);
    };
    checkStatus();

    // Then check every 5 seconds
    const interval = setInterval(async () => {
      const online = await checkServerStatus();
      setIsOnline(online);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700">
      <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`} />
      <span className="text-[10px] font-bold text-slate-300 uppercase">
        {isOnline ? 'Serveur Cloud Actif' : 'Serveur Déconnecté'}
      </span>
    </div>
  );
};

export default ServerStatus;


