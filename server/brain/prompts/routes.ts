// Prompts de Miguel por ruta. Solo construyen texto: las decisiones y la
// validación están en server/brain/decision/ y en src/brain/.
import type { ChatTurn } from '../../ai.js';
import { MIGUEL_SYSTEM_INSTRUCTION, EVIDENCE_JSON_SPEC } from './system.js';
import { athleteToday, availabilityLine, describeTargetRace, formatLoadContext, formatWatchZones } from '../context.js';
import { describeMemoryForPrompt } from '../../../src/brain/memory.js';
import { aetOrigin, describeIntensityPrescription, isFormulaMaxHr, resolveIntensityPrescription } from '../../../src/brain/intensity.js';
import { describeReadiness, type ReadinessState } from '../../../src/brain/readiness.js';
import { describeBreakdown } from '../../../src/brain/zonesense.js';
import { localDateKey } from '../../../src/utils/trainingLoad.js';
import { tag } from '../../../src/brain/provenance.js';
import { deriveWeeklyStructurePolicy, describeWeeklyStructurePolicy } from '../../../src/utils/weekStructure.js';

export { MIGUEL_SYSTEM_INSTRUCTION };

/** Conversación completa para /api/chat: contexto del atleta + historial. */
export function buildChatConversation(body: any): ChatTurn[] {
  const { messages, athleteProfile, currentReadiness, targetRace, context, athleteHistoryDoc, coachMemory, brainContext } = body || {};
  const formattedHistory: ChatTurn[] = (messages || []).map((m: any) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: String(m.content ?? ''),
  }));

  const memoryContext = coachMemory ? `
- Diagnóstico general personalizado: ${coachMemory.overallPhilosophySummary || 'En proceso'}
${describeMemoryForPrompt(coachMemory, athleteToday(body))}
` : '';

  const ultraExp = athleteProfile?.ultraExperience;
  const advProfile = athleteProfile?.advancedPhysiologicalProfile;

  const advProfileContext = advProfile ? `
[PERFIL FISIOLÓGICO AVANZADO & HISTORIAL CLÍNICO]:
- Historial Detallado de Lesiones Crónicas: ${advProfile.chronicInjuries?.description || 'Sin lesiones crónicas reportadas'}
  * Detonante principal: ${advProfile.chronicInjuries?.primaryTrigger || 'N/A'}
  * Señales tempranas de aviso: ${advProfile.chronicInjuries?.activeWarningSigns || 'N/A'}
  * Protocolo de gestión / descarga: ${advProfile.chronicInjuries?.managementProtocol || 'N/A'}
  * Plantillas podológicas: ${advProfile.chronicInjuries?.orthoticsOrInsoles ? 'SÍ (usa plantillas a medida)' : 'NO'}
- Experiencia en Alta Montaña & Terreno Volcánico:
  * Experiencia en terreno volcánico (lapilli, picón, arena volcánica): ${advProfile.highMountain?.hasVolcanicTerrainExperience ? 'SÍ (conoce la tracción y abrasión del lapilli canario)' : 'NO (novato en arena/lapilli volcánico, advertir sobre polainas y fatiga de tobillos)'}
  * Notas sobre terreno volcánico: ${advProfile.highMountain?.volcanicTerrainNotes || 'Sin notas'}
  * Grado técnico: ${advProfile.highMountain?.technicalTerrainGrade === 'extreme_ridge_scree' ? 'Extremo / crestería y pedreras rotas' : advProfile.highMountain?.technicalTerrainGrade === 'technical_alpine_rocks' ? 'Alta montaña técnica con rocas' : 'Senderos moderados'}
  * Altitud máxima alcanzada: ${advProfile.highMountain?.maxAltitudeReachedM ? advProfile.highMountain.maxAltitudeReachedM + 'm' : 'Sin dato'}
  * Sensibilidad a la altitud/hipoxia: ${advProfile.highMountain?.altitudeSensitivity || 'Sin dato'}
- Tolerancia al Calor Documentada:
  * Nivel: ${advProfile.heatTolerance?.level || 'Sin dato'}
  * Historial de calambres en calor: ${advProfile.heatTolerance?.crampHistoryInHeat ? 'SÍ (vulnerable a calambres por deshidratación/sodio)' : 'NO'}
  * Tasa de sudoración medida: ${advProfile.heatTolerance?.sweatRateDocumentedLitersPerHour ? advProfile.heatTolerance.sweatRateDocumentedLitersPerHour + ' L/h' : 'Sin medir'}
  * Perfil de sal / sudor: ${advProfile.heatTolerance?.sodiumLossProfile === 'salty_sweater_white_crust' ? 'Sudador salado (deja costra blanca); su reposición de sodio concreta no está medida' : 'Pérdida de sal moderada/baja'}
  * Estrategia de choque térmico: ${advProfile.heatTolerance?.heatStrategyNotes || 'Sin dato'}
- Cuestionario de Preferencias de Entrenamiento & Estilo de Vida:
  * Franja horaria preferida: ${advProfile.trainingPreferences?.preferredTrainingTime || 'Sin dato'}
  * Terreno predilecto para tiradas largas: ${advProfile.trainingPreferences?.longRunPreferredTerrain || 'Sin dato'}
  * Deportes cruzados tolerados: ${advProfile.trainingPreferences?.crossTrainingSports?.join(', ') || 'Sin dato'}
  * Flexibilidad semanal: ${advProfile.trainingPreferences?.weeklyFlexibility === 'flexible_swap_days' ? 'Flexible (intercambiar días según imprevistos)' : 'Estructura fija'}
  * Tolerancia a cinta de correr: ${advProfile.trainingPreferences?.treadmillTolerance || 'Sin dato'}
  * Día preferido de descanso total: ${advProfile.trainingPreferences?.preferredRestDay || 'Sin dato'}
  * Limitaciones de vida / trabajo: ${advProfile.trainingPreferences?.lifestyleConstraintsNotes || 'Sin dato'}
` : '';

  const ultraExpContext = ultraExp ? `
[EXPERIENCIA EN ULTRA TRAIL Y CONDICIÓN DEL ATLETA]:
- Años corriendo ultratrail: ${athleteProfile?.yearsTrailRunning ? athleteProfile.yearsTrailRunning + ' años' : 'Sin dato'}
- Carrera más larga completada: ${ultraExp.longestRaceKm || 'N/A'} km (+${ultraExp.longestRaceElevationGainM || 'N/A'}m D+)
- Ultras previas completadas: ${ultraExp.completedUltras || 'N/A'}
- Habilidad en bajadas técnicas: ${ultraExp.downhillTechnicalAbility === 'expert_technical' ? 'Experto / cabra montesa' : ultraExp.downhillTechnicalAbility === 'intermediate' ? 'Intermedio (necesita cuidar cuádriceps)' : 'Básico / cauto'}
- Técnica y uso de bastones: ${ultraExp.polesUsage || 'Sin dato'}
- Calidad y horas de sueño habitual: ${ultraExp.sleepQualityAvgHours ? ultraExp.sleepQualityAvgHours + 'h/noche' : 'Sin dato'}
- Nivel de estrés laboral/vital: ${ultraExp.dailyWorkStressLevel || 'Sin dato'}
- Asimilación y recuperación: ${ultraExp.recoveryCapacityAt50 || 'Sin dato'}
- Zonas vulnerables / lesiones históricas: ${ultraExp.vulnerableJointsOrTissues?.join(', ') || athleteProfile?.injuryHistory || 'Ninguna activa'}
- Tolerancia al calor canario: ${ultraExp.heatTolerance || 'Sin dato'}
- Historial digestivo / estómago: ${ultraExp.gutIssuesHistory || 'Sin dato'}
- Motivación personal: ${ultraExp.personalMotivation ? '"' + ultraExp.personalMotivation + '"' : 'Sin dato'}
` : `
- Historial de lesiones / puntos sensibles: ${athleteProfile?.injuryHistory || 'Sin datos'}
`;

  const athleteContext = `
[DATOS REALES DEL ATLETA - CERO DATOS INVENTADOS] (todo ${tag('real')}: medido o declarado por el atleta, salvo lo marcado de otra forma)
- Nombre: ${athleteProfile?.name || 'Atleta'}
- Edad: ${athleteProfile?.age ? athleteProfile.age + ' años' : 'Sin dato'}
- Altura: ${athleteProfile?.heightCm ? athleteProfile.heightCm + ' cm' : 'Sin dato'}
- Peso Actual: ${athleteProfile?.weightKg ? athleteProfile.weightKg + ' kg' : 'Sin dato'}
- Peso Objetivo de Carrera: ${athleteProfile?.targetRaceWeightKg ? athleteProfile.targetRaceWeightKg + ' kg' : 'Sin dato'}${athleteProfile?.weightKg && athleteProfile?.targetRaceWeightKg ? ` (${tag('derived')} Diferencia hacia meta: ${(Number(athleteProfile.weightKg) - Number(athleteProfile.targetRaceWeightKg)).toFixed(1)} kg)` : ''}
- FC Reposo: ${athleteProfile?.restingHr ? athleteProfile.restingHr + ' bpm' : 'Pendiente de registrar en Suunto'}
- FC Máx: ${athleteProfile?.maxHr ? athleteProfile.maxHr + ' bpm' + (isFormulaMaxHr(athleteProfile) ? ` (${tag('estimated')} coincide con 220 − edad: probablemente es la fórmula del reloj, no una medida; sugiérele confirmarla)` : '') : 'Pendiente de registrar en Suunto'}
- Umbral Aeróbico por FC (${aetOrigin(athleteProfile)}): ${athleteProfile?.aetHr ? athleteProfile.aetHr + ' bpm' : 'Pendiente de registrar'}
- Umbral Anaeróbico por FC: ${athleteProfile?.antHr ? athleteProfile.antHr + ' bpm' : 'Pendiente de registrar'}
- Estado ADS (Síndrome Deficiencia Aeróbica): ${athleteProfile?.hasAds ? 'SÍ (necesita volumen estricto Z1/Z2)' : 'NO'}
- [OBJETIVO PRINCIPAL] ${describeTargetRace(targetRace)}
- Estructura semanal: ${describeWeeklyStructurePolicy(deriveWeeklyStructurePolicy(athleteProfile))}
- ${availabilityLine(athleteProfile)}
- Check-in de hoy: ${currentReadiness ? 'registrado (sus datos y el ÚNICO estado válido de hoy, el del motor de readiness, van en CARGA Y RECUPERACIÓN)' : 'pendiente (sin HRV ni sueño de hoy)'}
- Origen de Datos: ${athleteProfile?.dataSource || 'Registro / Suunto'}
- VO2máx (Suunto): ${athleteProfile?.vo2Max ?? 'No disponible'}
- HRV nocturna de referencia: ${athleteProfile?.baselineHrv ? athleteProfile.baselineHrv + ' ms' : 'Pendiente'}
- Zonas de FC del reloj (carrera): ${formatWatchZones(athleteProfile?.watchZoneAdvice, athleteProfile?.zoneAdviceState, athleteProfile)}
- Origen de cada dato del perfil (Suunto = calculado de su reloj; Manual = lo ha puesto o corregido el atleta): ${
    athleteProfile?.fieldSources && Object.keys(athleteProfile.fieldSources).length
      ? Object.entries(athleteProfile.fieldSources).map(([k, v]) => `${k}=${v === 'suunto' ? 'Suunto' : 'Manual'}`).join(', ')
      : 'todo manual'
  }
${ultraExpContext}
${advProfileContext}
${athleteHistoryDoc?.content ? `
[DOCUMENTO DE HISTORIAL .MD SUBIDO POR EL ATLETA]:
"""
${athleteHistoryDoc.content}
"""
` : '[AVISO]: El atleta aún no ha subido su archivo .md de historial. Si necesitas detalles de su pasado o de tests previos de Suunto, pídeselo abiertamente.'}
${memoryContext}
[INTENSIDAD (jerarquía calculada, no la cambies)]:
${describeIntensityPrescription(resolveIntensityPrescription(athleteProfile), athleteProfile)}

[CARGA Y RECUPERACIÓN (hechos calculados por la app, no los recalcules)]:
${formatLoadContext(brainContext)}
- Contexto adicional: ${context || 'Conversación general'}
`;

  const conversation: ChatTurn[] = [
    { role: 'user', content: `[INSTRUCCIÓN DE CONTEXTO]: ${athleteContext}` },
    ...formattedHistory,
  ];
  return conversation;
}

/** Prompt de /api/generate-plan. */
export function buildPlanPrompt(body: any): string {
  const { athleteProfile, targetRace, weekStartDate, phaseFocus, existingWorkouts, athleteHistoryDoc, coachMemory, loadContext, nutritionEvidence } = body || {};
  const intensity = resolveIntensityPrescription(athleteProfile);
  const weekSessions = Array.isArray(existingWorkouts) && existingWorkouts.length
    ? existingWorkouts
        .map((w: any) => `- ${w.date} · ${w.title} (${w.type}) · ${w.status}${w.adapted ? ', adaptada' : ''}${w.fromSuunto ? ', de Suunto' : ''}${w.durationMin ? ` · ${w.durationMin} min` : ''}${w.tss != null ? ` · ${w.tss} TSS ${w.tssSource === 'suunto' ? tag('real') : w.tssSource === 'suunto_assigned' ? '[ASIGNADO POR SUUNTO: actividad añadida a mano, sin FC]' : tag('estimated')}` : ''}`)
        .join('\n')
    : '- No hay sesiones en esta semana todavía.';
  const nutritionLine = [
    nutritionEvidence?.maxCarbsPerHourG ? `tolerancia de carbohidratos registrada ${nutritionEvidence.maxCarbsPerHourG} g/h` : 'sin tolerancia de carbohidratos registrada',
    nutritionEvidence?.sweatRateLph ? `tasa de sudoración medida ${nutritionEvidence.sweatRateLph} L/h` : 'sin tasa de sudoración medida',
    nutritionEvidence?.sodiumRangeMgPerHour ? `rango de sodio medido ${nutritionEvidence.sodiumRangeMgPerHour.min}-${nutritionEvidence.sodiumRangeMgPerHour.max} mg/h` : `sin rango de sodio medido (plannedSodiumPerHourMg = null${nutritionEvidence?.sodiumProfile ? `; perfil cualitativo: ${nutritionEvidence.sodiumProfile}` : ''})`,
  ].join('; ');

  const memoryContext = coachMemory ? `
${describeMemoryForPrompt(coachMemory, athleteToday(body))}
` : '';

  const weekPolicy = deriveWeeklyStructurePolicy(athleteProfile);
  const prompt = `
Genera un microciclo semanal de entrenamiento de 7 días (comenzando el lunes ${weekStartDate || 'próximo'}) para preparar su carrera objetivo.
[OBJETIVO PRINCIPAL] ${describeTargetRace(targetRace)}

[DIRECTIVA CRÍTICA: CERO PLANES GENÉRICOS O DE PLANTILLA]:
- Queda TERMINANTEMENTE PROHIBIDO prescribir sesiones genéricas estándar (como "45 min de carrera suave", "hacer series", "estirar").
- Cada sesión debe estar diseñada al 100% para ESTE atleta individual, teniendo en cuenta sus antecedentes, sus zonas fisiológicas exactas, sus debilidades mecánicas y las reglas aprendidas.
- En cada sesión debes rellenar obligatoriamente "personalizedReasoning" (explicando en primera persona por qué prescribe esto para él, mencionando sus datos concretos) y "learnedAdjustment" (qué adaptación o regla de su memoria estás aplicando).

[ESTRUCTURA SEMANAL OBLIGATORIA]:
- Estructura de ESTA semana: ${describeWeeklyStructurePolicy(weekPolicy)} Dentro de ese rango, usa el mínimo si el estado de fatiga de abajo lo aconseja; si reduces, explícalo en "weekSummary".
- 1 tirada larga ("type": "long_mountain_run") en SÁBADO o DOMINGO, con desnivel positivo y descenso. Elige el día que mejor encaje esta semana (no tiene que ser siempre el mismo). OBLIGATORIO en la tirada larga: "plannedDistanceKm" y "plannedElevationGainM" mayores que 0.
- Todas las fechas dentro de la semana (lunes a domingo) y como mucho una sesión de carrera por día.
- El sistema COMPRUEBA esta estructura en código: un plan que no la cumpla se rechaza y no se guarda.
- Nunca más de ${weekPolicy.midweekRunsMax} sesiones entre semana, nunca tirada larga entre semana, nunca dos tiradas largas.
- Los demás días: DESCANSO TOTAL o movilidad ligera ("type": "rest"). La fuerza sin material puede ir como "strength_core" y no cuenta como sesión de carrera.
- ${availabilityLine(athleteProfile)}

[ESTADO ACTUAL DE CARGA Y RECUPERACIÓN (hechos calculados por la app)]:
${formatLoadContext(loadContext)}

[SESIONES YA EXISTENTES ESA SEMANA] (las hechas y las de Suunto se conservan; tu plan sustituye solo las planificadas no hechas de los días que devuelvas):
${weekSessions}

[INTENSIDAD]:
${describeIntensityPrescription(intensity, athleteProfile)}

[NUTRICIÓN: EVIDENCIA DEL ATLETA]:
- ${nutritionLine}. Si falta un dato, deja ese campo numérico en null y explícalo en "nutritionAdvice".

[REGLA DE INTEGRIDAD]: Respeta rigurosamente los umbrales medidos:
- AeT (Umbral Aeróbico): ${athleteProfile?.aetHr ? athleteProfile.aetHr + ' bpm' : 'SIN DATO (no inventes pulsaciones)'} (referencia de intensidad: rodajes y tiradas largas por debajo de él)
- AnT (Umbral Anaeróbico): ${athleteProfile?.antHr ? athleteProfile.antHr + ' bpm' : 'SIN DATO (no inventes pulsaciones)'}
- ADS: ${athleteProfile?.hasAds ? 'SÍ (base comprometida, prohibido pasar de AeT en volumen)' : 'NO'}
- Enfoque del mesociclo actual: ${phaseFocus || 'Base Aeróbica y Fortalecimiento Excéntrico al Aire Libre'}
- Material: Cero gimnasio. Todo peso corporal, escalones, rocas o cuestas naturales.
${memoryContext}
${athleteHistoryDoc?.content ? `
[HISTORIAL DEL ATLETA (.MD)]:
"""
${athleteHistoryDoc.content}
"""
` : ''}

Responde ÚNICAMENTE con un JSON válido estructurado así:
{
  "weekSummary": "Explicación personalizada de Miguel para su pupilo sobre el objetivo estratégico de esta semana",
  "workouts": [
    {
      "id": "string único",
      "date": "YYYY-MM-DD",
      "title": "Nombre específico e instructivo de la sesión",
      "type": "easy_run | long_mountain_run | muscular_endurance | hill_intervals | strength_core | drift_test | rest",
      "plannedDurationMin": number,
      "plannedDistanceKm": number (opcional),
      "plannedElevationGainM": number (opcional),
      "plannedElevationLossM": number (opcional; D− de la ruta, obligatorio en la tirada larga si no es circular),
      "intensitySource": "heart_rate_measured | rpe",
      "targetHrMin": number o null (ppm; null si no hay umbral de FC),
      "targetHrMax": number o null (ppm; OBLIGATORIO si hay umbral de FC: rodajes y tiradas largas ≤ AeT),
      "description": "Explicación detallada del objetivo metabólico y neuromuscular",
      "personalizedReasoning": "Por qué prescribo esto para ti hoy teniendo en cuenta tus datos específicos y sensaciones previas",
      "learnedAdjustment": "Regla aprendida de su memoria que aplicas aquí, o null si no aplicas ninguna",
      "warmup": "Calentamiento específico",
      "mainSet": "Parte principal detallada paso a paso",
      "cooldown": "Vuelta a la calma",
      "terrainRecommendation": "Pista forestal, sendero con piedras, rampa empinada, etc.",
      "nutritionAdvice": "Hidratación/electrolitos recomendados acordes a su perfil y a las condiciones de su carrera objetivo",
      "plannedCarbsPerHourG": number o null (solo con tolerancia registrada, sin superarla),
      "plannedFluidsPerHourMl": number o null (solo con tasa de sudoración medida),
      "plannedSodiumPerHourMg": number o null (solo dentro de un rango de sodio medido),
      "strengthExercises": [
        {
          "name": "Nombre ejercicio",
          "sets": 3,
          "reps": "repeticiones",
          "targetMuscle": "Músculo",
          "notes": "Cómo ejecutarlo sin material (al aire libre o casa)",
          "isOutdoorFriendly": true
        }
      ]
    }
  ]
}
`;
  return prompt;
}

/** Prompt de /api/adapt-session: Miguel elige DENTRO de los límites del motor. */
export function buildAdaptPrompt(body: any, state: ReadinessState): string {
  const { originalWorkout, checkIn, athleteProfile, athleteHistoryDoc } = body || {};
  const prompt = `
El atleta tiene programado hoy:
- Título: ${originalWorkout?.title}
- Tipo: ${originalWorkout?.type}
- Duración prevista: ${originalWorkout?.plannedDurationMin} min
- Objetivo: ${originalWorkout?.mainSet}

Datos de esta mañana:
- HRV: ${checkIn?.hrvRmssd ?? 'sin dato'} ms · sueño ${checkIn?.sleepHours ?? 'sin dato'} h · dolor ${checkIn?.muscleSoreness ?? 'no indicado'}/10 · estrés ${checkIn?.stressLevel ?? 'no indicado'}/10

${describeReadiness(state)}

[INTENSIDAD]:
${describeIntensityPrescription(resolveIntensityPrescription(athleteProfile), athleteProfile)}
${athleteHistoryDoc?.content ? `
[HISTORIAL DEL ATLETA (.MD)]:
"""
${athleteHistoryDoc.content}
"""` : ''}

Tu labor: elegir la sesión de hoy DENTRO de esos límites (no los reinterpretes ni los amplíes) y explicarla al atleta. Si el estado es VERDE y no hace falta cambiar nada, dilo y devuelve la sesión original.

Responde en formato JSON:
{
  "miguelMessage": "Explicación directa y cercana de Miguel: qué ha visto el motor, qué cambia y por qué.",
  "adaptedWorkout": {
    "title": "Título",
    "type": "easy_run | rest | strength_core | long_mountain_run | muscular_endurance | hill_intervals",
    "plannedDurationMin": number,
    "intensitySource": "heart_rate_measured | rpe",
    "targetHrMax": number o null (ppm, dentro de la FC máxima de hoy; null si no hay umbral de FC),
    "mainSet": "Instrucciones de la sesión",
    "warmup": "Calentamiento",
    "cooldown": "Vuelta a la calma",
    "wasAdapted": true o false,
    "adaptationReason": "Motivo, citando el estado del motor"
  }
}
`;
  return prompt;
}

/** Zonas de FC medidas por Suunto en texto: "Z1 (<132) 93 min, Z2 (132–141) 42 min…". */
function describeSuuntoZones(z: any): string {
  const l = z.lowerLimits;
  const t = z.timesSec;
  const m = (s: number) => Math.round(s / 60);
  return `Z1 (<${l.z2}) ${m(t.z1)} min, Z2 (${l.z2}–${l.z3 - 1}) ${m(t.z2)} min, Z3 (${l.z3}–${l.z4 - 1}) ${m(t.z3)} min, Z4 (${l.z4}–${l.z5 - 1}) ${m(t.z4)} min, Z5 (≥${l.z5}) ${m(t.z5)} min`;
}

/** Prompt de /api/analyze-workout: valoración + evidencias (no reglas). */
export function buildAnalyzePrompt(body: any): string {
  const { workout, fitMetrics, athleteProfile, athleteFeedback, coachMemory, athleteHistoryDoc } = body || {};
  const memoryContext = coachMemory ? `
${describeMemoryForPrompt(coachMemory, athleteToday(body))}
` : '';

  const prompt = `
Analiza la sesión de trail recién completada por el atleta y anota en tu cuaderno lo que has OBSERVADO en ella. Una sola sesión es una observación, no una regla permanente: formúlala como tal.

[PLANIFICACIÓN PREVIA]:
- Título: ${workout?.title}
- Tipo: ${workout?.type}
- Duración prevista: ${workout?.plannedDurationMin} min | D+ previsto: ${workout?.plannedElevationGainM || 0}m
- Objetivo de FC: ${workout?.targetHrMin || workout?.targetHrMax ? `${workout?.targetHrMin ? workout.targetHrMin + '–' : '≤ '}${workout?.targetHrMax ?? ''} ppm` : 'sin objetivo de FC'}
- Razón personalizada: ${workout?.personalizedReasoning || 'N/A'}

[DATOS REALES DEL ENTRENAMIENTO]:
- Duración real: ${fitMetrics?.totalDurationMin || workout?.actualDurationMin} min
- Distancia: ${fitMetrics?.totalDistanceKm || workout?.actualDistanceKm} km
- Desnivel: +${fitMetrics?.totalAscentM || workout?.actualElevationGainM || 0}m D+ / -${fitMetrics?.totalDescentM || 0}m D-
- FC Media: ${fitMetrics?.avgHeartRate || workout?.actualAvgHr} bpm | FC Máx: ${fitMetrics?.maxHeartRate || workout?.actualMaxHr} bpm
- Umbrales del atleta: AeT ${athleteProfile?.aetHr ? athleteProfile.aetHr + ' bpm' : 'sin dato'} / AnT ${athleteProfile?.antHr ? athleteProfile.antHr + ' bpm' : 'sin dato'}
- TSS (Suunto): ${workout?.actualTss ?? 'sin dato'}${workout?.suuntoTssMethod ? ` (método de Suunto: ${workout.suuntoTssMethod})` : ''}
- Zonas por FC (la referencia): ${
    fitMetrics?.hasHeartRate && fitMetrics.timeInAerobicPct != null
      ? `del .FIT → FC ≤ AeT ${fitMetrics.timeInAerobicPct}%, AeT–AnT ${fitMetrics.timeInTransitionPct}%, FC > AnT ${fitMetrics.timeInAnaerobicPct}%`
      : workout?.suuntoHrZones
        ? `${tag('real')} tiempo MEDIDO por Suunto en cada zona de FC del reloj: ${describeSuuntoZones(workout.suuntoHrZones)}`
      : athleteProfile?.aetHr && (fitMetrics?.avgHeartRate || workout?.actualAvgHr)
        ? `sin tiempo en zonas; FC media ${fitMetrics?.avgHeartRate || workout?.actualAvgHr} ppm ${(fitMetrics?.avgHeartRate || workout?.actualAvgHr) > athleteProfile.aetHr ? 'POR ENCIMA' : 'por debajo'} del AeT (${athleteProfile.aetHr})`
        : 'sin datos de FC suficientes (no las supongas)'
  }
${workout?.ascentTimeMin != null || workout?.descentTimeMin != null ? `- ${tag('real')} Tiempo subiendo ${workout?.ascentTimeMin ?? '?'} min y bajando ${workout?.descentTimeMin ?? '?'} min (reloj)
` : ''}${
  workout?.weatherTemperatureC != null || workout?.avgTemperatureC != null
    ? `- ${tag('real')} Temperatura: ${workout?.weatherTemperatureC != null ? `${workout.weatherTemperatureC} °C según el tiempo` : ''}${workout?.weatherTemperatureC != null && workout?.avgTemperatureC != null ? '; ' : ''}${workout?.avgTemperatureC != null ? `${workout.avgTemperatureC} °C en el sensor del reloj (sube con el calor corporal)` : ''}
`
    : ''
}${workout?.suuntoFeeling ? `- ${tag('real')} Sensación anotada en Suunto: ${workout.suuntoFeeling}/5
` : ''}- ZoneSense (solo segunda opinión, no manda): ${workout?.zoneSenseBreakdown ? describeBreakdown(workout.zoneSenseBreakdown) : 'sin datos'}

[FEEDBACK DEL ATLETA]:
- RPE (Esfuerzo percibido 1-10): ${athleteFeedback?.rpe || workout?.athleteRpe ? (athleteFeedback?.rpe || workout?.athleteRpe) + '/10' : 'No indicado'}
- Comentarios y sensaciones: "${athleteFeedback?.notes || workout?.athleteNotes || 'Sin comentarios adicionales'}"
${memoryContext}
${athleteHistoryDoc?.content ? `
[HISTORIAL DEL ATLETA (.MD)]:
"""
${athleteHistoryDoc.content}
"""` : ''}

Como Coach Miguel, realiza una evaluación honesta y sin rodeos. Después anota como EVIDENCIAS lo que esta sesión muestra (hechos con su dato, no reglas). Responde en JSON:
{
  "feedback": "Texto de Miguel hablando como entrenador amigo y directo: evalúa si cumplió las pulsaciones previstas respecto a su AeT (y comenta ZoneSense solo como contraste), avisa si corrió de más en subidas, analiza sensaciones musculares y da pautas de recuperación pensando en su carrera objetivo.",
  ${EVIDENCE_JSON_SPEC}
}
`;
  return prompt;
}

/** Prompt de /api/coach-memory/extract-insight: una nota = una evidencia. */
export function buildNoteEvidencePrompt(noteText: string, currentMemory: any, today: string = athleteToday(null)): string {
  const prompt = `
El atleta o el entrenador acaba de registrar una observación clave:
"${noteText}"

${describeMemoryForPrompt(currentMemory, today)}

Esto es UNA evidencia aportada por el atleta, no una regla permanente. Anótala en JSON:
{
  ${EVIDENCE_JSON_SPEC},
  "miguelConfirmation": "Mensaje corto de Miguel diciendo qué ha anotado y que lo convertirá en regla solo si se repite."
}
`;
  return prompt;
}

/** Prompt de /api/coach-memory/extract-chat-evidence: solo lo que afirma el atleta. */
export function buildChatEvidencePrompt(turns: any[], currentMemory: any, today: string = athleteToday(null)): string {
  const prompt = `
Lee esta conversación entre el atleta y Miguel y extrae SOLO lo que el ATLETA ha contado sobre su cuerpo, sus sensaciones, su recuperación, su nutrición o el terreno (hechos que él afirma). Lo que dice Miguel son consejos, NO evidencias.

[CONVERSACIÓN]
${turns.map((m: any) => `${m.role === 'user' ? 'ATLETA' : 'MIGUEL'}: ${String(m.content ?? '').slice(0, 1500)}`).join('\n')}

${describeMemoryForPrompt(currentMemory, today)}

Responde en JSON:
{
  ${EVIDENCE_JSON_SPEC}
}
`;
  return prompt;
}

/** Prompt de /api/parse-markdown-history. */
export function buildHistoryPrompt(markdownContent: string): string {
  const prompt = `
Eres Miguel, entrenador de Trail Running. El atleta acaba de subir su documento de historial deportivo y métricas de Suunto en formato Markdown (.md).

Debes leer TODO el documento con máxima atención y extraer ÚNICAMENTE la información real que esté explícitamente escrita en él.
[REGLA DE ORO DE INTEGRIDAD]: ESTÁ TERMINANTEMENTE PROHIBIDO INVENTAR NÚMEROS O ESTIMACIONES. Si el atleta no menciona su FC máxima o sus zonas, déjalos como null. Cada cifra va con la frase LITERAL del documento que la dice ("quote"); el sistema comprueba que la frase existe y que habla de ese dato (un "150 km" nunca es una FC).

Documento subido:
"""
${markdownContent}
"""

Responde con un objeto JSON estructurado:
{
  "summary": {
    "aetHr": { "value": number, "quote": "frase LITERAL del documento donde aparece" } o null,
    "antHr": { "value": number, "quote": "frase literal" } o null,
    "maxHr": { "value": number, "quote": "frase literal" } o null,
    "restingHr": { "value": number, "quote": "frase literal" } o null,
    "zoneSenseObservations": "Resumen del tiempo en verde/amarillo/rojo de ZoneSense (sin traducirlo a pulsaciones)",
    "keyRaces": ["Carrera 1", "Carrera 2"],
    "injuries": ["Lesión o sobrecarga detectada"],
    "weeklyVolumeKm": { "value": number, "quote": "frase literal" } o null
  },
  "miguelAnalysis": "Mensaje enérgico, cercano y honesto de Miguel en español de España: dale la bienvenida a su historial, agradece la precisión de los datos, destaca qué puntos fisiológicos vas a cuidar especialmente (ej: debilidades en bajadas, umbrales medidos, historial de sobrecargas) de cara a su carrera objetivo.",
  "extractedProfileUpdates": {
    "aetHr": { "value": number, "quote": "frase literal" } o null,
    "antHr": { "value": number, "quote": "frase literal" } o null,
    "maxHr": { "value": number, "quote": "frase literal" } o null,
    "restingHr": { "value": number, "quote": "frase literal" } o null,
    "injuryHistory": "string o null"
  }
}
`;
  return prompt;
}
