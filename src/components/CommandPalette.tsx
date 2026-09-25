import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  Calendar, 
  BarChart3, 
  Activity, 
  Mountain, 
  TrendingUp, 
  Flame, 
  Droplets, 
  Dumbbell, 
  Brain, 
  MessageSquare, 
  Watch, 
  FileText, 
  Compass, 
  Heart, 
  Plus, 
  Download, 
  Upload, 
  User, 
  Sparkles,
  ArrowRight,
  Database
} from 'lucide-react';

export interface CommandItem {
  id: string;
  title: string;
  category: 'Vistas' | 'Acciones Rápidas' | 'Copia de Seguridad';
  description?: string;
  icon: React.ElementType;
  badge?: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tabId: string) => void;
  onOpenCheckIn: () => void;
  onOpenAddWorkout: () => void;
  onOpenFartlek: () => void;
  onOpenProfile: () => void;
  onOpenBackup: () => void;
  onToggleTestData?: () => void;
  onOpenSetupGuide?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenCheckIn,
  onOpenAddWorkout,
  onOpenFartlek,
  onOpenProfile,
  onOpenBackup,
  onToggleTestData,
  onOpenSetupGuide,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open & clear search
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global keydown handler for Escape & arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const allCommands: CommandItem[] = [
    // Quick Actions
    {
      id: 'action-checkin',
      title: 'Registrar Check-in Matutino (HRV & Sueño)',
      category: 'Acciones Rápidas',
      description: 'Evalúa rMSSD y fatiga para adaptar las sesiones del día',
      icon: Heart,
      badge: 'Diario',
      keywords: ['hrv', 'sueño', 'fatiga', 'rmssd', 'recuperacion', 'mañana'],
      action: () => { onClose(); onOpenCheckIn(); }
    },
    {
      id: 'action-add-workout',
      title: 'Añadir Nueva Sesión de Entrenamiento',
      category: 'Acciones Rápidas',
      description: 'Programa una sesión personalizada con desnivel y zonas',
      icon: Plus,
      badge: 'Plan',
      keywords: ['nuevo', 'entrenamiento', 'crear', 'sesion', 'calendario'],
      action: () => { onClose(); onOpenAddWorkout(); }
    },
    {
      id: 'action-fartlek',
      title: 'Generar Fartlek Científico con Suunto ZoneSense',
      category: 'Acciones Rápidas',
      description: 'Generador dinámico de intervalos adaptados a tu HRV actual',
      icon: Sparkles,
      badge: 'ZoneSense',
      keywords: ['fartlek', 'intervalos', 'series', 'zonesense', 'generador', 'suunto'],
      action: () => { onClose(); onOpenFartlek(); }
    },
    {
      id: 'action-profile',
      title: 'Editar Perfil del Atleta y Umbrales Fisiológicos',
      category: 'Acciones Rápidas',
      description: 'Modifica AeT (142 bpm), AnT (166 bpm) o peso corporal',
      icon: User,
      badge: 'Config',
      keywords: ['perfil', 'umbrales', 'aet', 'ant', 'lthr', 'peso', 'ads'],
      action: () => { onClose(); onOpenProfile(); }
    },
    {
      id: 'action-backup',
      title: 'Copia de Seguridad & Portabilidad (.JSON)',
      category: 'Copia de Seguridad',
      description: 'Exporta o restaura todo tu historial y entrenamientos',
      icon: Download,
      badge: 'Portabilidad',
      keywords: ['backup', 'copia', 'restaurar', 'exportar', 'importar', 'json'],
      action: () => { onClose(); onOpenBackup(); }
    },

    // Vistas principales
    {
      id: 'tab-calendar',
      title: 'Calendario de Entrenamientos',
      category: 'Vistas',
      description: 'Microciclo semanal, sesiones completadas y TSS acumulado',
      icon: Calendar,
      badge: 'Semana',
      keywords: ['calendario', 'sesiones', 'microciclo', 'plan', 'semana'],
      action: () => { onClose(); onNavigateTab('calendar'); }
    },
    {
      id: 'tab-metrics',
      title: 'Dashboard de Métricas & PMC Fisiológico',
      category: 'Vistas',
      description: 'Resumen global de carga, CTL, ATL, TSB y exportación de informe PDF',
      icon: BarChart3,
      badge: 'PDF',
      keywords: ['dashboard', 'metricas', 'pdf', 'informe', 'kpi', 'acwr', 'sobreentrenamiento'],
      action: () => { onClose(); onNavigateTab('metrics'); }
    },
    {
      id: 'tab-acwr',
      title: 'Ratio de Carga Aguda:Crónica (ACWR 28d)',
      category: 'Vistas',
      description: 'Prevención de sobreentrenamiento con modelo Tim Gabbett y zona Sweet Spot',
      icon: Activity,
      badge: 'Gabbett',
      keywords: ['acwr', 'sobreentrenamiento', 'carga aguda', 'carga cronica', 'lesion', 'gabbett', 'sweet spot', 'prevencion'],
      action: () => {
        onClose();
        onNavigateTab('metrics');
        setTimeout(() => {
          const el = document.getElementById('acwr-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    },
    {
      id: 'tab-hrv-overreaching',
      title: 'Monitor de Sobre-esfuerzo: HRV 7d vs Carga Semanal',
      category: 'Vistas',
      description: 'Media móvil de 7 días del HRV rMSSD frente a carga semanal y banda SWC normal',
      icon: Heart,
      badge: 'Plews & Buchheit',
      keywords: ['hrv', 'rmssd', 'sobre-esfuerzo', 'overreaching', 'carga semanal', 'media movil', 'tono vagal', 'parasimpatico', 'plews', 'buchheit'],
      action: () => {
        onClose();
        onNavigateTab('metrics');
        setTimeout(() => {
          const el = document.getElementById('hrv-overreaching-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    },
    {
      id: 'tab-hrv-predictive',
      title: 'Predicción de Fatiga HRV (Regresión Lineal 30 Días)',
      category: 'Vistas',
      description: 'Modelo predictivo de mínimos cuadrados con proyección a 7 días y simulador de carga',
      icon: Sparkles,
      badge: 'Predictivo OLS',
      keywords: ['regresion', 'lineal', 'predictivo', 'prediccion', 'fatiga', 'hrv', 'rmssd', 'proyeccion', 'simulador', 'futuro'],
      action: () => {
        onClose();
        onNavigateTab('metrics');
        setTimeout(() => {
          const el = document.getElementById('hrv-predictive-section') || document.getElementById('hrv-predictive-regression-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    },
    {
      id: 'tab-pmc',
      title: 'Forma & Fatiga (PMC 90 días)',
      category: 'Vistas',
      description: 'Curvas de Rendimiento, Ramp Rate y TSS de montaña con daño excéntrico',
      icon: TrendingUp,
      badge: 'Banister',
      keywords: ['pmc', 'ctl', 'atl', 'tsb', 'fitness', 'fatiga', 'forma', 'banister', 'coggan'],
      action: () => { onClose(); onNavigateTab('pmc'); }
    },
    {
      id: 'tab-simulation',
      title: 'Simulador Transvulcania Ultramarathon (73K)',
      category: 'Vistas',
      description: '10 tramos oficiales de Fuencaliente a Los Llanos con estimación de fatiga',
      icon: Mountain,
      badge: '73K',
      keywords: ['transvulcania', 'simulador', 'carrera', 'la palma', 'fuencaliente', 'los muchachos', 'el time'],
      action: () => { onClose(); onNavigateTab('simulation'); }
    },
    {
      id: 'tab-performance',
      title: 'Resumen de Rendimiento & Zonas de Entrenamiento',
      category: 'Vistas',
      description: 'Distribución polarizada Uphill Athlete (80/20) y evolución de peso',
      icon: Activity,
      badge: '80/20',
      keywords: ['rendimiento', 'zonas', 'polarizado', 'aerobico', 'peso', 'resumen'],
      action: () => { onClose(); onNavigateTab('performance'); }
    },
    {
      id: 'tab-gut',
      title: 'Calculadora de Nutrición & Gut Training',
      category: 'Vistas',
      description: 'Adaptación intestinal progresiva (60 a 90g/h CHO) y co-transporte glucosa:fructosa',
      icon: Flame,
      badge: 'CHO g/h',
      keywords: ['nutricion', 'gut', 'estomago', 'carbohidratos', 'geles', 'fructosa'],
      action: () => { onClose(); onNavigateTab('gut'); }
    },
    {
      id: 'tab-hydration',
      title: 'Plan & Análisis de Hidratación (Test WUT & Sales)',
      category: 'Vistas',
      description: 'Protocolo Weight-Urine-Thirst y cálculo milimétrico de electrolitos/sodio',
      icon: Droplets,
      badge: 'Sales',
      keywords: ['hidratacion', 'agua', 'sodio', 'sales', 'sudor', 'wut', 'electrolitos'],
      action: () => { onClose(); onNavigateTab('hydration'); }
    },
    {
      id: 'tab-eccentric',
      title: 'Fuerza Excéntrica & Blindaje de Cuádriceps',
      category: 'Vistas',
      description: 'Rutina outdoor 3-1-1 para resistir los 2.400m de bajada técnica en Canarias',
      icon: Dumbbell,
      badge: 'Outdoor',
      keywords: ['fuerza', 'excentrica', 'cuadriceps', 'bajadas', 'desnivel negativo', 'pesas'],
      action: () => { onClose(); onNavigateTab('eccentric'); }
    },
    {
      id: 'tab-chat',
      title: 'Coach Miguel (Chat Fisiológico)',
      category: 'Vistas',
      description: 'Conversación directa con tu entrenador experto en ultradistancia y ZoneSense',
      icon: MessageSquare,
      badge: 'Coach',
      keywords: ['chat', 'miguel', 'coach', 'entrenador', 'ia', 'consejo', 'preguntar'],
      action: () => { onClose(); onNavigateTab('chat'); }
    },
    {
      id: 'tab-memory',
      title: 'Memoria & Reglas Aprendidas de Miguel',
      category: 'Vistas',
      description: 'Principios fisiológicos asimilados sobre tolerancia a geles, fatiga y calambres',
      icon: Brain,
      badge: 'Reglas',
      keywords: ['memoria', 'reglas', 'aprendizaje', 'contexto', 'insights'],
      action: () => { onClose(); onNavigateTab('memory'); }
    },
    {
      id: 'tab-zonesense',
      title: 'Suunto & ZoneSense',
      category: 'Vistas',
      description: 'Análisis de dispersión espectral RR y configuración de sincronización Suunto',
      icon: Watch,
      badge: 'Suunto',
      keywords: ['suunto', 'zonesense', 'dfa', 'alpha1', 'reloj', 'correa', 'hrv'],
      action: () => { onClose(); onNavigateTab('zonesense'); }
    },
    {
      id: 'tab-physiology',
      title: 'Fisiología de Montaña & Drift Test (ADS)',
      category: 'Vistas',
      description: 'Protocolo de desacoplamiento aeróbico Pa:HR para diagnosticar y revertir el ADS',
      icon: Activity,
      badge: 'ADS Test',
      keywords: ['fisiologia', 'drift', 'desacoplamiento', 'ads', 'aerobic deficiency', 'test'],
      action: () => { onClose(); onNavigateTab('physiology'); }
    },
    {
      id: 'tab-history',
      title: 'Historial & Documentación Técnica (.MD)',
      category: 'Vistas',
      description: 'Expediente deportivo completo en formato Markdown editable',
      icon: FileText,
      badge: 'Markdown',
      keywords: ['historial', 'markdown', 'documento', 'archivo', 'md'],
      action: () => { onClose(); onNavigateTab('history'); }
    },
    {
      id: 'tab-periodization',
      title: 'Periodización & Temporada Transvulcania 2027',
      category: 'Vistas',
      description: 'Macrociclo de 4 fases y carreras preparatorias intermedias (B y C)',
      icon: Compass,
      badge: 'Macrociclo',
      keywords: ['periodizacion', 'temporada', 'mesociclos', 'carreras', '2027'],
      action: () => { onClose(); onNavigateTab('periodization'); }
    }
  ];

  if (onOpenSetupGuide) {
    allCommands.push({
      id: 'action-setupguide',
      title: 'Guía de Setup Paso a Paso (Coach Miguel)',
      category: 'Acciones Rápidas',
      description: 'Configura tus parámetros clave de ultra trail, umbrales y entrevista de Miguel',
      icon: Compass,
      badge: 'Setup',
      keywords: ['setup', 'guia', 'configuracion', 'pasos', 'onboarding', 'parametros', 'inicial', 'miguel'],
      action: () => { onClose(); onOpenSetupGuide(); }
    });
  }

  if (onToggleTestData) {
    allCommands.push({
      id: 'action-testdata',
      title: 'Alternar / Limpiar Datos de Prueba',
      category: 'Acciones Rápidas',
      description: 'Carga o limpia datos simulados de microciclo sin tocar datos de usuario',
      icon: Database,
      badge: 'Datos',
      keywords: ['datos', 'prueba', 'test', 'limpiar', 'restablecer', 'muestra'],
      action: () => { onClose(); onToggleTestData(); }
    });
  }

  // Filter commands by query
  const filteredCommands = allCommands.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    const titleMatch = cmd.title.toLowerCase().includes(q);
    const descMatch = cmd.description?.toLowerCase().includes(q);
    const keywordMatch = cmd.keywords?.some((k) => k.toLowerCase().includes(q));
    const catMatch = cmd.category.toLowerCase().includes(q);
    return titleMatch || descMatch || keywordMatch || catMatch;
  });

  // Keep selection within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-900 border border-zinc-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-zinc-800 bg-zinc-950/80">
          <Search className="w-5 h-5 text-amber-400 shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribe para buscar vistas, métricas o acciones (ej: Transvulcania, Fartlek, HRV, PMC)..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-zinc-500 hover:text-zinc-300 p-1 mr-1 text-xs cursor-pointer"
            >
              Borrar
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-zinc-400 bg-zinc-800 border border-zinc-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto p-2 space-y-1 max-h-[60vh] divide-y divide-zinc-800/40">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
              <p className="text-sm font-semibold">No se encontraron resultados para "{query}"</p>
              <p className="text-xs text-zinc-600 mt-1">Prueba con palabras como "HRV", "TSS", "Transvulcania", o "Fartlek".</p>
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = cmd.icon;
              return (
                <div
                  key={cmd.id}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
                      : 'text-zinc-300 hover:bg-zinc-850/60'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isSelected 
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                        : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold truncate text-zinc-100">{cmd.title}</span>
                        {cmd.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-zinc-700 text-zinc-300 shrink-0">
                            {cmd.badge}
                          </span>
                        )}
                      </div>
                      {cmd.description && (
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">{cmd.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 ml-3">
                    <span className="text-[10px] font-medium text-zinc-500 hidden sm:inline">
                      {cmd.category}
                    </span>
                    <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400 opacity-100' : 'text-zinc-600 opacity-0'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2.5 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <div className="flex items-center space-x-3">
            <span><kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700">↓</kbd> Navegar</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">↵</kbd> Seleccionar</span>
          </div>
          <span className="hidden sm:inline">Uphill Coach AI • Búsqueda Rápida</span>
        </div>
      </div>
    </div>
  );
};
