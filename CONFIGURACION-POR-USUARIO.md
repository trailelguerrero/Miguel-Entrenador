# Configuración por usuario

Esta guía reúne todo lo que tienes que configurar para que **Uphill Coach AI** funcione en Vercel:

- la API key de la IA (Gemini por defecto; opcionalmente Claude u otros vía Experiential Labs),
- Vercel,
- la conexión con tu cuenta Suunto.

No hace falta tocar código.

---

## 0. Resumen rápido

| Qué | Dónde | Obligatorio | Tiempo |
|---|---|---|---|
| Crear API key de Gemini | aistudio.google.com | ✅ Sí | 2 min |
| Pegar `GEMINI_API_KEY` en Vercel y redesplegar | vercel.com | ✅ Sí | 3 min |
| Pulsar **Conectar Suunto** en la app | La propia app | ✅ Sí (para datos Suunto) | 1 min |
| Cambiar el modelo de Gemini (`GEMINI_MODEL`) | vercel.com | ❌ Opcional | 2 min |
| Usar Claude u otros modelos vía Experiential Labs (`AI_PROVIDER`) | vercel.com | ❌ Opcional | 5 min |
| Añadir el connector de Suunto en claude.ai | claude.ai | ❌ Opcional | 2 min |

**No tienes que configurar nada en la web de desarrolladores de Suunto** (APIZone). Tampoco tienes que copiar tokens de Suunto: la app usa el servidor MCP de Suunto que ya está desplegado y funcionando.

---

## 1. Qué necesitas

1. **Tu cuenta de Vercel.** Es la misma donde ya están los proyectos `mcp`, `app_carrera`, etc.
2. **Una cuenta de Google**, para crear la API key de Gemini.
3. **Tu usuario y contraseña de Suunto**, los de la App Suunto.
4. *(Opcional)* **Tu key de Experiential Labs**, solo si quieres usar Claude u otros modelos en lugar de Gemini (sección 5).

---

## 2. Conseguir la API key de Gemini

La app usa Gemini (de Google) para que "Miguel" converse contigo, genere planes, adapte sesiones y analice entrenos.

1. Entra en **https://aistudio.google.com/apikey** con tu cuenta de Google.
2. Si es la primera vez, acepta los términos de uso.
3. Pulsa **"Create API key"** (o "Crear clave de API").
4. Elige un proyecto de Google Cloud existente o deja que cree uno nuevo. Cualquiera sirve.
5. Copia la clave que aparece. Es un texto largo que suele empezar por `AIza...`.
6. Guárdala en un sitio seguro (un gestor de contraseñas, por ejemplo).

> ⚠️ **Seguridad:** trata la API key como una contraseña.
> - No la pegues en el código, en GitHub ni en chats.
> - Solo va en Vercel (paso 3) o en tu archivo `.env` local (sección 8), que Git ya ignora.

**Coste:** Gemini tiene una capa gratuita con límites de uso. Para un uso personal suele bastar. Puedes ver tu consumo y tus límites en la misma página de AI Studio, en "Usage" / "Plan". Si algún día superas la capa gratuita, las peticiones empiezan a fallar con un error de cuota (ver la sección 9). No se te cobra nada salvo que actives la facturación en Google Cloud.

---

## 3. Configurar Vercel

### 3.1 Crear el proyecto (solo la primera vez)

1. Entra en **https://vercel.com** e inicia sesión.
2. Arriba a la derecha pulsa **Add New… → Project**.
3. En la lista **Import Git Repository**, busca `Entrenador` y pulsa **Import**.
   - Si no aparece, pulsa **Adjust GitHub App Permissions**, da acceso al repositorio `trailelguerrero/Entrenador` y vuelve.
4. En la pantalla de configuración:
   - **Project Name**: `entrenador`.
   - **Framework Preset**, **Build Command** y **Output Directory**: no los toques. Vercel los lee de `vercel.json`.
   - Despliega **Environment Variables** y añade ya `GEMINI_API_KEY` con tu clave (paso 2). Así te ahorras el redespliegue del paso 3.3.
5. Pulsa **Deploy** y espera a que termine (1–2 min).

Si el proyecto `entrenador` ya existe, ábrelo desde el equipo **"trailelguerrero-3582's projects"**. Cada `git push` a la rama `main` lo vuelve a desplegar automáticamente.

### 3.2 Variables de entorno

1. Dentro del proyecto: **Settings → Environment Variables**.
2. Añade las variables de esta tabla. Para cada una: escribe el **Key**, pega el **Value**, deja marcados los entornos **Production**, **Preview** y **Development**, y pulsa **Save**.

| Key (nombre exacto) | Value (valor) | ¿Obligatoria? |
|---|---|---|
| `GEMINI_API_KEY` | La clave del paso 2 (`AIza...`) | ✅ Sí |
| `GEMINI_MODEL` | Nombre de un modelo de Gemini, p. ej. `gemini-3.8-flash`. Ver la sección 4. | ❌ No. Si no la pones, se usa `gemini-3.8-flash`. |
| `SUUNTO_MCP_URL` | `https://mcp-ten-kappa.vercel.app` | ❌ No. Es el valor por defecto; solo cámbiala si algún día mueves el servidor MCP de Suunto. |
| `AI_PROVIDER`, `EXPERIENTIAL_*`, `AI_FALLBACK` | Ver la sección 5 | ❌ No. Solo si quieres usar Claude (u otro modelo) en lugar de Gemini. |

> Las variables **no se aplican solas** a lo que ya está desplegado. Después de añadirlas o cambiarlas tienes que redesplegar (paso 3.3).

### 3.3 Redesplegar

1. Ve a la pestaña **Deployments** del proyecto.
2. En el despliegue más reciente (el de arriba), pulsa el menú **⋯** y luego **Redeploy**.
3. Confirma **Redeploy**. En 1–2 minutos el estado pasa a **Ready** (en verde).

### 3.4 La URL de tu app

- En la pestaña **Overview** del proyecto, en **Domains**, verás la URL pública. Será algo como `https://entrenador-xxxx.vercel.app`.
- Esa es la dirección que abres en el navegador o en el móvil. Si quieres, puedes instalarla como app desde el propio navegador (menú → "Instalar app" / "Añadir a pantalla de inicio").

### 3.5 Si al abrir la app te pide iniciar sesión en Vercel

Vercel tiene activada por defecto la **Deployment Protection**, que exige login de Vercel en algunas URLs.

- Para usar la app sin ese login: **Settings → Deployment Protection → Vercel Authentication** y selecciona **"Only Preview Deployments"** (o desactívalo). Después pulsa **Save**.
- La URL de producción (la de **Domains**) queda así accesible directamente.

### 3.6 Ver errores (logs)

Si algo falla:

- Ve a **Deployments → (despliegue) → Logs**, o a la pestaña **Logs** del proyecto.
- Ahí aparecen los errores de la API: Gemini, Suunto, etc. El mensaje textual del error es lo más útil si necesitas pedir ayuda.

---

## 4. Modelo de Gemini (`GEMINI_MODEL`), opcional

**Qué es:** el nombre exacto del modelo de Gemini que usa Miguel. Si no defines la variable, la app usa **`gemini-3.8-flash`**.

**Estado actual:** se comprobó el 24/09/2026 que `gemini-3.8-flash` existe y está disponible en general (GA desde el 02/09/2026). Hoy **no tienes que hacer nada**.

**Por qué existe esta variable:** Google renueva y retira modelos con el tiempo. Si un día `gemini-3.8-flash` deja de existir, la app no se rompe sin remedio: basta con cambiar el modelo en Vercel, **sin tocar código**.

### 4.1 Cómo saber si el modelo está fallando

- En la app, Miguel no responde y aparece un error al chatear, generar plan o analizar un entreno.
- En los logs de Vercel (paso 3.6) aparece un error de Gemini parecido a:
  - `404`, o `models/gemini-... is not found`, o `model not found`,
  - `is not supported for generateContent`.

Si el error dice `API key not valid`, el problema **no es el modelo sino la clave**: repite los pasos 2 y 3.2.

### 4.2 Cómo elegir otro modelo

1. Abre **https://ai.google.dev/gemini-api/docs/models**. Ahí están los modelos disponibles y su **código de modelo** exacto (el texto tipo `gemini-X.Y-flash`).
2. Elige uno de la familia **Flash** (rápido y barato), en estado estable o GA si es posible.
3. Copia el código **exactamente** como aparece: minúsculas y guiones incluidos.

### 4.3 Cómo cambiarlo en Vercel

1. **Settings → Environment Variables**.
2. Si ya existe `GEMINI_MODEL`: pulsa **⋯ → Edit**, cambia el valor y pulsa **Save**. Si no existe: añádela como en el paso 3.2.
3. **Redeploy** (paso 3.3).
4. Prueba a escribir a Miguel en el chat. Si responde, listo.

Para volver al modelo por defecto, borra la variable `GEMINI_MODEL` y haz **Redeploy**.

---

## 5. Opcional: usar Claude (Opus) u otros modelos con Experiential Labs

Por defecto la app usa **Gemini**. Si tienes una key de **Experiential Labs**, puedes cambiar a Claude Opus o a cualquier otro modelo de su catálogo **sin tocar código**: solo se cambian variables en Vercel.

Experiential Labs es una pasarela compatible con OpenAI (`https://api.experientiallabs.ai/v1`) que da acceso a muchos modelos (Claude, GPT, Gemini…) con una sola key.

### 5.1 Qué conviene saber antes

- **Coste:** los créditos gratuitos de bienvenida se acaban; después se paga por uso. Opus es de los modelos más caros. Revisa tu saldo en el panel de Experiential Labs.
- **Privacidad:** tus datos (HRV, sueño, lesiones, peso, historial) pasan por Experiential Labs además de por el proveedor del modelo. En su panel, revisa las opciones de retención de datos y de uso del tráfico para entrenar modelos, y desactívalas si no quieres que se usen.
- **Velocidad:** Opus razona mejor pero es más lento. Por eso la app usa **dos modelos**:
  - Un modelo "principal" para el **chat con Miguel**.
  - Un modelo "rápido" para lo que devuelve JSON: **planes semanales, adaptación de sesiones, análisis de entrenos, memoria del coach, info de carreras e historial `.md`**. Así no se pasa del límite de 60 s de Vercel.
- **Red de seguridad:** si Experiential falla (créditos agotados, modelo mal escrito, tarda demasiado…) y tienes `GEMINI_API_KEY` cargada, la app **reintenta automáticamente con Gemini** y Miguel responde igual. En los logs de Vercel verás la línea `[ai] Experiential falló, reintentando con Gemini: …` con el motivo.
  - **Recomendación:** deja siempre `GEMINI_API_KEY` cargada aunque uses Experiential.

### 5.2 Variables a cargar en Vercel

**Settings → Environment Variables**. Añade cada una marcando Production, Preview y Development:

| Key (nombre exacto) | Value (valor) | ¿Obligatoria? |
|---|---|---|
| `AI_PROVIDER` | `experiential` | ✅ Sí, para activar Experiential. Si no existe o vale `gemini`, se usa Gemini. |
| `EXPERIENTIAL_API_KEY` | Tu key de Experiential Labs (empieza por `xpl_`). La tienes en tu gestor de contraseñas, en la entrada "Experiential Labs API key 2 (onboarding 23-09)". | ✅ Sí |
| `EXPERIENTIAL_MODEL` | Modelo para el **chat** con Miguel. | ❌ No. Por defecto `claude-opus-5.5`. |
| `EXPERIENTIAL_FAST_MODEL` | Modelo para **planes y análisis** (respuestas JSON). | ❌ No. Por defecto `claude-sonnet-5`. |
| `AI_FALLBACK` | `off` para **desactivar** el reintento con Gemini. | ❌ No. Por defecto está activado. |
| `GEMINI_API_KEY` | La de la sección 2. | Muy recomendable, como respaldo. |

> ⚠️ **Seguridad:** la key de Experiential va **solo** en Vercel (o en tu `.env` local). Nunca en el código, en GitHub ni en chats.

Después: **Deployments → ⋯ → Redeploy** (paso 3.3).

### 5.3 Comprobar los nombres de modelo (importante)

Los nombres tienen que coincidir **exactamente** con los del catálogo de Experiential Labs. Los valores por defecto (`claude-opus-5.5`, `claude-sonnet-5`) y otros que te hayan recomendado (por ejemplo `gpt-6-luna`) **no se han podido verificar** desde aquí.

1. Abre **https://platform.experientiallabs.ai/models** (o, con tu sesión iniciada, el apartado **Models** del panel).
2. Busca el modelo. Cada uno tiene un **slug** o identificador, por ejemplo `claude-opus-5` o `claude-fable-5.1`.
3. Copia el slug **exactamente**, con minúsculas, guiones y puntos.
4. Si es distinto del valor por defecto, ponlo en `EXPERIENTIAL_MODEL` o `EXPERIENTIAL_FAST_MODEL` y haz **Redeploy**.

**Cómo saber si un nombre está mal:** Miguel sigue respondiendo (gracias al respaldo de Gemini), pero en los logs de Vercel (paso 3.6) aparece:

```
[ai] Experiential falló, reintentando con Gemini: Experiential Labs devolvió 404 con el modelo "…"
```

El texto entre comillas es el nombre que hay que corregir.

### 5.4 Ejemplos de configuración

| Quiero… | Variables |
|---|---|
| Opus en el chat y un modelo rápido para planes (recomendado) | `AI_PROVIDER=experiential`, `EXPERIENTIAL_API_KEY=xpl_…` (los modelos por defecto) |
| Respuestas más rápidas en el chat | Lo anterior + `EXPERIENTIAL_MODEL=<slug del modelo rápido>` (p. ej. el de GPT-6 Luna, si existe en el catálogo) |
| Todo con el mismo modelo | `EXPERIENTIAL_MODEL` y `EXPERIENTIAL_FAST_MODEL` con el mismo slug (ojo: con Opus, los planes pueden pasar de 60 s) |
| Ver los errores de Experiential sin que Gemini los tape | Añade `AI_FALLBACK=off` |

### 5.5 Volver a Gemini

- **Opción rápida:** cambia `AI_PROVIDER` a `gemini` (o bórrala) y haz **Redeploy**.
- Las variables `EXPERIENTIAL_*` pueden quedarse cargadas; se ignoran mientras `AI_PROVIDER` no sea `experiential`.

---

## 6. Conectar tu cuenta Suunto

Se hace **desde la propia app**, una vez en cada navegador o dispositivo:

1. Abre la app (tu URL de Vercel).
2. Ve a la pestaña **Suunto & ZoneSense → Conexión Suunto & Claude MCP**. También puedes ir a **Historial → Extracción Suunto Cloud**.
3. Pulsa **Conectar Suunto**.
4. Se abre la página de Suunto: inicia sesión con **tu usuario y contraseña de Suunto** y acepta el acceso.
5. Vuelves a la app. Se sincroniza sola la primera vez.

A partir de ahí, pulsa **Sincronizar** cuando quieras traer datos nuevos. Cada sincronización:

- Trae los **últimos 28 días**, el máximo que permite Suunto.
- **Entrenos:**
  - Si ese día tenías una sesión planificada sin completar, se marca como completada con los datos reales: duración, distancia, desnivel, FC media y máxima, TSS y tiempo en zonas ZoneSense.
  - Si no, el entreno se añade al calendario como completado.
  - Nunca se duplica un entreno ya importado.
- **Sueño, HRV y FC mínima de cada noche:** crean los check-ins de readiness de cada mañana.
  - No pisan los check-ins que hayas registrado a mano.

**Qué NO trae la sincronización:** la serie segundo a segundo ni la curva de DFA a1. Para el análisis detallado de una sesión concreta, exporta el `.fit` desde la App Suunto y súbelo en **Suunto & ZoneSense → Analizador .FIT** o en el detalle de la sesión.

### Si Suunto se desconecta

Si la conexión caduca, la app te avisa ("Reconecta Suunto") y el estado pasa a "No conectado". Solo tienes que pulsar **Conectar Suunto** otra vez e iniciar sesión.

Los tokens de Suunto se guardan **solo en tu navegador**. Si borras los datos del navegador o usas otro dispositivo, tendrás que conectar de nuevo.

---

## 7. Opcional: el connector de Suunto en claude.ai

El mismo servidor MCP de Suunto que usa la app puedes usarlo en claude.ai para preguntarle a Claude por tus entrenos:

1. En claude.ai: **Settings → Connectors → Add custom connector**.
2. URL: `https://mcp-ten-kappa.vercel.app/mcp`
3. Conéctate e inicia sesión con Suunto.

(Si ya lo tienes conectado, no hace falta repetirlo.)

---

## 8. Desarrollo local (opcional)

Solo si quieres ejecutar la app en tu ordenador:

```bash
git clone https://github.com/trailelguerrero/Entrenador.git
cd Entrenador
npm install
cp .env.example .env     # y edita .env: pon tu GEMINI_API_KEY (y, si quieres, las variables de Experiential de la sección 5)
npm run dev
```

La app se abre en `http://localhost:3000`. El archivo `.env` nunca se sube a GitHub (está en `.gitignore`).

---

## 9. Verificación final y problemas comunes

Checklist tras el despliegue:

1. ✅ La URL de Vercel abre la app. Si sale un login de Vercel, ve al paso 3.5.
2. ✅ El indicador `● IA` de la barra superior está en verde (o pulsa **Probar IA**) y Miguel responde en el chat.
3. ✅ **Conectar Suunto** te lleva al login de Suunto y, al volver, aparece "Suunto sincronizado" con tus entrenos en el calendario.

### 9.1 Indicadores de estado en la app

La app te avisa sola cuando una API falla. No hace falta mirar los logs para saber qué pasa.

**Indicador de la barra superior** (`● IA  ● Suunto`; en el móvil, `● IA  ● S`):

| Color | IA | Suunto |
|---|---|---|
| 🟢 Verde | Funciona | Conectado |
| 🟡 Ámbar | Modo respaldo: Experiential falló y responde Gemini | — |
| 🔴 Rojo | Error de API (ver el banner) | Error de API |
| ⚪ Gris | Todavía no se ha comprobado | No conectado |

- **Al pulsarlo** se abre un panel con el proveedor y el modelo en uso, el último error con "Qué hacer" y el botón **Probar IA**.
  - **Probar IA** hace una llamada real mínima (gasta muy pocos tokens) y te dice si respondió, con qué modelo y en cuánto tiempo.
  - Si Suunto no está conectado, el panel tiene un botón **Ir a Conexión Suunto**.
- **Al abrir la app** se comprueba la configuración del servidor (por ejemplo, si falta la API key) **sin gastar tokens**.

**Banner bajo la barra superior** (además, aparece un aviso emergente):

- 🔴 **"Error de API de IA"**: la IA no responde. Muestra el motivo y **Qué hacer**. El botón **Volver a probar** repite la prueba.
- 🔴 **"La API de la app no responde"**: el servidor de la app no contesta o el despliegue está mal. Revisa la sección 3.
- 🔴 **"Error de API de Suunto"**: la sincronización con Suunto falló.
- 🟡 **"IA en modo respaldo"**: Experiential Labs falló y Miguel está respondiendo con Gemini. La app funciona, pero no con el modelo que elegiste. Revisa la sección 5.

El banner desaparece solo con la siguiente respuesta correcta. También puedes cerrarlo con la ✕.

**Códigos de error** (aparecen en el panel y en los logs de Vercel):

| Código | Qué significa | Qué hacer |
|---|---|---|
| `AI_CONFIG` | Falta una variable (`GEMINI_API_KEY`, `EXPERIENTIAL_API_KEY`) o `AI_PROVIDER` está mal escrita | Secciones 2, 3.2 y 5.2; luego **Redeploy** |
| `AI_AUTH` | API key inválida o revocada | Crea una key nueva (sección 2, o tu panel de Experiential) y cámbiala en Vercel |
| `AI_QUOTA` | Cuota gratuita o créditos agotados | Espera (Gemini) o recarga créditos / vuelve a Gemini (5.5) |
| `AI_MODEL` | El nombre del modelo no existe | Sección 4 (`GEMINI_MODEL`) o 5.3 (`EXPERIENTIAL_*`) |
| `AI_TIMEOUT` | La IA tardó demasiado | Reintenta; si pasa siempre, usa un modelo más rápido |
| `AI_UNAVAILABLE` | El proveedor está caído o hay un problema de red | Suele ser temporal: reintenta en unos minutos |
| `AI_BAD_RESPONSE` | Respuesta inesperada de la IA | Reintenta; si se repite, prueba otro modelo |
| `BACKEND_MISSING` / `NETWORK` | La API de la app no responde | Comprueba en Vercel que el despliegue está en "Ready" (sección 3) y mira los logs (3.6) |
| `SUUNTO_AUTH` | La conexión con Suunto caducó | Pulsa **Conectar Suunto** (sección 6) |
| `SUUNTO_UNAVAILABLE` | El servidor MCP de Suunto no responde | Comprueba `https://mcp-ten-kappa.vercel.app` y el proyecto `mcp` en Vercel |

### 9.2 Problemas comunes

| Síntoma | Causa probable | Solución |
|---|---|---|
| Error "Falta la variable de entorno GEMINI_API_KEY" | No se cargó la clave o no se redesplegó | Pasos 3.2 y 3.3 |
| Error "AI_PROVIDER=experiential pero falta la variable EXPERIENTIAL_API_KEY" | Activaste Experiential sin cargar su key | Sección 5.2, luego **Redeploy** |
| Error `AI_PROVIDER="…" no es válido` | Valor mal escrito | Usa exactamente `gemini` o `experiential` |
| En los logs: `[ai] Experiential falló, reintentando con Gemini` | Modelo mal escrito (404), key inválida (401), sin créditos (402/429) o tardó demasiado | Mira el motivo en esa misma línea. Para un 404, sección 5.3; para 401, revisa la key; para 402/429, recarga créditos o vuelve a Gemini (5.5) |
| Error "Experiential Labs devolvió …" | Lo mismo, con `AI_FALLBACK=off` o sin `GEMINI_API_KEY` | Igual que la fila anterior |
| Error "API key not valid" | Clave mal copiada o revocada | Crea otra clave (paso 2), cámbiala en Vercel y haz **Redeploy** |
| Error 404 / "model not found" de Gemini | El modelo ya no existe | Sección 4 (`GEMINI_MODEL`) |
| Error 429 / "quota" / "RESOURCE_EXHAUSTED" | Superaste el límite gratuito de Gemini | Espera (el límite es por minuto o por día) o revisa el plan en AI Studio |
| Miguel tarda y da error en planes largos | Tiempo máximo de la función (60 s) | Vuelve a intentarlo; si pasa siempre, mira los logs (3.6) |
| "Reconecta Suunto" / "La conexión con Suunto caducó" | Tokens de Suunto vencidos | Pulsa **Conectar Suunto** (sección 6) |
| "No se pudo conectar Suunto … rechazó el registro" | El servidor MCP de Suunto no responde | Comprueba que `https://mcp-ten-kappa.vercel.app` abre y dice "Suunto MCP server activo"; si no, revisa el proyecto `mcp` en Vercel |
| La app muestra datos de ejemplo | Datos de prueba activos | Pulsa **Datos Prueba** en la barra superior para limpiarlos; tus entrenos reales se conservan |
