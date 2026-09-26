import {
  AthleteProfile,
  Workout,
  TargetRace,
  DailyCheckIn,
  ChatMessage,
  SuuntoIntegrationConfig,
  MacrocyclePlan,
  AthleteHistoryDocument,
  CoachLearnedMemory,
  CoachLearnedInsight,
  GutTrainingProfile,
  GutTrainingEntry,
  TransvulcaniaSimulationPlan,
  PMCDataPoint,
  EccentricOutdoorExercise,
  WeightEntry,
  WeeklyPerformanceSummary,
  MesocycleProgressionSummary,
  SweatRateTest,
  TransvulcaniaHydrationSection,
  WUTDailyCheck,
  AppBackupData
} from '../types';
import {
  SAMPLE_TRANSVULCANIA_SEGMENTS,
  SAMPLE_GUT_PROFILE,
  SAMPLE_ECCENTRIC_EXERCISES,
  SAMPLE_TEST_WORKOUTS,
  SAMPLE_DAILY_CHECKINS,
  SAMPLE_WEIGHT_HISTORY,
  SAMPLE_WEEKLY_SUMMARIES,
  SAMPLE_MESOCYCLE_PROGRESSION,
  SAMPLE_HYDRATION_TESTS,
  SAMPLE_TRANSVULCANIA_HYDRATION_SECTIONS,
  SAMPLE_WUT_CHECK,
  SAMPLE_ADAPTATION_STAGES
} from './sampleData';
import { computePmcSeries, localDateKey } from '../utils/trainingLoad';
import { deriveCheckIn, rebaseSuuntoCheckIn } from '../utils/readiness';
import { mergeSuuntoCheckIns, mergeSuuntoWorkouts, sportGroup } from '../brain/suuntoMerge';
import { resolveIntensityPrescription } from '../brain/intensity';
import { applyEvidence, refreshMemory, type EvidenceContext, type EvidenceItem } from '../brain/memory';

const STORAGE_KEYS = {
  PROFILE: 'uphill_coach_profile',
  TARGET_RACE: 'uphill_coach_target_race',
  SECONDARY_RACES: 'uphill_coach_secondary_races',
  WORKOUTS: 'uphill_coach_workouts',
  DAILY_CHECKINS: 'uphill_coach_checkins',
  CHAT_MESSAGES: 'uphill_coach_chat_messages',
  CHAT_SESSION_ID: 'uphill_coach_chat_session_id',
  SUUNTO_CONFIG: 'uphill_coach_suunto_config',
  MACROCYCLE: 'uphill_coach_macrocycle',
  ATHLETE_HISTORY_MD: 'uphill_coach_athlete_history_md',
  COACH_MEMORY: 'uphill_coach_learned_memory',
  GUT_PROFILE: 'uphill_coach_gut_profile',
  RACE_SIMULATION: 'uphill_coach_race_simulation',
  PMC_DATA: 'uphill_coach_pmc_data',
  TEST_DATA_ACTIVE: 'uphill_coach_test_data_active',
  WEIGHT_HISTORY: 'uphill_coach_weight_history',
  WEEKLY_SUMMARIES: 'uphill_coach_weekly_summaries',
  MESOCYCLE_PROGRESSION: 'uphill_coach_mesocycle_progression',
  HYDRATION_TESTS: 'uphill_coach_hydration_tests',
  WUT_CHECKS: 'uphill_coach_wut_checks',
};

/** Deporte de una sesión (src/brain/suuntoMerge.ts). */
export { sportGroup };

/**
 * Datos que viven en el servidor (Fase B). Cada escritura en el navegador (que hace
 * de caché) avisa al módulo de sincronización (src/services/remoteData.ts), que la
 * sube al servidor. Mientras se aplica lo que llega del servidor, no se avisa.
 */
export interface ServerSnapshot {
  profile: AthleteProfile | null;
  targetRace: TargetRace | null;
  coachMemory: CoachLearnedMemory | null;
  historyMd: AthleteHistoryDocument | null;
  workouts: Workout[];
  checkIns: DailyCheckIn[];
  suunto: Pick<SuuntoIntegrationConfig, 'connected' | 'lastSync' | 'syncStatus' | 'lastSyncMessage' | 'totalActivitiesSynced'>;
  imported: boolean;
  serverTime: string;
}

export type RemoteKind = 'profile' | 'targetRace' | 'coachMemory' | 'historyMd' | 'workouts' | 'checkIns';
const REMOTE_KIND: Record<string, RemoteKind> = {
  [STORAGE_KEYS.PROFILE]: 'profile',
  [STORAGE_KEYS.TARGET_RACE]: 'targetRace',
  [STORAGE_KEYS.COACH_MEMORY]: 'coachMemory',
  [STORAGE_KEYS.ATHLETE_HISTORY_MD]: 'historyMd',
  [STORAGE_KEYS.WORKOUTS]: 'workouts',
  [STORAGE_KEYS.DAILY_CHECKINS]: 'checkIns',
};
const SAMPLE_WORKOUT_IDS = new Set(SAMPLE_TEST_WORKOUTS.map((w) => w.id));
let remoteHook: ((kind: RemoteKind) => void) | null = null;
let remoteMuted = 0;

function writeTracked(key: string, value: string | null): void {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
  const kind = REMOTE_KIND[key];
  if (kind && remoteHook && remoteMuted === 0) remoteHook(kind);
}

// Initial target race as specified by user: Transvulcania 2027
export const DEFAULT_TARGET_RACE: TargetRace = {
  id: 'transvulcania-2027',
  name: 'Transvulcania Ultramarathon 2027',
  // La organización aún no ha publicado la fecha de 2027 (la de 2026 fue el 9 de mayo)
  date: '2027-05-08',
  dateConfirmed: false,
  distanceKm: 73.0,
  elevationGainM: 4350,
  elevationLossM: 4057,
  priority: 'A',
  location: 'Isla de La Palma, Canarias',
  terrainDescription: 'Senderos volcánicos, arena y lapilli, crestería a más de 2.400m (Roque de los Muchachos), brutal descenso final de 2.400m hasta el Puerto de Tazacorte y subida final por el barranco.',
  notes: 'Objetivo A principal. Requiere adaptación extrema al desnivel negativo (fuerza excéntrica de cuádriceps) y una base aeróbica sólida para gestionar la altitud y el calor.'
};

// Perfil vacío: nada inventado. Los datos fisiológicos llegan de Suunto
// (sincronización) o los introduce el atleta; 0 / '' = sin dato.
export const DEFAULT_PROFILE: AthleteProfile = {
  name: 'Atleta',
  age: 0,
  heightCm: 0,
  weightKg: 0,
  targetRaceWeightKg: 0,
  weightHistory: [],
  restingHr: 0,
  maxHr: 0,
  aetHr: 0,
  antHr: 0,
  hasAds: false,
  driftTestResultPct: undefined,
  yearsTrailRunning: 0,
  availableDaysPerWeek: 0,
  preferredLongRunDay: 'saturday',
  injuryHistory: '',
  strengthEquipment: 'none_bodyweight',
  currentWeeklyVolumeHours: 0,
  targetRaceName: 'Transvulcania 2027',
  dataSource: 'pending',
  setupCompleted: false,
  setupStep: 1,
};

/**
 * Limpia de un perfil guardado los datos del antiguo perfil de ejemplo que el
 * atleta nunca cambió (textos idénticos, valores numéricos que Suunto aún no
 * ha rellenado ni el atleta ha fijado a mano).
 */
function migrateLegacyProfile(p: AthleteProfile): { profile: AthleteProfile; changed: boolean } {
  const L = LEGACY_SAMPLE_PROFILE;
  const next: AthleteProfile = { ...p };
  let changed = false;
  const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);

  if (next.injuryHistory === L.injuryHistory) { next.injuryHistory = ''; changed = true; }
  if (next.ultraExperience && same(next.ultraExperience, L.ultraExperience)) {
    next.ultraExperience = undefined;
    if (next.yearsTrailRunning === L.yearsTrailRunning) next.yearsTrailRunning = 0;
    changed = true;
  }
  if (next.advancedPhysiologicalProfile && same(next.advancedPhysiologicalProfile, L.advancedPhysiologicalProfile)) {
    next.advancedPhysiologicalProfile = undefined;
    changed = true;
  }
  // Campos que rellena Suunto: si siguen con el valor de ejemplo y nadie los
  // ha fijado (ni Suunto ni el atleta), se vacían; la próxima sync los rellena.
  const suuntoFields = ['maxHr', 'aetHr', 'antHr', 'restingHr', 'currentWeeklyVolumeHours', 'availableDaysPerWeek'] as const;
  for (const f of suuntoFields) {
    if (!next.fieldSources?.[f] && next[f] === L[f]) { (next as any)[f] = 0; changed = true; }
  }
  if (!next.fieldSources?.hasAds && next.hasAds === L.hasAds && !next.aetHr) { next.hasAds = false; changed = true; }
  if (next.weightHistory && same(next.weightHistory, L.weightHistory)) { next.weightHistory = []; changed = true; }
  return { profile: next, changed };
}

// Perfil de EJEMPLO que usaban versiones anteriores como perfil por defecto.
// Solo se conserva para detectar y limpiar esos datos inventados en perfiles
// ya guardados (ver migrateLegacyProfile). No se muestra ni se envía a la IA.
const LEGACY_SAMPLE_PROFILE: AthleteProfile = {
  name: 'Atleta',
  age: 50,
  heightCm: 176, // 1.76 m
  weightKg: 71.5, // Peso actual
  targetRaceWeightKg: 67.5, // Peso óptimo para Transvulcania (-4.0 kg para ratio W/kg y menor impacto articular)
  weightHistory: SAMPLE_WEIGHT_HISTORY,
  restingHr: 48,
  maxHr: 178,
  aetHr: 138, // Umbral aeróbico (VT1)
  antHr: 162, // Umbral anaeróbico (VT2)
  hasAds: true, // Spread > 20 bpm (24 bpm) => Presenta ADS leve
  driftTestResultPct: undefined,
  yearsTrailRunning: 12,
  availableDaysPerWeek: 4, // 3 entre semana + 1 fin de semana
  preferredLongRunDay: 'saturday',
  injuryHistory: 'Sobrecarga recurrente en sóleo/gemelo izquierdo en descensos pronunciados prolongados; con 50 años la recuperación de la fatiga excéntrica requiere 48-72h.',
  strengthEquipment: 'none_bodyweight',
  currentWeeklyVolumeHours: 6.5,
  targetRaceName: 'Transvulcania 2027',
  ultraExperience: {
    longestRaceKm: 85,
    longestRaceElevationGainM: 5200,
    completedUltras: 'Gran Trail Peñalara 60k (2021), Ultra Sierra Nevada 75k (2022), CSP Castellón 110k (2023)',
    downhillTechnicalAbility: 'intermediate',
    polesUsage: 'expert_all_hills',
    sleepQualityAvgHours: 7.0,
    dailyWorkStressLevel: 'moderate',
    recoveryCapacityAt50: 'A mis 50 años la asimilación neuromuscular de las bajadas tarda más; necesito cuidar mucho el descanso entre bloques y el trabajo excéntrico al aire libre.',
    vulnerableJointsOrTissues: ['Tendón de Aquiles', 'Sóleos excéntrico', 'Cintilla iliotibial'],
    heatTolerance: 'moderate',
    gutIssuesHistory: 'Tolerancia aceptable hasta las 5 horas; a partir de ahí necesito comida salada y repartir los carbohidratos en tomas pequeñas.',
    personalMotivation: 'Coronar Transvulcania a mis 50 años con preparación quirúrgica, respetando la longevidad de mis piernas y disfrutando la crestería y el volcán.',
    coachInitialInterviewCompleted: true,
  },
  advancedPhysiologicalProfile: {
    chronicInjuries: {
      description: 'Tendinopatía aquílea izquierda recurrente (origen en sobrecarga de sóleos en descensos continuados) y conato de cintilla iliotibial derecha si supera los 30 km sin calentar glúteo medio.',
      primaryTrigger: 'Descensos continuados de más de 800m negativos a ritmo vivo o calzado con drop inferior a 5mm.',
      activeWarningSigns: 'Rigidez matutina al apoyar el talón en los primeros pasos y tirantez en el sóleo lateral tras 2h de carrera.',
      managementProtocol: 'Trabajo excéntrico en escalón (soleus drops 3-1-1), automasaje con pelota dura en sóleos y descarga muscular con crioterapia.',
      orthoticsOrInsoles: true,
    },
    highMountain: {
      hasVolcanicTerrainExperience: true,
      volcanicTerrainNotes: 'Experiencia en senderos de Tenerife y La Palma; el lapilli negro suelto exige mayor cadencia para no perder tracción y el uso obligatorio de polainas bajas para evitar piedras abrasivas en zapatillas.',
      technicalTerrainGrade: 'technical_alpine_rocks',
      maxAltitudeReachedM: 3100,
      altitudeSensitivity: 'none',
    },
    heatTolerance: {
      level: 'moderate',
      crampHistoryInHeat: true,
      sweatRateDocumentedLitersPerHour: 1.15,
      sodiumLossProfile: 'salty_sweater_white_crust',
      heatStrategyNotes: 'Alta pérdida de sal (costras blancas en tirantes de mochila). Requiere 650-750 mg de sodio por hora y bidón con cubrenucas mojado en avituallamientos.',
    },
    trainingPreferences: {
      preferredTrainingTime: 'early_morning',
      longRunPreferredTerrain: 'steep_technical_trail',
      crossTrainingSports: ['Bicicleta Gravel/MTB', 'Senderismo con desnivel (Power Hiking)'],
      weeklyFlexibility: 'flexible_swap_days',
      treadmillTolerance: 'emergency_weather_only',
      preferredRestDay: 'monday',
      lifestyleConstraintsNotes: 'Jornada laboral sedentaria entre semana. Prefiero entrenar a primera hora (6:30 - 8:00 AM) para no interferir con la familia.',
    },
  },
  setupCompleted: false,
  setupStep: 1,
};

export const DEFAULT_SUUNTO_CONFIG: SuuntoIntegrationConfig = {
  connected: false,
};

// URL del connector MCP de Suunto (el mismo servidor que usa la app para sincronizar).
export const SUUNTO_MCP_CONNECTOR_URL = 'https://mcp-ten-kappa.vercel.app/mcp';

// Memoria vacía: Miguel solo guarda lo que aprende de verdad (feedback de
// sesiones, check-ins, conversaciones). Nada de aprendizajes de ejemplo.
export const DEFAULT_COACH_MEMORY: CoachLearnedMemory = {
  athleteId: 'pupilo-transvulcania-2027',
  lastUpdated: new Date().toISOString(),
  overallPhilosophySummary: 'Objetivo Transvulcania 2027. Estructura semanal: 3 sesiones entre semana (2 si la fatiga o la disponibilidad lo aconsejan) + tirada larga en sábado o domingo. Sin gimnasio.',
  insights: [],
  adaptationHistory: [],
  coachNotebookNotes: [],
};

/** Quita de una memoria guardada los aprendizajes y notas de ejemplo que nunca se aprendieron. */
function migrateLegacyCoachMemory(m: CoachLearnedMemory): { memory: CoachLearnedMemory; changed: boolean } {
  const L = LEGACY_SAMPLE_COACH_MEMORY;
  const fakeInsight = new Set(L.insights.map((i) => i.observation));
  const fakeNotes = new Set(L.coachNotebookNotes);
  const insights = (m.insights || []).filter((i) => !fakeInsight.has(i.observation));
  const coachNotebookNotes = (m.coachNotebookNotes || []).filter((n) => !fakeNotes.has(n));
  const summaryIsLegacy = m.overallPhilosophySummary === L.overallPhilosophySummary;
  const changed = insights.length !== (m.insights || []).length ||
    coachNotebookNotes.length !== (m.coachNotebookNotes || []).length || summaryIsLegacy;
  return {
    memory: {
      ...m,
      insights,
      coachNotebookNotes,
      overallPhilosophySummary: summaryIsLegacy ? DEFAULT_COACH_MEMORY.overallPhilosophySummary : m.overallPhilosophySummary,
    },
    changed,
  };
}

// Memoria de EJEMPLO de versiones anteriores (aprendizajes inventados). Solo
// se usa para detectarlos y quitarlos de memorias guardadas.
const LEGACY_SAMPLE_COACH_MEMORY: CoachLearnedMemory = {
  athleteId: 'pupilo-transvulcania-2027',
  lastUpdated: new Date().toISOString(),
  overallPhilosophySummary: 'Atleta enfocado en Transvulcania 2027 con disponibilidad de 4 días (3 entre semana + 1 tirada larga). Sin acceso a gimnasio. Perfil metabólico con necesidad de blindaje aeróbico estricto (sub-AeT) para erradicar el ADS y fortalecer la musculatura de cuádriceps de forma excéntrica para el descenso brutal de Tazacorte.',
  insights: [
    {
      id: 'insight-1',
      category: 'physiology_zonesense',
      observation: 'En pendientes >12%, el intento de trotar provoca caída inmediata de DFA a1 de 0.78 a 0.58 (desacople celular prematuro).',
      ruleForFuturePlans: 'Obligatorio paso a power-hiking con bastones o zancada activa en pendientes pronunciadas para salvaguardar el estado aeróbico puro (DFA a1 >= 0.75).',
      confidenceScore: 92,
      learnedFromDate: '2026-09-01',
      sourceEvent: 'Historial deportivo inicial del atleta',
    },
    {
      id: 'insight-2',
      category: 'biomechanics_injury',
      observation: 'Tendencia recurrente a sobrecarga en sóleo/gemelo izquierdo en entrenamientos continuos de subida sobre asfalto o pista dura.',
      ruleForFuturePlans: 'Priorizar senderos de tierra con impacto amortiguado y prescribir trabajo excéntrico de sóleo en escalón tras cada sesión de carrera.',
      confidenceScore: 88,
      learnedFromDate: '2026-09-05',
      sourceEvent: 'Declaración de historial y puntos débiles del atleta',
    },
    {
      id: 'insight-3',
      category: 'fatigue_recovery',
      observation: 'Cuando la HRV nocturna (rMSSD) cae por debajo de 40 ms (caída >20%), la percepción de esfuerzo (RPE) se dispara a 8/10 incluso a ritmos aeróbicos de 135 bpm.',
      ruleForFuturePlans: 'Ante caídas de HRV matutina, reconvertir automáticamente sesiones de fuerza o series a descanso total o rodaje regenerativo Z1 de 30-40 min.',
      confidenceScore: 95,
      learnedFromDate: '2026-09-10',
      sourceEvent: 'Correlación de check-ins de Suunto y sensaciones',
    },
    {
      id: 'insight-nutrition-1',
      category: 'nutrition_hydration',
      observation: 'Tolerancia gástrica actual evaluada en 55-60 g/h con vaciado sin náuseas. Pérdida estimada de sodio en calor moderado: ~550 mg/h.',
      ruleForFuturePlans: 'Progresar de forma escalonada a 65-75 g/h en tiradas >2h alternando carbohidratos de ratio 1:0.8 (maltodextrina:fructosa) con 550-650 ml/h de electrolitos para saturar transportadores SGLT1 y GLUT5.',
      confidenceScore: 90,
      learnedFromDate: '2026-09-15',
      sourceEvent: 'Test de Gut Training & Tirada Larga Fuencaliente',
    }
  ],
  adaptationHistory: [],
  coachNotebookNotes: [
    'El pupilo responde con disciplina a los límites de pulso, pero necesita que le justifique el "por qué" de cada bajada de ritmo.',
    'Preparar específicamente la bajada de 2.400m de El Roque de los Muchachos a Tazacorte con step-downs excéntricos lentos en escaleras o rocas.',
    'Pautas de Nutrición: Monitorear el ratio de sudoración y asegurar que el atleta consuma entre 450 y 750 mg de sodio por hora para evitar hiponatremia en el calor de La Palma.'
  ]
};

/**
 * Versiones anteriores guardaban una puntuación fija (45/68/90) según reglas.
 * Ahora la puntuación es el Recovery de Suunto: se recupera de la nota del
 * check-in si existe; si no, queda sin dato.
 */
function fixLegacyReadinessScore(c: DailyCheckIn): DailyCheckIn {
  if (c.readinessScore == null || ![45, 68, 90].includes(c.readinessScore)) return c;
  const m = c.source === 'suunto' ? c.coachAdvice?.match(/Recovery Suunto del día: (\d+)%/) : null;
  return { ...c, readinessScore: m ? Number(m[1]) : undefined };
}

/**
 * Perfil de gut training vacío: tolerancia 0 (= sin dato), sin tomas.
 * Las etapas del protocolo son plantilla del programa (rangos de g/h por
 * etapa), pero el progreso del atleta empieza de cero.
 */
function emptyGutProfile(): GutTrainingProfile {
  return {
    currentMaxCarbsPerHour: 0,
    goalCarbsPerHour: 0,
    trainingPhase: 'Initiation (30-45g/h)',
    activeStageId: 1,
    stages: SAMPLE_ADAPTATION_STAGES.map((st, i) => ({
      ...st,
      status: i === 0 ? 'in_progress' : 'locked',
      sessionsCompleted: 0,
    })),
    gutSensitivities: [],
    entries: [],
  };
}

export const StorageService = {
  /** Registra quién sube al servidor las escrituras (null = solo este navegador). */
  setRemoteHook(fn: ((kind: RemoteKind) => void) | null): void {
    remoteHook = fn;
  },

  /** Guarda en este navegador (caché) el estado que devuelve el servidor. */
  applyServerSnapshot(snap: ServerSnapshot): void {
    this.withoutRemote(() => {
      if (snap.profile) writeTracked(STORAGE_KEYS.PROFILE, JSON.stringify(snap.profile));
      if (snap.targetRace) writeTracked(STORAGE_KEYS.TARGET_RACE, JSON.stringify(snap.targetRace));
      if (snap.coachMemory) writeTracked(STORAGE_KEYS.COACH_MEMORY, JSON.stringify(snap.coachMemory));
      writeTracked(STORAGE_KEYS.ATHLETE_HISTORY_MD, snap.historyMd ? JSON.stringify(snap.historyMd) : null);
      writeTracked(STORAGE_KEYS.WORKOUTS, JSON.stringify(snap.workouts));
      writeTracked(STORAGE_KEYS.DAILY_CHECKINS, JSON.stringify(snap.checkIns));
      const prev = this.getSuuntoConfig();
      this.saveSuuntoConfig({
        ...prev,
        ...snap.suunto,
        auth: undefined,
        serverManaged: true,
      });
    });
  },

  /** Datos de este navegador para la subida única al servidor. */
  exportForServer(): {
    profile: AthleteProfile | null;
    targetRace: TargetRace | null;
    coachMemory: CoachLearnedMemory | null;
    historyMd: AthleteHistoryDocument | null;
    workouts: Workout[];
    checkIns: DailyCheckIn[];
    suuntoAuth: SuuntoIntegrationConfig['auth'] | null;
  } {
    const has = (k: string) => localStorage.getItem(k) !== null;
    return {
      profile: has(STORAGE_KEYS.PROFILE) ? this.getProfile() : null,
      targetRace: has(STORAGE_KEYS.TARGET_RACE) ? this.getTargetRace() : null,
      coachMemory: has(STORAGE_KEYS.COACH_MEMORY) ? this.getCoachMemory() : null,
      historyMd: this.getAthleteHistory(),
      // Sin los entrenos de ejemplo del modo prueba
      workouts: this.getWorkouts().filter((w) => !SAMPLE_WORKOUT_IDS.has(w.id) && !w.id.startsWith('test-w-')),
      checkIns: this.getCheckIns().filter((c) => !c.isSample),
      suuntoAuth: this.getSuuntoConfig().auth ?? null,
    };
  },

  /** ¿Hay datos del atleta en este navegador que subir? */
  hasLocalAthleteData(): boolean {
    const e = this.exportForServer();
    return !!(e.profile || e.coachMemory || e.historyMd || e.workouts.length || e.checkIns.length || e.suuntoAuth);
  },

  /** Ejecuta fn sin avisar al servidor (para guardar en caché lo que viene de él). */
  withoutRemote<T>(fn: () => T): T {
    remoteMuted++;
    try {
      return fn();
    } finally {
      remoteMuted--;
    }
  },

  getProfile(): AthleteProfile {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (!stored) return DEFAULT_PROFILE;
      const { profile, changed } = migrateLegacyProfile(JSON.parse(stored));
      if (changed) localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
      return profile;
    } catch {
      return DEFAULT_PROFILE;
    }
  },

  saveProfile(profile: AthleteProfile): void {
    const previousBaseline = this.getProfile().baselineHrv;
    writeTracked(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    // Si cambia la HRV de referencia, los check-ins de Suunto se recalculan con ella
    if (profile.baselineHrv && profile.baselineHrv !== previousBaseline) {
      try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.DAILY_CHECKINS) || '[]');
        if (Array.isArray(raw)) {
          const rebased = raw.map((c: DailyCheckIn) => rebaseSuuntoCheckIn(c, profile.baselineHrv as number));
          writeTracked(STORAGE_KEYS.DAILY_CHECKINS, JSON.stringify(rebased));
        }
      } catch {
        // check-ins corruptos: se dejan como están
      }
    }
  },

  getTargetRace(): TargetRace {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.TARGET_RACE);
      if (!stored) return DEFAULT_TARGET_RACE;
      const race: TargetRace = JSON.parse(stored);
      // Guardada con una versión anterior: la fecha por defecto de 2027 no es oficial
      if (race.dateConfirmed === undefined && race.id === DEFAULT_TARGET_RACE.id && race.date === DEFAULT_TARGET_RACE.date) race.dateConfirmed = false;
      return race;
    } catch {
      return DEFAULT_TARGET_RACE;
    }
  },

  saveTargetRace(race: TargetRace): void {
    writeTracked(STORAGE_KEYS.TARGET_RACE, JSON.stringify(race));
  },

  getSecondaryRaces(): TargetRace[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SECONDARY_RACES);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  saveSecondaryRaces(races: TargetRace[]): void {
    localStorage.setItem(STORAGE_KEYS.SECONDARY_RACES, JSON.stringify(races));
  },

  getWorkouts(): Workout[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.WORKOUTS);
      if (stored !== null) return JSON.parse(stored);
      // Sin datos → calendario vacío. Los de ejemplo SOLO con "Cargar Prueba".
      return [];
    } catch {
      return [];
    }
  },

  saveWorkouts(workouts: Workout[]): void {
    writeTracked(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
  },

  addOrUpdateWorkout(workout: Workout): void {
    const list = this.getWorkouts();
    const index = list.findIndex(w => w.id === workout.id);
    if (index >= 0) {
      list[index] = workout;
    } else {
      list.push(workout);
    }
    this.saveWorkouts(list);
  },

  deleteWorkout(workoutId: string): void {
    const list = this.getWorkouts().filter(w => w.id !== workoutId);
    this.saveWorkouts(list);
  },

  getCheckIns(): DailyCheckIn[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DAILY_CHECKINS);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        // El semáforo se RECALCULA al leer con el motor actual (lo guardado es caché)
        if (Array.isArray(parsed)) {
          const baseline = this.getProfile().baselineHrv;
          return parsed.map((c: DailyCheckIn) => deriveCheckIn(fixLegacyReadinessScore(c), baseline));
        }
      }
      // Los de ejemplo solo en modo prueba
      return this.isTestDataActive() ? SAMPLE_DAILY_CHECKINS.map((c) => deriveCheckIn(c, this.getProfile().baselineHrv)) : [];
    } catch {
      return [];
    }
  },

  saveCheckIn(checkIn: DailyCheckIn): void {
    const list = this.getCheckIns();
    const index = list.findIndex(c => c.date === checkIn.date);
    if (index >= 0) {
      list[index] = checkIn;
    } else {
      list.unshift(checkIn);
    }
    writeTracked(STORAGE_KEYS.DAILY_CHECKINS, JSON.stringify(list));
  },

  /** Integra los datos de una sincronización con Suunto sin pisar lo que el
   * atleta registró a mano:
   * - Workouts: se salta un workoutKey ya importado; si ese día hay una sesión
   *   planificada sin completar, se completa con los datos reales; si no, se
   *   añade como sesión completada.
   * - Check-ins: se crean los días que no tienen; se actualizan los que ya
   *   venían de Suunto o eran datos de prueba; nunca se pisa uno manual. */
  mergeSuuntoSync(
    suuntoWorkouts: Workout[],
    suuntoCheckIns: DailyCheckIn[],
  ): { addedWorkouts: number; completedPlanned: number; checkInsAdded: number } {
    // Con una cuenta Suunto real, los entrenos de ejemplo (completados, con TSS
    // ficticio) contaminarían CTL/ATL/TSB: se eliminan antes de integrar.
    if (suuntoWorkouts.length > 0 && this.isTestDataActive()) {
      this.clearOnlySampleData();
    }
    // Rodajes con intensidad según la FC media frente a tu umbral aeróbico
    const w = mergeSuuntoWorkouts(this.getWorkouts(), suuntoWorkouts, resolveIntensityPrescription(this.getProfile()).aetHr);
    this.saveWorkouts(w.workouts);

    let stored: DailyCheckIn[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.DAILY_CHECKINS) || '[]');
      if (Array.isArray(raw)) stored = raw;
    } catch {
      stored = [];
    }
    // Todos los check-ins de Suunto contra la HRV de referencia del perfil
    const c = mergeSuuntoCheckIns(stored, suuntoCheckIns, this.getProfile().baselineHrv || 0, !this.isTestDataActive());
    writeTracked(STORAGE_KEYS.DAILY_CHECKINS, JSON.stringify(c.checkIns));

    return { addedWorkouts: w.addedWorkouts, completedPlanned: w.completedPlanned, checkInsAdded: c.checkInsAdded };
  },

  getTodayCheckIn(): DailyCheckIn | undefined {
    const today = localDateKey();
    return this.getCheckIns().find(c => c.date === today);
  },

  getChatMessages(): ChatMessage[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CHAT_MESSAGES);
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    // Initial welcome from Miguel
    const initialGreeting: ChatMessage = {
      id: 'welcome-miguel',
      role: 'assistant',
      content: `¡Hola! Soy Miguel, tu entrenador de Trail Running. Vamos juntos a por esa Transvulcania en 2027.

Aquí no vamos a perder el tiempo con modas ni con kilometraje basura. Nuestro manual de cabecera es *Training for the Uphill Athlete* y nuestra brújula en cada entreno serán tus pulsaciones (con los umbrales de tu Suunto) y tu HRV nocturna; ZoneSense nos servirá como segunda opinión al analizar.

Organizamos la semana en 3 sesiones entre semana (2 si toca aflojar) y la tirada larga el sábado o el domingo, con trabajo de fuerza en casa y al aire libre sin máquinas. 

Puedes revisar tus umbrales (AeT y AnT) en tu perfil, registrar tu test de deriva cardíaca, subir tus archivos .FIT de Suunto o simplemente contarme cómo te sientes hoy para calibrar la carga. ¡Dime cómo estamos de piernas y empezamos!`,
      timestamp: new Date().toISOString(),
      contextType: 'general'
    };
    return [initialGreeting];
  },

  saveChatMessages(messages: ChatMessage[]): void {
    localStorage.setItem(STORAGE_KEYS.CHAT_MESSAGES, JSON.stringify(messages));
  },

  /** Conversación de Supabase donde "Guardar" añade los mensajes (null = la próxima vez se crea una nueva). */
  getChatSessionId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.CHAT_SESSION_ID);
    } catch {
      return null;
    }
  },

  setChatSessionId(id: string | null): void {
    try {
      if (id) localStorage.setItem(STORAGE_KEYS.CHAT_SESSION_ID, id);
      else localStorage.removeItem(STORAGE_KEYS.CHAT_SESSION_ID);
    } catch {
      // sin localStorage: cada guardado crearía una conversación nueva en Supabase
    }
  },

  addChatMessage(message: ChatMessage): void {
    const msgs = this.getChatMessages();
    msgs.push(message);
    this.saveChatMessages(msgs);
  },

  getSuuntoConfig(): SuuntoIntegrationConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SUUNTO_CONFIG);
      if (!stored) return DEFAULT_SUUNTO_CONFIG;
      const cfg = JSON.parse(stored) as SuuntoIntegrationConfig;
      // Versiones anteriores marcaban connected=true con solo escribir credenciales;
      // ahora solo está conectado si hay tokens OAuth reales.
      return { ...cfg, connected: cfg.serverManaged ? !!cfg.connected : !!cfg.auth?.accessToken };
    } catch {
      return DEFAULT_SUUNTO_CONFIG;
    }
  },

  saveSuuntoConfig(config: SuuntoIntegrationConfig): void {
    localStorage.setItem(STORAGE_KEYS.SUUNTO_CONFIG, JSON.stringify(config));
  },

  getMacrocycle(): MacrocyclePlan | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MACROCYCLE);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  saveMacrocycle(plan: MacrocyclePlan): void {
    localStorage.setItem(STORAGE_KEYS.MACROCYCLE, JSON.stringify(plan));
  },

  getAthleteHistory(): AthleteHistoryDocument | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ATHLETE_HISTORY_MD);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },

  saveAthleteHistory(doc: AthleteHistoryDocument): void {
    writeTracked(STORAGE_KEYS.ATHLETE_HISTORY_MD, JSON.stringify(doc));
  },

  clearAthleteHistory(): void {
    writeTracked(STORAGE_KEYS.ATHLETE_HISTORY_MD, null);
  },

  getCoachMemory(): CoachLearnedMemory {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.COACH_MEMORY);
      if (!stored) return DEFAULT_COACH_MEMORY;
      const { memory, changed } = migrateLegacyCoachMemory(JSON.parse(stored));
      if (changed) localStorage.setItem(STORAGE_KEYS.COACH_MEMORY, JSON.stringify(memory));
      // Estado de cada aprendizaje recalculado desde sus evidencias (y caducidad)
      return refreshMemory(memory, localDateKey());
    } catch {
      return DEFAULT_COACH_MEMORY;
    }
  },

  saveCoachMemory(memory: CoachLearnedMemory): void {
    writeTracked(STORAGE_KEYS.COACH_MEMORY, JSON.stringify(memory));
  },

  /** Aplica evidencias (análisis de sesión, nota del atleta, chat confirmado). El estado lo calcula src/brain/memory.ts. */
  applyMemoryEvidence(items: EvidenceItem[], ctx: EvidenceContext): { memory: CoachLearnedMemory; changes: string[] } {
    const r = applyEvidence(this.getCoachMemory(), items, ctx, localDateKey());
    this.saveCoachMemory(r.memory);
    return r;
  },

  addCoachNotebookNote(note: string): CoachLearnedMemory {
    const memory = this.getCoachMemory();
    if (!memory.coachNotebookNotes) memory.coachNotebookNotes = [];
    memory.coachNotebookNotes.unshift(note);
    memory.lastUpdated = new Date().toISOString();
    this.saveCoachMemory(memory);
    return memory;
  },

  recordAdaptation(adaptation: {
    originalWorkoutTitle: string;
    adaptedWorkoutTitle: string;
    triggerReason: string;
    athleteOutcome?: string;
  }): CoachLearnedMemory {
    const memory = this.getCoachMemory();
    if (!memory.adaptationHistory) memory.adaptationHistory = [];
    memory.adaptationHistory.unshift({
      date: new Date().toISOString().split('T')[0],
      ...adaptation,
    });
    memory.lastUpdated = new Date().toISOString();
    this.saveCoachMemory(memory);
    return memory;
  },

  // Plantilla VACÍA: solo encabezados y huecos para rellenar. Nada de datos de
  // ejemplo, porque lo que se guarda aquí Miguel lo trata como historial real.
  getHistoryMarkdownTemplate(): string {
    return `# HISTORIAL DEL ATLETA & MÉTRICAS SUUNTO
*Documento de referencia para el entrenador Miguel. Rellena solo lo que sepas; deja en blanco lo que no.*

## 1. Perfil y datos fisiológicos
- **Nombre:**
- **Edad:**
- **Reloj Suunto:**
- **Banda de pecho (FC más precisa):**
- **FC en reposo:**
- **FC máxima (y cómo se midió):**
- **Umbral aeróbico por FC (y cómo se midió):**
- **Umbral anaeróbico por FC (y cómo se midió):**

## 2. Observaciones de pulsaciones (y ZoneSense si lo usas)
- (Qué ves en tus sesiones: cuándo sube la FC por encima de tu umbral aeróbico, en qué terreno o a qué hora de la tirada.)

## 3. Historial de carga y carreras previas
- **Años practicando trail running:**
- **Volumen semanal típico (km / D+ / días):**
- **Carreras completadas (año, distancia, desnivel, tiempo, sensaciones):**
- **Objetivo principal:** Transvulcania 2027

## 4. Lesiones y puntos débiles
-

## 5. Nutrición e hidratación habitual
- **Carbohidratos por hora que toleras:**
- **Sales / electrolitos:**
`;
  },

  // --- Gut Training Module (Mejora 2) ---
  getGutProfile(): GutTrainingProfile {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.GUT_PROFILE);
      if (!stored) return this.isTestDataActive() ? SAMPLE_GUT_PROFILE : emptyGutProfile();
      const parsed: GutTrainingProfile = JSON.parse(stored);
      if (!parsed.stages || parsed.stages.length === 0) {
        parsed.stages = emptyGutProfile().stages;
      }
      if (!parsed.activeStageId) {
        parsed.activeStageId = 1;
      }
      return parsed;
    } catch {
      return emptyGutProfile();
    }
  },

  saveGutProfile(profile: GutTrainingProfile): void {
    localStorage.setItem(STORAGE_KEYS.GUT_PROFILE, JSON.stringify(profile));
  },

  addGutEntry(entry: GutTrainingEntry): GutTrainingProfile {
    const profile = this.getGutProfile();
    profile.entries.unshift(entry);
    // Auto-update tolerance if rating was 5/5 and higher than previous max
    if (entry.giToleranceRating >= 4 && entry.carbsIngestedGramsPerHour > profile.currentMaxCarbsPerHour) {
      profile.currentMaxCarbsPerHour = entry.carbsIngestedGramsPerHour;
    }
    this.saveGutProfile(profile);
    return profile;
  },

  // --- Transvulcania Simulation Plan (Mejora 1) ---
  getTransvulcaniaPlan(customFinishHours = 12.5): TransvulcaniaSimulationPlan {
    let basePlan: TransvulcaniaSimulationPlan | null = null;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RACE_SIMULATION);
      if (stored) {
        basePlan = JSON.parse(stored);
        if (basePlan && Math.abs(basePlan.estimatedFinishMinutes - customFinishHours * 60) < 1) {
          return basePlan;
        }
      }
    } catch {
      // fallback
    }

    // Segmentos del simulador: SOLO en modo prueba. No son datos verificados
    // del recorrido ni del atleta (incluyen topes de FC y tiempos de ejemplo).
    const segments = this.isTestDataActive() ? SAMPLE_TRANSVULCANIA_SEGMENTS : [];
    const baseTotalMinutes = segments.reduce((sum, s) => sum + s.estimatedTimeMin, 0);
    const targetTotalMinutes = customFinishHours * 60;
    const ratio = baseTotalMinutes > 0 ? targetTotalMinutes / baseTotalMinutes : 1;

    const scaledSegments = segments.map((seg) => ({
      ...seg,
      estimatedTimeMin: Math.round(seg.estimatedTimeMin * ratio),
    }));

    const hoursPart = Math.floor(customFinishHours);
    const minutesPart = Math.round((customFinishHours % 1) * 60);
    const formattedMinutes = minutesPart < 10 ? `0${minutesPart}` : `${minutesPart}`;

    const plan: TransvulcaniaSimulationPlan = {
      raceName: 'Transvulcania Ultramarathon (La Palma)',
      totalDistanceKm: 73.0,
      totalElevationGainM: 4350,
      totalElevationLossM: 4057,
      estimatedFinishTimeFormatted: `${hoursPart}h ${formattedMinutes}m`,
      estimatedFinishMinutes: Math.round(targetTotalMinutes),
      segments: scaledSegments,
      overallPacingStrategy: 'Subidas por debajo de tu umbral aeróbico (FC); en el descenso final, cadencia alta sin frenar en seco.',
      eccentricImpactWarning: 'El descenso final hasta Tazacorte es muy largo: prepara los cuádriceps con trabajo excéntrico.',
    };

    return plan;
  },

  saveTransvulcaniaPlan(plan: TransvulcaniaSimulationPlan): void {
    localStorage.setItem(STORAGE_KEYS.RACE_SIMULATION, JSON.stringify(plan));
  },

  // --- PMC Performance Management Chart (Mejora 3) ---
  // El PMC ya no se guarda: se calcula siempre a partir de los entrenos
  // completados (TSS de Suunto). Así nunca se mezcla con series de ejemplo.
  getPMCData(): PMCDataPoint[] {
    return computePmcSeries(this.getWorkouts(), this.getProfile().antHr);
  },

  /** Borra la serie PMC antigua (datos de ejemplo) que guardaban versiones anteriores. */
  savePMCData(_points?: PMCDataPoint[]): void {
    localStorage.removeItem(STORAGE_KEYS.PMC_DATA);
  },

  // --- Eccentric Outdoor Exercises (Mejora 4) ---
  getEccentricExercises(): EccentricOutdoorExercise[] {
    return SAMPLE_ECCENTRIC_EXERCISES;
  },

  // --- Weight History & Race Weight Tracking ---
  getWeightHistory(): WeightEntry[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.WEIGHT_HISTORY);
      if (stored) return JSON.parse(stored);
      return this.isTestDataActive() ? SAMPLE_WEIGHT_HISTORY : [];
    } catch {
      return [];
    }
  },

  /** Peso actual: el último pesaje registrado; si no hay ninguno, el del perfil. */
  getCurrentWeightKg(): number {
    const history = [...this.getWeightHistory()].sort((a, b) => a.date.localeCompare(b.date));
    return history.length > 0 ? history[history.length - 1].weightKg : (this.getProfile().weightKg || 0);
  },

  saveWeightHistory(history: WeightEntry[]): void {
    localStorage.setItem(STORAGE_KEYS.WEIGHT_HISTORY, JSON.stringify(history));
  },

  addWeightEntry(entry: Omit<WeightEntry, 'id'>): WeightEntry[] {
    const history = this.getWeightHistory();
    const newEntry: WeightEntry = {
      ...entry,
      id: `w-${Date.now()}`
    };
    const updated = [...history, newEntry].sort((a, b) => a.date.localeCompare(b.date));
    this.saveWeightHistory(updated);

    // El peso del perfil es siempre el del último pesaje (por fecha)
    const profile = this.getProfile();
    profile.weightKg = updated[updated.length - 1].weightKg;
    profile.weightHistory = updated;
    this.saveProfile(profile);

    return updated;
  },

  deleteWeightEntry(id: string): WeightEntry[] {
    const history = this.getWeightHistory().filter(e => e.id !== id);
    this.saveWeightHistory(history);
    if (history.length > 0) {
      const profile = this.getProfile();
      profile.weightKg = [...history].sort((a, b) => a.date.localeCompare(b.date))[history.length - 1].weightKg;
      profile.weightHistory = history;
      this.saveProfile(profile);
    }
    return history;
  },

  // --- Weekly Performance Summaries (Resumen de Rendimiento) ---
  getWeeklySummaries(): WeeklyPerformanceSummary[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.WEEKLY_SUMMARIES);
      if (stored) return JSON.parse(stored);
      return this.isTestDataActive() ? SAMPLE_WEEKLY_SUMMARIES : [];
    } catch {
      return [];
    }
  },

  saveWeeklySummaries(summaries: WeeklyPerformanceSummary[]): void {
    localStorage.setItem(STORAGE_KEYS.WEEKLY_SUMMARIES, JSON.stringify(summaries));
  },

  // --- Mesocycle Progression Summaries ---
  getMesocycleProgression(): MesocycleProgressionSummary[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MESOCYCLE_PROGRESSION);
      if (stored) return JSON.parse(stored);
      return this.isTestDataActive() ? SAMPLE_MESOCYCLE_PROGRESSION : [];
    } catch {
      return [];
    }
  },

  saveMesocycleProgression(mesos: MesocycleProgressionSummary[]): void {
    localStorage.setItem(STORAGE_KEYS.MESOCYCLE_PROGRESSION, JSON.stringify(mesos));
  },

  // --- Hydration Tests & Sweat Rate Tracking ---
  getHydrationTests(): SweatRateTest[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HYDRATION_TESTS);
      if (stored) return JSON.parse(stored);
      return this.isTestDataActive() ? SAMPLE_HYDRATION_TESTS : [];
    } catch {
      return [];
    }
  },

  saveHydrationTests(tests: SweatRateTest[]): void {
    localStorage.setItem(STORAGE_KEYS.HYDRATION_TESTS, JSON.stringify(tests));
  },

  addHydrationTest(test: Omit<SweatRateTest, 'id'>): SweatRateTest[] {
    const list = this.getHydrationTests();
    const newTest: SweatRateTest = {
      ...test,
      id: `sweat-test-${Date.now()}`
    };
    const updated = [newTest, ...list];
    this.saveHydrationTests(updated);
    return updated;
  },

  deleteHydrationTest(id: string): SweatRateTest[] {
    const list = this.getHydrationTests().filter(t => t.id !== id);
    this.saveHydrationTests(list);
    return list;
  },

  // Plan de hidratación por tramos: SOLO en modo prueba (cifras de ejemplo, no tuyas).
  getTransvulcaniaHydrationSections(): TransvulcaniaHydrationSection[] {
    return this.isTestDataActive() ? SAMPLE_TRANSVULCANIA_HYDRATION_SECTIONS : [];
  },

  // --- WUT (Weight Urine Thirst) Hydration Check ---
  getWUTCheck(): WUTDailyCheck | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.WUT_CHECKS);
      if (stored) return JSON.parse(stored);
      return this.isTestDataActive() ? SAMPLE_WUT_CHECK : null;
    } catch {
      return null;
    }
  },

  saveWUTCheck(check: WUTDailyCheck): void {
    localStorage.setItem(STORAGE_KEYS.WUT_CHECKS, JSON.stringify(check));
  },

  // --- Test Data Management ---
  isTestDataActive(): boolean {
    return localStorage.getItem(STORAGE_KEYS.TEST_DATA_ACTIVE) === 'true';
  },

  setTestDataActive(active: boolean): void {
    localStorage.setItem(STORAGE_KEYS.TEST_DATA_ACTIVE, active ? 'true' : 'false');
  },

  // Inspects how many user workouts vs sample workouts are currently in database
  getDataCounts(): { userWorkouts: number; sampleWorkouts: number; userWeights: number } {
    const workouts = this.getWorkouts();
    const sampleIds = new Set(SAMPLE_TEST_WORKOUTS.map(w => w.id));
    let sampleWorkouts = 0;
    let userWorkouts = 0;
    for (const w of workouts) {
      if (sampleIds.has(w.id) || w.id.startsWith('test-w-')) {
        sampleWorkouts++;
      } else {
        userWorkouts++;
      }
    }
    const sampleWeightIds = new Set(SAMPLE_WEIGHT_HISTORY.map(e => e.id));
    const userWeights = this.getWeightHistory().filter(e => !sampleWeightIds.has(e.id)).length;
    return { userWorkouts, sampleWorkouts, userWeights };
  },

  /**
   * Añade los datos de ejemplo SIN borrar los tuyos (antes los sustituía: se perdían
   * entrenos, check-ins, peso, gut training e hidratación reales).
   */
  loadFullTestData(): void {
    const has = (key: string) => localStorage.getItem(key) !== null;
    const sampleIds = new Set(SAMPLE_TEST_WORKOUTS.map((w) => w.id));
    this.saveWorkouts([...this.getWorkouts().filter((w) => !sampleIds.has(w.id)), ...SAMPLE_TEST_WORKOUTS]);
    if (!has(STORAGE_KEYS.GUT_PROFILE)) this.saveGutProfile(SAMPLE_GUT_PROFILE);
    const sampleWeightIds = new Set(SAMPLE_WEIGHT_HISTORY.map((e) => e.id));
    this.saveWeightHistory([...this.getWeightHistory().filter((e) => !sampleWeightIds.has(e.id)), ...SAMPLE_WEIGHT_HISTORY]);
    if (!has(STORAGE_KEYS.WEEKLY_SUMMARIES)) this.saveWeeklySummaries(SAMPLE_WEEKLY_SUMMARIES);
    if (!has(STORAGE_KEYS.MESOCYCLE_PROGRESSION)) this.saveMesocycleProgression(SAMPLE_MESOCYCLE_PROGRESSION);
    const sampleHydrationIds = new Set(SAMPLE_HYDRATION_TESTS.map((t) => t.id));
    this.saveHydrationTests([...this.getHydrationTests().filter((t) => !sampleHydrationIds.has(t.id)), ...SAMPLE_HYDRATION_TESTS]);
    if (!has(STORAGE_KEYS.WUT_CHECKS)) this.saveWUTCheck(SAMPLE_WUT_CHECK);
    // Check-ins de ejemplo solo en los días sin check-in tuyo, y marcados para poder quitarlos
    const real = this.getCheckIns().filter((c) => !c.isSample);
    const realDates = new Set(real.map((c) => c.date));
    const samples = SAMPLE_DAILY_CHECKINS.filter((c) => !realDates.has(c.date)).map((c) => ({ ...c, isSample: true }));
    writeTracked(STORAGE_KEYS.DAILY_CHECKINS, JSON.stringify([...real, ...samples].sort((a, b) => b.date.localeCompare(a.date))));
    this.setTestDataActive(true);
  },

  // PRESERVES user-created workouts, weights, tests and check-ins; removes ONLY test/sample records
  clearOnlySampleData(): { preservedUserWorkouts: number; removedSampleWorkouts: number } {
    const sampleIds = new Set(SAMPLE_TEST_WORKOUTS.map(w => w.id));
    const allWorkouts = this.getWorkouts();
    const userWorkouts = allWorkouts.filter(w => !sampleIds.has(w.id) && !w.id.startsWith('test-w-'));
    const removedSampleWorkouts = allWorkouts.length - userWorkouts.length;
    
    // Save only user workouts (as '[]' if empty, so it doesn't auto-repopulate)
    this.saveWorkouts(userWorkouts);

    // Keep user-entered weight records
    const sampleWeightIds = new Set(SAMPLE_WEIGHT_HISTORY.map(e => e.id));
    const userWeights = this.getWeightHistory().filter(e => !sampleWeightIds.has(e.id));
    this.saveWeightHistory(userWeights);

    // Keep user-entered hydration tests
    const sampleHydrationIds = new Set(SAMPLE_HYDRATION_TESTS.map(t => t.id));
    const userHydrationTests = this.getHydrationTests().filter(t => !sampleHydrationIds.has(t.id));
    this.saveHydrationTests(userHydrationTests);

    // Se quitan solo los check-ins de ejemplo. Los tuyos (manuales y de Suunto) se
    // conservan todos (antes se borraba todo salvo el de hoy).
    const all = this.getCheckIns();
    const marked = all.some((c) => c.isSample);
    const today = localDateKey();
    const userCheckIns = marked
      ? all.filter((c) => !c.isSample)
      : // Datos de prueba cargados con una versión anterior (sin marca): se conservan los
        // de Suunto y el de hoy; el resto no se puede distinguir de los de ejemplo.
        all.filter((c) => c.source === 'suunto' || c.date === today);
    writeTracked(STORAGE_KEYS.DAILY_CHECKINS, JSON.stringify(userCheckIns));
    // Gut training de ejemplo: fuera si no lo has cambiado
    if (localStorage.getItem(STORAGE_KEYS.GUT_PROFILE) === JSON.stringify(SAMPLE_GUT_PROFILE)) localStorage.removeItem(STORAGE_KEYS.GUT_PROFILE);
    // Resto de registros de ejemplo que no has cambiado
    const sameAsSample: [string, unknown][] = [
      [STORAGE_KEYS.WEEKLY_SUMMARIES, SAMPLE_WEEKLY_SUMMARIES],
      [STORAGE_KEYS.MESOCYCLE_PROGRESSION, SAMPLE_MESOCYCLE_PROGRESSION],
      [STORAGE_KEYS.WUT_CHECKS, SAMPLE_WUT_CHECK],
    ];
    for (const [key, sample] of sameAsSample) {
      if (localStorage.getItem(key) === JSON.stringify(sample)) localStorage.removeItem(key);
    }
    // Simulación de carrera generada con los tramos de ejemplo
    localStorage.removeItem(STORAGE_KEYS.RACE_SIMULATION);

    this.setTestDataActive(false);
    return { preservedUserWorkouts: userWorkouts.length, removedSampleWorkouts };
  },

  // Complete purge of calendar if athlete explicitly wants an empty slate
  clearAllWorkoutsAndData(): void {
    this.saveWorkouts([]); // empty array
    this.saveWeightHistory([]);
    this.saveHydrationTests([]);
    writeTracked(STORAGE_KEYS.DAILY_CHECKINS, JSON.stringify([]));
    localStorage.removeItem(STORAGE_KEYS.GUT_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.PMC_DATA);
    localStorage.removeItem(STORAGE_KEYS.WEEKLY_SUMMARIES);
    localStorage.removeItem(STORAGE_KEYS.MESOCYCLE_PROGRESSION);
    localStorage.removeItem(STORAGE_KEYS.WUT_CHECKS);
    this.setTestDataActive(false);
  },

  clearTestData(): void {
    // Default safe behavior: clear only sample data
    this.clearOnlySampleData();
  },

  // --- Full Backup & Portability System (Mejora 1) ---
  exportFullBackup(): AppBackupData {
    const profile = this.getProfile();
    return {
      version: '1.2.0',
      exportedAt: new Date().toISOString(),
      app: 'Uphill Coach AI (Miguel)',
      athleteName: profile.name,
      data: {
        profile,
        targetRace: this.getTargetRace(),
        secondaryRaces: this.getSecondaryRaces(),
        workouts: this.getWorkouts(),
        dailyCheckIns: this.getCheckIns(),
        chatMessages: this.getChatMessages(),
        suuntoConfig: this.getSuuntoConfig(),
        macrocycle: this.getMacrocycle(),
        athleteHistoryMd: localStorage.getItem(STORAGE_KEYS.ATHLETE_HISTORY_MD) || undefined,
        coachMemory: this.getCoachMemory(),
        gutProfile: this.getGutProfile(),
        raceSimulation: this.getTransvulcaniaPlan(),
        pmcData: this.getPMCData(),
        weightHistory: this.getWeightHistory(),
        weeklySummaries: this.getWeeklySummaries(),
        mesocycleProgression: this.getMesocycleProgression(),
        hydrationTests: this.getHydrationTests(),
        wutChecks: this.getWUTCheck() ?? undefined
      }
    };
  },

  downloadBackupFile(): void {
    const backup = this.exportFullBackup();
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.href = url;
    link.download = `uphill-coach-backup-${backup.athleteName.toLowerCase().replace(/\s+/g, '_')}-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  importFullBackup(backup: AppBackupData): { success: boolean; error?: string; countSummary: Record<string, number> } {
    try {
      if (!backup || !backup.data) {
        return { success: false, error: 'Archivo de copia de seguridad inválido o estructura corrupta.', countSummary: {} };
      }

      const { data } = backup;
      const countSummary: Record<string, number> = {};

      if (data.profile) {
        this.saveProfile(data.profile);
        countSummary.profile = 1;
      }
      if (data.targetRace) {
        this.saveTargetRace(data.targetRace);
      }
      if (data.secondaryRaces) {
        this.saveSecondaryRaces(data.secondaryRaces);
      }
      if (Array.isArray(data.workouts)) {
        this.saveWorkouts(data.workouts);
        countSummary.workouts = data.workouts.length;
      }
      if (Array.isArray(data.dailyCheckIns)) {
        writeTracked(STORAGE_KEYS.DAILY_CHECKINS, JSON.stringify(data.dailyCheckIns));
        countSummary.checkIns = data.dailyCheckIns.length;
      }
      if (Array.isArray(data.chatMessages)) {
        this.saveChatMessages(data.chatMessages);
      }
      if (data.suuntoConfig) {
        this.saveSuuntoConfig(data.suuntoConfig);
      }
      if (data.macrocycle) {
        this.saveMacrocycle(data.macrocycle);
      }
      if (data.athleteHistoryMd) {
        writeTracked(STORAGE_KEYS.ATHLETE_HISTORY_MD, data.athleteHistoryMd);
      }
      if (data.coachMemory) {
        this.saveCoachMemory(data.coachMemory);
        countSummary.coachRules = data.coachMemory.insights.length;
      }
      if (data.gutProfile) {
        this.saveGutProfile(data.gutProfile);
      }
      if (data.raceSimulation) {
        this.saveTransvulcaniaPlan(data.raceSimulation);
      }
      if (Array.isArray(data.pmcData)) {
        // La serie PMC se recalcula desde los entrenos; no se importa.
        countSummary.pmcPoints = data.pmcData.length;
      }
      if (Array.isArray(data.weightHistory)) {
        this.saveWeightHistory(data.weightHistory);
        countSummary.weights = data.weightHistory.length;
      }
      if (Array.isArray(data.weeklySummaries)) {
        this.saveWeeklySummaries(data.weeklySummaries);
      }
      if (Array.isArray(data.mesocycleProgression)) {
        this.saveMesocycleProgression(data.mesocycleProgression);
      }
      if (Array.isArray(data.hydrationTests)) {
        this.saveHydrationTests(data.hydrationTests);
      }
      if (data.wutChecks) {
        this.saveWUTCheck(data.wutChecks);
      }

      return { success: true, countSummary };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error al restaurar los datos.', countSummary: {} };
    }
  }
};
