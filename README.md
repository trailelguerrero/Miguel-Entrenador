# Uphill Coach AI - Entrenador Personal de Trail Running & Ultra Trail

Aplicación completa de entrenamiento de montaña inspirada en el manual de cabecera **"Training for the Uphill Athlete: A Manual for Mountain Runners and Ski Mountaineers"** (Scott Johnston, Steve House y Kilian Jornet), combinada con la tecnología de **Suunto ZoneSense (DFA alpha-1)** y la monitorización de recuperación por **HRV nocturna**.

---

## 🏃 Características Principales

### 1. Coach Miguel (IA de Alto Rendimiento)
- **Tono Cercano y Directo**: Un entrenador amigo que te ayuda, escucha tus sensaciones tras cada sesión y dice las cosas claras. Sin rodeos si te pasas de pulsaciones en días suaves o intentas forzar cuando hay fatiga.
- **Aprendizaje Constante**: Contextualizado con tu perfil fisiológico, historial de entrenamientos, carreras secundarias y métricas matutinas.
- **Diálogo Interactivo**: Puedes debatir cómo te has sentido en la sesión, analizar por qué se planificó un ejercicio, ajustar ritmos o consultar estrategia técnica para la bajada de 2.400m de Transvulcania.

### 2. Metodología "Training for the Uphill Athlete"
- **Erradicación del ADS (Aerobic Deficiency Syndrome)**: Prioridad al volumen estricto por debajo del Umbral Aeróbico (AeT) para maximizar la base mitocondrial y la oxidación lipídica.
- **Test de Deriva Cardíaca (Heart Rate Drift Test de 60 min)**: Protocolo y calculadora integrados para verificar con precisión milimétrica tu verdadero AeT.
- **Fuerza Específica Sin Gimnasio**: 7 ejercicios con peso corporal y al aire libre (step-ups en roca, zancadas búlgaras con pausa isométrica, step-downs excéntricos de descenso, circuito de core lumbopélvico y series de Muscular Endurance en cuestas empinadas >25%).

### 3. Suunto ZoneSense & Recuperación Diaria
- **Monitorización Celular en Tiempo Real**: Análisis de fluctuación fractal (DFA a1) a partir de la variabilidad cardíaca durante el ejercicio:
  - `DFA a1 ≥ 0.75`: Aeróbico limpio (Z1-Z2), grasas, lactato basal.
  - `0.75 > a1 ≥ 0.50`: Transición aeróbica-anaeróbica (Tempo/Z3).
  - `DFA a1 < 0.50`: Régimen anaeróbico (Z4-Z5), acumulación de lactato.
- **Check-in Matutino con Alerta de Fatiga**: Registro de HRV nocturna (rMSSD) y calidad de sueño de tu reloj Suunto.
- **Adaptación en Tiempo Real**: Si el sistema detecta una caída significativa de HRV o falta de sueño, Miguel propone adaptar automáticamente la sesión de hoy a rodaje regenerativo o descanso.

### 4. Calendario Interactivo & Periodización Transvulcania 2027
- **Objetivo A**: Transvulcania Ultramarathon 2027 (~73 km, +4.350m D+, -4.057m D-).
- **Semana de 4 Días**: 3 sesiones entre semana y tirada larga de montaña el fin de semana.
- **Edición Directa**: Puedes escribir, reprogramar, completar o eliminar entrenamientos directamente en el calendario.
- **Generador de Microciclos con IA**: Miguel planifica semanas completas detallando calentamiento, series principales, terreno recomendado y pautas nutricionales.
- **Gestor de Carreras Secundarias (B y C)**: Búsqueda con IA de perfiles técnicos y análisis de cómo encajan en el camino a La Palma.

### 5. Lector de Archivos Reales .FIT de Suunto
- Arrastra y suelta tus archivos `.fit` directamente. Extrae tiempo, desnivel acumulado (+/-), frecuencia cardíaca media y máxima, y estima el índice DFA a1 y la distribución de zonas. Sin datos ficticios preprogramados.

### 6. Sincronización real con tu cuenta Suunto
- Botón **Conectar Suunto**: inicias sesión con tu cuenta Suunto una vez y listo (sin claves de desarrollador).
- **Sincronizar** trae los entrenos de los últimos 365 días (duración, distancia, desnivel, FC, TSS, tiempo en zonas ZoneSense) y, de los últimos 28 días, sueño, HRV y FC mínima de cada noche → check-ins de readiness automáticos.
- **CTL / ATL / TSB** se calculan con el TSS que da Suunto para cada entreno (nunca se recalcula), desde el primer entreno registrado: CTL = media exponencial de 42 días, ATL = de 7 días, TSB = CTL − ATL. Las sesiones planificadas no completadas no suman carga.
- Funciona a través del servidor MCP de Suunto ya desplegado (`https://mcp-ten-kappa.vercel.app`), el mismo que se puede añadir como connector en claude.ai.

---

## 🛠️ Tecnologías

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Motion.
- **Backend / API**: Express (función serverless de Vercel en `api/index.ts`). IA intercambiable en `server/ai.ts`: Gemini (`@google/genai`, por defecto) o cualquier modelo de Experiential Labs (Claude, GPT…) con `AI_PROVIDER=experiential`.
- **Decodificador de Telemetría**: `fit-file-parser` (procesamiento binario de `.fit`).
- **Almacenamiento**: Persistencia local en navegador (`localStorage`).

---

## 🚀 Despliegue y configuración

👉 **Todo lo que hay que configurar (Vercel, API key de Gemini, Suunto) está paso a paso en [CONFIGURACION-POR-USUARIO.md](./CONFIGURACION-POR-USUARIO.md).**

Resumen:
- Única variable obligatoria: `GEMINI_API_KEY`. Opcional: `GEMINI_MODEL` (por defecto `gemini-3.8-flash`).
- Para usar Claude u otros modelos vía Experiential Labs: `AI_PROVIDER=experiential` + `EXPERIENTIAL_API_KEY` (sección 5 de la guía). Si Experiential falla, la app reintenta con Gemini.
- Suunto no necesita variables: se conecta desde la propia app.

Estructura:
- `server/app.ts`: todas las rutas `/api/*` (IA + Suunto). No escucha puertos.
- `server/ai.ts`: elige el proveedor de IA según las variables de entorno.
- `api/index.ts`: la expone como función serverless en Vercel (`vercel.json` enruta `/api/*` ahí).
- `server.ts`: solo para desarrollo local (`npm run dev` en `http://localhost:3000`).
