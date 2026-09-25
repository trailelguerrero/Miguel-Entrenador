export type WorkoutType = 
  | 'easy_run' 
  | 'long_mountain_run' 
  | 'muscular_endurance' 
  | 'hill_intervals' 
  | 'intensity_run' // carrera importada de Suunto con > 20 % del tiempo en amarillo/rojo de ZoneSense
  | 'strength_core' 
  | 'drift_test' 
  | 'cross_training' 
  | 'rest';

export type ZoneSenseState = 'aerobic' | 'aerobic_anaerobic' | 'anaerobic' | 'recovery';

export interface StrengthExercise {
  name: string;
  sets: number;
  reps: string;
  notes: string;
  targetMuscle: string;
  isOutdoorFriendly: boolean;
}

/** Colores de Suunto ZoneSense: se evalúan contra la línea base de cada día, no contra una FC. */
export type ZoneSenseTarget =
  | 'ZoneSense verde (aeróbico)'
  | 'ZoneSense amarillo (entre umbrales)'
  | 'ZoneSense rojo (sobre umbral anaeróbico)'
  | 'Regenerativo (verde, muy suave)';
export type LegacyZoneSenseTarget =
  | 'DFA a1 > 0.75 (Aeróbico puro)'
  | 'DFA a1 0.75 - 0.50 (Transición)'
  | 'DFA a1 < 0.50 (Anaeróbico)'
  | 'Regenerativo';

/** Fuente de la prescripción de intensidad (jerarquía en src/brain/intensity.ts). */
export type IntensitySource = 'zonesense' | 'heart_rate_measured' | 'rpe' | 'terrain' | 'unknown';

export interface Workout {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: WorkoutType;
  plannedDurationMin: number;
  plannedDistanceKm?: number;
  plannedElevationGainM?: number;
  
  // Uphill Athlete & ZoneSense targets
  // Topes de FC: SOLO con umbral medido (si no, null). Ver src/brain/intensity.ts
  targetHrMin?: number | null;
  targetHrMax?: number | null;
  /** De dónde sale la prescripción de intensidad de esta sesión. */
  intensitySource?: IntensitySource;
  // Objetivo de intensidad en colores de ZoneSense (NO equivalen a pulsaciones).
  // Se aceptan los textos antiguos "DFA a1 ..." de sesiones ya guardadas.
  zoneSenseTarget?: ZoneSenseTarget | LegacyZoneSenseTarget;
  
  description: string;
  personalizedReasoning?: string; // Why this session was custom-crafted for this specific athlete
  learnedAdjustment?: string; // Adaptation derived from Miguel's accumulated learning
  warmup?: string;
  mainSet: string;
  cooldown?: string;
  strengthExercises?: StrengthExercise[];
  terrainRecommendation?: string;
  nutritionAdvice?: string;
  
  // Execution tracking
  completed: boolean;
  actualDurationMin?: number;
  actualDistanceKm?: number;
  actualElevationGainM?: number;
  actualElevationLossM?: number;
  actualAvgHr?: number;
  actualMaxHr?: number;
  actualDfaAlpha1Avg?: number; // ZoneSense average
  zoneSenseBreakdown?: {
    aerobicPct: number; // ZoneSense verde (aeróbico)
    transitionPct: number; // ZoneSense amarillo (entre umbrales)
    anaerobicPct: number; // ZoneSense rojo (sobre umbral anaeróbico)
    /** % de la duración del entreno que ZoneSense llegó a medir (los % de color son sobre ese tiempo). */
    measuredPct?: number;
  };
  athleteRpe?: number; // 1 to 10
  athleteNotes?: string;
  coachFeedback?: string;
  wasAdapted?: boolean;
  adaptationReason?: string;

  // Gut training & Fueling tracking (Mejora 2)
  plannedCarbsPerHourG?: number | null;
  actualCarbsPerHourG?: number;
  plannedFluidsPerHourMl?: number | null;
  actualFluidsPerHourMl?: number;
  plannedSodiumPerHourMg?: number | null;
  actualSodiumPerHourMg?: number;
  fuelingGuideline?: WorkoutFuelingGuideline;
  giToleranceRating?: 1 | 2 | 3 | 4 | 5; // 1 = Severe distress / vomits, 5 = Perfect digestion
  fuelingNotes?: string;

  // Training Stress Metrics (Coggan / Friel standard)
  tss?: number;
  plannedTss?: number;
  actualTss?: number;
  intensityFactor?: number; // IF = HR_avg / AnT (LTHR)

  // Sincronización con Suunto: workoutKey de Suunto, para no importar dos veces la misma actividad
  suuntoWorkoutKey?: string;
  /** Añadido a mano en la app de Suunto (sin pulsómetro): su TSS es un valor fijo de Suunto, no medido. */
  suuntoManualEntry?: boolean;
}

export interface WorkoutFuelingGuideline {
  carbsPerHourG: number;
  fluidsPerHourMl: number;
  sodiumPerHourMg: number;
  recommendedFuelTypes: string[];
  temperatureContext?: 'mild' | 'warm' | 'hot';
  preWorkoutFueling?: string;
  postWorkoutRecovery?: string;
}

// 1. Transvulcania Race Simulation Types
export interface RaceSimulationSegment {
  id: string;
  name: string;
  fromKm: number;
  toKm: number;
  elevationGainM: number;
  elevationLossM: number;
  highestAltM: number;
  surfaceType: 'volcanic_sand' | 'dirt_trail' | 'technical_rock' | 'steep_descent_rock' | 'paved_road';
  targetHrCap: number; // Max HR advised for this segment (strict sub-AeT on climbs, low HR on descents)
  recommendedEffort: 'AeT puro / Power-Hike' | 'ZoneSense verde' | 'Z1 Controlada' | 'Protección Cuádriceps / Frenado mínimo';
  estimatedTimeMin: number;
  targetCarbsGrams: number;
  targetSodiumMg: number;
  targetFluidsMl: number;
  tacticalAdvice: string;
  isCutoffPoint?: boolean;
  cutoffTimeLimitMinutes?: number;
}

export interface TransvulcaniaSimulationPlan {
  raceName: string;
  totalDistanceKm: number;
  totalElevationGainM: number;
  totalElevationLossM: number;
  estimatedFinishTimeFormatted: string;
  estimatedFinishMinutes: number;
  segments: RaceSimulationSegment[];
  overallPacingStrategy: string;
  eccentricImpactWarning: string;
}

// 2. Gut Training Module
export interface GutTrainingEntry {
  id: string;
  date: string;
  workoutTitle: string;
  durationMin: number;
  carbsTargetGramsPerHour: number;
  carbsIngestedGramsPerHour: number;
  sodiumTargetMgPerHour: number;
  hydrationMlPerHour: number;
  fuelsUsed: string[]; // e.g. "Geles maltodextrina:fructosa 1:0.8", "Dátiles", "Sales isotónicas"
  giToleranceRating: 1 | 2 | 3 | 4 | 5; // 1 (Bad) to 5 (Rock solid)
  symptomsReported?: string[]; // e.g. "Pesadez", "Reflujo", "Náuseas", "Gases", "Ninguno"
  miguelDigestiveFeedback?: string;
}

export interface AdaptationStage {
  id: number;
  name: string;
  shortName: string;
  carbsRangeLabel: string;
  minCarbsGramsPerHour: number;
  maxCarbsGramsPerHour: number;
  status: 'completed' | 'in_progress' | 'locked';
  sessionsRequired: number;
  sessionsCompleted: number;
  biologicalMechanism: string;
  targetTransporters: string;
  recommendedFuels: string[];
  coachGraduationCriteria: string;
  coachTips: string;
}

export interface NutritionPlanCalculation {
  sessionType: 'recovery_base' | 'long_run_mountain' | 'threshold_intervals' | 'race_transvulcania';
  durationHours: number;
  elevationGainM: number;
  temperatureC: number;
  athleteWeightKg: number;
  totalKcal: number;
  kcalPerHour: number;
  fatOxidationGrams: number;
  fatOxidationKcal: number;
  fatPct: number;
  choOxidationGrams: number;
  choOxidationKcal: number;
  choPct: number;
  targetChoPerHourGrams: number;
  totalChoToIngestGrams: number;
  fuelStrategyGels: number;
  fuelStrategySolids: number;
  fuelStrategyLiquidChoGrams: number;
  hourlyFluidsMl: number;
  totalFluidsLiters: number;
  hourlySodiumMg: number;
  totalSodiumMg: number;
  recoveryWindow: {
    choGrams: number;
    proteinGrams: number;
    ratio: string;
    hydrationRecommendation: string;
  };
}

export interface GutTrainingProfile {
  currentMaxCarbsPerHour: number; // Current gut tolerance (e.g. 55g/h)
  goalCarbsPerHour: number; // Target for Transvulcania (e.g. 80g/h)
  trainingPhase: 'Initiation (30-45g/h)' | 'Volume Tolerance (50-65g/h)' | 'Race Pace High Load (70-90g/h)';
  activeStageId?: number; // 1, 2, 3 or 4
  stages?: AdaptationStage[];
  fatMaxGramsPerHour?: number; // Estimated fat oxidation at sub-AeT pace
  gutSensitivities: string[];
  entries: GutTrainingEntry[];
}

// 3. Performance Management Chart (PMC) with Coggan / Friel Metrics
export interface PMCDataPoint {
  date: string; // YYYY-MM-DD
  dayLabel: string;
  tss: number; // Standard Training Stress Score (Coggan)
  mountainTss: number; // Mountain-adjusted TSS factoring eccentric descent
  ctl: number; // Chronic Training Load (Fitness - 42d EWMA)
  atl: number; // Acute Training Load (Fatigue - 7d EWMA)
  tsb: number; // Training Stress Balance (Form = CTL - ATL)
  rampRate?: number; // 7-day change in CTL (+3 to +7 is safe)
  intensityFactor?: number; // Daily average Intensity Factor (IF)
  zoneSenseAerobicMin: number; // Minutos en ZoneSense verde
  elevationGainM: number;
  elevationLossM: number; // Eccentric muscle stress
  workoutTitle?: string;
  rpe?: number;
}

// 4. Outdoor Eccentric Strength Exercise
export interface EccentricOutdoorExercise {
  id: string;
  name: string;
  targetMuscles: string;
  outdoorSetup: string; // "Escalón alto, tronco caído o roca estable en el sendero"
  tempoPattern: string; // "3-1-1" (3s bajada excéntrica, 1s pausa isométrica, 1s subida concéntrica)
  downSeconds: number;
  pauseSeconds: number;
  upSeconds: number;
  sets: number;
  reps: string;
  instruction: string;
  biomechanicalPurpose: string; // Por qué prepara la bajada de 2.410m de El Time
  riskWarning: string;
  iconType: 'step_down' | 'soleus_drop' | 'bulgarian_split' | 'downhill_lunge' | 'anti_rotation_core';
}

export interface TargetRace {
  id: string;
  name: string;
  date: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  priority: 'A' | 'B' | 'C';
  location: string;
  terrainDescription: string;
  targetPaceOrTime?: string;
  notes?: string;
  /** false = fecha estimada (la organización aún no la ha publicado). */
  dateConfirmed?: boolean;
  /** De dónde sale cada dato: 'web' = verificado con fuentes; 'athlete' = lo introdujo el atleta. Sin entrada = sin dato. */
  dataSources?: Partial<Record<RaceDataField, 'web' | 'athlete'>>;
  /** Páginas que respaldan los datos verificados. */
  webSources?: { title: string; uri: string }[];
  /** Datos que la búsqueda no pudo verificar. */
  unverifiedFields?: RaceDataField[];
  /** Avisos de coherencia entre datos (p. ej. distancia y desnivel de páginas distintas). */
  dataWarnings?: string[];
  verifiedAt?: string;
}

export type RaceDataField = 'name' | 'date' | 'distanceKm' | 'elevationGainM' | 'elevationLossM' | 'location' | 'terrainDescription' | 'altitudeRange';

/** Respuesta de /api/race-info: solo datos respaldados por páginas reales. */
export interface RaceInfoResult {
  verified: boolean;
  fields: Partial<Record<RaceDataField, { value: string | number; sources: { title: string; uri: string }[] }>>;
  unverified: RaceDataField[];
  sources: { title: string; uri: string }[];
  queries: string[];
  /** Avisos de coherencia entre campos. */
  warnings?: string[];
  strategicAdvice: string | null;
  message?: string;
  checkedAt?: string;
}

export interface AthleteHistoryDocument {
  fileName: string;
  lastUpdated: string;
  content: string; // The full raw markdown text
  parsedSummary?: {
    aetHr?: number;
    antHr?: number;
    maxHr?: number;
    restingHr?: number;
    zoneSenseObservations?: string;
    keyRaces?: string[];
    injuries?: string[];
    weeklyVolumeKm?: number;
  };
  miguelAnalysis?: string;
}

export interface CoachLearnedInsight {
  id: string;
  category: 'physiology_zonesense' | 'fatigue_recovery' | 'biomechanics_injury' | 'nutrition_hydration' | 'terrain_technique';
  observation: string; // What Miguel has verified about the athlete
  ruleForFuturePlans: string; // Dynamic rule applied to next training generations
  /** % de evidencias a favor (lo calcula src/brain/memory.ts, no la IA). */
  confidenceScore: number;
  learnedFromDate: string;
  sourceEvent: string; // e.g. "Análisis FIT de Tirada Larga" o "Feedback Post-sesión" o "Check-in Matutino"
  /** Estado calculado a partir de las evidencias (src/brain/memory.ts). */
  status?: InsightStatus;
  evidence?: InsightEvidence[];
  lastEvidenceAt?: string;
}

export type InsightStatus = 'observation' | 'hypothesis' | 'provisional_rule' | 'consolidated_rule' | 'refuted' | 'expired';

export interface InsightEvidence {
  date: string; // YYYY-MM-DD
  source: 'workout_analysis' | 'athlete_note' | 'chat' | 'legacy';
  /** true = apoya el aprendizaje; false = lo contradice. */
  supports: boolean;
  summary: string;
  /** Sesión, nota o conversación de origen (una misma fuente cuenta una sola vez). */
  refId?: string;
  /** Evidencia en contra GRAVE (lesión, dolor agudo, sobreentrenamiento): anula el aprendizaje. */
  critical?: boolean;
}

/** Evidencia propuesta desde el chat, pendiente de que el atleta la confirme. */
export interface PendingMemoryEvidence {
  id: string;
  date: string;
  refId: string;
  item: {
    insightId: string | null;
    supports: boolean;
    summary: string;
    critical?: boolean;
    category?: CoachLearnedInsight['category'];
    observation?: string;
    hypothesis?: string;
  };
}

export interface CoachLearnedMemory {
  athleteId: string;
  lastUpdated: string;
  overallPhilosophySummary: string; // High-level personalized coaching assessment
  insights: CoachLearnedInsight[];
  adaptationHistory: Array<{
    date: string;
    originalWorkoutTitle: string;
    adaptedWorkoutTitle: string;
    triggerReason: string;
    athleteOutcome?: string;
  }>;
  coachNotebookNotes: string[]; // Notes written by Miguel or athlete to Miguel
  /** Evidencias extraídas del chat que el atleta aún no ha confirmado. */
  pendingEvidence?: PendingMemoryEvidence[];
}

export interface WeightEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
  bodyFatPct?: number;
  notes?: string;
}

// Hydration Plan & Analysis Types
export interface SweatRateTest {
  id: string;
  date: string;
  workoutTitle: string;
  preWeightKg: number;
  postWeightKg: number;
  fluidsConsumedMl: number;
  urineMl: number;
  durationMin: number;
  temperatureC: number;
  elevationGainM?: number;
  sweatLossLiters: number;
  sweatRateLitersPerHour: number;
  bodyWeightLossPct: number;
  sodiumLossEstimateMgPerHour: number;
  recommendedFluidsPerHourMl: number;
  hydrationRiskLevel: 'optimal' | 'moderate_dehydration' | 'severe_dehydration';
  notes?: string;
  coachFeedback?: string;
}

export interface TransvulcaniaHydrationSection {
  segmentId: string;
  name: string;
  fromKm: number;
  toKm: number;
  distanceKm: number;
  dPlusM: number;
  dMinusM: number;
  estimatedHours: number;
  climateZone: string;
  tempRangeC: string;
  recommendedCarryMl: number;
  hourlyTargetMl: number;
  hourlySodiumMg: number;
  flaskSetup: string;
  aidStationName: string;
  coachWarning: string;
}

export interface WUTDailyCheck {
  id: string;
  date: string;
  weightDown: boolean; // Weight > 1% lower than 3-day average
  urineColorScore: number; // 1 to 8 (Armstrong Scale)
  morningThirst: boolean; // Persistent morning dry mouth
  score: number; // 0 = Euhydrated, 1 = Mild hypohydration risk, 2-3 = Significant hypohydration
  status: 'optimal' | 'mild_risk' | 'dehydrated';
  advice: string;
}

export interface UltraExperienceDetails {
  longestRaceKm?: number;
  longestRaceElevationGainM?: number;
  completedUltras?: string; // ej: "UTMB 2021, CSP 115k 2023, Trail Peñalara 60k"
  downhillTechnicalAbility?: 'beginner' | 'intermediate' | 'expert_technical'; // habilidad en bajadas técnicas
  polesUsage?: 'never' | 'steep_only' | 'expert_all_hills'; // uso de bastones
  sleepQualityAvgHours?: number; // horas de sueño nocturno habitual
  dailyWorkStressLevel?: 'low' | 'moderate' | 'high_physical' | 'high_mental'; // nivel de estrés diario
  recoveryCapacityAt50?: string; // sensaciones de recuperación muscular a sus 50 años
  vulnerableJointsOrTissues?: string[]; // ej: ["Tendón de Aquiles", "Fascia plantar", "Cintilla iliotibial", "Sóleos excéntrico"]
  heatTolerance?: 'poor' | 'moderate' | 'strong'; // tolerancia al calor (clave para Transvulcania)
  gutIssuesHistory?: string; // historial de problemas gastrointestinales
  personalMotivation?: string; // qué le motiva a correr ultra a sus 50 años
  coachInitialInterviewCompleted?: boolean;
}

export interface ChronicInjuriesHistory {
  description: string; // Detalle narrativo de lesiones crónicas o recurrentes
  primaryTrigger: string; // Detonante principal (ej: exceso de desnivel negativo, bajadas rápidas, calzado con drop bajo)
  activeWarningSigns: string; // Señales de aviso temprano (ej: rigidez matutina en el tendón de Aquiles, tirantez en sóleos)
  managementProtocol: string; // Qué hace cuando nota molestias (ej: automasaje, crioterapia, descarga excéntrica)
  orthoticsOrInsoles: boolean; // Usa plantillas podológicas o taloneras
}

export interface HighMountainExperience {
  hasVolcanicTerrainExperience: boolean; // Experiencia en terreno volcánico (lapilli, picón, malpaís, arena volcánica)
  volcanicTerrainNotes?: string; // Observaciones sobre tracción, polainas, arena volcánica abrasiva o técnica en picón
  technicalTerrainGrade: 'moderate_trails' | 'technical_alpine_rocks' | 'extreme_ridge_scree'; // Grado técnico
  maxAltitudeReachedM: number; // Altitud máxima alcanzada en montaña (ej: 2426m Roque, 3718m Teide, 3404m Aneto)
  altitudeSensitivity: 'none' | 'mild_headache_above_2000m' | 'significant_drop_in_pace'; // Sensibilidad a la altitud/hipoxia
}

export interface DocumentedHeatTolerance {
  level: 'low' | 'moderate' | 'high' | 'heat_acclimated'; // Nivel de tolerancia
  crampHistoryInHeat: boolean; // Historial de calambres térmicos o deshidratación
  sweatRateDocumentedLitersPerHour?: number; // Tasa de sudoración medida (l/h)
  sodiumLossProfile: 'low_salt' | 'medium_salt' | 'salty_sweater_white_crust'; // Perfil de pérdida de sodio (costra blanca)
  heatStrategyNotes: string; // Pauta de choque contra el calor canario (visera, cubrenucas, sales, hielo)
}

export interface TrainingPreferencesQuestionnaire {
  preferredTrainingTime: 'early_morning' | 'midday' | 'evening' | 'flexible'; // Franja horaria preferida
  longRunPreferredTerrain: 'steep_technical_trail' | 'rolling_mountain_paths' | 'high_alpine_scree' | 'mixed_fire_road'; // Terreno tirada larga
  crossTrainingSports: string[]; // Deportes cruzados tolerados (Gravel/MTB, Natación, Esquí de montaña, Elíptica)
  weeklyFlexibility: 'strict_fixed_days' | 'flexible_swap_days' | 'shift_work_adaptive'; // Flexibilidad semanal
  treadmillTolerance: 'hate_it_outdoor_only' | 'emergency_weather_only' | 'regularly_for_steep_walk'; // Tolerancia a cinta indoor
  preferredRestDay: 'monday' | 'friday' | 'post_long_run' | 'flexible'; // Día preferido de descanso total
  lifestyleConstraintsNotes?: string; // Limitaciones laborales, familiares o viajes
}

export interface AdvancedPhysiologicalProfile {
  chronicInjuries: ChronicInjuriesHistory;
  highMountain: HighMountainExperience;
  heatTolerance: DocumentedHeatTolerance;
  trainingPreferences: TrainingPreferencesQuestionnaire;
}

export interface AthleteProfile {
  name: string;
  age: number;
  heightCm: number; // Altura en cm (ej. 176)
  weightKg: number; // Peso actual en kg (ej. 71.5)
  targetRaceWeightKg: number; // Peso óptimo para Transvulcania en kg (ej. 67.5)
  weightHistory?: WeightEntry[];
  restingHr: number;
  baselineHrv?: number; // Línea base rMSSD nocturna (ej. 51.5 ms)
  /**
   * ¿Lleva banda de pecho? true = sí (lo indicó el atleta o Suunto registró ZoneSense
   * en los últimos 30 días); false = no; sin valor = desconocido (no se asume ZoneSense).
   */
  hasChestStrap?: boolean;
  hasChestStrapSource?: 'manual' | 'suunto';
  maxHr: number;
  aetHr: number; // Aerobic Threshold (VT1)
  antHr: number; // Anaerobic Threshold (VT2)
  hasAds: boolean; // Aerobic Deficiency Syndrome (if AnT - AeT > 10% or > 20 bpm)
  driftTestResultPct?: number; // < 3.5%-5% ok, > 5% ADS
  yearsTrailRunning: number;
  availableDaysPerWeek: number; // 3 midweek + 1 weekend default = 4
  preferredLongRunDay: 'saturday' | 'sunday';
  injuryHistory: string;
  strengthEquipment: 'none_bodyweight' | 'basic_outdoor';
  currentWeeklyVolumeHours: number;
  targetRaceName: string;
  dataSource?: 'suunto_sync' | 'markdown_file' | 'manual' | 'pending';
  hasConnectedSuunto?: boolean;
  ultraExperience?: UltraExperienceDetails;
  advancedPhysiologicalProfile?: AdvancedPhysiologicalProfile;
  setupCompleted?: boolean;
  setupStep?: number;

  // Perfil automático desde Suunto (ver src/utils/suuntoProfile.ts)
  vo2Max?: number;
  /** Origen de cada campo que Suunto puede rellenar: si es 'manual', Suunto no lo pisa. */
  fieldSources?: Partial<Record<SuuntoProfileField, 'suunto' | 'manual'>>;
  /** Últimos valores calculados desde Suunto (para "volver a Suunto"). */
  suuntoValues?: SuuntoProfileValues;
  /** Explicación de cómo se calculó cada valor. */
  suuntoEvidence?: Partial<Record<SuuntoProfileField, string>>;
  suuntoProfileUpdatedAt?: string;
  /** Aviso para cambiar las zonas de FC del reloj (solo con tendencia sostenida). */
  watchZoneAdvice?: WatchZoneAdvice;
}

export interface WatchZoneRecommendation {
  field: 'maxHr' | 'aetHr' | 'antHr';
  label: string;
  current: number;
  suggested: number;
  direction: 'up' | 'down';
  evidence: string;
}

export interface WatchZoneAdvice {
  checkedAt: string;
  watch: { maxHr: number | null; zones: { z2: number | null; z3: number | null; z4: number | null; z5: number | null } | null; sport: string } | null;
  recommendations: WatchZoneRecommendation[];
  notes: string[];
}

/** Campos del perfil que se calculan a partir de los datos de Suunto. */
export const SUUNTO_PROFILE_FIELDS = [
  'maxHr',
  'aetHr',
  'antHr',
  'hasAds',
  'restingHr',
  'baselineHrv',
  'vo2Max',
  'currentWeeklyVolumeHours',
  'availableDaysPerWeek',
  'preferredLongRunDay',
] as const;

export type SuuntoProfileField = (typeof SUUNTO_PROFILE_FIELDS)[number];

export type SuuntoProfileValues = Partial<Pick<AthleteProfile, SuuntoProfileField>>;

export interface SuuntoProfileSuggestion {
  values: SuuntoProfileValues;
  evidence: Partial<Record<SuuntoProfileField, string>>;
  /**
   * Campos que Suunto rellenó antes y que ya no se pueden deducir de forma fiable
   * (p. ej. umbrales sacados de las zonas de fábrica del reloj): se vacían si
   * siguen siendo de Suunto. Los que el atleta puso a mano no se tocan.
   */
  cleared?: SuuntoProfileField[];
}

// 5. Performance Summary & Mesocycle Progression Types
export interface WeeklyZoneDistribution {
  zone1Min: number; // Recuperación / Regenerativo (< AeT - 15)
  zone2Min: number; // Base Aeróbica Sub-AeT (AeT - 15 a AeT, DFA a1 > 0.75)
  zone3Min: number; // Tempo / Transición (AeT a AnT - 10, DFA a1 0.75 - 0.50)
  zone4Min: number; // Umbral Anaeróbico AnT (AnT - 10 a AnT + 5)
  zone5Min: number; // VO2max / Anaeróbico (> AnT + 5)
  totalDurationMin: number;
  aerobicRatioPct: number; // (Z1 + Z2) / Total * 100
  zoneSenseAerobicMin: number; // Minutos en ZoneSense verde
}

export interface WeeklyPerformanceSummary {
  weekId: string;
  weekLabel: string; // e.g. "Semana 3 - Feb"
  startDate: string;
  endDate: string;
  mesocycleName: string;
  totalDistanceKm: number;
  totalDurationMin: number;
  totalElevationGainM: number;
  totalElevationLossM: number;
  completedWorkoutsCount: number;
  plannedWorkoutsCount: number;
  mountainTss: number;
  zoneDistribution: WeeklyZoneDistribution;
  avgHeartRate?: number;
  compliancePct: number;
  coachWeeklyAssessment: string;
}

export interface MesocycleProgressionSummary {
  id: string;
  name: string;
  phase: string;
  weeksCount: number;
  avgWeeklyDistanceKm: number;
  avgWeeklyElevationGainM: number;
  avgWeeklyDurationHours: number;
  totalElevationGainM: number;
  aerobicBasePct: number; // % in Z1 + Z2
  aeTPaceEvolution?: string;
  driftTestEvolutionPct?: number;
  keyMilestone: string;
  coachNote: string;
}

export interface DailyCheckIn {
  date: string; // YYYY-MM-DD
  restingHr: number;
  hrvRmssd: number; // Night HRV from Suunto (ms)
  hrvBaseline: number; // 7-day or 30-day baseline (ms)
  sleepHours: number;
  sleepQuality: number; // 1-100 or 1-10
  muscleSoreness?: number; // 1-10
  stressLevel?: number; // 1-10
  /** Recovery (Balance) medio del día según Suunto, 0-100. Sin dato de Suunto → undefined. */
  readinessScore?: number;
  /** Muestras de Recovery de Suunto de ese día (pocas = día aún incompleto). */
  recoverySamples?: number;
  /** Verde, ámbar, rojo o 'unknown' (sin HRV, sueño ni dolor: no se puede valorar). */
  status: 'optimal' | 'moderate' | 'fatigued' | 'unknown';
  coachAdvice: string;
  suggestedAction?: 'maintain' | 'downgrade_easy' | 'full_rest' | 'swap_with_rest';
  source?: 'suunto'; // presente si el check-in viene de la sincronización con Suunto
  /**
   * Minutos que Suunto marcó como "siesta" y terminaron ese día. No se suman a
   * sleepHours: Suunto no da la hora y a veces son tramos de la propia noche.
   */
  napMinutes?: number;
  /** Check-in de ejemplo (modo prueba): se borra al salir del modo prueba. */
  isSample?: boolean;
}

export interface Mesocycle {
  id: string;
  number: number;
  title: string;
  phase: 'base_aerobic' | 'ads_reversal' | 'muscular_endurance' | 'mountain_specific' | 'peak_taper';
  startDate: string;
  endDate: string;
  focus: string;
  keyWorkouts: string[];
}

export interface MacrocyclePlan {
  id: string;
  targetRace: TargetRace;
  startDate: string;
  raceDate: string;
  totalWeeks: number;
  mesocycles: Mesocycle[];
  secondaryRaces: TargetRace[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  contextType?: 'workout_debrief' | 'hrv_alert' | 'general' | 'plan_adaptation';
  relatedWorkoutId?: string;
  /** Documentos de la Biblioteca de Miguel en los que se apoyó la respuesta. */
  knowledgeSources?: KnowledgeSource[];
  /** Intercambios de conversaciones anteriores guardadas que Miguel recordó. */
  memorySources?: MemorySource[];
  /** La biblioteca falló y Miguel respondió sin ella. */
  knowledgeWarning?: string;
  /** Cuándo se guardó en Supabase (sin valor = solo está en este dispositivo). */
  savedAt?: string;
}

/** Intercambio de una conversación anterior guardada en Supabase usado en una respuesta. */
export interface MemorySource {
  sessionId: string;
  sessionTitle: string | null;
  /** Fecha de la pregunta original (ISO). */
  date: string | null;
  similarity: number;
}

/** Fragmento de la Biblioteca de Miguel (RAG) usado en una respuesta. */
export interface KnowledgeSource {
  title: string;
  source: string | null;
  similarity: number;
}

// Tokens OAuth del servidor MCP de Suunto (ver server/suunto-routes.ts).
export interface SuuntoAuth {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch segundos
}

export interface SuuntoIntegrationConfig {
  connected: boolean;
  /** Fase B: los tokens viven cifrados en el servidor, que sincroniza (el navegador no los ve). */
  serverManaged?: boolean;
  auth?: SuuntoAuth;
  lastSync?: string;
  syncStatus?: 'synced' | 'pending' | 'error' | 'syncing';
  totalActivitiesSynced?: number;
  lastSyncMessage?: string;
}

// 6. Weekly Fatigue & Deload Prediction Types
export interface WeeklyHrvFatigueTrend {
  weekIndex: number; // 1 to 4
  weekLabel: string;
  startDate: string;
  endDate: string;
  avgHrvRmssd: number;
  baselineHrv: number;
  hrvDeviationPct: number; // e.g. -14.2%
  avgRestingHr: number;
  restingHrDelta: number; // e.g. +3.8 bpm
  avgSleepQuality: number;
  avgMuscleSoreness: number; // 1-10
  avgStressLevel: number; // 1-10
  avgReadinessScore: number; // 0-100
  amberRedDaysCount: number;
  totalDays: number;
  fatigueClassification: 'optimal_recovery' | 'functional_overreaching' | 'accumulated_fatigue' | 'imminent_overtraining';
  isCurrentWeek: boolean;
}

export interface DeloadPrediction {
  urgency: 'low' | 'moderate' | 'high' | 'imminent';
  recommendedStartDate: string;
  recommendedDurationDays: number;
  confidencePct: number;
  currentMesocycleWeek: number; // e.g. Week 4 of 4
  totalLoadingWeeks: number;
  triggersDetected: string[];
  physiologicalRationale: string;
  suggestedVolumeReductionPct: number;
  coachMiguelPrescription: {
    maxHeartRateCap: number;
    zoneSenseTarget: string;
    weeklyVolumeHours: number;
    prohibitedElements: string[];
    mandatoryElements: string[];
    recoveryInterventions: string[];
  };
}

// 7. Fartlek Generator Types
export type FartlekFocus = 
  | 'ads_reversal_aet_control' 
  | 'uphill_cadence_poles' 
  | 'transvulcania_rolling_crest' 
  | 'recovery_dynamic';

export interface FartlekGeneratorParams {
  seasonPhase: 'mesocycle_2_aerobic_base' | 'mesocycle_3_muscular_endurance' | 'mesocycle_4_race_prep' | 'deload_week';
  currentHrvStatus: 'optimal' | 'moderate' | 'fatigued';
  durationMinutes: 45 | 60 | 75;
  focus: FartlekFocus;
  terrainType: 'rolling_trail' | 'uphill_dirt' | 'technical_volcanic' | 'easy_gravel';
  usePoles: boolean;
}

export interface FartlekIntervalBlock {
  repNumber: number;
  fastDurationMinutes: number;
  fastPaceLabel: string;
  fastTargetHrMax: number;
  fastZoneSense: string;
  fastCadenceTarget?: string; // sin valor: no hay dato de cadencia del atleta
  fastTacticalCue: string;
  recoveryDurationMinutes: number;
  recoveryPaceLabel: string;
  recoveryTargetHrMax: number;
  recoveryDescription: string;
}

export interface GeneratedFartlekPlan {
  id: string;
  title: string;
  workoutType: WorkoutType;
  totalDurationMin: number;
  estimatedDistanceKm: number;
  estimatedElevationGainM: number;
  targetHrMin: number;
  targetHrMax: number;
  zoneSenseTarget: Workout['zoneSenseTarget'];
  description: string;
  whyThisFitsAthlete: string;
  uphillAthleteScienceNote: string;
  warmup: string;
  mainSetStructured: FartlekIntervalBlock[];
  mainSetSummary: string;
  cooldown: string;
  postWorkoutEccentricRoutine: string;
  nutritionAdvice: string;
}

export interface AppBackupData {
  version: string;
  exportedAt: string;
  app: string;
  athleteName: string;
  data: {
    profile?: AthleteProfile;
    targetRace?: TargetRace;
    secondaryRaces?: TargetRace[];
    workouts?: Workout[];
    dailyCheckIns?: DailyCheckIn[];
    chatMessages?: ChatMessage[];
    suuntoConfig?: SuuntoIntegrationConfig;
    macrocycle?: MacrocyclePlan | null;
    athleteHistoryMd?: string;
    coachMemory?: CoachLearnedMemory;
    gutProfile?: GutTrainingProfile;
    raceSimulation?: TransvulcaniaSimulationPlan;
    pmcData?: PMCDataPoint[];
    weightHistory?: WeightEntry[];
    weeklySummaries?: WeeklyPerformanceSummary[];
    mesocycleProgression?: MesocycleProgressionSummary[];
    hydrationTests?: SweatRateTest[];
    wutChecks?: WUTDailyCheck;
  };
}

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}
