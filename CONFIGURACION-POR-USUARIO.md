# Configuración por usuario

Esta guía reúne todo lo que tienes que configurar para que **Uphill Coach AI** funcione en Vercel:

- la API key de la IA (Gemini por defecto; opcionalmente Claude u otros vía Experiential Labs),
- Vercel,
- la conexión con tu cuenta Suunto,
- *(opcional)* Supabase, para la **Biblioteca de Miguel** (documentos que consulta en el chat) y para guardar las conversaciones.

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
| Biblioteca de Miguel y conversaciones en Supabase | supabase.com + vercel.com | ❌ Opcional | 10 min |

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
3. En la lista **Import Git Repository**, busca `Miguel-Entrenador` y pulsa **Import**.
   - Si no aparece, pulsa **Adjust GitHub App Permissions**, da acceso al repositorio `trailelguerrero/Miguel-Entrenador` y vuelve.
4. En la pantalla de configuración:
   - **Project Name**: `miguel`.
   - **Framework Preset**, **Build Command** y **Output Directory**: no los toques. Vercel los lee de `vercel.json`.
   - Despliega **Environment Variables** y añade ya `GEMINI_API_KEY` con tu clave (paso 2). Así te ahorras el redespliegue del paso 3.3.
5. Pulsa **Deploy** y espera a que termine (1–2 min).

Si el proyecto `miguel` ya existe (ya está creado: https://miguel-seven-sage.vercel.app), ábrelo desde el equipo **"trailelguerrero-3582's projects"**. Cada `git push` a la rama `main` lo vuelve a desplegar automáticamente.

### 3.2 Variables de entorno

1. Dentro del proyecto: **Settings → Environment Variables**.
2. Añade las variables de esta tabla. Para cada una: escribe el **Key**, pega el **Value**, deja marcados los entornos **Production**, **Preview** y **Development**, y pulsa **Save**.

| Key (nombre exacto) | Value (valor) | ¿Obligatoria? |
|---|---|---|
| `GEMINI_API_KEY` | La clave del paso 2 (`AIza...`) | ✅ Sí |
| `GEMINI_MODEL` | Nombre de un modelo de Gemini, p. ej. `gemini-3.8-flash`. Ver la sección 4. | ❌ No. Si no la pones, se usa `gemini-3.8-flash`. |
| `SUUNTO_MCP_URL` | `https://mcp-ten-kappa.vercel.app` | ❌ No. Es el valor por defecto; solo cámbiala si algún día mueves el servidor MCP de Suunto. |
| `AI_PROVIDER`, `EXPERIENTIAL_*`, `AI_FALLBACK` | Ver la sección 5 | ❌ No. Solo si quieres usar Claude (u otro modelo) en lugar de Gemini. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EMBEDDING_PROVIDER`… | Ver la sección 10 | ⚠️ Recomendable. Guardan tus datos en el servidor, la Biblioteca de Miguel y las conversaciones. |
| `APP_SECRET` | Un secreto largo inventado por ti (40+ caracteres). | ❌ No. **Sin ella la app no pide ninguna clave** (ver el aviso de abajo). Con ella, la app pide la clave una vez por dispositivo. |
| `CRON_SECRET` | Otro secreto largo inventado por ti. | ❌ No. La sincronización diaria con Suunto funciona sin ella; con ella, solo Vercel puede lanzarla. |
| `SESSION_SECRET` | Otro secreto largo. | ❌ No. Firma las sesiones; cambiarlo **cierra la sesión en todos tus dispositivos**. |
| `TOKEN_ENCRYPTION_KEY` | Otro secreto largo. | ❌ No, pero recomendable. Cifra los tokens de Suunto guardados en Supabase. Sin ella se usa `APP_SECRET` o, si no hay, `SUPABASE_SERVICE_ROLE_KEY` (cambiar esa clave obliga a reconectar Suunto una vez). |

> **Sin clave (por defecto).** La app es de un solo atleta y **no pide ninguna clave**. ⚠️ Eso significa que **cualquiera que conozca la URL** puede ver tus datos (entrenos, sueño, HRV), usar tu conexión con Suunto y gastar tu cuota de IA: no compartas la URL. Si algún día quieres cerrarla, pon `APP_SECRET` en Vercel y haz **Redeploy**: la app pedirá esa clave una vez por dispositivo (sesión de 90 días, cookie HttpOnly; la clave no se guarda en el navegador).

> Las variables **no se aplican solas** a lo que ya está desplegado. Después de añadirlas o cambiarlas tienes que redesplegar (paso 3.3).

### 3.3 Redesplegar

1. Ve a la pestaña **Deployments** del proyecto.
2. En el despliegue más reciente (el de arriba), pulsa el menú **⋯** y luego **Redeploy**.
3. Confirma **Redeploy**. En 1–2 minutos el estado pasa a **Ready** (en verde).

### 3.4 La URL de tu app

- En la pestaña **Overview** del proyecto, en **Domains**, verás la URL pública. La de esta app es `https://miguel-seven-sage.vercel.app`.
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

Se hace **desde la propia app**. Con Supabase configurado (sección 11), **una sola vez**: los tokens se guardan cifrados en el servidor y todos tus dispositivos ven lo mismo. Sin Supabase, una vez en cada navegador:

1. Abre la app (tu URL de Vercel).
2. Ve a la pestaña **Suunto & ZoneSense → Conexión Suunto & Claude MCP**. También puedes ir a **Historial → Extracción Suunto Cloud**.
3. Pulsa **Conectar Suunto**.
4. Se abre la página de Suunto: inicia sesión con **tu usuario y contraseña de Suunto** y acepta el acceso.
5. Vuelves a la app. Se sincroniza sola la primera vez.

A partir de ahí, con Supabase el servidor sincroniza **solo cada mañana** (cron, sección 11) y **al abrir la app** si hace más de 3 horas de la última vez. Pulsa **Sincronizar** cuando quieras traer datos nuevos al momento. Cada sincronización:

- Trae los entrenos de los **últimos 365 días** (con ellos se calculan CTL/ATL/TSB; si Suunto tiene historial anterior, los valores pueden diferir) y el sueño/HRV de los **últimos 28 días**, el máximo que permite Suunto para esos datos.
- **Entrenos:**
  - Si ese día tenías una sesión planificada sin completar, se marca como completada con los datos reales: duración, distancia, desnivel, FC media y máxima, TSS y tiempo en zonas ZoneSense.
  - Si no, el entreno se añade al calendario como completado.
  - Nunca se duplica un entreno ya importado.
- **Sueño, HRV y FC mínima de cada noche:** crean los check-ins de readiness de cada mañana.
  - No pisan los check-ins que hayas registrado a mano.

**Qué NO trae la sincronización:** la serie segundo a segundo (sí trae el tiempo en verde/amarillo/rojo de ZoneSense de cada entreno). El .FIT tampoco trae ZoneSense. Para el análisis detallado de una sesión concreta, exporta el `.fit` desde la App Suunto y súbelo en **Suunto & ZoneSense → Analizador .FIT** o en el detalle de la sesión.

### Si Suunto se desconecta

Si la conexión caduca, la app te avisa ("Reconecta Suunto") y el estado pasa a "No conectado". Solo tienes que pulsar **Conectar Suunto** otra vez e iniciar sesión.

Con Supabase, los tokens de Suunto se guardan **cifrados en el servidor** (tabla `athlete_docs`); el navegador nunca los ve. Sin Supabase se guardan en el navegador y, si lo borras o usas otro dispositivo, tendrás que conectar de nuevo.

### Desconectar Suunto

Puedes desconectar tu cuenta cuando quieras desde cualquiera de estos sitios:

- **Indicador `● IA ● Suunto`** de la barra superior → **Desconectar Suunto**.
- **Historial (.MD)** → tarjeta "Extracción Suunto Cloud" → **Desconectar Suunto**.
- **Suunto & ZoneSense** → pestaña "Conexión Suunto & Claude MCP" → **Desconectar**.

**Qué hace:**
- Borra los tokens de conexión con Suunto (del servidor o, sin Supabase, de este navegador). El indicador de Suunto pasa a gris ("No conectado").
- **Se conservan** los entrenos ya importados, los check-ins y tu perfil.
- Para volver a conectar, pulsa **Conectar Suunto** otra vez.

### Perfil automático desde Suunto

Al sincronizar, la app **calcula tu perfil de atleta con tus datos de Suunto**, en vez de que lo rellenes tú. Son reglas fijas, sin IA: si no hay datos suficientes para un campo, ese campo no se toca. Después Miguel te resume en el chat qué ha tomado y qué conviene revisar.

| Campo | De dónde sale |
|---|---|
| FC máxima | La FC máxima configurada en tu Suunto. Si no está, la más alta registrada en 90 días. |
| Umbral aeróbico (AeT) | El umbral de Suunto ZoneSense, si tu reloj lo calcula. Si no, el límite superior de tu Zona 2 de FC en Suunto. |
| Umbral anaeróbico (AnT) | El umbral de ZoneSense. Si no, el límite superior de tu Zona 4 de FC en Suunto. |
| Déficit aeróbico (ADS) | Diferencia AeT–AnT mayor de 20 bpm o del 10 % (misma regla que la ficha). |
| FC en reposo | Mediana de tu FC mínima nocturna (últimos 28 días, sin siestas). |
| HRV de referencia | Media de tu HRV nocturna (últimos 28 días). |
| VO2máx | El último estimado por tu Suunto. |
| Volumen semanal | Horas de entreno de las últimas 4 semanas / 4. |
| Días de entreno por semana | Media de días con entreno por semana (últimas 4 semanas). |
| Día de tirada larga | Sábado o domingo, según dónde cayó más veces tu carrera más larga de cada semana (90 días). |

**En la Guía de Setup** (botón 🧭 de la barra superior): en el paso 1 y en el paso 4 tienes **"Sincronizar y rellenar desde Suunto"**. Al pulsarlo, los campos de la guía que vienen de Suunto se rellenan solos con tus datos reales (con su etiqueta SUUNTO) y tú completas el resto: experiencia en ultra, lesiones, calor, preferencias… Si conectas Suunto desde la guía sin haberla terminado, al volver se abre sola para continuar.

**Siguen siendo manuales**, porque Suunto no los comparte: nombre, edad, altura, peso, peso objetivo y lesiones.

**Etiquetas en la ficha** (botón **Atleta** de la barra superior):

- **SUUNTO:** el valor viene de tu reloj. Pasa el ratón por encima (o mantén pulsado en el móvil) para ver cómo se calculó. Se actualiza en cada sincronización.
- **MANUAL:** lo has cambiado tú, a mano o con el test de deriva. Suunto **ya no lo toca**.
- **↺ usar Suunto (valor):** aparece junto a un campo manual. Vuelve a poner el valor de Suunto y el campo pasa otra vez a "Suunto". Pulsa **Guardar Perfil** para confirmarlo.

> Si los umbrales AeT/AnT que salen no te cuadran, lo más probable es que tus zonas de FC en la App Suunto sean las de fábrica. Ajústalas en la App Suunto y vuelve a sincronizar, o haz el test de deriva en "Fisiología & Drift": ese valor queda como manual.

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
git clone https://github.com/trailelguerrero/Miguel-Entrenador.git
cd Miguel-Entrenador
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

### 9.2 Instalar la app en el móvil y forzar la versión nueva

**Instalar en Android (Chrome):**
1. Abre la URL de la app en **Chrome**.
2. Si aparece el botón **Instalar App** (o el icono ⬇ en la barra superior), púlsalo.
3. Si no aparece: menú **⋮** de Chrome → **"Instalar aplicación"** o **"Añadir a pantalla de inicio"** → **Instalar**.
4. Justo después de desinstalarla, Chrome puede tardar en volver a ofrecerla. Cierra Chrome del todo (quítalo de las apps recientes), abre la página de nuevo, espera unos segundos y repite el paso 3.

**Instalar en iPhone (Safari):** botón **Compartir** → **"Añadir a la pantalla de inicio"** → **Añadir**.

**Comprobar qué versión estás viendo:** pulsa el indicador `● IA ● Suunto` y mira abajo del panel **"Versión de la app"**. Compárala con el último despliegue en Vercel (Deployments → commit).

**Si el móvil sigue mostrando una versión antigua** (no puedes hacer zoom con dos dedos, faltan botones…) aunque hayas cerrado y abierto la app:

1. ⚠️ **Antes, haz una copia de tus datos.** Tus entrenos, tu perfil y el chat se guardan solo en el navegador. Usa **Buscar → "Copia de Seguridad"** y descarga el `.json`.
2. En Chrome (Android): menú **⋮** → **Configuración** → **Configuración de sitios** → **Todos los sitios** → busca `miguel-seven-sage.vercel.app` → **Borrar y restablecer**.
3. Abre la URL de nuevo, restaura la copia (Buscar → Copia de Seguridad → Restaurar) y vuelve a pulsar **Conectar Suunto**.

**Zoom mientras tanto:** en Chrome (Android), menú **⋮** → **Configuración** → **Accesibilidad** → activa **"Forzar zoom"**. Así el zoom funciona en cualquier web.

### 9.3 Problemas comunes

> **¿No ves un cambio recién publicado en el móvil** (p. ej. un botón nuevo, o no puedes hacer zoom con dos dedos)? La app instalada guarda una copia para funcionar sin conexión. Desde esta versión se actualiza y recarga sola al abrirla o al volver a ella. Si aun así ves la versión anterior: cierra la app del todo (quítala de las apps recientes) y ábrela otra vez. Si sigue igual, en el navegador abre la URL y recarga; en último caso, desinstala el icono y vuelve a añadirlo a la pantalla de inicio.

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
| No aparece un botón nuevo o no funciona el zoom en el móvil | La app instalada muestra la versión guardada | Cierra la app del todo y vuelve a abrirla (ver nota arriba) |
| La app muestra datos de ejemplo | Datos de prueba activos | Pulsa **Datos Prueba** en la barra superior para limpiarlos; tus entrenos reales se conservan |
| "Biblioteca desactivada: falta …" | Faltan variables de Supabase o de embeddings | Sección 10.2 y **Redeploy** |
| "Parece que falta el esquema: ejecuta scripts/init.sql" | No se ejecutó el SQL en Supabase | Sección 10.1 |
| La app pide la clave (`AUTH_REQUIRED`) | Hay `APP_SECRET` en Vercel y este dispositivo no tiene sesión o caducó (90 días) | Escribe el valor de `APP_SECRET`, o bórrala de Vercel si no quieres clave |
| "Error de Supabase… Invalid path specified in request URL" | `SUPABASE_URL` mal escrita | Debe ser exactamente `https://<tu-ref>.supabase.co` (sin `/rest/v1` ni barra final). La app ya corrige esas formas, pero revísala |
| "Sin conexión: no se ha guardado" | Cambiaste algo sin conexión o el servidor falló | Vuelve a hacerlo con conexión; al volver, la app recarga lo guardado en el servidor |
| Miguel no cita documentos que sí están en la biblioteca | Se cambió de proveedor/modelo de embeddings, o el umbral es alto | Vuelve a subir los documentos (10.5) o baja `KNOWLEDGE_MATCH_THRESHOLD` |

---

## 10. Opcional: Biblioteca de Miguel y conversaciones en Supabase

Con Supabase configurado, la app gana dos cosas (sin él, todo funciona igual que antes):

- **Biblioteca de Miguel (RAG).** Subes documentos de referencia (manuales, apuntes, planes de tu entrenador…). Se trocean, se convierten en *embeddings* y se guardan en Supabase (Postgres + pgvector). En cada mensaje del chat se buscan los fragmentos más parecidos a tu pregunta y se le pasan a Miguel, que los cita como `[B1]`, `[B2]`… Debajo de su respuesta ves de qué documento salió. **No es un modelo entrenado**: Miguel solo "sabe" lo que hay en esos fragmentos, y nunca los usa como tus datos fisiológicos (esos siguen viniendo solo de Suunto, tu .md y tus tests).
- **Miguel recuerda las conversaciones guardadas.** Al guardar, cada intercambio (tu pregunta + su respuesta) se vectoriza. En una conversación nueva, Miguel recupera los intercambios anteriores más parecidos a lo que preguntas (hasta 3), los cita como `[C1]` con su fecha y debajo de la respuesta ves de qué conversación salen. Los trata como lo que le contaste, no como datos medidos, y si están desactualizados prevalecen tus datos actuales. La conversación abierta no se "recuerda" así porque ya la tiene entera.
- **Conversaciones guardadas, cuando tú quieras.** El chat **no** se conecta a Supabase por su cuenta: solo se guarda al pulsar **Guardar en Supabase** (ver 10.6). Desde cualquier móvil u ordenador puedes abrir **Conversaciones guardadas** y cargar una. Borrar el chat en el móvil (papelera) **nunca** borra nada de Supabase.

### 10.1 Crear el proyecto y las tablas en Supabase

1. Entra en [supabase.com](https://supabase.com) → **New project** (el plan gratuito vale). Apunta la contraseña de la base de datos.
2. Cuando esté listo: menú izquierdo **SQL Editor** → **New query**.
3. Copia **todo** el contenido de [`scripts/init.sql`](scripts/init.sql), pégalo y pulsa **Run**. Debe terminar en "Success".
   Crea: la extensión `vector`, las tablas `documents`, `chat_sessions` y `chat_messages`, sus índices, la seguridad (RLS: nadie salvo el servidor de la app puede leer ni escribir) y la función de búsqueda `match_documents`. Se puede ejecutar varias veces sin romper nada.
4. Comprueba en **Table Editor** que aparecen las tres tablas.

### 10.2 Variables a cargar en Vercel

En Supabase: **Project Settings → API** (o **Data API** / **API Keys**, según la versión del panel):

| Key (nombre exacto) | Value | ¿Obligatoria? |
|---|---|---|
| `SUPABASE_URL` | **Project URL**, exactamente `https://xxxx.supabase.co` (sin `/rest/v1`, sin barra final; no la dirección del panel `supabase.com/dashboard/...`) | ✅ Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | La clave **service_role** (secreta). ⚠️ No la clave `anon`/publishable. | ✅ Sí |
| `EMBEDDING_PROVIDER` | `gemini` (por defecto) u `openai` | ❌ No |
| `GEMINI_EMBEDDING_MODEL` | Modelo de embeddings de Gemini. Por defecto `gemini-embedding-001`. | ❌ No |
| `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL` | Solo con `EMBEDDING_PROVIDER=openai`. Modelo por defecto `text-embedding-3-small`. | ❌ No |
| `KNOWLEDGE_MATCH_THRESHOLD` | Parecido mínimo (0–1) para que un fragmento llegue a Miguel. Por defecto `0.55`. | ❌ No |

Con Gemini (lo normal) **no hace falta ninguna clave nueva**: los embeddings usan la misma `GEMINI_API_KEY` del chat.

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` es secreta: solo en Vercel, nunca en el código ni en capturas. Si se filtra, rótala (Supabase → API Keys) y haz **Redeploy**. `INGEST_SECRET` ya no se usa: puedes borrarla de Vercel.

Marca **Production**, **Preview** y **Development** y haz **Redeploy** (3.3).

### 10.3 Comprobarlo

- Abre `https://<tu-app>/api/health`. En `"knowledge"` debe salir `"enabled": true` y `"chatHistoryEnabled": true`. Si no, `"missing"` dice qué variable falta.
- En la app: menú **Coach → Biblioteca de Miguel**. Si falta algo, lo indica arriba en amarillo.

### 10.4 Subir documentos

1. **Coach → Biblioteca de Miguel**.
2. Pulsa **Ver documentos** (usa la sesión de la app: no hace falta escribir ninguna clave).
3. Pon un **título**, opcionalmente la **fuente**, y carga un archivo `.md`/`.txt` o pega el texto. Pulsa **Guardar en la biblioteca**.
   - Máximo 200.000 caracteres por documento: los libros largos, en partes ("Libro X – parte 1", "parte 2"…).
   - Subir otra vez un documento con el **mismo título lo sustituye** (no se duplica).
   - La papelera borra un documento entero.
4. Pregúntale a Miguel algo de ese documento en el chat: debajo de la respuesta verás **Biblioteca de Miguel · [B1] título**.

También se puede hacer desde un ordenador con `curl`:

```bash
curl -X POST https://<tu-app>/api/knowledge/ingest \
  -H "Content-Type: application/json" \
  --data @sample-ingest.json
```

### 10.5 Cambiar de proveedor de IA más adelante

- **Chat (quien redacta las respuestas):** se cambia como siempre con `AI_PROVIDER` (sección 5). No afecta a la biblioteca.
- **Embeddings (quien convierte los documentos en vectores):** se cambia con `EMBEDDING_PROVIDER` (`gemini` u `openai`) y su modelo. Los vectores de modelos distintos no son comparables: cada fragmento guarda con qué modelo se creó y Miguel solo busca entre los del modelo actual. **Tras cambiar de proveedor o de modelo de embeddings, vuelve a subir los documentos** (la lista de la biblioteca avisa de los que se quedaron con el modelo anterior).
- Añadir otro proveedor de embeddings es añadir una entrada en `server/rag/embeddings.ts`; la columna de Supabase admite vectores de 1536 dimensiones.

### 10.6 Guardar y cargar conversaciones

Encima del chat de Miguel hay dos botones:

- **Guardar en Supabase (N)**: sube los N mensajes que todavía solo están en este dispositivo. Guardar dos veces no duplica nada: cada mensaje se guarda una sola vez. Mientras no lo pulses, la app no escribe nada en Supabase.
- **Conversaciones guardadas**: lista las conversaciones de Supabase (título = primera pregunta, nº de mensajes y fecha). Al tocar una, sustituye al chat del dispositivo; lo que escribas después se añade a esa misma conversación cuando pulses **Guardar**. Si tienes mensajes sin guardar, te avisa antes.
- **Papelera del chat**: borra la conversación **solo de este dispositivo** (avisa si hay mensajes sin guardar). En Supabase no se borra nada; la próxima vez que guardes se crea una conversación nueva. La app no tiene ninguna opción para borrar conversaciones de Supabase: si algún día quieres hacerlo, desde el panel de Supabase (**Table Editor → chat_sessions**, borrar la fila; sus mensajes se borran con ella).

Al guardar, además, Miguel indexa los intercambios nuevos para recordarlos en otras conversaciones (10.7). Si eso fallara, los mensajes quedan guardados igual y el aviso lo indica; vuelve a pulsar **Guardar** más tarde y se completa.

### 10.7 Qué recuerda Miguel

| Fuente | Cuándo la usa |
|---|---|
| La conversación abierta en el móvil | Siempre, entera |
| Conversaciones guardadas en Supabase | Solo los intercambios parecidos a tu pregunta (hasta 3), citados como `[C1]`… |
| Biblioteca de Miguel | Solo los fragmentos parecidos a tu pregunta (hasta 5), citados como `[B1]`… |
| Memoria de Miguel ("Anotar en memoria") | Siempre, las reglas y hipótesis confirmadas |
| Suunto, perfil, historial .md, check-in | Siempre |

Lo que no esté guardado en Supabase (mensajes solo en el móvil) no se recuerda desde otras conversaciones. Buscar en la biblioteca y en las conversaciones usa **un solo** embedding por pregunta, así que no duplica el gasto.

### 10.8 Coste

- **Supabase**: el plan gratuito (0 €) basta de sobra: un mensaje ocupa ~1–2 KB, un intercambio vectorizado ~8–10 KB y un documento largo (200.000 caracteres) ~2–3 MB. La pega del plan gratuito es que **pausa el proyecto tras unos 7 días sin actividad**: la biblioteca y las conversaciones dejan de responder (el chat sigue funcionando sin ellas) hasta que lo reactivas con un botón en el panel de Supabase; no se pierde nada. Precios actuales: supabase.com/pricing.
- **Embeddings (Google, con tu `GEMINI_API_KEY`)**: un embedding pequeño por mensaje del chat y uno por intercambio al guardar; céntimos al mes con un uso normal, dentro del nivel gratuito en muchos casos.

---

## 11. Tus datos en el servidor (Supabase como fuente de verdad)

Con Supabase configurado (sección 10), **tus datos viven en el servidor**: perfil, entrenos, check-ins, memoria de Miguel, carrera objetivo, historial .md y la conexión con Suunto. Ventajas: ves lo mismo en el móvil y en el ordenador, Miguel razona con esos datos (no con lo que tenga guardado un navegador) y Suunto se sincroniza solo.

Todavía se quedan en el navegador (llegarán en una segunda entrega): gut training, peso, hidratación y el chat (el chat se guarda en Supabase con **Guardar**, sección 10.6).

### 11.1 Activarlo (una vez)

1. **Supabase → SQL Editor:** vuelve a ejecutar **todo** [`scripts/init.sql`](scripts/init.sql). Crea la tabla nueva `athlete_docs` (no toca lo que ya tienes).
2. **Vercel → Environment Variables:** comprueba `SUPABASE_URL` (formato de 10.2). Opcionales: `CRON_SECRET`, `TOKEN_ENCRYPTION_KEY` (ver 3.2). **Redeploy.**
3. Abre la app. Te pide la clave (una vez por dispositivo) y aparece el aviso **"Tus datos ahora se guardan en el servidor"**:
   - **Subir mis datos** (en el dispositivo donde tienes tus datos): sube todo, incluida la conexión con Suunto, así que **no hace falta reconectar Suunto**. Si un registro ya existe en el servidor, gana el más reciente; lo que midió Suunto (TSS, FC, HRV…) lo pone siempre Suunto, y tu dolor y estrés se conservan.
   - **Usar solo lo del servidor** (en los demás dispositivos): sustituye lo de ese navegador por lo del servidor.
4. Compruébalo en `https://<tu-app>/api/health`: `"dataStore": true`.

### 11.2 Sincronización con Suunto

- **Cada mañana** a las 07:00 UTC (9:00 en Madrid en verano, 8:00 en invierno) Vercel llama a `/api/cron/suunto-sync` (con `CRON_SECRET` si la has puesto; no hace falta).
- **Al abrir la app**, si la última sincronización tiene más de 3 horas.
- **Botón Sincronizar**, cuando quieras.

### 11.3 Sin conexión

- La app muestra lo último que cargó (caché de lectura).
- **Los cambios necesitan conexión.** Si cambias algo sin conexión, sale el aviso **"Sin conexión: no se ha guardado"** y, al volver la conexión, la app recarga lo que hay en el servidor. Nada se pierde en silencio.

