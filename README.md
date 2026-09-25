# Uphill Coach AI - Entrenador Personal de Trail Running & Ultra Trail

Aplicación completa de entrenamiento de montaña inspirada en el manual de cabecera **"Training for the Uphill Athlete: A Manual for Mountain Runners and Ski Mountaineers"** (Scott Johnston, Steve House y Kilian Jornet), combinada con **Suunto ZoneSense** y la monitorización de recuperación por **HRV nocturna**.

---

## 🏃 Características Principales

### 1. Coach Miguel (IA de Alto Rendimiento)
- **Tono Cercano y Directo**: Un entrenador amigo que te ayuda, escucha tus sensaciones tras cada sesión y dice las cosas claras. Sin rodeos si te pasas de pulsaciones en días suaves o intentas forzar cuando hay fatiga.
- **Contexto real**: perfil fisiológico, historial de entrenamientos, carreras secundarias y métricas matutinas. Una sola sesión es una observación, no una regla.
- **Memoria basada en evidencias (`src/brain/memory.ts`)**: cada análisis de sesión, nota o conversación aporta *evidencias*; el estado lo calcula el código: 1 = observación, 2 = hipótesis (se vigila), ≥3 = regla provisional (se aplica), ≥5 sin contradicciones = consolidada. Cada evidencia en contra baja un nivel y un aprendizaje caduca a los 90 días sin evidencias nuevas. Una misma sesión cuenta una sola vez. Lo que Miguel saca del chat queda pendiente hasta que lo confirmas en *Memoria de Miguel*.
- **Procedencia de los datos (`src/brain/provenance.ts`)**: lo que recibe Miguel va etiquetado como REAL, DERIVADO, ESTIMADO, HIPÓTESIS o RECOMENDACIÓN, para no mezclar lo medido con lo calculado o lo supuesto.
- **Biblioteca de Miguel (RAG, opcional)**: documentos propios guardados en Supabase + pgvector. En cada mensaje se recuperan los fragmentos más parecidos a la pregunta y Miguel los cita (`[B1]`…). No es un modelo entrenado: solo usa lo recuperado, y nunca como datos fisiológicos del atleta. Las conversaciones se guardan en Supabase solo al pulsar **Guardar en Supabase** y se pueden cargar desde cualquier dispositivo; borrar el chat en el móvil no las borra. Miguel recuerda los intercambios guardados parecidos a la pregunta (`[C1]`…, con fecha) en conversaciones nuevas.
- **Diálogo Interactivo**: Puedes debatir cómo te has sentido en la sesión, analizar por qué se planificó un ejercicio, ajustar ritmos o consultar estrategia técnica para la bajada de 2.400m de Transvulcania.

### 2. Metodología "Training for the Uphill Athlete"
- **Erradicación del ADS (Aerobic Deficiency Syndrome)**: Prioridad al volumen estricto por debajo del Umbral Aeróbico (AeT) para maximizar la base mitocondrial y la oxidación lipídica.
- **Test de Deriva Cardíaca (Heart Rate Drift Test de 60 min)**: Protocolo y calculadora integrados para estimar tu AeT por FC.
- **Fuerza Específica Sin Gimnasio**: 7 ejercicios con peso corporal y al aire libre (step-ups en roca, zancadas búlgaras con pausa isométrica, step-downs excéntricos de descenso, circuito de core lumbopélvico y series de Muscular Endurance en cuestas empinadas >25%).

### 3. Suunto ZoneSense & Recuperación Diaria
- **ZoneSense (fuente única: `src/brain/zonesense.ts`)**: Suunto mide la intensidad con DDFA (análisis de fluctuaciones sin tendencia dinámico) sobre los intervalos R-R de la banda de pecho y la muestra en colores:
  - **Verde**: aeróbico (bajo el umbral aeróbico de ese día).
  - **Amarillo**: entre umbral aeróbico y anaeróbico.
  - **Rojo**: sobre el umbral anaeróbico (zona VO2máx).
  Los colores se miden contra la línea base de cada entreno (primeros ~10 min suaves) y **no equivalen a ninguna FC concreta**; la app nunca los traduce a pulsaciones. Sin banda de pecho, la referencia son las zonas de FC del reloj solo si el umbral está medido; si no, esfuerzo percibido.
- **Check-in Matutino**: HRV nocturna (rMSSD), sueño y Recovery de Suunto.
- **Motor de readiness (`src/brain/readiness.ts`)**: el código calcula el estado (verde/ámbar/rojo) con HRV, sueño, dolor, estrés, TSB y carga reciente, y fija los límites de la sesión. Miguel elige y explica la sesión dentro de esos límites; el servidor recorta cualquier propuesta que se salga.

### 4. Calendario Interactivo & Periodización Transvulcania 2027
- **Objetivo A**: Transvulcania Ultramarathon 2027 (~73 km, +4.350m D+, -4.057m D-).
- **Estructura semanal**: 3 sesiones entre semana (2 si la fatiga o la disponibilidad lo aconsejan) + tirada larga el sábado o el domingo.
- **Edición Directa**: Puedes escribir, reprogramar, completar o eliminar entrenamientos directamente en el calendario.
- **Generador de Microciclos con IA**: Miguel planifica semanas completas detallando calentamiento, series principales, terreno recomendado y pautas nutricionales.
- **Carreras preparatorias con fuentes**: al añadir una carrera se busca en Google (búsqueda de Gemini) y solo se guardan los datos que respalda alguna página, con su enlace. Cada cifra tiene que aparecer en un fragmento respaldado por una fuente; lo que no, queda *sin verificar*. Lo que escribes tú se marca como dato tuyo. Requiere `GEMINI_API_KEY` aunque uses Experiential.
- **Gestor de Carreras Secundarias (B y C)**: Búsqueda con IA de perfiles técnicos y análisis de cómo encajan en el camino a La Palma.

### 5. Lector de Archivos Reales .FIT de Suunto
- Arrastra y suelta tus archivos `.fit`. Extrae tiempo, desnivel (+/-), FC media y máxima y el tiempo por FC respecto a tus umbrales. El .FIT **no** trae ZoneSense, así que no se estima.

### 6. Sincronización real con tu cuenta Suunto
- Botón **Conectar Suunto**: inicias sesión con tu cuenta Suunto una vez y listo (sin claves de desarrollador).
- **Sincronizar** trae los entrenos de los últimos 365 días (duración, distancia, desnivel, FC, TSS, tiempo en zonas ZoneSense) y, de los últimos 28 días, sueño, HRV y FC mínima de cada noche → check-ins de readiness automáticos.
- **CTL / ATL / TSB** se calculan con el TSS que da Suunto para cada entreno (nunca se recalcula) y con el historial disponible: CTL = media exponencial de 42 días, ATL = de 7 días, TSB = CTL − ATL. Arrancan en 0 el día del primer entreno importado, así que con menos de 42 días de historial el CTL está infravalorado y puede diferir del de la app de Suunto (que puede tener historial anterior). Las sesiones planificadas no completadas no suman carga.
- **Ventanas de datos** (`src/brain/dataWindows.ts`): entrenos 365 días · sueño/HRV/Recovery 28 días · perfil deducido de 90 días.
- **Datos de ejemplo** solo con el botón "Cargar Prueba"; sin él, lo que no tiene datos aparece vacío.
- Funciona a través del servidor MCP de Suunto ya desplegado (`https://mcp-ten-kappa.vercel.app`), el mismo que se puede añadir como connector en claude.ai.

---

## 🛠️ Tecnologías

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion.
- **Backend / API**: Express (función serverless de Vercel en `api/index.ts`). IA intercambiable en `server/ai.ts`: Gemini (`@google/genai`, por defecto) o cualquier modelo de Experiential Labs (Claude, GPT…) con `AI_PROVIDER=experiential`.
- **Cerebro de Miguel**: `src/brain/` (reglas compartidas cliente/servidor: ZoneSense, intensidad, readiness, memoria, procedencia) y `server/brain/` (`prompts/` = texto para la IA, `context.ts` = hechos → texto, `decision/` = validación en código de lo que devuelve la IA). `server/app.ts` solo tiene las rutas HTTP. Pruebas: `npm test`.
- **Decodificador de Telemetría**: `fit-file-parser` (procesamiento binario de `.fit`).
- **Almacenamiento**: Persistencia local en navegador (`localStorage`). Opcional: Supabase (Postgres + pgvector) para la Biblioteca de Miguel y el historial de conversaciones (`server/rag/`, esquema en `scripts/init.sql`). Embeddings intercambiables con `EMBEDDING_PROVIDER` (Gemini por defecto, u OpenAI).

---

## 🚀 Despliegue y configuración

👉 **Todo lo que hay que configurar (Vercel, API key de Gemini, Suunto) está paso a paso en [CONFIGURACION-POR-USUARIO.md](./CONFIGURACION-POR-USUARIO.md).**

Resumen:
- Única variable obligatoria: `GEMINI_API_KEY`. Opcional: `GEMINI_MODEL` (por defecto `gemini-3.8-flash`).
- Para usar Claude u otros modelos vía Experiential Labs: `AI_PROVIDER=experiential` + `EXPERIENTIAL_API_KEY` (sección 5 de la guía). Si Experiential falla, la app reintenta con Gemini.
- Suunto no necesita variables: se conecta desde la propia app.
- Opcional, Biblioteca de Miguel y conversaciones: ejecutar `scripts/init.sql` en Supabase y cargar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `INGEST_SECRET` (sección 10 de la guía). Sin ellas la app funciona igual, sin biblioteca.

Estructura:
- `server/app.ts`: todas las rutas `/api/*` (IA + Suunto). No escucha puertos.
- `server/ai.ts`: elige el proveedor de IA según las variables de entorno.
- `server/rag/`: Supabase (`supabase.ts`), embeddings intercambiables (`embeddings.ts`), biblioteca (`knowledge.ts`), conversaciones (`chatStore.ts`), memoria de conversaciones (`conversationMemory.ts`) y troceado (`chunker.ts`).
- `api/index.ts`: la expone como función serverless en Vercel (`vercel.json` enruta `/api/*` ahí).
- `server.ts`: solo para desarrollo local (`npm run dev` en `http://localhost:3000`).
