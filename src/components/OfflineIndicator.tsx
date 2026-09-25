import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-500/90 text-stone-950 font-bold px-3.5 py-2 text-xs shadow-2xl backdrop-blur-md border border-amber-400 animate-pulse">
      <WifiOff className="w-4 h-4 text-stone-950 shrink-0" />
      <span>Modo Offline en Montaña — Usando datos en caché</span>
    </div>
  );
};
