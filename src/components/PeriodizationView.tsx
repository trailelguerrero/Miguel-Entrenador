import React, { useState } from 'react';
import { 
  Compass, 
  Mountain, 
  Calendar, 
  Plus, 
  Search, 
  Sparkles, 
  Trash2, 
  Clock, 
  ChevronRight, 
  AlertCircle,
  Flag,
  Target
} from 'lucide-react';
import { TargetRace, AthleteProfile, Mesocycle, RaceDataField, RaceInfoResult } from '../types';
import { ApiService } from '../services/api';

interface PeriodizationViewProps {
  targetRace: TargetRace;
  secondaryRaces: TargetRace[];
  onSaveSecondaryRaces: (races: TargetRace[]) => void;
  profile: AthleteProfile;
}

const RACE_FIELD_NAMES: Record<RaceDataField, string> = {
  name: 'nombre oficial',
  date: 'fecha',
  distanceKm: 'distancia',
  elevationGainM: 'D+',
  elevationLossM: 'D-',
  location: 'lugar',
  terrainDescription: 'terreno',
  altitudeRange: 'altitudes',
};

/** Marca de procedencia: ✓ = verificado en la web; (tuyo) = lo escribiste tú. */
function sourceMark(r: TargetRace, f: RaceDataField) {
  const src = r.dataSources?.[f];
  if (src === 'web') return <span className="text-emerald-400 ml-0.5" title="Verificado con fuentes web">✓</span>;
  if (src === 'athlete') return <span className="text-zinc-500 ml-0.5" title="Dato introducido por ti">(tuyo)</span>;
  return null;
}

export const PeriodizationView: React.FC<PeriodizationViewProps> = ({
  targetRace,
  secondaryRaces,
  onSaveSecondaryRaces,
  profile,
}) => {
  const [showAddRaceModal, setShowAddRaceModal] = useState(false);
  const [newRaceName, setNewRaceName] = useState('');
  const [newRaceDate, setNewRaceDate] = useState('');
  // Vacíos por defecto: solo cuentan si el atleta los escribe (nada de cifras de ejemplo)
  const [newRaceDistance, setNewRaceDistance] = useState<string>('');
  const [newRaceElevation, setNewRaceElevation] = useState<string>('');
  const [newRacePriority, setNewRacePriority] = useState<'B' | 'C'>('B');
  const [isSearchingRace, setIsSearchingRace] = useState(false);

  // Default Mesocycle Road Map towards Transvulcania 2027
  const mesocyclesData = [
    {
      title: 'Fase 1: Base Aeróbica Pura & Erradicación de ADS',
      duration: 'Semanas 1 - 16',
      focus: 'Volumen estricto en ZoneSense verde',
      description: 'Construcción masiva de capilares y mitocondrias. Si tienes ADS, toda intensidad anaeróbica queda vetada. Fuerza general de core y piernas con peso corporal.',
      keyWorkouts: ['Rodajes Z1/Z2 de 60-90 min', 'Test de deriva cardíaca mensual', 'Circuito de fuerza Uphill Athlete 2x/sem']
    },
    {
      title: 'Fase 2: Muscular Endurance (ME) & Cuestas Empinadas',
      duration: 'Semanas 17 - 32',
      focus: 'Power-hiking en rampas > 25% + Fuerza excéntrica',
      description: 'Adaptación neuromuscular para las subidas de los volcanes de La Palma sin quemar glucógeno. Step-downs lentos para preparar los cuádriceps contra el daño excéntrico.',
      keyWorkouts: ['Series ME en cuesta extrema (4x5 min)', 'Tiradas largas con +1.200m D+', 'Zancadas búlgaras con pausa']
    },
    {
      title: 'Fase 3: Específico de Montaña & Descenso de Tazacorte',
      duration: 'Semanas 33 - 48',
      focus: 'Tiradas largas con desnivel real (+2.000m D+) y bajadas técnicas',
      description: 'Simulación del terreno volcánico y el descenso continuo de 2.400m de El Roque a Tazacorte. Calibración del protocolo de nutrición (40-60g carbohidratos/hora) y bastones.',
      keyWorkouts: ['Tiradas largas de fin de semana (3.5 - 5h)', 'Carrera preparatoria B', 'Entrenamientos en fatiga con bastones']
    },
    {
      title: 'Fase 4: Pico Competitivo & Tapering Pre-Transvulcania',
      duration: 'Últimas 4 semanas',
      focus: 'Descenso progresivo de volumen (-40%) manteniendo toques de activación',
      description: 'Supercompensación. El trabajo ya está hecho. Priorizar sueño y HRV nocturna alta en Suunto para llegar a la línea de salida del Faro de Fuencaliente con los depósitos llenos.',
      keyWorkouts: ['Rodajes cortos con 4-5 cambios de ritmo vivos', 'Descanso activo', 'Visualización y estrategia de carrera']
    }
  ];

  // AI Race Search / Enrich
  const handleSearchAndAddRace = async () => {
    if (!newRaceName.trim()) return;

    setIsSearchingRace(true);
    const declaredDistance = Number(newRaceDistance) > 0 ? Number(newRaceDistance) : undefined;
    const declaredElevation = Number(newRaceElevation) > 0 ? Number(newRaceElevation) : undefined;
    let info: RaceInfoResult | null = null;
    try {
      info = await ApiService.getRaceInfo(newRaceName, newRaceDate, declaredDistance);
    } catch (err: any) {
      // El banner "Error de API de IA" ya muestra el detalle; la carrera se guarda solo con tus datos
      console.error('Error al buscar información de la carrera:', err);
    }

    // Prioridad: dato verificado con fuentes > dato que escribiste tú > sin dato
    const web = info?.fields ?? {};
    const dataSources: TargetRace['dataSources'] = {};
    const val = <T extends string | number>(field: RaceDataField, declared: T | undefined): T | undefined => {
      const w = web[field]?.value as T | undefined;
      if (w !== undefined && w !== null && w !== '') {
        dataSources[field] = 'web';
        return w;
      }
      if (declared !== undefined && declared !== '') {
        dataSources[field] = 'athlete';
        return declared;
      }
      return undefined;
    };

    const race: TargetRace = {
      id: `race-${Date.now()}`,
      name: val('name', newRaceName.trim()) ?? newRaceName.trim(),
      date: val('date', newRaceDate || undefined) ?? '',
      distanceKm: val('distanceKm', declaredDistance) ?? 0,
      elevationGainM: val('elevationGainM', declaredElevation) ?? 0,
      elevationLossM: val<number>('elevationLossM', undefined) ?? 0,
      priority: newRacePriority,
      location: val<string>('location', undefined) ?? '',
      terrainDescription: val<string>('terrainDescription', undefined) ?? '',
      notes: info?.strategicAdvice ?? info?.message ?? undefined,
      dataSources,
      webSources: info?.sources ?? [],
      unverifiedFields: info ? info.unverified : ['name', 'date', 'distanceKm', 'elevationGainM', 'elevationLossM', 'location', 'terrainDescription', 'altitudeRange'],
      dataWarnings: info?.warnings?.length ? info.warnings : undefined,
      verifiedAt: info?.checkedAt,
    };

    onSaveSecondaryRaces([...secondaryRaces, race]);
    setShowAddRaceModal(false);
    setNewRaceName('');
    setNewRaceDistance('');
    setNewRaceElevation('');
    setIsSearchingRace(false);
  };

  const handleDeleteSecondaryRace = (id: string) => {
    onSaveSecondaryRaces(secondaryRaces.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-8">
      
      {/* Target Race Hero Card */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/30 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Mountain className="w-64 h-64 text-amber-400" />
        </div>

        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="flex items-center space-x-2.5">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-black uppercase tracking-wider">
              Objetivo Principal (Prioridad A)
            </span>
            <span className="text-xs text-zinc-400 font-semibold">{targetRace.date}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">
            {targetRace.name}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2">
            <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800">
              <span className="text-zinc-500 text-xs font-semibold">Distancia</span>
              <div className="text-xl font-black text-zinc-100">{targetRace.distanceKm} km</div>
            </div>

            <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800">
              <span className="text-zinc-500 text-xs font-semibold">Desnivel Positivo</span>
              <div className="text-xl font-black text-amber-400">+{targetRace.elevationGainM} m</div>
            </div>

            <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800">
              <span className="text-zinc-500 text-xs font-semibold">Desnivel Negativo</span>
              <div className="text-xl font-black text-red-400">-{targetRace.elevationLossM} m</div>
            </div>

            <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800">
              <span className="text-zinc-500 text-xs font-semibold">Ubicación</span>
              <div className="text-xs font-bold text-zinc-200 mt-1 line-clamp-1">{targetRace.location}</div>
            </div>
          </div>

          <div className="bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800/80 text-xs space-y-2 text-zinc-300 leading-relaxed">
            <p><strong className="text-zinc-100">Características del Terreno:</strong> {targetRace.terrainDescription}</p>
            <p><strong className="text-amber-400">Estrategia de Miguel:</strong> {targetRace.notes}</p>
          </div>
        </div>
      </div>

      {/* Mesocycles Road Map */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-zinc-100 flex items-center space-x-2">
              <Compass className="w-5 h-5 text-amber-400" />
              <span>Macrociclo de la Temporada & Mesociclos</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Periodización lineal inversa y específica según la metodología Uphill Athlete
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mesocyclesData.map((meso, idx) => (
            <div
              key={idx}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3 relative overflow-hidden"
            >
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-800 text-amber-400 border border-zinc-700">
                  {meso.duration}
                </span>
                <span className="text-xs font-black text-zinc-600">Fase 0{idx + 1}</span>
              </div>

              <h4 className="text-sm font-black text-zinc-100">{meso.title}</h4>

              <div className="text-xs font-bold text-emerald-400 bg-emerald-950/30 p-2 rounded-lg border border-emerald-900/30">
                Enfoque: {meso.focus}
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">{meso.description}</p>

              <div className="border-t border-zinc-800/80 pt-3">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                  Sesiones Clave:
                </span>
                <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                  {meso.keyWorkouts.map((k, i) => (
                    <li key={i}>{k}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Secondary Preparation Races (B and C) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-zinc-100 flex items-center space-x-2">
              <Flag className="w-5 h-5 text-emerald-400" />
              <span>Carreras Secundarias Preparatorias (Prioridad B y C)</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Pruebas para testear ritmo, material y nutrición en condiciones reales
            </p>
          </div>

          <button
            onClick={() => setShowAddRaceModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 border border-zinc-700 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Añadir Carrera</span>
          </button>
        </div>

        {secondaryRaces.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center space-y-2">
            <Target className="w-8 h-8 text-zinc-600 mx-auto" />
            <h4 className="text-xs font-bold text-zinc-300">No hay carreras secundarias añadidas</h4>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Puedes añadir carreras de preparación intermedias (ej: un trail de 30-40km con desnivel). La IA buscará información del perfil y Miguel te explicará cómo encajarla en el plan.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {secondaryRaces.map((r) => (
              <div
                key={r.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    r.priority === 'B'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                    Prioridad {r.priority}
                  </span>
                  <button
                    onClick={() => handleDeleteSecondaryRace(r.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 p-1 rounded transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h4 className="text-base font-extrabold text-zinc-100">{r.name}</h4>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{r.date || 'fecha sin dato'}</span>
                    {sourceMark(r, 'date')}
                  </span>
                  <span>•</span>
                  <span>{r.distanceKm > 0 ? `${r.distanceKm} km` : 'km sin dato'}{sourceMark(r, 'distanceKm')}</span>
                  <span>•</span>
                  <span className="text-amber-400">{r.elevationGainM > 0 ? `+${r.elevationGainM}m D+` : 'D+ sin dato'}{sourceMark(r, 'elevationGainM')}</span>
                  {r.elevationLossM > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-red-400">-{r.elevationLossM}m D-{sourceMark(r, 'elevationLossM')}</span>
                    </>
                  )}
                </div>

                {(r.location || r.terrainDescription) && (
                  <p className="text-xs text-zinc-400">
                    {r.location && <>{r.location}{sourceMark(r, 'location')}</>}
                    {r.location && r.terrainDescription && ' · '}
                    {r.terrainDescription && <>{r.terrainDescription}{sourceMark(r, 'terrainDescription')}</>}
                  </p>
                )}

                {r.unverifiedFields && r.unverifiedFields.length > 0 && (
                  <p className="text-[11px] text-amber-300/80">
                    Sin verificar: {r.unverifiedFields.map((f) => RACE_FIELD_NAMES[f]).join(', ')}
                  </p>
                )}

                {r.dataWarnings?.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-300/80">⚠ {w}</p>
                ))}

                {r.webSources && r.webSources.length > 0 && (
                  <div className="text-[11px] text-zinc-500 space-y-0.5">
                    <span className="font-semibold text-zinc-400">Fuentes:</span>
                    {r.webSources.slice(0, 4).map((src, i) => (
                      <a key={i} href={src.uri} target="_blank" rel="noopener noreferrer" className="block truncate text-cyan-400 hover:underline">
                        {src.title || src.uri}
                      </a>
                    ))}
                  </div>
                )}

                {r.notes && (
                  <div className="text-xs text-zinc-300 bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 leading-relaxed">
                    <strong className="text-emerald-400">Consejo de Miguel (recomendación):</strong> {r.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Race Modal with AI Search */}
      {showAddRaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-black text-zinc-100">Añadir Carrera Preparatoria</h3>
            <p className="text-xs text-zinc-400">
              Escribe el nombre de la prueba: se busca en Google y solo se guardan los datos que respalda alguna página (con su enlace). Lo que no se encuentre queda "sin verificar"; si escribes distancia o D+, se usan como datos tuyos.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400">Nombre de la Carrera</label>
                <input
                  type="text"
                  placeholder="Ej: Trail Valle de Tena 4K, Reventón Trail, Zegama..."
                  value={newRaceName}
                  onChange={(e) => setNewRaceName(e.target.value)}
                  className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400">Fecha Aproximada</label>
                  <input
                    type="date"
                    value={newRaceDate}
                    onChange={(e) => setNewRaceDate(e.target.value)}
                    className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400">Prioridad</label>
                  <select
                    value={newRacePriority}
                    onChange={(e) => setNewRacePriority(e.target.value as 'B' | 'C')}
                    className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
                  >
                    <option value="B">Prioridad B (Test serio)</option>
                    <option value="C">Prioridad C (Entrenamiento dorsal)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400">Distancia Estimada (km)</label>
                  <input
                    type="number"
                    value={newRaceDistance}
                    placeholder="Si la sabes"
                    onChange={(e) => setNewRaceDistance(e.target.value)}
                    className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400">D+ Estimado (m)</label>
                  <input
                    type="number"
                    value={newRaceElevation}
                    placeholder="Si lo sabes"
                    onChange={(e) => setNewRaceElevation(e.target.value)}
                    className="w-full mt-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowAddRaceModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSearchAndAddRace}
                disabled={isSearchingRace || !newRaceName.trim()}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-amber-600 hover:from-emerald-500 hover:to-amber-500 text-zinc-950 font-black text-xs shadow-lg transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSearchingRace ? 'Buscando en Google...' : 'Buscar & Añadir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
