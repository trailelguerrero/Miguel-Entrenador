import express, { Request, Response } from 'express';
import { AiError, aiConfigStatus, ChatTurn, classifyAiError, generateText, GenerateOptions, modelFor, parseModelJson } from './ai.js';
import { registerSuuntoRoutes } from './suunto-routes.js';
import { ZONESENSE_PROMPT_RULES, describeBreakdown } from '../src/brain/zonesense.js';
import { describeDataWindows } from '../src/brain/dataWindows.js';
import { describeIntensityPrescription, resolveIntensityPrescription } from '../src/brain/intensity.js';
import { describeReadiness, evaluateReadiness, type ReadinessState } from '../src/brain/readiness.js';
import { describeLoadHistory, localDateKey } from '../src/utils/trainingLoad.js';
import { PROVENANCE_PROMPT_RULES, tag } from '../src/brain/provenance.js';
import { describeMemoryForPrompt, sanitizeEvidenceItems, MAX_EVIDENCE_PER_EVENT } from '../src/brain/memory.js';
import { sanitizeAdaptation, sanitizePlanWorkouts } from './brain/validate.js';

// App Express con todas las rutas /api/*. No escucha en ningún puerto:
// - En Vercel la exporta api/index.ts como función serverless.
// - En local la monta server.ts junto con Vite.
const app = express();

app.use(express.json({ limit: '25mb' }));

// Llama a la IA y, si respondió el respaldo (Gemini en vez de Experiential),
// lo avisa al navegador con la cabecera X-AI-Fallback (la app muestra un aviso).
async function runAi(res: Response, opts: GenerateOptions): Promise<string> {
  const result = await generateText(opts);
  if (result.fallback) {
    res.setHeader('X-AI-Fallback', encodeURIComponent(`${result.fallback.code}: ${result.fallback.reason}`));
  }
  return result.text;
}

// Respuesta de error común para todas las rutas de IA: código + mensaje claro
// + qué hacer, que la app muestra en el banner "Error de API de IA".
function sendAiError(res: Response, route: string, err: unknown) {
  const aiErr = err instanceof AiError ? err : classifyAiError(err, (process.env.AI_PROVIDER as any) === 'experiential' ? 'experiential' : 'gemini');
  console.error(`Error in ${route}: [${aiErr.code}] ${aiErr.message}`, aiErr.detail ?? '');
  res.status(aiErr.httpStatus).json({
    error: aiErr.message,
    code: aiErr.code,
    hint: aiErr.hint,
    provider: aiErr.provider,
  });
}

// Estado de la configuración (no gasta tokens): la app lo consulta al abrirse.
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    ai: aiConfigStatus(),
    suuntoMcpUrl: process.env.SUUNTO_MCP_URL || 'https://mcp-ten-kappa.vercel.app',
  });
});

// Prueba real y mínima de la IA (botón "Probar IA" de la app).
app.post('/api/health/ai-test', async (_req: Request, res: Response) => {
  const started = Date.now();
  try {
    const result = await generateText({
      system: 'Eres un comprobador de conexión.',
      input: 'Responde únicamente con la palabra: OK',
      temperature: 0,
    });
    res.json({
      ok: true,
      provider: result.provider,
      model: modelFor(result.provider, false),
      latencyMs: Date.now() - started,
      reply: result.text.trim().slice(0, 40),
      fallback: result.fallback,
    });
  } catch (err) {
    sendAiError(res, '/api/health/ai-test', err);
  }
});

/** Disponibilidad: solo la que el atleta declara a mano; lo de Suunto es historial, no disponibilidad. */
function availabilityLine(p: any): string {
  const days = p?.availableDaysPerWeek;
  if (days && p?.fieldSources?.availableDaysPerWeek === 'manual') {
    return `Disponibilidad declarada por el atleta: ${days} días/semana${days <= 3 ? ' → como máximo 2 sesiones entre semana + tirada larga' : ''}.`;
  }
  if (days) return `Disponibilidad no declarada por el atleta. Según Suunto entrena de media ${days} días/semana (incluye otros deportes); no es un límite.`;
  return 'Disponibilidad no declarada por el atleta.';
}

/** Zonas del reloj y, SOLO si hay tendencia sostenida, la recomendación de cambio. */
function formatWatchZones(a: any): string {
  if (!a?.watch) return 'sin datos';
  const z = a.watch.zones;
  const base = `FC máx ${a.watch.maxHr ?? '?'}; inicio Z2 ${z?.z2 ?? '?'}, Z3 ${z?.z3 ?? '?'}, Z4 ${z?.z4 ?? '?'}, Z5 ${z?.z5 ?? '?'}`;
  const recs = (a.recommendations || []).map((r: any) => `${r.label} ${r.current}→${r.suggested} (${r.evidence})`);
  return recs.length
    ? `${base}. RECOMENDACIÓN POR TENDENCIA SOSTENIDA: ${recs.join('; ')}. Díselo al atleta.`
    : `${base}. Sin tendencia sostenida que justifique cambiarlas: no recomiendes cambiar zonas por datos de un solo día.${(a.notes || []).length ? ` Notas: ${a.notes.join(' ')}` : ''}`;
}

function formatLoadContext(lc: any): string {
  if (!lc) return '- Sin datos de carga ni recuperación.';
  const lines: string[] = [];
  if (lc.ctl != null) lines.push(`- ${tag('derived')} CTL ${lc.ctl} · ATL ${lc.atl} · TSB ${lc.tsb}${lc.weeklyTss != null ? ` · TSS últimos 7 días ${lc.weeklyTss}` : ''}`);
  if (lc.loadHistory) lines.push(`- ${describeLoadHistory(lc.loadHistory)}`);
  for (const c of lc.recentCheckIns || []) {
    lines.push(`- ${c.date}: ${c.fromSuunto ? `${tag('real')} (Suunto)` : `${tag('real')} (declarado por el atleta)`} HRV ${c.hrvRmssd} ms (referencia ${c.hrvBaseline} ms), sueño ${c.sleepHours} h${c.recoveryPct != null ? `, Recovery Suunto ${c.recoveryPct}%` : ''}, semáforo ${tag('derived')} ${c.status}`);
  }
  if (lc.todayReadiness) lines.push(`${tag('derived')} ${describeReadiness(lc.todayReadiness as ReadinessState)}`);
  lines.push(`- ${describeDataWindows()}`);
  return lines.join('\n');
}

// Formato común de EVIDENCIAS para la memoria (el estado lo calcula src/brain/memory.ts)
const EVIDENCE_JSON_SPEC = `"evidence": [
    {
      "insightId": "id de un aprendizaje de la memoria (el que va entre corchetes) si esto lo APOYA o lo CONTRADICE; null si es un hallazgo nuevo",
      "supports": true o false (false = contradice ese aprendizaje),
      "summary": "Qué ocurrió, con el dato que lo respalda (hecho, no regla)",
      "category": "solo si insightId es null: physiology_zonesense | fatigue_recovery | biomechanics_injury | nutrition_hydration | terrain_technique",
      "observation": "solo si insightId es null: hallazgo en una frase",
      "hypothesis": "solo si insightId es null: qué habría que vigilar para confirmarlo (hipótesis, no regla)"
    }
  ]  (máximo ${MAX_EVIDENCE_PER_EVENT}; lista vacía [] si no hay nada que aporte evidencia real. No inventes evidencias: solo lo que muestran los datos o dice el atleta)`;

const MIGUEL_SYSTEM_INSTRUCTION = `
Eres Miguel, un entrenador de Trail Running y Ultra Trail de élite. Eres el entrenador personal y amigo cercano del atleta.
Tu tono es directo, motivador, empático pero sin pelos en la lengua: dices las cosas claras. Si el atleta corre demasiado rápido en días suaves ("zona basura" o "junk miles"), le frenas con explicaciones fisiológicas contundentes. Si está fatigado o su HRV/ZoneSense indica estrés celular, le ordenas descansar o bajar intensidad sin rodeos para protegerlo de lesiones y sobreentrenamiento.

REGLA SUPREMA DE INTEGRIDAD DE DATOS (CERO ALUCINACIÓN O INVENCIÓN):
- NUNCA inventes datos de Frecuencia Cardíaca ni métricas de Suunto ZoneSense (colores, tiempo en zonas, umbrales) ni utilices fórmulas estándar o genéricas (como 220-edad o zonas fijas arbitrarias).
- Los datos fisiológicos deben proceder EXCLUSIVAMENTE de:
  1. Suunto (a través de la sincronización de Suunto API, puente MCP o archivos .FIT reales subidos).
  2. El documento de historial del atleta en formato Markdown (.md) subido al sistema.
  3. Los registros explícitos de test de campo realizados por el atleta (ej. Test de deriva de 60 min).
- Si en algún momento no se dispone de un dato real concreto (por ejemplo, falta la FC máxima real o el tiempo en zonas de ZoneSense de una sesión), no lo inventes: pide al atleta que lo aporte en su archivo .md o que suba el archivo .fit de su reloj Suunto.

Tus pilares fundamentales son:
1. MANUAL DE CABECERA: "Training for the Uphill Athlete: A Manual for Mountain Runners and Ski Mountaineers" (Scott Johnston, Steve House y Kilian Jornet).
   - Más del 80-90% del entrenamiento debe ser en Zona 1 y Zona 2 estrictas (por debajo de AeT / Umbral Aeróbico) para erradicar el Síndrome de Deficiencia Aeróbica (ADS) y multiplicar mitocondrias y capilares.
   - Test de deriva cardíaca de 60 min (Heart Rate Drift Test) como prueba reina para verificar AeT.
   - Fuerza sin máquinas: Step-ups en rocas/bancos, zancadas búlgaras con pausa isométrica, step-downs excéntricos para blindar los cuádriceps en bajadas, peso muerto rumano a una pierna y circuito de core lumbopélvico.
   - Trabajo de Resistencia Muscular (Muscular Endurance - ME): Subidas empinadas (>20-25% de pendiente) en power-hiking.

2. ${ZONESENSE_PROMPT_RULES}

3. CÓMO SABER SI LA CUENTA DE SUUNTO ESTÁ CONECTADA O SI SUBIR EL ARCHIVO .FIT:
   - Si el atleta te pregunta cómo se conectan sus entrenamientos con Suunto:
     * En la pestaña 'Suunto & ZoneSense' → 'Conexión Suunto & Claude MCP' pulsa "Conectar Suunto" e inicia sesión con su cuenta Suunto (una sola vez por navegador). No necesita claves de desarrollador.
     * Con la cuenta conectada (semáforo VERDE), el botón "Sincronizar" trae los entrenos de los últimos 365 días (para calcular CTL/ATL/TSB con el TSS de Suunto) y los últimos 28 días de sueño: resumen de cada entreno (duración, distancia, desnivel, FC media/máx, TSS y tiempo en zonas ZoneSense aeróbica/transición/anaeróbica) y, de cada noche, sueño, HRV y FC mínima. Las sesiones planificadas de ese día se marcan como completadas con los datos reales.
     * La sincronización trae el tiempo en verde/amarillo/rojo de ZoneSense de cada entreno, pero NO la serie segundo a segundo: para ese análisis detallado de una sesión concreta, que exporte el archivo .fit desde la App Suunto y lo suba en la pestaña 'Suunto & ZoneSense' o en el detalle de la sesión.
     * Del archivo .FIT el motor lee FC, cadencia, desnivel y velocidad. El .FIT NO trae ZoneSense: el reparto de zonas del .FIT es por FC respecto a AeT/AnT, no ZoneSense. Sé honesto con esto.

4. OBJETIVO PRINCIPAL: Transvulcania 2027 en La Palma (73 km, +4.350m D+, -4.057m D-). Terreno volcánico, calor, crestería del Roque de los Muchachos a 2.426m y un descenso demoledor de 2.400m hasta el Puerto de Tazacorte.

5. ESTRUCTURA SEMANAL DEL ATLETA (REGLA FIJA): 3 sesiones entre semana (lunes a viernes) + 1 tirada larga en SÁBADO o DOMINGO (un fin de semana puede ser sábado y otro domingo; eliges tú según la semana). Algunas semanas puedes bajar a 2 sesiones entre semana si la fatiga lo aconseja (HRV, Recovery de Suunto, TSB) o si el atleta ha indicado menos disponibilidad; cuando lo hagas, explícale por qué. Fuerza en casa o al aire libre sin material.

6. HISTORIAL DEPORTIVO (.MD): Conoce al dedillo el archivo .md del deportista si ha sido cargado. Cita sus carreras pasadas, sus puntos débiles y sus sensaciones históricas para demostrarle que le conoces de verdad.

7. APRENDIZAJE CONTINUO Y CERO PLANES GENÉRICOS (100% PERSONALIZACIÓN Y ADAPTACIÓN):
   - Cada pupilo es un mundo biológico único. Odias las plantillas prefabricadas, planes enlatados y tablas genéricas de revista.
   - Cada sesión que prescribes responde con precisión quirúrgica al estado de este atleta hoy: sus adaptaciones fisiológicas previas, sus puntos débiles registrados en su perfil o historial (nunca supongas lesiones que no consten), sus métricas reales de ZoneSense y su evolución de carga.
   - En cada sesión justificas exactamente el motivo personalizado ("Por qué para ti hoy") y qué regla aprendida de sesiones pasadas estás aplicando.
   - Aprendes de forma acumulativa pero prudente. El ESTADO de cada aprendizaje lo calcula el código a partir de evidencias: 1 = observación, 2 = hipótesis (se vigila), 3 o más = regla provisional (se aplica), 5 o más sin contradicciones = consolidada; cada evidencia en contra lo baja un nivel y caduca a los 90 días sin evidencias. Solo aplicas como regla lo que llega en "REGLAS QUE SE APLICAN"; lo que llega "A VIGILAR" lo comentas como hipótesis, nunca como regla.

8. MONITORIZACIÓN DE PESO ÓPTIMO Y BIOMECÁNICA VERTICAL:
   - Monitorizas la altura, peso actual y peso objetivo de carrera que figuren en sus datos (si no hay objetivo, no lo supongas).
   - No des cifras de kcal o minutos ahorrados por kilo: no hay un dato validado para este atleta.
   - La pérdida de peso debe ser progresiva (300-400g/semana) mediante recomposición corporal y nunca con déficits calóricos severos que provoquen RED-S (Deficiencia Energética Relativa) o degradación muscular.

9. NUTRICIÓN, HIDRATACIÓN Y ENTRENAMIENTO GÁSTRICO:
   - Las recomendaciones salen de: punto de partida general + EVIDENCIA DEL ATLETA (tolerancia de carbohidratos registrada en su gut training, tasa de sudoración medida, perfil de pérdida de sodio, historial digestivo) + entorno (calor, altitud) + demanda de la sesión (duración, intensidad).
   - Sin evidencia del atleta NO des cifras concretas (g/h, ml/h, mg/h) como si fueran suyas: dilo, da el rango general como orientación explícitamente genérica y propón cómo medirlo (test de sudoración, progresión de gut training).
   - Nunca superes la tolerancia de carbohidratos registrada; progresa desde ella.
   - Analizas la tolerancia digestiva reportada tras cada sesión y la usas como evidencia.

10. ${PROVENANCE_PROMPT_RULES}
`;

// 1. Interactive Chat with Miguel
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { messages, athleteProfile, currentReadiness, targetRace, context, athleteHistoryDoc, coachMemory, brainContext } = req.body;

    const formattedHistory: ChatTurn[] = (messages || []).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content ?? ''),
    }));

    const memoryContext = coachMemory ? `
- Diagnóstico general personalizado: ${coachMemory.overallPhilosophySummary || 'En proceso'}
${describeMemoryForPrompt(coachMemory, localDateKey())}
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
  * Perfil de sal / sudor: ${advProfile.heatTolerance?.sodiumLossProfile === 'salty_sweater_white_crust' ? 'Sudador salado (genera costra blanca, necesita 600-800 mg sodio/h)' : 'Pérdida de sal moderada/baja'}
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
[DATOS REALES DEL ATLETA - CERO DATOS INVENTADOS]
- Nombre: ${athleteProfile?.name || 'Atleta'}
- Edad: ${athleteProfile?.age ? athleteProfile.age + ' años' : 'Sin dato'}
- Altura: ${athleteProfile?.heightCm ? athleteProfile.heightCm + ' cm' : 'Sin dato'}
- Peso Actual: ${athleteProfile?.weightKg ? athleteProfile.weightKg + ' kg' : 'Sin dato'}
- Peso Objetivo de Carrera: ${athleteProfile?.targetRaceWeightKg ? athleteProfile.targetRaceWeightKg + ' kg' : 'Sin dato'}${athleteProfile?.weightKg && athleteProfile?.targetRaceWeightKg ? ` (Diferencia hacia meta: ${(Number(athleteProfile.weightKg) - Number(athleteProfile.targetRaceWeightKg)).toFixed(1)} kg)` : ''}
- FC Reposo: ${athleteProfile?.restingHr ? athleteProfile.restingHr + ' bpm' : 'Pendiente de registrar en Suunto'}
- FC Máx: ${athleteProfile?.maxHr ? athleteProfile.maxHr + ' bpm' : 'Pendiente de registrar en Suunto'}
- Umbral Aeróbico por FC (zonas del reloj, respaldo sin banda; NO es ZoneSense): ${athleteProfile?.aetHr ? athleteProfile.aetHr + ' bpm' : 'Pendiente de registrar'}
- Umbral Anaeróbico por FC (zonas del reloj, respaldo sin banda; NO es ZoneSense): ${athleteProfile?.antHr ? athleteProfile.antHr + ' bpm' : 'Pendiente de registrar'}
- Estado ADS (Síndrome Deficiencia Aeróbica): ${athleteProfile?.hasAds ? 'SÍ (necesita volumen estricto Z1/Z2)' : 'NO'}
- Objetivo Principal: ${targetRace?.name || 'Transvulcania 2027'} (${targetRace?.distanceKm || 73}km, +${targetRace?.elevationGainM || 4350}m D+)
- Estructura semanal: 3 sesiones entre semana (o 2 si lo decides por fatiga/disponibilidad) + tirada larga en sábado o domingo.
- ${availabilityLine(athleteProfile)}
- Estado Biométrico Hoy (Suunto HRV/Sueño): ${currentReadiness ? JSON.stringify(currentReadiness) : 'Pendiente de sincronizar o check-in'}
- Origen de Datos: ${athleteProfile?.dataSource || 'Registro / Suunto'}
- VO2máx (Suunto): ${athleteProfile?.vo2Max ?? 'No disponible'}
- HRV nocturna de referencia: ${athleteProfile?.baselineHrv ? athleteProfile.baselineHrv + ' ms' : 'Pendiente'}
- Zonas de FC del reloj (carrera): ${formatWatchZones(athleteProfile?.watchZoneAdvice)}
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
${describeIntensityPrescription(resolveIntensityPrescription(athleteProfile))}

[CARGA Y RECUPERACIÓN (hechos calculados por la app, no los recalcules)]:
${formatLoadContext(brainContext)}
- Contexto adicional: ${context || 'Conversación general'}
`;

    const conversation: ChatTurn[] = [
      { role: 'user', content: `[INSTRUCCIÓN DE CONTEXTO]: ${athleteContext}` },
      ...formattedHistory,
    ];

    const text = await runAi(res, {
      system: MIGUEL_SYSTEM_INSTRUCTION,
      input: conversation,
      temperature: 0.7,
    });

    const reply = text || 'Oye, ha habido un pequeño corte en la comunicación, pero aquí estoy. Cuéntame cómo vas.';
    res.json({ reply });
  } catch (err) {
    sendAiError(res, '/api/chat', err);
  }
});

// 2. Generate Plan / Microcycle Workouts
app.post('/api/generate-plan', async (req: Request, res: Response) => {
  try {
    const { athleteProfile, targetRace, weekStartDate, phaseFocus, existingWorkouts, athleteHistoryDoc, coachMemory, loadContext, nutritionEvidence } = req.body;
    const intensity = resolveIntensityPrescription(athleteProfile);
    const weekSessions = Array.isArray(existingWorkouts) && existingWorkouts.length
      ? existingWorkouts
          .map((w: any) => `- ${w.date} · ${w.title} (${w.type}) · ${w.status}${w.adapted ? ', adaptada' : ''}${w.fromSuunto ? ', de Suunto' : ''}${w.durationMin ? ` · ${w.durationMin} min` : ''}${w.tss != null ? ` · ${w.tss} TSS ${w.tssSource === 'suunto' ? tag('real') : tag('estimated')}` : ''}`)
          .join('\n')
      : '- No hay sesiones en esta semana todavía.';
    const nutritionLine = [
      nutritionEvidence?.maxCarbsPerHourG ? `tolerancia de carbohidratos registrada ${nutritionEvidence.maxCarbsPerHourG} g/h` : 'sin tolerancia de carbohidratos registrada',
      nutritionEvidence?.sweatRateLph ? `tasa de sudoración medida ${nutritionEvidence.sweatRateLph} L/h` : 'sin tasa de sudoración medida',
      nutritionEvidence?.sodiumProfile ? `perfil de sodio: ${nutritionEvidence.sodiumProfile}` : 'sin perfil de sodio',
    ].join('; ');

    const memoryContext = coachMemory ? `
${describeMemoryForPrompt(coachMemory, localDateKey())}
` : '';

    const prompt = `
Genera un microciclo semanal de entrenamiento de 7 días (comenzando el lunes ${weekStartDate || 'próximo'}) para preparar ${targetRace?.name || 'Transvulcania 2027'}.

[DIRECTIVA CRÍTICA: CERO PLANES GENÉRICOS O DE PLANTILLA]:
- Queda TERMINANTEMENTE PROHIBIDO prescribir sesiones genéricas estándar (como "45 min de carrera suave", "hacer series", "estirar").
- Cada sesión debe estar diseñada al 100% para ESTE atleta individual, teniendo en cuenta sus antecedentes, sus zonas fisiológicas exactas, sus debilidades mecánicas y las reglas aprendidas.
- En cada sesión debes rellenar obligatoriamente "personalizedReasoning" (explicando en primera persona por qué prescribe esto para él, mencionando sus datos concretos) y "learnedAdjustment" (qué adaptación o regla de su memoria estás aplicando).

[ESTRUCTURA SEMANAL OBLIGATORIA]:
- 3 sesiones de carrera entre semana (lunes a viernes). Puedes reducirlas a 2 SOLO si el estado de fatiga de abajo lo aconseja o si la disponibilidad declarada por el atleta es menor; si reduces, explícalo en "weekSummary".
- 1 tirada larga ("type": "long_mountain_run") en SÁBADO o DOMINGO, con desnivel positivo y descenso. Elige el día que mejor encaje esta semana (no tiene que ser siempre el mismo).
- Nunca más de 3 sesiones entre semana, nunca tirada larga entre semana, nunca dos tiradas largas.
- Los demás días: DESCANSO TOTAL o movilidad ligera ("type": "rest"). La fuerza sin material puede ir como "strength_core" y no cuenta como sesión de carrera.
- ${availabilityLine(athleteProfile)}

[ESTADO ACTUAL DE CARGA Y RECUPERACIÓN (hechos calculados por la app)]:
${formatLoadContext(loadContext)}

[SESIONES YA EXISTENTES ESA SEMANA] (las hechas y las de Suunto se conservan; tu plan sustituye solo las planificadas no hechas de los días que devuelvas):
${weekSessions}

[INTENSIDAD]:
${describeIntensityPrescription(intensity)}

[NUTRICIÓN: EVIDENCIA DEL ATLETA]:
- ${nutritionLine}. Si falta un dato, deja ese campo numérico en null y explícalo en "nutritionAdvice".

[REGLA DE INTEGRIDAD]: Respeta rigurosamente los umbrales medidos:
- AeT (Umbral Aeróbico): ${athleteProfile?.aetHr ? athleteProfile.aetHr + ' bpm' : 'SIN DATO (no inventes pulsaciones)'} (tope de FC SOLO como respaldo sin banda; con banda de pecho la referencia es ZoneSense en verde)
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
      "intensitySource": "zonesense | heart_rate_measured | rpe | terrain | unknown",
      "zoneSenseTarget": "ZoneSense verde (aeróbico) | Regenerativo (verde, muy suave) | ZoneSense amarillo (entre umbrales) | ZoneSense rojo (sobre umbral anaeróbico)",
      "targetHrMin": number o null (null si no hay umbral de FC medido),
      "targetHrMax": number o null (null si no hay umbral de FC medido),
      "description": "Explicación detallada del objetivo metabólico y neuromuscular",
      "personalizedReasoning": "Por qué prescribo esto para ti hoy teniendo en cuenta tus datos específicos y sensaciones previas",
      "learnedAdjustment": "Regla aprendida de su memoria que aplicas aquí, o null si no aplicas ninguna",
      "warmup": "Calentamiento específico",
      "mainSet": "Parte principal detallada paso a paso",
      "cooldown": "Vuelta a la calma",
      "terrainRecommendation": "Pista forestal, sendero con piedras, rampa empinada, etc.",
      "nutritionAdvice": "Hidratación/electrolitos recomendados acordes a su perfil y calor de La Palma",
      "plannedCarbsPerHourG": number o null (solo con tolerancia registrada, sin superarla),
      "plannedFluidsPerHourMl": number o null (solo con tasa de sudoración medida),
      "plannedSodiumPerHourMg": number o null (solo con tasa de sudoración y perfil de sodio),
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

    const text = await runAi(res, {
      system: MIGUEL_SYSTEM_INSTRUCTION,
      input: prompt,
      json: true,
    });

    const parsed = parseModelJson(text);
    // El código garantiza las reglas: sin FC inventada, colores canónicos, nutrición con evidencia
    const checked = sanitizePlanWorkouts(parsed.workouts, athleteProfile, weekStartDate, nutritionEvidence);
    res.json({ ...parsed, workouts: checked.workouts, validationNotes: checked.notes, structureIssues: checked.structureIssues });
  } catch (err) {
    sendAiError(res, '/api/generate-plan', err);
  }
});

// 3. Adapt Session in Real-Time based on Morning HRV & Sleep
app.post('/api/adapt-session', async (req: Request, res: Response) => {
  try {
    const { originalWorkout, checkIn, athleteProfile, athleteHistoryDoc, readinessState } = req.body;

    // El estado y los límites los calcula el motor determinista (normalmente
    // en el cliente, con TSB y carga); si no llegan, se calculan aquí con el check-in.
    const state: ReadinessState =
      readinessState && readinessState.level
        ? readinessState
        : evaluateReadiness({
            hrvRmssd: checkIn?.hrvRmssd,
            hrvBaseline: athleteProfile?.baselineHrv || checkIn?.hrvBaseline,
            sleepHours: checkIn?.sleepHours,
            muscleSoreness: checkIn?.muscleSoreness,
            stressLevel: checkIn?.stressLevel,
            recoveryPct: checkIn?.readinessScore,
            plannedWorkout: originalWorkout,
          });

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
${describeIntensityPrescription(resolveIntensityPrescription(athleteProfile))}
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
    "intensitySource": "zonesense | heart_rate_measured | rpe | terrain | unknown",
    "zoneSenseTarget": "ZoneSense verde (aeróbico) | Regenerativo (verde, muy suave) | ZoneSense amarillo (entre umbrales) | ZoneSense rojo (sobre umbral anaeróbico)",
    "targetHrMax": number o null (null si no hay umbral de FC medido),
    "mainSet": "Instrucciones de la sesión",
    "warmup": "Calentamiento",
    "cooldown": "Vuelta a la calma",
    "wasAdapted": true o false,
    "adaptationReason": "Motivo, citando el estado del motor"
  }
}
`;

    const text = await runAi(res, {
      system: MIGUEL_SYSTEM_INSTRUCTION,
      input: prompt,
      json: true,
    });

    const parsed = parseModelJson(text);
    // Recorte determinista a los límites del motor de readiness
    const checked = sanitizeAdaptation(parsed.adaptedWorkout, state, athleteProfile);
    res.json({ ...parsed, adaptedWorkout: checked.adapted, corrections: checked.corrections, readinessState: state });
  } catch (err) {
    sendAiError(res, '/api/adapt-session', err);
  }
});

// 4. Workout Debrief & FIT Analysis by Miguel (with Continuous Learning)
app.post('/api/analyze-workout', async (req: Request, res: Response) => {
  try {
    const { workout, fitMetrics, athleteProfile, athleteFeedback, coachMemory, athleteHistoryDoc } = req.body;

    const memoryContext = coachMemory ? `
${describeMemoryForPrompt(coachMemory, localDateKey())}
` : '';

    const prompt = `
Analiza la sesión de trail recién completada por el atleta y anota en tu cuaderno lo que has OBSERVADO en ella. Una sola sesión es una observación, no una regla permanente: formúlala como tal.

[PLANIFICACIÓN PREVIA]:
- Título: ${workout?.title}
- Tipo: ${workout?.type}
- Duración prevista: ${workout?.plannedDurationMin} min | D+ previsto: ${workout?.plannedElevationGainM || 0}m
- Objetivo ZoneSense: ${workout?.zoneSenseTarget}
- Razón personalizada: ${workout?.personalizedReasoning || 'N/A'}

[DATOS REALES DEL ENTRENAMIENTO]:
- Duración real: ${fitMetrics?.totalDurationMin || workout?.actualDurationMin} min
- Distancia: ${fitMetrics?.totalDistanceKm || workout?.actualDistanceKm} km
- Desnivel: +${fitMetrics?.totalAscentM || workout?.actualElevationGainM || 0}m D+ / -${fitMetrics?.totalDescentM || 0}m D-
- FC Media: ${fitMetrics?.avgHeartRate || workout?.actualAvgHr} bpm | FC Máx: ${fitMetrics?.maxHeartRate || workout?.actualMaxHr} bpm
- Umbrales del atleta: AeT ${athleteProfile?.aetHr ? athleteProfile.aetHr + ' bpm' : 'sin dato'} / AnT ${athleteProfile?.antHr ? athleteProfile.antHr + ' bpm' : 'sin dato'}
- TSS (Suunto): ${workout?.actualTss ?? 'sin dato'}
- Distribución de zonas: ${
      workout?.zoneSenseBreakdown
        ? `ZoneSense de Suunto → ${describeBreakdown(workout.zoneSenseBreakdown)}`
        : fitMetrics?.hasHeartRate
          ? `por FC del .FIT (NO es ZoneSense) → FC ≤ AeT ${fitMetrics.timeInAerobicPct}%, AeT–AnT ${fitMetrics.timeInTransitionPct}%, FC > AnT ${fitMetrics.timeInAnaerobicPct}%`
          : 'sin datos de zonas (no las supongas)'
    }

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
  "feedback": "Texto de Miguel hablando como entrenador amigo y directo: evalúa cumplimiento de ZoneSense/AeT, avisa si corrió de más en subidas, analiza sensaciones musculares y da pautas de recuperación para Transvulcania 2027.",
  ${EVIDENCE_JSON_SPEC}
}
`;

    const text = await runAi(res, {
      system: MIGUEL_SYSTEM_INSTRUCTION,
      input: prompt,
      json: true,
    });

    const parsed = parseModelJson(text);
    // Evidencias validadas en código (ids existentes, categorías válidas, máximo por sesión)
    res.json({ feedback: parsed.feedback, evidence: sanitizeEvidenceItems(parsed.evidence, coachMemory) });
  } catch (err) {
    sendAiError(res, '/api/analyze-workout', err);
  }
});

// 5. Extract Learned Insight from Conversation / Note
app.post('/api/coach-memory/extract-insight', async (req: Request, res: Response) => {
  try {
    const { noteText, athleteProfile, currentMemory } = req.body;

    if (!noteText) {
      return res.status(400).json({ error: 'Texto no proporcionado' });
    }

    const prompt = `
El atleta o el entrenador acaba de registrar una observación clave:
"${noteText}"

${describeMemoryForPrompt(currentMemory, localDateKey())}

Esto es UNA evidencia aportada por el atleta, no una regla permanente. Anótala en JSON:
{
  ${EVIDENCE_JSON_SPEC},
  "miguelConfirmation": "Mensaje corto de Miguel diciendo qué ha anotado y que lo convertirá en regla solo si se repite."
}
`;

    const text = await runAi(res, {
      system: MIGUEL_SYSTEM_INSTRUCTION,
      input: prompt,
      json: true,
    });

    const parsed = parseModelJson(text);
    res.json({ miguelConfirmation: parsed.miguelConfirmation, evidence: sanitizeEvidenceItems(parsed.evidence, currentMemory) });
  } catch (err) {
    sendAiError(res, '/api/coach-memory/extract-insight', err);
  }
});

// 5b. Evidencias de una conversación con Miguel (quedan PENDIENTES hasta que el atleta las confirme)
app.post('/api/coach-memory/extract-chat-evidence', async (req: Request, res: Response) => {
  try {
    const { messages, currentMemory } = req.body;
    const turns = (Array.isArray(messages) ? messages : []).slice(-30);
    const athleteTurns = turns.filter((m: any) => m?.role === 'user');
    if (athleteTurns.length === 0) return res.json({ evidence: [] });

    const prompt = `
Lee esta conversación entre el atleta y Miguel y extrae SOLO lo que el ATLETA ha contado sobre su cuerpo, sus sensaciones, su recuperación, su nutrición o el terreno (hechos que él afirma). Lo que dice Miguel son consejos, NO evidencias.

[CONVERSACIÓN]
${turns.map((m: any) => `${m.role === 'user' ? 'ATLETA' : 'MIGUEL'}: ${String(m.content ?? '').slice(0, 1500)}`).join('\n')}

${describeMemoryForPrompt(currentMemory, localDateKey())}

Responde en JSON:
{
  ${EVIDENCE_JSON_SPEC}
}
`;

    const text = await runAi(res, {
      system: MIGUEL_SYSTEM_INSTRUCTION,
      input: prompt,
      json: true,
    });

    const parsed = parseModelJson(text);
    res.json({ evidence: sanitizeEvidenceItems(parsed.evidence, currentMemory) });
  } catch (err) {
    sendAiError(res, '/api/coach-memory/extract-chat-evidence', err);
  }
});

// 6. Look up / Analyze Race Info (for secondary prep races or Transvulcania details)
app.post('/api/race-info', async (req: Request, res: Response) => {
  try {
    const { raceName, approximateDate, distanceKm } = req.body;

    const prompt = `
Busca información técnica detallada sobre la carrera de montaña "${raceName}" (aprox. ${distanceKm ? distanceKm + ' km' : ''}, fecha prevista ${approximateDate || ''}).
Incluye:
- Ubicación exacta y altitud mínima y máxima.
- Desnivel positivo (D+) y negativo (D-).
- Tipo de terreno (bloques de piedra, senderos técnicos, pistas corribles, barro, arena).
- Cómo encaja como carrera preparatoria secundaria (prioridad B o C) de cara a la Transvulcania 2027 (73km, +4.350m D+).

Responde en formato JSON:
{
  "name": "Nombre oficial",
  "distanceKm": number,
  "elevationGainM": number,
  "elevationLossM": number,
  "location": "Lugar",
  "terrainDescription": "Descripción detallada del terreno",
  "altitudeRange": "mínima - máxima",
  "strategicValueForTransvulcania": "Consejo de Miguel sobre cómo afrontarla"
}
`;

    const text = await runAi(res, {
      system: MIGUEL_SYSTEM_INSTRUCTION,
      input: prompt,
      json: true,
    });

    const parsed = parseModelJson(text);
    res.json(parsed);
  } catch (err) {
    sendAiError(res, '/api/race-info', err);
  }
});

// 6. Parse and Ingest Athlete Markdown History (.md)
app.post('/api/parse-markdown-history', async (req: Request, res: Response) => {
  try {
    const { markdownContent, fileName } = req.body;

    if (!markdownContent || typeof markdownContent !== 'string') {
      return res.status(400).json({ error: 'El contenido del archivo .md está vacío.' });
    }

    const prompt = `
Eres Miguel, entrenador de Trail Running. El atleta acaba de subir su documento de historial deportivo y métricas de Suunto en formato Markdown (.md).

Debes leer TODO el documento con máxima atención y extraer ÚNICAMENTE la información real que esté explícitamente escrita en él.
[REGLA DE ORO DE INTEGRIDAD]: ESTÁ TERMINANTEMENTE PROHIBIDO INVENTAR NÚMEROS O ESTIMACIONES. Si el atleta no menciona su FC máxima o sus zonas, déjalos como null.

Documento subido:
"""
${markdownContent}
"""

Responde con un objeto JSON estructurado:
{
  "summary": {
    "aetHr": number o null,
    "antHr": number o null,
    "maxHr": number o null,
    "restingHr": number o null,
    "zoneSenseObservations": "Resumen del tiempo en verde/amarillo/rojo de ZoneSense (sin traducirlo a pulsaciones)",
    "keyRaces": ["Carrera 1", "Carrera 2"],
    "injuries": ["Lesión o sobrecarga detectada"],
    "weeklyVolumeKm": number o null
  },
  "miguelAnalysis": "Mensaje enérgico, cercano y honesto de Miguel en español de España: dale la bienvenida a su historial, agradece la precisión de los datos, destaca qué puntos fisiológicos vas a cuidar especialmente (ej: debilidades en bajadas, umbrales medidos, historial de sobrecargas) de cara al objetivo de Transvulcania 2027.",
  "extractedProfileUpdates": {
    "aetHr": number o null,
    "antHr": number o null,
    "maxHr": number o null,
    "restingHr": number o null,
    "injuryHistory": "string o null"
  }
}
`;

    const text = await runAi(res, {
      system: MIGUEL_SYSTEM_INSTRUCTION,
      input: prompt,
      json: true,
    });

    const parsed = parseModelJson(text);
    res.json(parsed);
  } catch (err) {
    sendAiError(res, '/api/parse-markdown-history', err);
  }
});

registerSuuntoRoutes(app);

export default app;
