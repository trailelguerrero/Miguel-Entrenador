import React, { useState } from 'react';
import { 
  Mountain, 
  Calendar as CalendarIcon, 
  MessageSquare, 
  Compass, 
  Activity, 
  Heart, 
  User, 
  Watch,
  AlertTriangle,
  Sparkles,
  FileText,
  Brain,
  Flame,
  Dumbbell,
  TrendingUp,
  Database,
  Trash2,
  BarChart3,
  Droplets,
  Search,
  Download,
  Layers,
  BookOpen
} from 'lucide-react';
import { AthleteProfile, DailyCheckIn, TargetRace } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { ApiStatusIndicator } from './ApiStatusIndicator';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  profile: AthleteProfile;
  targetRace: TargetRace;
  todayCheckIn?: DailyCheckIn;
  onOpenCheckIn: () => void;
  onOpenProfile: () => void;
  hasHistoryDoc?: boolean;
  learnedRulesCount?: number;
  isTestDataActive?: boolean;
  onToggleTestData?: () => void;
  onOpenCommandPalette: () => void;
  onOpenBackup: () => void;
  onOpenSetupGuide: () => void;
  onDisconnectSuunto?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  profile,
  targetRace,
  todayCheckIn,
  onOpenCheckIn,
  onOpenProfile,
  hasHistoryDoc,
  learnedRulesCount,
  isTestDataActive,
  onToggleTestData,
  onOpenCommandPalette,
  onOpenBackup,
  onOpenSetupGuide,
  onDisconnectSuunto,
}) => {
  const [selectedHub, setSelectedHub] = useState<'all' | 'training' | 'metrics' | 'strategy' | 'coach'>('all');
  // Calculate days remaining until target race
  const getDaysUntilRace = (raceDateStr: string) => {
    try {
      const raceDate = new Date(raceDateStr);
      const today = new Date();
      const diffTime = raceDate.getTime() - today.getTime();
      return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    } catch {
      return 0;
    }
  };

  const daysToRace = getDaysUntilRace(targetRace.date);

  const getStatusColor = () => {
    if (!todayCheckIn || todayCheckIn.status === 'unknown') return 'bg-zinc-700 text-zinc-300';
    if (todayCheckIn.status === 'optimal') return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    if (todayCheckIn.status === 'moderate') return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    return 'bg-red-500/20 text-red-400 border border-red-500/30';
  };

  const navItems = [
    { id: 'calendar', label: 'Calendario', icon: CalendarIcon, hub: 'training' },
    { id: 'metrics', label: 'Dashboard Métricas', icon: BarChart3, badge: 'PDF', hub: 'metrics' },
    { id: 'performance', label: 'Resumen Rendimiento', icon: Activity, badge: 'Zonas & Peso', hub: 'metrics' },
    { id: 'simulation', label: 'Simulador Transvulcania', icon: Mountain, badge: '73K', hub: 'strategy' },
    { id: 'pmc', label: 'Forma & Fatiga (PMC)', icon: TrendingUp, badge: 'Uphill', hub: 'training' },
    { id: 'gut', label: 'Calculadora & Nutrición', icon: Flame, badge: 'Adaptación', hub: 'strategy' },
    { id: 'hydration', label: 'Plan & Análisis Hidratación', icon: Droplets, badge: 'Sudor & Sales', hub: 'strategy' },
    { id: 'eccentric', label: 'Fuerza Excéntrica', icon: Dumbbell, badge: '3-1-1', hub: 'strategy' },
    { id: 'memory', label: 'Memoria de Miguel', icon: Brain, badge: `${learnedRulesCount ?? 0} Reglas`, hub: 'coach' },
    { id: 'chat', label: 'Coach Miguel', icon: MessageSquare, badge: 'IA', hub: 'coach' },
    { id: 'knowledge', label: 'Biblioteca de Miguel', icon: BookOpen, badge: 'RAG', hub: 'coach' },
    { id: 'zonesense', label: 'Suunto & ZoneSense', icon: Watch, hub: 'metrics' },
    { id: 'physiology', label: 'Fisiología & Drift', icon: Activity, hub: 'training' },
    { id: 'history', label: 'Historial (.MD)', icon: FileText, badge: hasHistoryDoc ? '✓ MD' : undefined, hub: 'coach' },
    { id: 'periodization', label: 'Periodización 2027', icon: Compass, hub: 'strategy' },
  ];

  const filteredNavItems = selectedHub === 'all' 
    ? navItems 
    : navItems.filter(item => item.hub === selectedHub);

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Main Title */}
          <div className="flex items-center space-x-3 cursor-pointer shrink-0" onClick={() => setActiveTab('calendar')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-950/40">
              <Mountain className="w-6 h-6 text-zinc-950 stroke-[2.2]" />
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-tight text-zinc-100">UPHILL COACH</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  MIGUEL
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-medium hidden sm:block">Uphill Athlete • Suunto ZoneSense</p>
            </div>
          </div>

          {/* Quick Search / Command Palette Trigger */}
          <button
            onClick={onOpenCommandPalette}
            className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 transition cursor-pointer mx-2 max-w-xs w-full sm:w-auto"
            title="Abrir buscador rápido (⌘K / Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Buscar vista o acción...</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono bg-zinc-800 border border-zinc-700 rounded text-zinc-400 ml-1">
              ⌘K
            </kbd>
          </button>

          {/* Right Actions: Backup, Test Data, Check-in, Profile */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Estado de las APIs (IA / Suunto) */}
            <ApiStatusIndicator onGoToSuunto={() => setActiveTab('zonesense')} onDisconnectSuunto={onDisconnectSuunto} />

            {/* Guía de Setup Paso a Paso */}
            <button
              onClick={onOpenSetupGuide}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                profile.setupCompleted
                  ? 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-300 hover:text-zinc-100'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300'
              }`}
              title="Guía de Setup del Atleta (Parámetros y Entrevista de Miguel)"
            >
              <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden md:inline text-[11px]">
                {profile.setupCompleted ? 'Guía Setup' : `Setup (${profile.setupStep || 1}/6)`}
              </span>
            </button>

            {/* Backup / Export JSON */}
            <button
              onClick={onOpenBackup}
              className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition cursor-pointer"
              title="Copia de Seguridad & Portabilidad (.JSON)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden lg:inline text-[11px]">Copia JSON</span>
            </button>

            {/* Test Data Badge & Button */}
            {onToggleTestData && (
              <button
                onClick={onToggleTestData}
                className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  isTestDataActive
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-850'
                }`}
                title={isTestDataActive ? "Pulsa para limpiar datos de prueba" : "Pulsa para cargar datos de prueba"}
              >
                <Database className="w-3.5 h-3.5" />
                <span className="text-[11px]">{isTestDataActive ? 'Datos Prueba' : 'Cargar Prueba'}</span>
              </button>
            )}

            <PWAInstallButton />

            <button
              onClick={onOpenCheckIn}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${getStatusColor()}`}
              title="Registrar o consultar métricas matutinas de HRV y sueño"
            >
              <Heart className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {todayCheckIn ? (
                  todayCheckIn.status === 'optimal' ? 'Recuperación Óptima' :
                  todayCheckIn.status === 'unknown' ? 'Recuperación sin datos' :
                  todayCheckIn.status === 'moderate' ? 'Fatiga Moderada' : 'Fatiga Alta'
                ) : 'Check-in HRV'}
              </span>
            </button>

            <button
              onClick={onOpenProfile}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 font-medium transition-colors"
            >
              <User className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">{profile.name}</span>
              {profile.hasAds && (
                <span className="w-2 h-2 rounded-full bg-amber-400" title="ADS Activo"></span>
              )}
            </button>
          </div>
        </div>

        {/* Hub Category Selectors & Tabs */}
        <div className="border-t border-zinc-900/80 pt-1.5 pb-1 flex flex-col space-y-1.5">
          {/* Hub Filter Pills */}
          <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar text-[11px]">
            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mr-1 hidden sm:inline flex items-center gap-1">
              <Layers className="w-3 h-3 text-zinc-600" /> Hubs:
            </span>
            <button
              onClick={() => setSelectedHub('all')}
              className={`px-2 py-0.5 rounded-md font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedHub === 'all'
                  ? 'bg-zinc-800 text-amber-400 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Todas (14)
            </button>
            <button
              onClick={() => setSelectedHub('training')}
              className={`px-2 py-0.5 rounded-md font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedHub === 'training'
                  ? 'bg-zinc-800 text-amber-400 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              🏃 Carga & Plan
            </button>
            <button
              onClick={() => setSelectedHub('metrics')}
              className={`px-2 py-0.5 rounded-md font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedHub === 'metrics'
                  ? 'bg-zinc-800 text-amber-400 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              📊 Métricas & Fisiología
            </button>
            <button
              onClick={() => setSelectedHub('strategy')}
              className={`px-2 py-0.5 rounded-md font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedHub === 'strategy'
                  ? 'bg-zinc-800 text-amber-400 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              ⛰️ Transvulcania (73K)
            </button>
            <button
              onClick={() => setSelectedHub('coach')}
              className={`px-2 py-0.5 rounded-md font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedHub === 'coach'
                  ? 'bg-zinc-800 text-amber-400 border border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              🧠 Coach Miguel
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 overflow-x-auto py-1 no-scrollbar">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-zinc-500'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] font-black px-1 rounded bg-emerald-500/20 text-emerald-400">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};
