import { 
  RaceSimulationSegment, 
  GutTrainingProfile, 
  PMCDataPoint, 
  EccentricOutdoorExercise, 
  Workout,
  DailyCheckIn,
  WeightEntry,
  WeeklyPerformanceSummary,
  MesocycleProgressionSummary,
  WorkoutFuelingGuideline,
  SweatRateTest,
  TransvulcaniaHydrationSection,
  WUTDailyCheck,
  AdaptationStage
} from '../types';

export const SAMPLE_TRANSVULCANIA_SEGMENTS: RaceSimulationSegment[] = [
  {
    id: 'seg-1',
    name: 'Faro de Fuencaliente ➔ Los Canarios',
    fromKm: 0,
    toKm: 7.2,
    elevationGainM: 710,
    elevationLossM: 15,
    highestAltM: 710,
    surfaceType: 'volcanic_sand',
    targetHrCap: 140, // Sub-AeT
    recommendedEffort: 'AeT puro / Power-Hike',
    estimatedTimeMin: 68,
    targetCarbsGrams: 55,
    targetSodiumMg: 500,
    targetFluidsMl: 650,
    tacticalAdvice: 'Salida nocturna (06:00 AM). Toda la salida es arena volcánica suelta (picón). NO corras por la euforia: cada zancada en carrera gasta el doble de glucógeno y carga los gemelos. Clava bastones y mantén el pulso < 140 bpm.',
    isCutoffPoint: true,
    cutoffTimeLimitMinutes: 105,
  },
  {
    id: 'seg-2',
    name: 'Los Canarios ➔ Las Deseadas (Volcanes)',
    fromKm: 7.2,
    toKm: 16.8,
    elevationGainM: 1340,
    elevationLossM: 45,
    highestAltM: 1945,
    surfaceType: 'volcanic_sand',
    targetHrCap: 142,
    recommendedEffort: 'AeT puro / Power-Hike',
    estimatedTimeMin: 125,
    targetCarbsGrams: 110,
    targetSodiumMg: 900,
    targetFluidsMl: 1200,
    tacticalAdvice: 'Subida implacable por la Ruta de los Volcanes. Amanece en las crestas de lava. Prohibido superar 142 bpm. El viento y el polvo resecan la boca: bebe pequeños sorbos cada 15 min.',
    isCutoffPoint: true,
    cutoffTimeLimitMinutes: 240,
  },
  {
    id: 'seg-3',
    name: 'Las Deseadas ➔ Refugio de El Pilar',
    fromKm: 16.8,
    toKm: 24.3,
    elevationGainM: 120,
    elevationLossM: 590,
    highestAltM: 1945,
    surfaceType: 'dirt_trail',
    targetHrCap: 135,
    recommendedEffort: 'Z1 Controlada',
    estimatedTimeMin: 55,
    targetCarbsGrams: 50,
    targetSodiumMg: 450,
    targetFluidsMl: 600,
    tacticalAdvice: 'Descenso tendido y amable por pista de pinar canario. Suelta brazos y hombros. No te dejes llevar a ritmos excesivos: aprovecha para comer sólido y rellenar bidones en El Pilar.',
    isCutoffPoint: true,
    cutoffTimeLimitMinutes: 315,
  },
  {
    id: 'seg-4',
    name: 'Refugio de El Pilar ➔ El Reventón',
    fromKm: 24.3,
    toKm: 31.6,
    elevationGainM: 640,
    elevationLossM: 150,
    highestAltM: 1450,
    surfaceType: 'dirt_trail',
    targetHrCap: 142,
    recommendedEffort: 'AeT puro / Power-Hike',
    estimatedTimeMin: 62,
    targetCarbsGrams: 55,
    targetSodiumMg: 500,
    targetFluidsMl: 700,
    tacticalAdvice: 'Subida firme entrando en la Caldera de Taburiente. El calor empieza a apretar. Mantén la cadencia constante de bastón sin tirones.',
    isCutoffPoint: false,
  },
  {
    id: 'seg-5',
    name: 'El Reventón ➔ Pico de la Nieve ➔ Pico de la Cruz',
    fromKm: 31.6,
    toKm: 42.5,
    elevationGainM: 920,
    elevationLossM: 380,
    highestAltM: 2280,
    surfaceType: 'technical_rock',
    targetHrCap: 140,
    recommendedEffort: 'ZoneSense verde',
    estimatedTimeMin: 110,
    targetCarbsGrams: 95,
    targetSodiumMg: 850,
    targetFluidsMl: 1100,
    tacticalAdvice: 'Crestería a más de 2.000m de altitud. La presión de oxígeno es menor y la sensación de fatiga aumenta. Si trotas en falso llano, vigila en tu Suunto que ZoneSense se mantenga verde (DFA a1 > 0.75).',
    isCutoffPoint: true,
    cutoffTimeLimitMinutes: 510,
  },
  {
    id: 'seg-6',
    name: 'Pico de la Cruz ➔ Roque de los Muchachos (Cota Máxima)',
    fromKm: 42.5,
    toKm: 51.5,
    elevationGainM: 650,
    elevationLossM: 240,
    highestAltM: 2426,
    surfaceType: 'technical_rock',
    targetHrCap: 142,
    recommendedEffort: 'ZoneSense verde',
    estimatedTimeMin: 85,
    targetCarbsGrams: 75,
    targetSodiumMg: 700,
    targetFluidsMl: 900,
    tacticalAdvice: 'Llegas al techo de la isla (2.426 m) junto a los telescopios. Come y bebe con tranquilidad en el avituallamiento. Tómate 5 minutos para colocarte bien las polainas y apretarte las zapatillas: empieza el infierno excéntrico.',
    isCutoffPoint: true,
    cutoffTimeLimitMinutes: 630,
  },
  {
    id: 'seg-7',
    name: 'Roque de los Muchachos ➔ Torre del Time (Tramo Crítico)',
    fromKm: 51.5,
    toKm: 62.0,
    elevationGainM: 50,
    elevationLossM: 1260,
    highestAltM: 2426,
    surfaceType: 'steep_descent_rock',
    targetHrCap: 130, // Low HR, but extreme eccentric strain
    recommendedEffort: 'Protección Cuádriceps / Frenado mínimo',
    estimatedTimeMin: 80,
    targetCarbsGrams: 60,
    targetSodiumMg: 650,
    targetFluidsMl: 850,
    tacticalAdvice: '⚠️ ¡ZONA PELIGROSA PARA CUÁDRICEPS! Descenso continuo de 1.260 m negativos sobre piedra rota y lajas. Aumenta la cadencia de pasos cortos (180+ ppm), no talones con la pierna recta. Si frenas de golpe quemarás los vastos internos.',
    isCutoffPoint: true,
    cutoffTimeLimitMinutes: 720,
  },
  {
    id: 'seg-8',
    name: 'Torre del Time ➔ Puerto de Tazacorte',
    fromKm: 62.0,
    toKm: 68.2,
    elevationGainM: 10,
    elevationLossM: 1150,
    highestAltM: 1160,
    surfaceType: 'steep_descent_rock',
    targetHrCap: 132,
    recommendedEffort: 'Protección Cuádriceps / Frenado mínimo',
    estimatedTimeMin: 55,
    targetCarbsGrams: 45,
    targetSodiumMg: 600,
    targetFluidsMl: 800,
    tacticalAdvice: 'El temido muro de El Time. Zigzags interminables con calor sofocante bajando directo al mar. El impacto excéntrico es máximo. Si has hecho el trabajo de step-downs y fuerza al aire libre, aquí adelantarás decenas de corredores.',
    isCutoffPoint: true,
    cutoffTimeLimitMinutes: 795,
  },
  {
    id: 'seg-9',
    name: 'Puerto de Tazacorte ➔ Los Llanos de Aridane (Meta)',
    fromKm: 68.2,
    toKm: 73.0,
    elevationGainM: 340,
    elevationLossM: 20,
    highestAltM: 340,
    surfaceType: 'paved_road',
    targetHrCap: 155,
    recommendedEffort: 'AeT puro / Power-Hike',
    estimatedTimeMin: 45,
    targetCarbsGrams: 30,
    targetSodiumMg: 350,
    targetFluidsMl: 500,
    tacticalAdvice: 'Subida por el lecho del Barranco de Las Angustias y entrada triunfal al pueblo de Los Llanos de Aridane. Las piernas arderán por el cambio de bajada a subida: camina con orgullo el barranco y trota con la multitud en la avenida.',
    isCutoffPoint: true,
    cutoffTimeLimitMinutes: 840,
  },
];

export const SAMPLE_ADAPTATION_STAGES: AdaptationStage[] = [
  {
    id: 1,
    name: 'Fase 1: Despertar Digestivo & SGLT1',
    shortName: 'Fase 1: Base Gástrica',
    carbsRangeLabel: '30 - 45 g/h',
    minCarbsGramsPerHour: 30,
    maxCarbsGramsPerHour: 45,
    status: 'completed',
    sessionsRequired: 3,
    sessionsCompleted: 3,
    biologicalMechanism: 'Expansión de la densidad de transportadores intestinales SGLT1 para absorber glucosa y polímeros de glucosa sin saturación osmótica ni náuseas.',
    targetTransporters: 'SGLT1 (Transportador dependiente de Sodio)',
    recommendedFuels: ['Geles isotónicos simples (glucosa/maltodextrina)', 'Plátano maduro', 'Agua con sales'],
    coachGraduationCriteria: 'Completar 3 tiradas >90 min a ritmo AeT con 40-45g/h y calificación digestiva ≥4/5 sin ningún síntoma de reflujo.',
    coachTips: 'Fase superada con éxito. Tu mucosa intestinal demostró vaciado gástrico rápido sin retención de agua en la cavidad gástrica.'
  },
  {
    id: 2,
    name: 'Fase 2: Activación de Doble Transportador',
    shortName: 'Fase 2: Tolerancia a Fructosa (GLUT5)',
    carbsRangeLabel: '50 - 65 g/h',
    minCarbsGramsPerHour: 50,
    maxCarbsGramsPerHour: 65,
    status: 'in_progress',
    sessionsRequired: 4,
    sessionsCompleted: 3,
    biologicalMechanism: 'Estimulación del transportador GLUT5 introduciendo fructosa en ratio 1:0.8 o 2:1 junto con maltodextrina. Evita el cuello de botella del transportador SGLT1 que se satura a ~60g/h.',
    targetTransporters: 'SGLT1 + GLUT5 (Doble vía no competitiva)',
    recommendedFuels: ['Geles con ratio maltodextrina:fructosa (1:0.8)', 'Dátiles naturales despipados', 'Bebida de hidratos con sodio'],
    coachGraduationCriteria: 'Realizar 4 tiradas de montaña >2h30 a ritmo aeróbico tolerando entre 55g y 65g/h con sensación de ligereza abdominal.',
    coachTips: 'Llevas 3/4 sesiones completadas con gran solvencia. En la próxima tirada larga de fin de semana consolidaremos los 65 g/h para desbloquear la Fase 3.'
  },
  {
    id: 3,
    name: 'Fase 3: Sobrecarga en Tiradas Específicas',
    shortName: 'Fase 3: Alta Carga en Montaña',
    carbsRangeLabel: '65 - 80 g/h',
    minCarbsGramsPerHour: 65,
    maxCarbsGramsPerHour: 80,
    status: 'locked',
    sessionsRequired: 4,
    sessionsCompleted: 0,
    biologicalMechanism: 'Consolidación de absorción masiva bajo vibración mecánica de bajada y estrés térmico. Permite ahorrar hasta un 25% de glucógeno muscular en los primeros 40 km.',
    targetTransporters: 'SGLT1 + GLUT5 sobrecargados + ciclodextrina',
    recommendedFuels: ['Hidrogel Maurten / 226ERS Isocarb', 'Gominolas energéticas', 'Sales de alta concentración'],
    coachGraduationCriteria: 'Superar 2 simulaciones de carrera de >4 horas con calor simulado ingiriendo 70-75g/h sin molestias.',
    coachTips: 'Se activará al completar la sesión restante de Fase 2. Aquí combinaremos hidrogeles de alta absorción con pequeñas porciones de alimento salado.'
  },
  {
    id: 4,
    name: 'Fase 4: Nivel Ultra Transvulcania',
    shortName: 'Fase 4: Máxima Eficiencia (80-90 g/h)',
    carbsRangeLabel: '80 - 90 g/h',
    minCarbsGramsPerHour: 80,
    maxCarbsGramsPerHour: 90,
    status: 'locked',
    sessionsRequired: 3,
    sessionsCompleted: 0,
    biologicalMechanism: 'Máxima tasa de oxidación exógena alcanzable por el ser humano. Blindaje gástrico absoluto para resistir 10-12 horas continuas con 4.350m D+ en La Palma.',
    targetTransporters: 'Saturación coordinada multicarbohidrato + tampón osmolar',
    recommendedFuels: ['Mezcla líquida 60g en bidón + 1 gel 30g por hora', 'Patata cocida con sal gorda', 'Caldo salado en avituallamientos'],
    coachGraduationCriteria: 'Simulación final de Transvulcania (cresta + descenso de 2.000m) consumiendo 80-85g/h a ritmo de carrera.',
    coachTips: 'El estándar de oro de los corredores de élite. Te permitirá llegar con chispa muscular a la última subida de Los Llanos de Aridane.'
  }
];

export const SAMPLE_GUT_PROFILE: GutTrainingProfile = {
  currentMaxCarbsPerHour: 55,
  goalCarbsPerHour: 80,
  trainingPhase: 'Volume Tolerance (50-65g/h)',
  activeStageId: 2,
  stages: SAMPLE_ADAPTATION_STAGES,
  fatMaxGramsPerHour: 48,
  gutSensitivities: ['Fructosa pura en exceso provoca hinchazón', 'Tolerancia óptima con ratio maltodextrina:fructosa 1:0.8'],
  entries: [
    {
      id: 'gut-1',
      date: '2026-09-06',
      workoutTitle: 'Tirada Larga Montaña 22K',
      durationMin: 180,
      carbsTargetGramsPerHour: 45,
      carbsIngestedGramsPerHour: 45,
      sodiumTargetMgPerHour: 450,
      hydrationMlPerHour: 600,
      fuelsUsed: ['Gel Maurten 160', 'Plátano maduro', 'Agua con pastilla de sales'],
      giToleranceRating: 5,
      symptomsReported: ['Ninguno'],
      miguelDigestiveFeedback: 'Excelente respuesta gástrica a 45g/h sin acidez ni pesadez. Procedemos a subir a 55g/h.',
    },
    {
      id: 'gut-2',
      date: '2026-09-13',
      workoutTitle: 'Tirada Larga con Desnivel +1200m',
      durationMin: 210,
      carbsTargetGramsPerHour: 55,
      carbsIngestedGramsPerHour: 52,
      sodiumTargetMgPerHour: 500,
      hydrationMlPerHour: 650,
      fuelsUsed: ['Geles 226ERS Isocarb', 'Dátiles despipados', 'Bebida isotónica Suunto'],
      giToleranceRating: 4,
      symptomsReported: ['Ligera pesadez al minuto 150'],
      miguelDigestiveFeedback: 'Buena asimilación general. La pesadez coincidió con el tramo de subida más empinada donde el pulso rozó los 145 bpm. Recuerda espaciar las tomas justo antes de coronar o en descansos.',
    },
    {
      id: 'gut-3',
      date: '2026-09-20',
      workoutTitle: 'Volumen Específico de Fin de Semana',
      durationMin: 195,
      carbsTargetGramsPerHour: 60,
      carbsIngestedGramsPerHour: 58,
      sodiumTargetMgPerHour: 550,
      hydrationMlPerHour: 700,
      fuelsUsed: ['Geles High5 Energy Gel Aqua', 'Puré de manzana y arroz', 'Electrolitos'],
      giToleranceRating: 5,
      symptomsReported: ['Ninguno'],
      miguelDigestiveFeedback: 'Estómago de hierro hoy. Asimilaste 58g/h con total comodidad intestinal. Estamos listos para probar 65g/h en la próxima tirada.',
    }
  ],
};

export const SAMPLE_ECCENTRIC_EXERCISES: EccentricOutdoorExercise[] = [
  {
    id: 'ecc-1',
    name: 'Step-Down Excéntrico en Escalón Alto / Roca',
    targetMuscles: 'Cuádriceps (Vasto interno, recto femoral) y Glúteo Medio',
    outdoorSetup: 'Escalón de piedra, bordillo alto (20-35 cm) o roca plana en el sendero',
    tempoPattern: '3-1-1',
    downSeconds: 3,
    pauseSeconds: 1,
    upSeconds: 1,
    sets: 3,
    reps: '10 a 12 por pierna',
    instruction: 'De pie sobre la roca con una sola pierna. La pierna libre baja lentamente hacia el suelo durante 3 segundos sin dejarse caer. Roza el suelo con el talón SIN impulsarte y regresa en 1 segundo arriba.',
    biomechanicalPurpose: 'Simula exactamente la contracción de frenado que soportarán tus cuádriceps en los 2.410m de bajada continua de El Time.',
    riskWarning: 'No dejes que la rodilla se doble hacia adentro (valgo). Debe apuntar en línea recta con el segundo dedo del pie.',
    iconType: 'step_down',
  },
  {
    id: 'ecc-2',
    name: 'Caída y Elongación Excéntrica de Sóleo en Bordillo',
    targetMuscles: 'Sóleo, Gemelo profundo y Tendón de Aquiles',
    outdoorSetup: 'Bordillo de acera o borde de escalera',
    tempoPattern: '3-1-1',
    downSeconds: 3,
    pauseSeconds: 1,
    upSeconds: 1,
    sets: 3,
    reps: '12 a 15 por pierna con rodilla ligeramente flexionada (20°)',
    instruction: 'Apoya el metatarso en el borde. Con la rodilla flexionada 20° para aislar el sóleo, baja el talón lentamente durante 3 segundos sintiendo el estiramiento bajo tensión. Pausa 1s abajo y sube en 1s.',
    biomechanicalPurpose: 'Refuerza el sóleo frente a la carga de las subidas pronunciadas.',
    riskWarning: 'Mantén la rodilla flexionada en todo el recorrido. Si estiras la rodilla, trabajas el gastrocnemio y no el sóleo.',
    iconType: 'soleus_drop',
  },
  {
    id: 'ecc-3',
    name: 'Sentadilla Búlgara en Desnivel o Tronco Caído',
    targetMuscles: 'Cadena anterior, Vasto externo y estabilizadores de cadera',
    outdoorSetup: 'Banco de parque, tronco caído o montículo en el camino',
    tempoPattern: '3-1-1',
    downSeconds: 3,
    pauseSeconds: 1,
    upSeconds: 1,
    sets: 3,
    reps: '8 a 10 por pierna',
    instruction: 'Un pie adelantado y el empeine trasero apoyado en el montículo. Desciende lentamente en 3 segundos manteniendo el torso erguido. Siente el peso sobre el talón delantero.',
    biomechanicalPurpose: 'Desarrolla fuerza unilateral máxima para absorber impactos en bajadas técnicas irregulares.',
    riskWarning: 'Evita levantar el talón de la pierna delantera al descender.',
    iconType: 'bulgarian_split',
  },
  {
    id: 'ecc-4',
    name: 'Zancadas Lentas con Mochila Lastrada Cuesta Abajo',
    targetMuscles: 'Recto femoral, Tendón rotuliano y Estabilidad de tobillo',
    outdoorSetup: 'Cuesta suave de tierra o sendero (pendiente 6-10%) con tu mochila de trail',
    tempoPattern: '3-1-1',
    downSeconds: 3,
    pauseSeconds: 1,
    upSeconds: 1,
    sets: 3,
    reps: '10 zancadas alternas por pierna',
    instruction: 'Carga tu mochila con 3-4 kg (bidones llenos de agua). Da un paso amplio cuesta abajo y frena el descenso en 3 segundos antes de que la rodilla trasera toque tierra.',
    biomechanicalPurpose: 'Inmuniza el sarcómero muscular contra el daño excéntrico inducido por el ejercicio prolongado.',
    riskWarning: 'Realizar solo tras haber calentado 10 minutos al trote suave.',
    iconType: 'downhill_lunge',
  },
  {
    id: 'ecc-5',
    name: 'Plancha Lateral con Elevación en Pendiente',
    targetMuscles: 'Core lateral, Glúteo medio y Cuadrado lumbar',
    outdoorSetup: 'Suelo de tierra o césped natural',
    tempoPattern: '3-1-1',
    downSeconds: 3,
    pauseSeconds: 2,
    upSeconds: 1,
    sets: 3,
    reps: '10 repeticiones o 35 seg de aguante por lado',
    instruction: 'Apoyado sobre el antebrazo en plancha lateral. Eleva la pierna superior controlando que la pelvis no caiga hacia atrás ni hacia el suelo.',
    biomechanicalPurpose: 'Evita el basculamiento de la pelvis al correr con bastones por terrenos inclinados de cresta volcánica.',
    riskWarning: 'Mantén una línea recta desde la cabeza hasta los tobillos sin doblar la cadera.',
    iconType: 'anti_rotation_core',
  },
];

export const generateSamplePMCData = (daysCount: number = 90): PMCDataPoint[] => {
  const points: PMCDataPoint[] = [];
  const today = new Date();
  
  // Starting values 90 days ago (Base Aeróbica Inicial)
  let ctl = 28.0;
  let atl = 26.0;
  const ctlHistory: number[] = [];

  // Exact exponentially weighted moving average decays (Coggan & Banister)
  const ctlDecay = 1 - Math.exp(-1 / 42); // 0.02353
  const atlDecay = 1 - Math.exp(-1 / 7);  // 0.13312

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday

    // Generate realistic trail training load
    let tss = 0;
    let ifFactor = 0;
    let zoneSenseMin = 0;
    let dPlus = 0;
    let dMinus = 0;
    let workoutTitle: string | undefined = undefined;

    // Progressive overload: slightly higher volume in recent weeks
    const progressFactor = 1 + (daysCount - 1 - i) / (daysCount * 3); // 1.0 to 1.33

    if (dayOfWeek === 6) {
      // Long Saturday Mountain Run (Tirada Larga)
      tss = Math.round((115 + Math.floor(Math.sin(i) * 12)) * progressFactor);
      ifFactor = 0.76;
      zoneSenseMin = Math.round(110 * progressFactor);
      dPlus = Math.round((900 + Math.floor(Math.cos(i) * 150)) * progressFactor);
      dMinus = Math.round((850 + Math.floor(Math.cos(i) * 150)) * progressFactor);
      workoutTitle = 'Tirada Larga de Montaña (Uphill Aerobic)';
    } else if (dayOfWeek === 2 || dayOfWeek === 4) {
      // Midweek aerobic trail run (Martes / Jueves)
      tss = Math.round((48 + Math.floor(Math.sin(i) * 8)) * progressFactor);
      ifFactor = 0.74;
      zoneSenseMin = Math.round(45 * progressFactor);
      dPlus = Math.round(380 * progressFactor);
      dMinus = Math.round(370 * progressFactor);
      workoutTitle = 'Rodaje Z1/Z2 + Desnivel';
    } else if (dayOfWeek === 3) {
      // Strength & Core day (Miércoles)
      tss = 35;
      ifFactor = 0.65;
      zoneSenseMin = 0;
      workoutTitle = 'Fuerza Excéntrica al Aire Libre';
    } else {
      // Rest or recovery (Lunes, Viernes, Domingo)
      tss = (i % 7 === 0) ? 15 : 0;
      ifFactor = tss > 0 ? 0.55 : 0;
      workoutTitle = tss > 0 ? 'Recuperación Activa Z1' : undefined;
    }

    // Mountain-adjusted TSS factoring in eccentric descent:
    const mountainTss = tss + Math.round((dMinus / 1000) * 8);

    // Standard impulse-response model for PMC:
    // CTL_today = CTL_yesterday + (TSS - CTL_yesterday) * (1 - e^(-1/42))
    // ATL_today = ATL_yesterday + (TSS - ATL_yesterday) * (1 - e^(-1/7))
    ctl = ctl + (mountainTss - ctl) * ctlDecay;
    atl = atl + (mountainTss - atl) * atlDecay;
    const tsb = ctl - atl;

    ctlHistory.push(ctl);
    let rampRate = 0;
    if (ctlHistory.length > 7) {
      rampRate = Math.round((ctl - ctlHistory[ctlHistory.length - 8]) * 10) / 10;
    }

    points.push({
      date: dateStr,
      dayLabel: d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }),
      tss,
      mountainTss,
      intensityFactor: ifFactor > 0 ? ifFactor : undefined,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      rampRate,
      zoneSenseAerobicMin: zoneSenseMin,
      elevationGainM: dPlus,
      elevationLossM: dMinus,
      workoutTitle,
      rpe: workoutTitle ? (dayOfWeek === 6 ? 6 : 4) : undefined,
    });
  }

  return points;
};

export const SAMPLE_PMC_DATA: PMCDataPoint[] = generateSamplePMCData();

export const SAMPLE_TEST_WORKOUTS: Workout[] = [
  {
    id: 'test-w-1',
    date: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().split('T')[0],
    title: 'Tirada Larga: Adaptación Fuencaliente',
    type: 'long_mountain_run',
    plannedDurationMin: 180,
    plannedDistanceKm: 21,
    plannedElevationGainM: 1150,
    plannedTss: 135,
    actualTss: 142,
    tss: 142,
    intensityFactor: 0.82,
    targetHrMin: 125,
    targetHrMax: 142,
    zoneSenseTarget: 'DFA a1 > 0.75 (Aeróbico puro)',
    description: 'Simulación de los primeros 20 km de Transvulcania. Mantén el DFA a1 estrictamente en verde.',
    personalizedReasoning: 'Diseñada específicamente para comprobar si tu Sóleo izquierdo tolera la pendiente con bastones y entrenar el vaciado gástrico a 55g/h.',
    learnedAdjustment: 'Aplicada regla de memoria: En pendientes >12% transición inmediata a power-hiking para no colapsar el DFA a1.',
    warmup: '15 min caminando en llano + movilidad de tobillos.',
    mainSet: '2h 30min en terreno volcánico/tierra manteniendo pulso < 142 bpm.',
    cooldown: '15 min trote suave Z1 regenerativo.',
    strengthExercises: [],
    completed: true,
    actualDurationMin: 178,
    actualDistanceKm: 21.4,
    actualElevationGainM: 1180,
    actualAvgHr: 136,
    actualMaxHr: 146,
    actualDfaAlpha1Avg: 0.81,
    zoneSenseBreakdown: {
      aerobicPct: 88,
      transitionPct: 10,
      anaerobicPct: 2,
    },
    athleteRpe: 6,
    athleteNotes: 'Sensaciones muy buenas. Estómago impecable con 55g de carbohidratos/hora. Cero molestias de sóleo al usar bastones.',
    coachFeedback: '¡Magistral! Mantuviste un 88% en zona aeróbica pura. Tu DFA a1 promedio de 0.81 demuestra que la base metabólica está asentándose con firmeza.',
    plannedCarbsPerHourG: 55,
    actualCarbsPerHourG: 54,
    plannedFluidsPerHourMl: 650,
    actualFluidsPerHourMl: 620,
    giToleranceRating: 5,
    fuelingNotes: '2 geles isotónicos + medio plátano cada 45 minutos. Perfecta digestión.',
  },
  {
    id: 'test-w-2',
    date: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString().split('T')[0],
    title: 'Fuerza Excéntrica al Aire Libre: Blindaje Cuádriceps',
    type: 'strength_core',
    plannedDurationMin: 45,
    plannedTss: 35,
    actualTss: 35,
    tss: 35,
    intensityFactor: 0.65,
    targetHrMin: 100,
    targetHrMax: 125,
    zoneSenseTarget: 'Regenerativo',
    description: 'Circuito al aire libre sin máquinas. Énfasis en el tempo 3-1-1 para step-downs y sóleos en escalón.',
    personalizedReasoning: 'Entrenamiento prioritario para desarrollar resistencia al impacto excéntrico de los 2.410m de bajada de Tazacorte.',
    learnedAdjustment: 'Incorpora 3 series de sóleo en bordillo para proteger tu inserción de tendón de Aquiles.',
    warmup: '10 min trote suave por parque o sendero + círculos de cadera.',
    mainSet: '3 rondas: 12 Step-downs excéntricos (3s bajada) + 12 Sóleos en escalón (3s bajada) + 10 Sentadillas búlgaras en banco + Plancha lateral 40s.',
    cooldown: 'Estiramientos suaves de psoas y cuádriceps.',
    completed: true,
    actualDurationMin: 42,
    actualAvgHr: 114,
    actualMaxHr: 132,
    athleteRpe: 5,
    athleteNotes: 'Queman los cuádriceps con los 3 segundos de bajada lenta. Muy buena sensación de control articular.',
    coachFeedback: 'Justo esa quemazón controlada en la fase de bajada es la que genera la hipertrofia sarcomérica en serie que salvará tus piernas en la isla de La Palma.',
  },
  {
    id: 'test-w-3',
    date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
    title: 'Rodaje Aeróbico Z1/Z2 + Calibración Suunto',
    type: 'easy_run',
    plannedDurationMin: 60,
    plannedDistanceKm: 9.5,
    plannedElevationGainM: 350,
    plannedTss: 55,
    actualTss: 58,
    tss: 58,
    intensityFactor: 0.79,
    targetHrMin: 120,
    targetHrMax: 138,
    zoneSenseTarget: 'DFA a1 > 0.75 (Aeróbico puro)',
    description: 'Sesión continua suave por sendero irregular. Enfoque en cadencia ágil y respiración nasal.',
    personalizedReasoning: 'Volumen regenerativo para acumular mitocondrias sin estresar el sistema nervioso central.',
    learnedAdjustment: 'Mantenido el límite en 138 bpm para asegurar que la HRV de mañana continúe en rango óptimo.',
    warmup: '10 min marcha rápida.',
    mainSet: '45 min de carrera fluida manteniendo DFA a1 > 0.80.',
    cooldown: '5 min caminando descalzo sobre hierba.',
    completed: true,
    actualDurationMin: 58,
    actualDistanceKm: 9.8,
    actualElevationGainM: 370,
    actualAvgHr: 131,
    actualMaxHr: 139,
    actualDfaAlpha1Avg: 0.84,
    zoneSenseBreakdown: {
      aerobicPct: 94,
      transitionPct: 6,
      anaerobicPct: 0,
    },
    athleteRpe: 4,
    athleteNotes: 'Corrí casi todo el tiempo con la boca cerrada. Ritmo muy agradable.',
    coachFeedback: 'Un 94% en aeróbico puro y DFA a1 medio de 0.84. Tu motor de grasas está respondiendo como un reloj.',
    plannedCarbsPerHourG: 30,
    actualCarbsPerHourG: 30,
    plannedFluidsPerHourMl: 500,
    actualFluidsPerHourMl: 500,
    giToleranceRating: 5,
  },
  {
    id: 'test-w-4',
    date: new Date(Date.now() + 1 * 24 * 3600 * 1000).toISOString().split('T')[0],
    title: 'Tirada Específica de Montaña: Bloque Volcánico',
    type: 'long_mountain_run',
    plannedDurationMin: 195,
    plannedDistanceKm: 23,
    plannedElevationGainM: 1300,
    plannedTss: 155,
    intensityFactor: 0.81,
    targetHrMin: 125,
    targetHrMax: 142,
    zoneSenseTarget: 'DFA a1 > 0.75 (Aeróbico puro)',
    description: 'Tirada clave del microciclo. Prueba de carga nutricional a 60g/h de carbohidratos.',
    personalizedReasoning: 'Avanzamos un escalón en la tolerancia gástrica (de 55 a 60 g/h) y acumulamos 1.300m de bajada para seguir adaptando los tendones.',
    learnedAdjustment: 'Parada obligatoria de 30 segundos cada 60 min para hidratar con calma y comprobar sensaciones de cuádriceps.',
    warmup: '15 min de subida suave caminando con bastones.',
    mainSet: 'Tirada continua en terreno de desnivel. 60g de carbohidratos por hora con 650 ml de agua con sales.',
    cooldown: '10 min caminando + estiramiento de gemelos.',
    completed: false,
    plannedCarbsPerHourG: 60,
    plannedFluidsPerHourMl: 650,
  }
];

export const generateSampleDailyCheckIns = (): DailyCheckIn[] => {
  const checkIns: DailyCheckIn[] = [];
  const baseline = 51;
  const today = new Date();

  // 28 days of check-in history across 4 distinct weeks of Mesocycle 2
  for (let i = 0; i < 28; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    let hrv: number;
    let restingHr: number;
    let sleepHours: number;
    let sleepQuality: number;
    let soreness: number;
    let stress: number;
    let readiness: number;
    let status: 'optimal' | 'moderate' | 'fatigued';
    let coachAdvice: string;
    let suggestedAction: 'maintain' | 'downgrade_easy' | 'full_rest' | 'swap_with_rest';

    if (i >= 21) {
      // Week 1 (21 to 27 days ago): Fresh, high parasympathetic tone
      hrv = 53 + (i % 3);
      restingHr = 45 + (i % 2);
      sleepHours = 7.8;
      sleepQuality = 88;
      soreness = 2;
      stress = 2;
      readiness = 90 + (i % 4);
      status = 'optimal';
      coachAdvice = 'Tono parasimpático óptimo. Asimilación excelente de la base aeróbica.';
      suggestedAction = 'maintain';
    } else if (i >= 14) {
      // Week 2 (14 to 20 days ago): Volume loading (37.8 km, +1580m)
      hrv = 50 + (i % 3);
      restingHr = 47 + (i % 2);
      sleepHours = 7.4;
      sleepQuality = 82;
      soreness = 3;
      stress = 3;
      readiness = 84 + (i % 3);
      status = 'optimal';
      coachAdvice = 'Buena tolerancia al volumen semanal. Mantén la disciplina sub-AeT.';
      suggestedAction = 'maintain';
    } else if (i >= 7) {
      // Week 3 (7 to 13 days ago): Peak load week (42.2 km, +1850m)
      hrv = 46 + (i % 3);
      restingHr = 48 + (i % 2);
      sleepHours = 7.1;
      sleepQuality = 77;
      soreness = 4 + (i % 2);
      stress = 4;
      readiness = 76 + (i % 4);
      status = 'moderate';
      coachAdvice = 'Fatiga aguda normal del pico de volumen. Evita picos de pulso en cuestas.';
      suggestedAction = 'maintain';
    } else {
      // Week 4 (0 to 6 days ago): Cumulative fatigue approaching deload threshold
      // HRV drops to 41-44 ms (-15% to -20% below baseline 51ms), Resting HR creeps to 50-51 bpm
      const recentVariations = [43, 42, 44, 41, 45, 43, 44];
      const rHrVariations = [51, 51, 50, 52, 49, 50, 51];
      const sorenessVariations = [5, 6, 5, 6, 4, 5, 5];
      const readVariations = [68, 65, 71, 62, 74, 69, 70];

      hrv = recentVariations[i % recentVariations.length];
      restingHr = rHrVariations[i % rHrVariations.length];
      sleepHours = 6.8;
      sleepQuality = 72;
      soreness = sorenessVariations[i % sorenessVariations.length];
      stress = 4;
      readiness = readVariations[i % readVariations.length];
      status = readiness < 68 ? 'fatigued' : 'moderate';
      coachAdvice = 'Alerta de fatiga acumulada: La HRV nocturna acumula 4 días seguidos por debajo de tu línea base de 51 ms y el pulso en reposo ha subido +4 bpm. Se acerca el momento de programar la descarga.';
      suggestedAction = readiness < 68 ? 'downgrade_easy' : 'maintain';
    }

    checkIns.push({
      date: dateStr,
      restingHr,
      hrvRmssd: hrv,
      hrvBaseline: baseline,
      sleepHours,
      sleepQuality,
      muscleSoreness: soreness,
      stressLevel: stress,
      readinessScore: readiness,
      status,
      coachAdvice,
      suggestedAction,
    });
  }

  return checkIns;
};

export const SAMPLE_DAILY_CHECKINS: DailyCheckIn[] = generateSampleDailyCheckIns();

export const SAMPLE_WEIGHT_HISTORY: WeightEntry[] = [
  {
    id: 'w-1',
    date: new Date(Date.now() - 42 * 24 * 3600 * 1000).toISOString().split('T')[0],
    weightKg: 73.2,
    bodyFatPct: 15.8,
    notes: 'Punto de partida macrociclo Transvulcania 2027. Altura 176 cm. IMC: 23.6.'
  },
  {
    id: 'w-2',
    date: new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString().split('T')[0],
    weightKg: 72.4,
    bodyFatPct: 15.2,
    notes: 'Fin de Mesociclo 1 (Base Aeróbica). Reducción de inflamación y grasa visceral.'
  },
  {
    id: 'w-3',
    date: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
    weightKg: 71.9,
    bodyFatPct: 14.8,
    notes: 'Excelente respuesta. Piernas más reactivas en subidas y menor impacto en bajada.'
  },
  {
    id: 'w-4',
    date: new Date().toISOString().split('T')[0],
    weightKg: 71.5,
    bodyFatPct: 14.5,
    notes: 'Pesaje actual en ayunas. -1.7 kg acumulados. Faltan 4.0 kg hacia el peso óptimo de 67.5 kg.'
  }
];

export const SAMPLE_WEEKLY_SUMMARIES: WeeklyPerformanceSummary[] = [
  {
    weekId: 'w-sum-1',
    weekLabel: 'Semana 1 (Hace 5 sem)',
    startDate: new Date(Date.now() - 35 * 24 * 3600 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().split('T')[0],
    mesocycleName: 'Mesociclo 1: Base Aeróbica & Reversión ADS',
    totalDistanceKm: 26.5,
    totalDurationMin: 220,
    totalElevationGainM: 920,
    totalElevationLossM: 920,
    completedWorkoutsCount: 4,
    plannedWorkoutsCount: 4,
    mountainTss: 172,
    avgHeartRate: 135,
    compliancePct: 100,
    coachWeeklyAssessment: 'Semana impecable de disciplina aeróbica. Ritmo de caminata en subidas empinadas para salvaguardar el AeT a 142 bpm.',
    zoneDistribution: {
      zone1Min: 95,
      zone2Min: 105,
      zone3Min: 15,
      zone4Min: 5,
      zone5Min: 0,
      totalDurationMin: 220,
      aerobicRatioPct: 90.9,
      zoneSenseAerobicMin: 198,
    }
  },
  {
    weekId: 'w-sum-2',
    weekLabel: 'Semana 2 (Hace 4 sem)',
    startDate: new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() - 22 * 24 * 3600 * 1000).toISOString().split('T')[0],
    mesocycleName: 'Mesociclo 1: Base Aeróbica & Reversión ADS',
    totalDistanceKm: 31.0,
    totalDurationMin: 265,
    totalElevationGainM: 1140,
    totalElevationLossM: 1140,
    completedWorkoutsCount: 4,
    plannedWorkoutsCount: 4,
    mountainTss: 215,
    avgHeartRate: 136,
    compliancePct: 100,
    coachWeeklyAssessment: 'Crecimiento de volumen progresivo. El pulso promedio se mantuvo en 136 bpm en tirada larga. Ratio aeróbico del 89.4%.',
    zoneDistribution: {
      zone1Min: 110,
      zone2Min: 127,
      zone3Min: 20,
      zone4Min: 8,
      zone5Min: 0,
      totalDurationMin: 265,
      aerobicRatioPct: 89.4,
      zoneSenseAerobicMin: 232,
    }
  },
  {
    weekId: 'w-sum-3',
    weekLabel: 'Semana 3 (Hace 3 sem)',
    startDate: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString().split('T')[0],
    mesocycleName: 'Mesociclo 2: Construcción de Volumen y D+',
    totalDistanceKm: 37.8,
    totalDurationMin: 320,
    totalElevationGainM: 1580,
    totalElevationLossM: 1580,
    completedWorkoutsCount: 4,
    plannedWorkoutsCount: 4,
    mountainTss: 278,
    avgHeartRate: 137,
    compliancePct: 100,
    coachWeeklyAssessment: 'Superada la barrera de los 1.500m D+. Muy buena respuesta neuromuscular con las sesiones de sóleo excéntrico.',
    zoneDistribution: {
      zone1Min: 130,
      zone2Min: 152,
      zone3Min: 28,
      zone4Min: 10,
      zone5Min: 0,
      totalDurationMin: 320,
      aerobicRatioPct: 88.1,
      zoneSenseAerobicMin: 275,
    }
  },
  {
    weekId: 'w-sum-4',
    weekLabel: 'Semana 4 (Hace 2 sem)',
    startDate: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString().split('T')[0],
    mesocycleName: 'Mesociclo 2: Construcción de Volumen y D+',
    totalDistanceKm: 42.2,
    totalDurationMin: 365,
    totalElevationGainM: 1850,
    totalElevationLossM: 1850,
    completedWorkoutsCount: 4,
    plannedWorkoutsCount: 4,
    mountainTss: 320,
    avgHeartRate: 137,
    compliancePct: 100,
    coachWeeklyAssessment: 'Pico de volumen del segundo mesociclo. Aumento de velocidad a pulso constante (de 6:25 a 6:05 min/km a 140 bpm).',
    zoneDistribution: {
      zone1Min: 145,
      zone2Min: 175,
      zone3Min: 32,
      zone4Min: 13,
      zone5Min: 0,
      totalDurationMin: 365,
      aerobicRatioPct: 87.7,
      zoneSenseAerobicMin: 310,
    }
  },
  {
    weekId: 'w-sum-5',
    weekLabel: 'Semana 5 (Semana Pasada)',
    startDate: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString().split('T')[0],
    mesocycleName: 'Mesociclo 2: Construcción de Volumen y D+',
    totalDistanceKm: 32.5,
    totalDurationMin: 275,
    totalElevationGainM: 1320,
    totalElevationLossM: 1320,
    completedWorkoutsCount: 4,
    plannedWorkoutsCount: 4,
    mountainTss: 228,
    avgHeartRate: 134,
    compliancePct: 100,
    coachWeeklyAssessment: 'Semana de descarga asimilativa. Regeneración completa comprobada con HRV en verde y pulso en reposo a 46 bpm.',
    zoneDistribution: {
      zone1Min: 135,
      zone2Min: 120,
      zone3Min: 15,
      zone4Min: 5,
      zone5Min: 0,
      totalDurationMin: 275,
      aerobicRatioPct: 92.7,
      zoneSenseAerobicMin: 250,
    }
  }
];

export const SAMPLE_MESOCYCLE_PROGRESSION: MesocycleProgressionSummary[] = [
  {
    id: 'meso-1',
    name: 'Mesociclo 1: Reversión ADS & Base Aeróbica Inicial',
    phase: 'base_aerobic',
    weeksCount: 4,
    avgWeeklyDistanceKm: 28.5,
    avgWeeklyElevationGainM: 1030,
    avgWeeklyDurationHours: 4.1,
    totalElevationGainM: 4120,
    aerobicBasePct: 90.2,
    aeTPaceEvolution: '6:35 min/km ➔ 6:15 min/km a 140 bpm',
    driftTestEvolutionPct: 6.8, // ADS inicial
    keyMilestone: 'Desacoplamiento cardíaco reducido de 7.5% a 5.8%. Control estricto del pulso en subidas.',
    coachNote: 'Excelente disciplina mental: caminar cuando la pendiente supera el 12% ha permitido construir capilares y mitocondrias en fibras de contracción lenta.'
  },
  {
    id: 'meso-2',
    name: 'Mesociclo 2: Construcción de Volumen & D+ Aeróbico',
    phase: 'mountain_specific',
    weeksCount: 4,
    avgWeeklyDistanceKm: 38.4,
    avgWeeklyElevationGainM: 1585,
    avgWeeklyDurationHours: 5.4,
    totalElevationGainM: 6340,
    aerobicBasePct: 88.5,
    aeTPaceEvolution: '6:15 min/km ➔ 5:58 min/km a 142 bpm',
    driftTestEvolutionPct: 4.2, // Umbral < 5% alcanzado
    keyMilestone: 'Reversión exitosa del Síndrome de Deficiencia Aeróbica (ADS). Drift Test validado a 4.2%.',
    coachNote: 'Aumento neto de 17 segundos/km en la velocidad a umbral aeróbico. Capacidad para mantener DFA a1 > 0.75 incluso acumulando +1.500m de desnivel.'
  },
  {
    id: 'meso-3',
    name: 'Mesociclo 3: Muscular Endurance & Carga Excéntrica (Planificado)',
    phase: 'muscular_endurance',
    weeksCount: 4,
    avgWeeklyDistanceKm: 46.0,
    avgWeeklyElevationGainM: 2400,
    avgWeeklyDurationHours: 6.5,
    totalElevationGainM: 9600,
    aerobicBasePct: 85.0,
    aeTPaceEvolution: 'Consolidación de ritmo en subida sostenida',
    driftTestEvolutionPct: 3.5,
    keyMilestone: 'Tolerancia de cuádriceps en descensos continuos de >2.000m D- y tolerancia gástrica a 65 g/h.',
    coachNote: 'Foco prioritario en el muro de bajada de El Time (Roque a Tazacorte). Las sesiones de Step-down excéntrico 3-1-1 son innegociables.'
  }
];

// --- HYDRATION DATASETS ---

export const SAMPLE_HYDRATION_TESTS: SweatRateTest[] = [
  {
    id: 'sweat-test-1',
    date: '2026-09-08',
    workoutTitle: 'Tirada Larga Clima Cálido (Simulación Fuencaliente)',
    preWeightKg: 72.1,
    postWeightKg: 70.6,
    fluidsConsumedMl: 1800,
    urineMl: 150,
    durationMin: 180,
    temperatureC: 27,
    elevationGainM: 950,
    sweatLossLiters: 3.15,
    sweatRateLitersPerHour: 1.05,
    bodyWeightLossPct: 2.08,
    sodiumLossEstimateMgPerHour: 680,
    recommendedFluidsPerHourMl: 750,
    hydrationRiskLevel: 'moderate_dehydration',
    notes: 'Día soleado en sendero pedregoso. Sensación de boca seca en la última media hora.',
    coachFeedback: 'Pérdida del 2.08% de masa corporal. Excediste el límite seguro del 2.0%, lo que explica que tu pulso subiera 6 ppm en los últimos 40 min por menor volumen plasmático. Para días a >25°C, sube la reposición a 750 ml/h con 650 mg de sodio.'
  },
  {
    id: 'sweat-test-2',
    date: '2026-09-15',
    workoutTitle: 'Rodaje Sub-AeT en Altitud / Cresta Fresca',
    preWeightKg: 71.7,
    postWeightKg: 70.9,
    fluidsConsumedMl: 900,
    urineMl: 200,
    durationMin: 110,
    temperatureC: 16,
    elevationGainM: 620,
    sweatLossLiters: 1.5,
    sweatRateLitersPerHour: 0.82,
    bodyWeightLossPct: 1.11,
    sodiumLossEstimateMgPerHour: 490,
    recommendedFluidsPerHourMl: 550,
    hydrationRiskLevel: 'optimal',
    notes: 'Viento en cresta pero buena temperatura. Utilicé 1 bidón con electrolitos y 1 de agua.',
    coachFeedback: 'Excelente equilibrio hídrico. Pérdida del 1.11% dentro de la ventana de rendimiento de Uphill Athlete (<1.5%). La orina posterior fue color claro (Nivel 2).'
  },
  {
    id: 'sweat-test-3',
    date: '2026-09-22',
    workoutTitle: 'Bloque Muscular de Bajada Excéntrica en Calor',
    preWeightKg: 71.5,
    postWeightKg: 70.1,
    fluidsConsumedMl: 1500,
    urineMl: 100,
    durationMin: 140,
    temperatureC: 29,
    elevationGainM: 300,
    sweatLossLiters: 2.8,
    sweatRateLitersPerHour: 1.2,
    bodyWeightLossPct: 1.95,
    sodiumLossEstimateMgPerHour: 780,
    recommendedFluidsPerHourMl: 800,
    hydrationRiskLevel: 'optimal',
    notes: 'Descenso rápido con alta temperatura. Terminé al límite de sales.',
    coachFeedback: 'Tu tasa de sudoración roza los 1.2 L/h en calor canario. Mantuviste la pérdida justo en 1.95%, pero en Transvulcania durante la bajada de Tazacorte necesitarás cápsula de sal cada 45 minutos.'
  }
];

export const SAMPLE_TRANSVULCANIA_HYDRATION_SECTIONS: TransvulcaniaHydrationSection[] = [
  {
    segmentId: 'h-sec-1',
    name: 'Faro de Fuencaliente ➔ Los Canarios',
    fromKm: 0,
    toKm: 7.2,
    distanceKm: 7.2,
    dPlusM: 710,
    dMinusM: 15,
    estimatedHours: 1.1,
    climateZone: 'Arena volcánica (Picón) • Calor de primera hora',
    tempRangeC: '20°C - 23°C',
    recommendedCarryMl: 1000,
    hourlyTargetMl: 600,
    hourlySodiumMg: 550,
    flaskSetup: 'Flask 1: Isotónico con carbohidratos (30g) | Flask 2: Agua con sales neutras',
    aidStationName: 'Avituallamiento Los Canarios (Km 7.2)',
    coachWarning: 'La arena volcánica absorbe la energía del paso y dispara el coste metabólico. No te confíes con el frescor del amanecer; bebe antes de llegar al pueblo.'
  },
  {
    segmentId: 'h-sec-2',
    name: 'Los Canarios ➔ Las Deseadas ➔ Refugio del Pilar',
    fromKm: 7.2,
    toKm: 24.4,
    distanceKm: 17.2,
    dPlusM: 1215,
    dMinusM: 520,
    estimatedHours: 2.9,
    climateZone: 'Ruta de los Volcanes • Sol directo sin sombra • Muy seco',
    tempRangeC: '24°C - 28°C',
    recommendedCarryMl: 1500,
    hourlyTargetMl: 700,
    hourlySodiumMg: 650,
    flaskSetup: '2 Soft Flasks 500ml delante + 1 Flask 500ml de reserva en espalda',
    aidStationName: 'Avituallamiento Mayor: Refugio del Pilar (Km 24.4)',
    coachWarning: '¡ZONA ROJA! Son casi 3 horas sin fuentes de agua en la cresta volcánica expuesta. Sal de Los Canarios con 1.5L completos. Muchos abandonos de Transvulcania se gestan aquí por hipohidratación silenciosa.'
  },
  {
    segmentId: 'h-sec-3',
    name: 'Refugio del Pilar ➔ Pico de la Nieve',
    fromKm: 24.4,
    toKm: 35.3,
    distanceKm: 10.9,
    dPlusM: 820,
    dMinusM: 180,
    estimatedHours: 1.8,
    climateZone: 'Crestería de altura (1.900m) • Humedad relativa <20%',
    tempRangeC: '17°C - 21°C',
    recommendedCarryMl: 1200,
    hourlyTargetMl: 600,
    hourlySodiumMg: 550,
    flaskSetup: 'Flask 1: 500ml con sales e hidratos | Flask 2: 500ml agua pura + pastilla de sales',
    aidStationName: 'Avituallamiento Pico de la Nieve (Km 35.3)',
    coachWarning: 'La altitud y el aire seco canario provocan evaporación instantánea. No esperarás tener sed para beber; mantén tomas cada 15 min por alarma de tu reloj Suunto.'
  },
  {
    segmentId: 'h-sec-4',
    name: 'Pico de la Nieve ➔ Pico de la Cruz ➔ Roque de los Muchachos',
    fromKm: 35.3,
    toKm: 51.5,
    distanceKm: 16.2,
    dPlusM: 780,
    dMinusM: 420,
    estimatedHours: 2.6,
    climateZone: 'Techo de la Isla (2.426m) • Hipoxia suave • Viento fuerte',
    tempRangeC: '15°C - 19°C',
    recommendedCarryMl: 1200,
    hourlyTargetMl: 650,
    hourlySodiumMg: 550,
    flaskSetup: '1 Flask Isotónico + 1 Flask Agua fresca + Cápsula sal al coronar',
    aidStationName: 'Avituallamiento Roque de los Muchachos (Km 51.5)',
    coachWarning: 'Punto más alto de la carrera. Come algo sólido salado (patata cocida o frutos secos) en el Roque y sal con los bidones 100% llenos para el descenso letal.'
  },
  {
    segmentId: 'h-sec-5',
    name: 'Roque de los Muchachos ➔ Torre del Time ➔ Puerto de Tazacorte',
    fromKm: 51.5,
    toKm: 67.5,
    distanceKm: 16.0,
    dPlusM: 60,
    dMinusM: 2420,
    estimatedHours: 2.2,
    climateZone: 'El Muro de El Time • Choque térmico vertical (de 15°C a 30°C)',
    tempRangeC: '26°C - 31°C',
    recommendedCarryMl: 1500,
    hourlyTargetMl: 800,
    hourlySodiumMg: 750,
    flaskSetup: 'Líquidos bien fríos si es posible. Máximo aporte de sodio y sales',
    aidStationName: 'Avituallamiento Puerto de Tazacorte (Km 67.5)',
    coachWarning: '¡EL HORNO DE TAZACORTE! El descenso excéntrico rompe fibras musculares. Si tus niveles de sodio caen aquí, los calambres en cuádriceps bloquearán tus piernas en las zetas de piedra hacia el puerto.'
  },
  {
    segmentId: 'h-sec-6',
    name: 'Puerto de Tazacorte ➔ Meta Los Llanos de Aridane',
    fromKm: 67.5,
    toKm: 73.2,
    distanceKm: 5.7,
    dPlusM: 360,
    dMinusM: 20,
    estimatedHours: 0.9,
    climateZone: 'Barranco de las Angustias • Calor asfáltico y humedad costera',
    tempRangeC: '27°C - 30°C',
    recommendedCarryMl: 750,
    hourlyTargetMl: 650,
    hourlySodiumMg: 500,
    flaskSetup: '1 Flask 500ml agua / sales frescas para coronar',
    aidStationName: 'META: Los Llanos de Aridane (Km 73.2)',
    coachWarning: 'Último repecho de subida tras 70 km en las piernas. Mantén pequeños sorbos de agua fría para refrescar la boca y evitar náuseas de última hora.'
  }
];

export const SAMPLE_WUT_CHECK: WUTDailyCheck = {
  id: 'wut-today',
  date: new Date().toISOString().split('T')[0],
  weightDown: false,
  urineColorScore: 2,
  morningThirst: false,
  score: 0,
  status: 'optimal',
  advice: 'Estado de hidratación excelente (Euhidratado). Orina amarillo pajizo claro y sin sequedad bucal. Listo para la sesión programada.'
};
