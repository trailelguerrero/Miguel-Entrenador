# Auditoría del cerebro de Miguel — septiembre 2026

Alcance: `src/brain/`, `server/brain/`, `server/rag/`, `server/app.ts`, `server/ai.ts` y cómo los usa la app (`src/App.tsx`, `src/services/storage.ts`, `src/components/CoachMemoryView.tsx`, `src/components/DailyReadinessModal.tsx`).
Estado de partida: `npm test` → 64/64 en verde. Tras los arreglos de G1–G3 y M1–M2: 75/75 (tests en `tests/audit2.test.ts` y `tests/apiauth.test.ts`). Los fallos marcados **[REPRODUCIDO]** se han comprobado ejecutando el código con entradas concretas.

---

## 1. Qué es el cerebro

El cerebro de Miguel no es un modelo entrenado. Es un **LLM (Gemini o, vía Experiential, Claude/GPT) rodeado de código determinista** que:

1. **Calcula los hechos** antes de hablar con la IA.
2. **Le dice a la IA qué puede y qué no puede decidir.**
3. **Revisa y recorta en código lo que devuelve la IA.**

| Módulo | Qué hace | Quién decide |
|---|---|---|
| `src/brain/readiness.ts` | Nivel del día (verde/ámbar/rojo/sin datos) y límites de la sesión | Código |
| `src/brain/memory.ts` | Memoria por evidencias: observación → hipótesis → regla provisional → consolidada | Código (la IA solo aporta evidencias) |
| `src/brain/intensity.ts` | Jerarquía de intensidad: ZoneSense → FC medida → RPE → sin datos | Código |
| `src/brain/zonesense.ts` | Fuente única de ZoneSense (colores, nunca pulsaciones) | Código |
| `src/brain/provenance.ts` | Etiquetas REAL / DERIVADO / ESTIMADO / HIPÓTESIS / RECOMENDACIÓN | Código |
| `src/brain/context.ts` | CTL/ATL/TSB, TSS de 7 días, check-ins y readiness de hoy (en el cliente) | Código |
| `server/brain/prompts/*` | Texto para la IA (personalidad, reglas, contexto) | — |
| `server/brain/decision/validate.ts` | Recorta planes y adaptaciones: sin FC inventada, colores canónicos, nutrición solo con evidencia, límites de readiness | Código |
| `server/brain/decision/race.ts` | Datos de carreras solo si una web los respalda; quita frases del consejo con cifras sin verificar | Código |
| `server/brain/decision/history.ts` | Las cifras del historial .md tienen que aparecer escritas en el documento | Código |
| `server/rag/*` | Biblioteca (documentos en Supabase + pgvector) y memoria de conversaciones guardadas | Búsqueda por similitud |

### Cómo toma una decisión (ejemplo: adaptar la sesión de hoy)

```
check-in (HRV, sueño, dolor, estrés) + carga (TSB, TSS 7 d, CTL)
        │
        ▼
evaluateReadiness()  ── nivel base: ROJO si HRV < −20 %, sueño < 5,5 h o dolor ≥ 8
        │                          ÁMBAR si HRV < −10 %, sueño < 6,5 h o dolor ≥ 6
        │            ── escaladores (+1 nivel máx.): TSB < −30, TSS 7 d > CTL×7+20 %, estrés ≥ 8
        │            ── rojo + escalador, o ámbar + 2 escaladores → descanso obligatorio
        ▼
límites: duración máx., color ZoneSense máx., series sí/no, descanso obligatorio
        │   (el servidor lo recalcula; lo que manda el cliente solo puede endurecerlo)
        ▼
IA (Miguel) elige y explica la sesión DENTRO de los límites
        ▼
sanitizeAdaptation(): recorta duración, quita series, baja el color, quita FC sin umbral medido
        ▼
la app guarda la sesión adaptada y el mensaje de Miguel en el chat
```

### Cómo aprende

- La IA **nunca** escribe una regla. Devuelve como mucho 3 *evidencias* por evento (análisis de sesión, nota del atleta, chat).
- El código cuenta: 1 = observación, 2 = hipótesis, ≥3 = regla provisional (se aplica), ≥5 sin contradicciones = consolidada. Cada evidencia en contra baja un nivel; una grave (lesión, dolor agudo, sobreentrenamiento) la descarta hasta 3 a favor posteriores; caduca a los 90 días.
- Lo que sale del chat queda **pendiente** hasta que el atleta lo confirma.
- Solo las reglas (provisional/consolidada) llegan a los prompts como "REGLAS QUE SE APLICAN".

### Qué sabe (conocimiento)

- **Fijo en el prompt**: *Training for the Uphill Athlete*, ZoneSense, Transvulcania 2027, estructura 3+1.
- **Biblioteca (RAG)**: documentos que pega el atleta en la pantalla Biblioteca (con `INGEST_SECRET`). En cada mensaje del chat se recuperan hasta 5 fragmentos (similitud > 0,55) y se citan `[B1]`.
- **Conversaciones guardadas**: hasta 3 intercambios parecidos, citados `[C1]`.
- La biblioteca **solo** se consulta en el chat, no en planes, adaptaciones ni análisis.

---

## 2. Hallazgos

### 🔴 Graves

**G1. La adaptación de la sesión puede saltarse los límites del motor [REPRODUCIDO]** — ✅ ARREGLADO
`server/brain/decision/validate.ts:117-121` + `src/App.tsx:584`
`sanitizeAdaptation` solo recorta los campos que la IA *devuelve*. La app luego hace `{ ...todayWorkout, ...adaptedWorkout }`, así que lo que la IA omita se queda con el valor original.
- Día ÁMBAR, sesión original `hill_intervals`, la IA no devuelve `type` → la sesión guardada sigue siendo **series**, aunque el motor dice "sin series".
- Día ROJO (máx. 35 min), la IA devuelve `plannedDurationMin: "120"` (texto) → `pos()` lo ignora y se guarda **120 min**.
Arreglo: validar sobre la sesión original fusionada (no solo sobre la respuesta) y convertir números en texto.

**G2. Endpoints de IA y memoria abiertos a cualquiera** — ✅ ARREGLADO
`server/app.ts:225` (y todas las rutas de IA)
Solo la biblioteca y las conversaciones piden `x-ingest-secret`. `/api/chat`, `/api/generate-plan`, `/api/analyze-workout`, etc. no piden nada. Quien conozca la URL de Vercel puede:
- gastar tu cuota de Gemini/Experiential;
- preguntarle a Miguel por tus **conversaciones guardadas**: `/api/chat` busca en `conversation_memory` y las mete en el prompt, así que las puede repetir (datos de salud: lesiones, HRV, sensaciones).
Arreglo: exigir el mismo secreto (o uno de app) en todas las rutas `/api/*` salvo `health` y el callback de Suunto, y limitar peticiones por minuto.

**G3. El semáforo del check-in ignora el estrés y la carga, y "sin datos" sale como VERDE [REPRODUCIDO]** — ✅ ARREGLADO
`src/utils/readiness.ts` + `src/components/DailyReadinessModal.tsx:37-42`
- `computeReadiness` no recibe `stressLevel` ni TSB/TSS. Con estrés 9/10 el check-in guarda `optimal` y el motor (en la adaptación) dice `amber`. El atleta ve verde; Miguel adapta como ámbar.
- Con nivel `unknown` (sin HRV ni sueño) guarda `status: 'optimal'` y ese "optimal" se manda a Miguel en `recentCheckIns` y en `currentReadiness`.
Arreglo: pasar estrés (y carga si está) a `computeReadiness`, y añadir un estado "sin datos" en vez de `optimal`.

### 🟠 Medios

**M1. Repetir la misma nota crea una regla en un día [REPRODUCIDO]** — ✅ ARREGLADO
`src/components/CoachMemoryView.tsx:67` (`refId: note-${Date.now()}`) + `src/brain/memory.ts:191`
Cada nota tiene un id nuevo y la protección "mismo día" solo se aplica al chat. Escribir tres veces "me duele el sóleo en bajada" → **regla provisional** con 3 evidencias del mismo día. Contradice "una sola sesión es una observación".
Arreglo: como mucho una evidencia por aprendizaje, fuente y día (o que las notas cuenten como el chat).

**M2. `"supports": "false"` (texto) cuenta como evidencia A FAVOR [REPRODUCIDO]** — ✅ ARREGLADO
`src/brain/memory.ts:145` → `r.supports !== false`. Si el modelo devuelve el booleano como texto, una contradicción suma a favor.
Arreglo: `supports = r.supports === true || r.supports === 'true'`; si no es ni true ni false, descartar.

**M3. Sin check-in de hoy, el motor no pone límites aunque la carga sea peligrosa**
`src/brain/context.ts:62-75`. Con TSB −45 y sin check-in, ni el chat ni el plan reciben un nivel ni límites. Y con check-in pero sin HRV/sueño/dolor (nivel `unknown`), los límites son totalmente abiertos (`readiness.ts:140`: rojo permitido, series permitidas).
Propuesta: evaluar los escaladores de carga aunque no haya check-in, y que `unknown` no permita series.

**M4. El plan semanal no aplica los límites de readiness al día de hoy**
`sanitizePlanWorkouts` solo arregla FC, colores y nutrición. Si generas la semana en curso un día ROJO, la sesión de hoy puede traer series. Tampoco hay tope de duración ni de progresión de carga semanal (p. ej. +10 %).

**M5. Hallazgos repetidos que nunca llegan a regla (fragmentación)**
Si la IA no reutiliza el `insightId` y crea un "hallazgo nuevo" cada vez con otra redacción, la misma observación queda repartida en varias observaciones de 1 evidencia y nunca sube. No hay deduplicación por parecido (ni por texto en los insights, solo en pendientes).

**M6. Día ÁMBAR permite la tirada larga completa**
`readiness.ts:138`: en ámbar la duración máxima es la planificada. Una tirada de 4 h en ámbar pasa sin recorte (solo en verde). Es decisión de diseño, pero conviene revisarla (p. ej. máx. 60–75 % de lo planificado).

**M7. Biblioteca y webs = inyección de instrucciones**
Los fragmentos de la biblioteca y de conversaciones van al *system prompt*. Un documento pegado desde una web con texto tipo "ignora las reglas anteriores…" llega al modelo con rango de sistema. Es más grave si se añade la búsqueda automática de webs (ver §3).

### 🟡 Menores

- **m1.** Generar el plan: si la IA devuelve fechas fuera de la semana o más de 7 sesiones, `App.tsx:653` las amontona en el domingo (varias sesiones el mismo día).
- **m2.** El chat manda **todo** el historial y el `.md` completo en cada mensaje: coste y latencia crecen sin límite (el límite del body es 25 MB; la función, 60 s).
- **m3.** `describeMemoryForPrompt` mete todos los aprendizajes (también descartados) sin tope.
- **m4.** Chat: la evidencia lleva la fecha de la extracción, no la del hecho; hablar hoy de la sesión de ayer no se detecta como duplicado.
- **m5.** `verifyHistoryNumbers` acepta una FC si el número aparece en cualquier parte del .md (p. ej. "150" de "150 km").
- **m6.** Al confirmar un pendiente cuyo aprendizaje se borró, se pierde en silencio (sin aviso).
- **m7.** `currentReadiness` se manda como JSON crudo del check-in (incluye el `status` antiguo y el `coachAdvice`), mezclado con el estado verificado del motor: dos semáforos en el mismo prompt.
- **m8.** Memoria de Miguel solo en `localStorage` del dispositivo: móvil y ordenador tienen cerebros distintos; borrar datos del navegador lo borra (hay copia de seguridad manual).

### ✅ Lo que está bien

- Separación clara IA ↔ código: la IA propone y el código decide.
- El servidor recalcula el readiness; el cliente solo puede endurecerlo.
- Nunca se inventan pulsaciones ni cifras de nutrición sin evidencia.
- Verificación de carreras con fuentes reales y filtro de cifras.
- Memoria por evidencias con caducidad, contradicciones y evidencia grave.
- RLS en Supabase y `service_role` solo en el servidor; secreto comparado en tiempo constante.
- 64 tests en verde.

---

## 3. Opinión: que el atleta pida a Miguel añadir cosas al cerebro o buscar artículos, libros y webs

**Buena idea, con condiciones.** Hoy solo se puede añadir conocimiento pegando texto en la Biblioteca (con la clave). Que se pueda hacer desde el chat ("Miguel, apúntate esto" / "busca estudios sobre entrenamiento excéntrico para bajadas") es natural. El riesgo es mezclar tres cosas distintas:

| Qué pide el atleta | Dónde debe ir | Por qué |
|---|---|---|
| "Recuerda que me duele el sóleo en bajadas" | **Memoria por evidencias** (pendiente → confirmar) | Es un dato suyo; necesita repetirse para ser regla |
| "Mi médico me ha prohibido correr 2 semanas" | **Perfil / restricción dura** con fecha de caducidad | Debe limitar planes ya, no esperar 3 evidencias |
| "Añade este artículo/libro/web" | **Biblioteca (RAG)** | Conocimiento general, no datos del atleta |

**Reglas que propongo:**

1. **Miguel propone, el atleta confirma.** Nada entra en el cerebro sin una vista previa (título, fuente, URL, resumen, fragmentos) y un botón "Añadir". Igual que los pendientes del chat.
2. **La biblioteca nunca cambia las reglas del código.** Un artículo no puede subir límites de readiness, permitir pulsaciones sin umbral medido ni saltarse la memoria por evidencias. Solo informa las explicaciones y la elección *dentro* de los límites.
3. **Búsqueda con fuentes reales.** Reutilizar la búsqueda de Google de Gemini que ya se usa para carreras (`searchWithGemini`): guardar solo lo que respalde una página, con su URL y fecha de consulta.
4. **Calidad de la fuente.** Etiquetar cada documento: estudio revisado por pares / libro / web de entrenador / blog / opinión. Miguel lo dice al citarlo y, ante contradicciones, pesa más la evidencia fuerte.
5. **Libros: solo lo que el atleta aporte.** Miguel no puede descargar libros con copyright; sí resúmenes o notas que escriba el atleta, o textos de acceso abierto.
6. **Contra la inyección de instrucciones:** mover los fragmentos fuera del *system prompt* (como mensaje de usuario etiquetado), limpiar el texto de la web y avisar en el prompt de que son datos, no órdenes.
7. **Auth primero (G2).** Si Miguel puede escribir en la biblioteca desde el chat, el chat tiene que estar protegido; si no, cualquiera podría envenenar el cerebro.
8. **Biblioteca también en planes y análisis**, no solo en el chat, si se quiere que influya en la programación.

Orden recomendado: arreglar G1–G3 y M1–M2 → proteger la API → "añadir al cerebro" desde el chat con confirmación → búsqueda web con fuentes.
