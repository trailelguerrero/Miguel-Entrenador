import React from 'react';
import { Calendar, BarChart3, Heart, MessageSquare, Search } from 'lucide-react';
import { DailyCheckIn } from '../types';

interface BottomNavBarProps {
  activeTab: string;
  onNavigateTab: (tab: string) => void;
  onOpenCheckIn: () => void;
  onOpenCommandPalette: () => void;
  todayCheckIn?: DailyCheckIn;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onNavigateTab,
  onOpenCheckIn,
  onOpenCommandPalette,
  todayCheckIn,
}) => {
  const getCheckInStatusColor = () => {
    if (!todayCheckIn) return 'text-zinc-400';
    if (todayCheckIn.status === 'optimal') return 'text-emerald-400';
    if (todayCheckIn.status === 'moderate') return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-800/90 px-2 py-1 safe-area-bottom shadow-2xl"
      aria-label="Navegación móvil"
    >
      <div className="grid grid-cols-5 items-center justify-around h-14">
        
        {/* 1. Calendario */}
        <button
          onClick={() => onNavigateTab('calendar')}
          className={`flex flex-col items-center justify-center py-1 transition cursor-pointer ${
            activeTab === 'calendar' ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="relative">
            <Calendar className="w-5 h-5" />
            {activeTab === 'calendar' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </div>
          <span className="text-[10px] font-semibold mt-1">Calendario</span>
        </button>

        {/* 2. Métricas / PMC */}
        <button
          onClick={() => onNavigateTab('metrics')}
          className={`flex flex-col items-center justify-center py-1 transition cursor-pointer ${
            activeTab === 'metrics' || activeTab === 'pmc' ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="relative">
            <BarChart3 className="w-5 h-5" />
            {(activeTab === 'metrics' || activeTab === 'pmc') && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </div>
          <span className="text-[10px] font-semibold mt-1">Métricas</span>
        </button>

        {/* 3. Check-in Matutino (Acción central destacada) */}
        <button
          onClick={onOpenCheckIn}
          className="flex flex-col items-center justify-center py-1 transition cursor-pointer group"
          title="Registrar o consultar check-in matutino"
        >
          <div className="relative -mt-3.5 w-11 h-11 rounded-full bg-gradient-to-tr from-zinc-900 to-zinc-800 border border-zinc-700 shadow-lg flex items-center justify-center group-hover:scale-105 transition-transform">
            <Heart className={`w-5 h-5 ${getCheckInStatusColor()}`} />
            {!todayCheckIn && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            )}
            {!todayCheckIn && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400" />
            )}
          </div>
          <span className="text-[10px] font-semibold mt-0.5 text-zinc-300">
            {todayCheckIn ? 'HRV' : 'Check-in'}
          </span>
        </button>

        {/* 4. Coach Miguel */}
        <button
          onClick={() => onNavigateTab('chat')}
          className={`flex flex-col items-center justify-center py-1 transition cursor-pointer ${
            activeTab === 'chat' ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            {activeTab === 'chat' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </div>
          <span className="text-[10px] font-semibold mt-1">Coach</span>
        </button>

        {/* 5. Command Palette / Más */}
        <button
          onClick={onOpenCommandPalette}
          className="flex flex-col items-center justify-center py-1 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          title="Buscar vistas y herramientas"
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] font-semibold mt-1">Buscar</span>
        </button>

      </div>
    </nav>
  );
};
