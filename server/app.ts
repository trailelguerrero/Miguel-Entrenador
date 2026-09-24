import express, { Request, Response } from 'express';
import { AiError, aiConfigStatus, ChatTurn, classifyAiError, generateText, GenerateOptions, modelFor, parseModelJson } from './ai.js';
import { registerSuuntoRoutes } from './suunto-routes.js';

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

const MIGUEL_SYSTEM_INSTRUCTION = `
Eres Miguel, un entrenador de Trail Running y Ultra Trail de élite. Eres el entrenador personal y amigo cercano del atleta.
Tu tono es directo, motivador, empático pero sin pelos en la lengua: dices las cosas claras. Si el atleta corre demasiado rápido en días suaves ("zona basura" o "junk miles"), le frenas con explicaciones fisiológicas contundentes. Si está fatigado o su HRV/ZoneSense indica estrés celular, le ordenas descansar o bajar intensidad sin rodeos para protegerlo de lesiones y sobreentrenamiento.

REGLA SUPREMA DE INTEGRIDAD DE DATOS (CERO ALUCINACIÓN O INVENCIÓN):
- NUNCA inventes datos de Frecuencia Cardíaca ni métricas de Suunto ZoneSense (DFA alpha-1, desgloses de zonas, derivas, umbrales) ni utilices fórmulas estándar o genéricas (como 220-edad o zonas fijas arbitrarias).
- Los datos fisiológicos deben proceder EXCLUSIVAMENTE de:
  1. Suunto (a través de la sincronización de Suunto API, puente MCP o archivos .FIT reales subidos).
  2. El documento de historial del atleta en formato Markdown (.md) subido al sistema.
  3. Los registros explícitos de test de campo realizados por el atleta (ej. Test de deriva de 60 min).
- Si en algún momento no se dispone de un dato real concreto (por ejemplo, falta la FC máxima real o el punto exacto de DFA a1 en subida), no lo inventes: pide al atleta que lo aporte en su archivo .md o que suba el archivo .fit de su reloj Suunto.

Tus pilares fundamentales son:
1. MANUAL DE CABECERA: "Training for the Uphill Athlete: A Manual for Mountain Runners and Ski Mountaineers" (Scott Johnston, Steve House y Kilian Jornet).
   - Más del 80-90% del entrenamiento debe ser en Zona 1 y Zona 2 estrictas (por debajo de AeT / Umbral Aeróbico) para erradicar el Síndrome de Deficiencia Aeróbica (ADS) y multiplicar mitocondrias y capilares.
   - Test de deriva cardíaca de 60 min (Heart Rate Drift Test) como prueba reina para verificar AeT.
   - Fuerza sin máquinas: Step-ups en rocas/bancos, zancadas búlgaras con pausa isométrica, step-downs excéntricos para blindar los cuádriceps en bajadas, peso muerto rumano a una pierna y circuito de core lumbopélvico.
   - Trabajo de Resistencia Muscular (Muscular Endurance - ME): Subidas empinadas (>20-25% de pendiente) en power-hiking.

2. SUUNTO ZONESENSE (DFA a1 - Detrended Fluctuation Analysis) Y TRADUCCIÓN A PULSACIONES (BPM):
   - Eres un absoluto experto en ZoneSense. Mide la correlación fractal de la HRV durante el esfuerzo.
   - REGLA CARDINAL DE CLARIDAD: Cuando menciones, expliques o prescribas un rango de DFA a1, NUNCA lo dejes como un valor abstracto aislado. SIEMPRE debes traducirlo e indicar de forma explícita las pulsaciones (BPM) exactas que corresponden a este atleta según sus umbrales individuales:
     * DFA a1 ≥ 0.75 -> Estado aeróbico limpio (Z1-Z2), oxidación de grasas óptima: "por debajo de tu AeT (< 142 bpm)".
     * DFA a1 0.75 a 0.50 -> Zona de transición aeróbica-anaeróbica (Tempo/Z3): "entre 143 y 166 bpm (entre tu AeT y AnT)".
     * DFA a1 < 0.50 -> Régimen anaeróbico y glucolítico (Z4-Z5): "por encima de tu AnT (> 167 bpm)".
     * DFA a1 > 0.85 -> Rodaje 100% regenerativo Z1: "estrictamente por debajo de 130 bpm".
   - El atleta mira su reloj Suunto en carrera: al decirle "DFA a1 > 0.75", dale siempre la referencia en pulsaciones (< 142 bpm) para que pueda gestionarlo sin dudas.
   - Sabes distinguir entre "deriva cardíaca por calor/deshidratación" (pulsaciones suben pero DFA a1 se mantiene alto) y "fatiga celular real" (DFA a1 cae en picado).

3. CÓMO SABER SI LA CUENTA DE SUUNTO ESTÁ CONECTADA O SI SUBIR EL ARCHIVO .FIT:
   - Si el atleta te pregunta cómo se conectan sus entrenamientos con Suunto:
     * En la pestaña 'Suunto & ZoneSense' → 'Conexión Suunto & Claude MCP' pulsa "Conectar Suunto" e inicia sesión con su cuenta Suunto (una sola vez por navegador). No necesita claves de desarrollador.
     * Con la cuenta conectada (semáforo VERDE), el botón "Sincronizar" trae los últimos 28 días: resumen de cada entreno (duración, distancia, desnivel, FC media/máx, TSS y tiempo en zonas ZoneSense aeróbica/transición/anaeróbica) y, de cada noche, sueño, HRV y FC mínima. Las sesiones planificadas de ese día se marcan como completadas con los datos reales.
     * La sincronización NO trae la serie segundo a segundo ni la curva de DFA a1: para ese análisis detallado de una sesión concreta, que exporte el archivo .fit desde la App Suunto y lo suba en la pestaña 'Suunto & ZoneSense' o en el detalle de la sesión.
     * Del archivo .FIT el motor lee FC, cadencia, desnivel y velocidad; el DFA a1 se estima a partir del tiempo en zonas de FC (no es la curva exacta del reloj). Sé honesto con esto si te lo pregunta.

4. OBJETIVO PRINCIPAL: Transvulcania 2027 en La Palma (73 km, +4.350m D+, -4.057m D-). Terreno volcánico, calor, crestería del Roque de los Muchachos a 2.426m y un descenso demoledor de 2.400m hasta el Puerto de Tazacorte.

5. ESTRUCTURA SEMANAL DEL ATLETA: 4 días de entrenamiento por semana (3 entre semana + 1 tirada larga el fin de semana). Fuerza en casa o al aire libre sin material.

6. HISTORIAL DEPORTIVO (.MD): Conoce al dedillo el archivo .md del deportista si ha sido cargado. Cita sus carreras pasadas, sus puntos débiles y sus sensaciones históricas para demostrarle que le conoces de verdad.

7. APRENDIZAJE CONTINUO Y CERO PLANES GENÉRICOS (100% PERSONALIZACIÓN Y ADAPTACIÓN):
   - Cada pupilo es un mundo biológico único. Odias las plantillas prefabricadas, planes enlatados y tablas genéricas de revista.
   - Cada sesión que prescribes responde con precisión quirúrgica al estado de este atleta hoy: sus adaptaciones fisiológicas previas, sus puntos débiles registrados (ej: sobrecarga en sóleo izquierdo, fatiga excéntrica en bajadas), sus métricas reales de ZoneSense y su evolución de carga.
   - En cada sesión justificas exactamente el motivo personalizado ("Por qué para ti hoy") y qué regla aprendida de sesiones pasadas estás aplicando.
   - Aprendes de forma acumulativa y permanente: tras cada feedback, cada archivo .FIT analizado, cada caída de HRV o cada conversación, extraes nuevas conclusiones y las incorporas a tu modelo mental del pupilo.

8. MONITORIZACIÓN DE PESO ÓPTIMO Y BIOMECÁNICA VERTICAL:
   - Monitorizas de cerca la altura, peso actual y peso óptimo de carrera (Target: 67.5 kg) del atleta.
   - Entiendes la física de escalada en montaña: en los +4.350m de D+ de Transvulcania, cada kilogramo extra requiere ~900 kcal más de gasto metabólico y aumenta brutalmente el estrés articular excéntrico en el descenso de 2.400m de El Time.
   - La pérdida de peso debe ser progresiva (300-400g/semana) mediante recomposición corporal y nunca con déficits calóricos severos que provoquen RED-S (Deficiencia Energética Relativa) o degradación muscular.

9. DIRECCIÓN NUTRICIONAL, HIDRATACIÓN Y ENTRENAMIENTO GÁSTRICO (GUT TRAINING):
   - Como entrenador de élite, diriges y educas al atleta en nutrición e hidratación con la misma rigurosidad que en el entrenamiento físico.
   - Prescribes pautas concretas para cada sesión:
     * Carbohidratos: Progresión de 50 g/h hacia 75-90 g/h utilizando ratios óptimos 1:0.8 o 2:1 (maltodextrina:fructosa) para no saturar el transportador intestinal SGLT1 ni causar molestias osmóticas.
     * Hidratación y Sodio: Para el calor y altitud de La Palma, pautas de reposición del 80% del sudor y 500-750 mg/h de sodio para prevenir hiponatremia.
     * Fatiga de paladar: Integrar comida real y salada en tiradas largas (>3-4 horas).
   - Analizas la tolerancia digestiva reportada tras cada sesión, aprendes qué alimentos le sientan bien o mal y ajustas tus recomendaciones futuras.
`;

// 1. Interactive Chat with Miguel
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { messages, athleteProfile, currentReadiness, targetRace, context, athleteHistoryDoc, coachMemory } = req.body;

    const formattedHistory: ChatTurn[] = (messages || []).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content ?? ''),
    }));

    const memoryContext = coachMemory ? `
[CUADERNO DE MEMORIA Y APRENDIZAJE ACUMULADO DE MIGUEL]:
- Diagnóstico general personalizado: ${coachMemory.overallPhilosophySummary || 'En proceso'}
- Reglas y hallazgos descubiertos sobre este atleta:
${(coachMemory.insights || []).map((i: any, idx: number) => `  ${idx + 1}. [${i.category}] ${i.observation} -> REGLA: ${i.ruleForFuturePlans}`).join('\n')}
- Notas internas de Miguel:
${(coachMemory.coachNotebookNotes || []).map((n: string) => `  * ${n}`).join('\n')}
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
  * Altitud máxima alcanzada: ${advProfile.highMountain?.maxAltitudeReachedM || 2400}m
  * Sensibilidad a la altitud/hipoxia: ${advProfile.highMountain?.altitudeSensitivity || 'ninguna'}
- Tolerancia al Calor Documentada:
  * Nivel: ${advProfile.heatTolerance?.level || 'moderada'}
  * Historial de calambres en calor: ${advProfile.heatTolerance?.crampHistoryInHeat ? 'SÍ (vulnerable a calambres por deshidratación/sodio)' : 'NO'}
  * Tasa de sudoración medida: ${advProfile.heatTolerance?.sweatRateDocumentedLitersPerHour ? advProfile.heatTolerance.sweatRateDocumentedLitersPerHour + ' L/h' : 'Estimada ~1.0-1.2 L/h'}
  * Perfil de sal / sudor: ${advProfile.heatTolerance?.sodiumLossProfile === 'salty_sweater_white_crust' ? 'Sudador salado (genera costra blanca, necesita 600-800 mg sodio/h)' : 'Pérdida de sal moderada/baja'}
  * Estrategia de choque térmico: ${advProfile.heatTolerance?.heatStrategyNotes || 'Pautas de hidratación estándar'}
- Cuestionario de Preferencias de Entrenamiento & Estilo de Vida:
  * Franja horaria preferida: ${advProfile.trainingPreferences?.preferredTrainingTime || 'mañana temprana'}
  * Terreno predilecto para tiradas largas: ${advProfile.trainingPreferences?.longRunPreferredTerrain || 'montaña técnica'}
  * Deportes cruzados tolerados: ${advProfile.trainingPreferences?.crossTrainingSports?.join(', ') || 'Bicicleta, senderismo'}
  * Flexibilidad semanal: ${advProfile.trainingPreferences?.weeklyFlexibility === 'flexible_swap_days' ? 'Flexible (intercambiar días según imprevistos)' : 'Estructura fija'}
  * Tolerancia a cinta de correr: ${advProfile.trainingPreferences?.treadmillTolerance || 'solo en emergencias climáticas'}
  * Día preferido de descanso total: ${advProfile.trainingPreferences?.preferredRestDay || 'lunes'}
  * Limitaciones de vida / trabajo: ${advProfile.trainingPreferences?.lifestyleConstraintsNotes || 'Jornada laboral estándar'}
` : '';

    const ultraExpContext = ultraExp ? `
[EXPERIENCIA REAL EN ULTRA TRAIL Y CONDICIÓN DEL ATLETA (50 AÑOS)]:
- Años corriendo ultratrail: ${athleteProfile?.yearsTrailRunning || 12} años
- Carrera más larga completada: ${ultraExp.longestRaceKm || 'N/A'} km (+${ultraExp.longestRaceElevationGainM || 'N/A'}m D+)
- Ultras previas completadas: ${ultraExp.completedUltras || 'N/A'}
- Habilidad en bajadas técnicas: ${ultraExp.downhillTechnicalAbility === 'expert_technical' ? 'Experto / cabra montesa' : ultraExp.downhillTechnicalAbility === 'intermediate' ? 'Intermedio (necesita cuidar cuádriceps)' : 'Básico / cauto'}
- Técnica y uso de bastones: ${ultraExp.polesUsage || 'Pendiente'}
- Calidad y horas de sueño habitual: ${ultraExp.sleepQualityAvgHours || 7}h/noche
- Nivel de estrés laboral/vital: ${ultraExp.dailyWorkStressLevel || 'moderado'}
- Asimilación y recuperación a sus 50 años: ${ultraExp.recoveryCapacityAt50 || 'Requiere mayor tiempo de recuperación neuromuscular (48-72h tras tiradas duras)'}
- Zonas vulnerables / lesiones históricas: ${ultraExp.vulnerableJointsOrTissues?.join(', ') || athleteProfile?.injuryHistory || 'Ninguna activa'}
- Tolerancia al calor canario: ${ultraExp.heatTolerance || 'moderada'}
- Historial digestivo / estómago: ${ultraExp.gutIssuesHistory || 'Tolerancia estándar'}
- Motivación personal: "${ultraExp.personalMotivation || 'Superar el reto con salud y rigor'}"
` : `
- Historial de lesiones / puntos sensibles: ${athleteProfile?.injuryHistory || 'Sin datos'}
`;

    const athleteContext = `
[DATOS REALES DEL ATLETA - CERO DATOS INVENTADOS]
- Nombre: ${athleteProfile?.name || 'Atleta'}
- Edad: ${athleteProfile?.age || 50} años (Corredor veterano de ultratrail, respeta su experiencia pero cuida su recuperación neuromuscular)
- Altura: ${athleteProfile?.heightCm || 176} cm
- Peso Actual: ${athleteProfile?.weightKg || 71.5} kg
- Peso Óptimo de Carrera: ${athleteProfile?.targetRaceWeightKg || 67.5} kg (Diferencia hacia meta: ${(Number(athleteProfile?.weightKg || 71.5) - Number(athleteProfile?.targetRaceWeightKg || 67.5)).toFixed(1)} kg)
- FC Reposo: ${athleteProfile?.restingHr ? athleteProfile.restingHr + ' bpm' : 'Pendiente de registrar en Suunto'}
- FC Máx: ${athleteProfile?.maxHr ? athleteProfile.maxHr + ' bpm' : 'Pendiente de registrar en Suunto'}
- Umbral Aeróbico (AeT): ${athleteProfile?.aetHr ? athleteProfile.aetHr + ' bpm' : 'Pendiente de registrar'}
- Umbral Anaeróbico (AnT): ${athleteProfile?.antHr ? athleteProfile.antHr + ' bpm' : 'Pendiente de registrar'}
- Estado ADS (Síndrome Deficiencia Aeróbica): ${athleteProfile?.hasAds ? 'SÍ (necesita volumen estricto Z1/Z2)' : 'NO'}
- Objetivo Principal: ${targetRace?.name || 'Transvulcania 2027'} (${targetRace?.distanceKm || 73}km, +${targetRace?.elevationGainM || 4350}m D+)
- Disponibilidad: 4 días/semana (3 entre semana + tirada larga fin de semana). Sin gimnasio (solo peso corporal y aire libre).
- Estado Biométrico Hoy (Suunto HRV/Sueño): ${currentReadiness ? JSON.stringify(currentReadiness) : 'Pendiente de sincronizar o check-in'}
- Origen de Datos: ${athleteProfile?.dataSource || 'Registro / Suunto'}
- VO2máx (Suunto): ${athleteProfile?.vo2Max ?? 'No disponible'}
- HRV nocturna de referencia: ${athleteProfile?.baselineHrv ? athleteProfile.baselineHrv + ' ms' : 'Pendiente'}
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
    const { athleteProfile, targetRace, weekStartDate, phaseFocus, existingWorkouts, athleteHistoryDoc, coachMemory } = req.body;

    const memoryContext = coachMemory ? `
[APRENDIZAJES ACUMULADOS SOBRE ESTE ATLETA]:
- Reglas y adaptaciones previas descubiertas:
${(coachMemory.insights || []).map((i: any) => `  * [${i.category}] ${i.observation} -> APLICAR REGLA: ${i.ruleForFuturePlans}`).join('\n')}
- Notas del cuaderno de Miguel:
${(coachMemory.coachNotebookNotes || []).map((n: string) => `  * ${n}`).join('\n')}
` : '';

    const prompt = `
Genera un microciclo semanal de entrenamiento de 7 días (comenzando el lunes ${weekStartDate || 'próximo'}) para preparar ${targetRace?.name || 'Transvulcania 2027'}.

[DIRECTIVA CRÍTICA: CERO PLANES GENÉRICOS O DE PLANTILLA]:
- Queda TERMINANTEMENTE PROHIBIDO prescribir sesiones genéricas estándar (como "45 min de carrera suave", "hacer series", "estirar").
- Cada sesión debe estar diseñada al 100% para ESTE atleta individual, teniendo en cuenta sus antecedentes, sus zonas fisiológicas exactas, sus debilidades mecánicas y las reglas aprendidas.
- En cada sesión debes rellenar obligatoriamente "personalizedReasoning" (explicando en primera persona por qué prescribe esto para él, mencionando sus datos concretos) y "learnedAdjustment" (qué adaptación o regla de su memoria estás aplicando).

El atleta dispone de 4 días de entrenamiento a la semana:
- 3 sesiones entre semana (martes, miércoles y viernes, o adaptable).
- 1 sesión de tirada larga el fin de semana (sábado o domingo) con desnivel positivo y descenso.
- Los otros 3 días son DESCANSO TOTAL o movilidad ligera.

[REGLA DE INTEGRIDAD]: Respeta rigurosamente los umbrales medidos:
- AeT (Umbral Aeróbico): ${athleteProfile?.aetHr || 142} bpm (tope estricto para rodajes y tiradas)
- AnT (Umbral Anaeróbico): ${athleteProfile?.antHr || 166} bpm
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
      "targetHrMin": number,
      "targetHrMax": number,
      "zoneSenseTarget": "DFA a1 > 0.75 (Aeróbico puro) | DFA a1 0.75 - 0.50 (Transición) | DFA a1 < 0.50 (Anaeróbico) | Regenerativo",
      "description": "Explicación detallada del objetivo metabólico y neuromuscular",
      "personalizedReasoning": "Por qué prescribo esto para ti hoy teniendo en cuenta tus datos específicos y sensaciones previas",
      "learnedAdjustment": "Regla aprendida aplicada aquí (ej: limitación de trote en >12% de pendiente / cuidado de sóleo)",
      "warmup": "Calentamiento específico",
      "mainSet": "Parte principal detallada paso a paso",
      "cooldown": "Vuelta a la calma",
      "terrainRecommendation": "Pista forestal, sendero con piedras, rampa empinada, etc.",
      "nutritionAdvice": "Hidratación/electrolitos recomendados acordes a su perfil y calor de La Palma",
      "plannedCarbsPerHourG": 60,
      "plannedFluidsPerHourMl": 650,
      "plannedSodiumPerHourMg": 550,
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
    res.json(parsed);
  } catch (err) {
    sendAiError(res, '/api/generate-plan', err);
  }
});

// 3. Adapt Session in Real-Time based on Morning HRV & Sleep
app.post('/api/adapt-session', async (req: Request, res: Response) => {
  try {
    const { originalWorkout, checkIn, athleteProfile } = req.body;

    const prompt = `
El atleta tiene programado hoy el siguiente entrenamiento:
- Título: ${originalWorkout?.title}
- Tipo: ${originalWorkout?.type}
- Duración prevista: ${originalWorkout?.plannedDurationMin} min
- Objetivo: ${originalWorkout?.mainSet}

Sin embargo, sus datos matutinos de Suunto registran FATIGA:
- HRV rMSSD: ${checkIn?.hrvRmssd} ms (Línea base: ${checkIn?.hrvBaseline} ms, variación: ${Math.round(((checkIn?.hrvRmssd - checkIn?.hrvBaseline) / checkIn?.hrvBaseline) * 100)}%)
- Horas de sueño: ${checkIn?.sleepHours} h (Calidad: ${checkIn?.sleepQuality}/100)
- Dolor muscular percibido: ${checkIn?.muscleSoreness || 'No indicado'}/10
- Estrés vital: ${checkIn?.stressLevel || 'No indicado'}/10

Como Miguel, tu labor es proteger la adaptación y prevenir lesiones según Uphill Athlete.
Adapta la sesión de hoy de forma realista (ej. si eran series o tirada dura, conviértela en rodaje suave Z1 regenerativo de 40 min, caminata con movilidad o descanso total).

Responde en formato JSON:
{
  "miguelMessage": "Explicación directa, cercana y contundente de Miguel al atleta sobre por qué se modifica el entreno.",
  "adaptedWorkout": {
    "title": "Título adaptado",
    "type": "easy_run | rest | strength_core",
    "plannedDurationMin": number,
    "targetHrMax": number,
    "zoneSenseTarget": "DFA a1 > 0.75 (Aeróbico puro) | Regenerativo",
    "mainSet": "Instrucciones de la sesión adaptada",
    "warmup": "Calentamiento suave",
    "cooldown": "Estiramientos o vuelta a la calma",
    "wasAdapted": true,
    "adaptationReason": "Fatiga detectada por caída de HRV y déficit de sueño"
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
    sendAiError(res, '/api/adapt-session', err);
  }
});

// 4. Workout Debrief & FIT Analysis by Miguel (with Continuous Learning)
app.post('/api/analyze-workout', async (req: Request, res: Response) => {
  try {
    const { workout, fitMetrics, athleteProfile, athleteFeedback, coachMemory } = req.body;

    const memoryContext = coachMemory ? `
[APRENDIZAJES PREVIOS DE MIGUEL SOBRE EL ATLETA]:
${(coachMemory.insights || []).map((i: any) => `  * [${i.category}] ${i.observation}`).join('\n')}
` : '';

    const prompt = `
Analiza la sesión de trail recién completada por el atleta y extrae un APRENDIZAJE PERMANENTE para tu cuaderno de entrenador.

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
- Umbral AeT del atleta: ${athleteProfile?.aetHr || 142} bpm
- Distribución de zonas estimada:
  * Aeróbico (DFA a1 >= 0.75 / HR <= AeT): ${fitMetrics?.timeInAerobicPct ?? 80}%
  * Transición (DFA a1 0.75-0.50): ${fitMetrics?.timeInTransitionPct ?? 15}%
  * Anaeróbico (DFA a1 < 0.50): ${fitMetrics?.timeInAnaerobicPct ?? 5}%

[FEEDBACK DEL ATLETA]:
- RPE (Esfuerzo percibido 1-10): ${athleteFeedback?.rpe || workout?.athleteRpe || 5}/10
- Comentarios y sensaciones: "${athleteFeedback?.notes || workout?.athleteNotes || 'Sin comentarios adicionales'}"
${memoryContext}

Como Coach Miguel, realiza una evaluación honesta y sin rodeos, y genera un aprendizaje para tu memoria en formato JSON:
{
  "feedback": "Texto de Miguel hablando como entrenador amigo y directo: evalúa cumplimiento de ZoneSense/AeT, avisa si corrió de más en subidas, analiza sensaciones musculares y da pautas de recuperación para Transvulcania 2027.",
  "newLearnedInsight": {
    "category": "physiology_zonesense | fatigue_recovery | biomechanics_injury | nutrition_hydration | terrain_technique",
    "observation": "Qué acabas de comprobar de forma empírica sobre este atleta en esta sesión concreta",
    "ruleForFuturePlans": "Regla aplicable a los siguientes planes para optimizar su rendimiento o evitar lesiones",
    "confidenceScore": 85
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

Extrae un aprendizaje permanente estructurado en JSON para el cuaderno de Miguel:
{
  "category": "physiology_zonesense | fatigue_recovery | biomechanics_injury | nutrition_hydration | terrain_technique",
  "observation": "Resumen conciso del hallazgo sobre el cuerpo o hábitos del atleta",
  "ruleForFuturePlans": "Regla práctica que Miguel debe aplicar en futuras prescripciones de entrenamiento",
  "confidenceScore": 90,
  "miguelConfirmation": "Mensaje corto de Miguel confirmando que ha anotado este aprendizaje en su libreta."
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
    sendAiError(res, '/api/coach-memory/extract-insight', err);
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
    "zoneSenseObservations": "Resumen de lo que observa en Suunto ZoneSense (DFA a1)",
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
