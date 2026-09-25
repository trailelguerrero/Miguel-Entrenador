# Auditoría independiente: Fase A

Respuesta a la auditoría independiente (hallazgos C1–C36). La app es de un **solo atleta**.

- **Fase A:** arregla todo lo que no depende de cambiar la arquitectura.
- **Fase B:** el servidor como fuente de verdad (datos en Supabase), autenticación y validación de esquemas; queda pendiente de diseñar juntos.

Estado: `npm test` → 113/113 (18 tests nuevos en `tests/audit5.test.ts`) · `tsc` OK · `build` OK.

## Estado de cada hallazgo

| # | Hallazgo | Estado | Qué se ha hecho |
|---|---|---|---|
| C1 | El servidor recalcula con lo que envía el cliente | ✅ Fase B | Los datos viven en Supabase (`athlete_docs`). Tras la subida única, el chat, el plan, la adaptación y la memoria leen perfil, carga, check-ins y memoria **del servidor** (`server/brain/serverData.ts`) y calculan CTL/ATL/TSB y el readiness allí, con la fecha del atleta. |
| C2 | La API está abierta si no hay secreto | ✅ Fase B | Cerrada por defecto: sin clave configurada responde 503. Toda `/api/*` exige sesión (cookie HttpOnly firmada de 90 días, `server/auth.ts`); la clave ya no se guarda en el navegador. |
| C3 | Dos readiness | ◐ Casi | El servidor recalcula el readiness de hoy con el motor desde los check-ins guardados (ya no se fía del estado del cliente). Queda dejar de guardar el `status` en el check-in (esquemas, C27). |
| C4 | Se mezclan "recuperación desconocida" y "carga" | ⏳ Fase B | Separar el estado de recuperación y el de carga es un cambio de modelo. |
| C5 | Sin dato de banda se asumía que había banda | ✅ | Tres estados: sí / no / desconocido (`hasChestStrap`). Con "desconocido" no se asume ZoneSense. Se deduce de Suunto (ZoneSense en los últimos 30 días) o se elige en la ficha. |
| C6 | La política solo se aplicaba al tipo de sesión | ✅ | `src/brain/workoutContract.ts` fija los tipos permitidos por nivel. Rojo: regenerativo o descanso (la fuerza pasa a descanso, la tirada larga y el test de deriva a regenerativo). Ámbar: sin series ni test. Sin datos: suave o descanso. Los **textos se reescriben** si describen intensidad no permitida. En rojo, sin desnivel ni distancia heredados. |
| C7 | Un descanso con restos de entreno | ✅ | `toRest()`: un descanso queda sin distancia, desnivel, FC, nutrición ni textos de sesión, tanto en la adaptación como en el plan. |
| C8 | El plan se guardaba aunque incumpliera la estructura | ✅ | `validatePlanContract`: **válido / reparado / rechazado**. Si se rechaza, se reintenta una vez con los motivos (si queda tiempo) y, si sigue mal, no se guarda (422). |
| C9 | Tirada larga sin desnivel | ✅ | La tirada larga exige distancia y D+ mayores que 0. También se rechazan dos carreras el mismo día y las fechas fuera de la semana. |
| C10 | La personalización de la IA no se verifica | ⏳ Fase B | Pasar a `factIds` comprobables. |
| C11 | A favor y en contra el mismo día contaban dos veces | ✅ | Como mucho una evidencia subjetiva por aprendizaje y día. Si cambia de sentido, la nueva sustituye a la anterior. |
| C12 | La similitud fusionaba lados distintos | ✅ | Rasgos que distinguen: izquierdo/derecho, subida/bajada, calor/frío. Si chocan, la similitud es 0. La memoria estructurada completa queda para la Fase B. |
| C13 | Reglas sin tope en el prompt | ✅ | Como mucho 20 reglas (primero las consolidadas), 10 observaciones o hipótesis y 5 caducadas o descartadas. |
| C14 | Una cifra del historial valía si aparecía en cualquier parte | ✅ | La cifra tiene que ir junto a la palabra de su dato ("FC máxima", "umbral aeróbico"…), sin una unidad contradictoria, y la IA da la frase literal. Un "150 km" ya no es una FC de 150. |
| C15 | Identidad de la carrera (edición) | ⏳ Fase B | — |
| C16 | Derivaciones de cifras de carreras demasiado permisivas | ✅ | Solo operaciones con significado: distancia y desnivel que faltan o sobran frente al objetivo, y m/km. Nada de sumas arbitrarias. |
| C17 | Zona horaria | ✅ | La app envía `athleteToday` y `athleteTimezone`. El servidor usa la fecha del atleta (por defecto Europe/Madrid), nunca la suya (UTC). |
| C18 | Regresión de HRV con pocos datos | ✅ | Mínimo de 10 noches; con menos, "datos insuficientes". Se muestra el R². |
| C19 | Sin HRV, el panel decía "estable" | ✅ | Nuevo estado `insufficient_data`. Sin HRV no se recomienda descarga y el índice dice "Sin datos de HRV". |
| C20/C34 | ACWR categórico | ✅ | Descriptivo: carga aguda baja / similar / elevada / muy elevada. Se quitan "Sweet Spot", "Zona de Peligro", "ALERTA ROJA", "2x–4x", los % de riesgo de la pantalla y las cifras de sodio. Sin carga crónica: "Sin carga de las últimas 4 semanas". |
| C21 | Fuente de la carga | ✅ | Nueva fuente `suunto_assigned` para las actividades añadidas a mano en Suunto; Miguel la ve como "ASIGNADO POR SUUNTO". |
| C22 | Descarga con cifras escritas a mano | ✅ | `src/brain/deload.ts`: tus sesiones planificadas al 75 % y sin intensidad. Si no hay plan, el 75 % de la mediana de tus rodajes recientes. Sin historial, no genera nada. Sin pulsaciones. |
| C23 | Sodio con un perfil cualitativo | ✅ | Solo dentro de un **rango medido** (`sodiumRangeMgPerHour`); sin rango, `null`. |
| C25 | El cliente puede fabricar historial del asistente | ⏳ Fase B (baja) | Con un solo atleta no hay terceros. |
| C26/C27/C28 | Invariantes en el prompt, sin esquemas en tiempo de ejecución | ◐ | Las invariantes de sesión y de semana ya viven en código (contrato). Faltan los esquemas de validación (Fase B). |
| C29/C30 | Calidad de datos y cobertura | ◐ | La cobertura de ZoneSense ya se guarda (`measuredPct`). Falta el motor de calidad de datos (Fase B). |
| C31 | HRV de referencia estable | ⏳ Fase B | — |
| C32/C33 | ADS y deriva presentados como diagnóstico | ✅ | Etiquetados como **heurística de la metodología Uphill Athlete**. Miguel debe decir "según la metodología que seguimos". Se corrige una 5.ª copia de la regla de ADS (historial .md). |
| C35 | La HRV autorizaba +10 % de carga | ✅ | La HRV es un modificador, no un autorizador: ningún % de carga sale de la tendencia de HRV. |
| C36 | Jerarquía de decisiones | ◐ | Seguridad (readiness y contrato) → estructura (contrato del plan) → IA. La formalización completa llega con la Fase B. |

## Matices a la auditoría
- **C6:** una tirada larga de 180 min en rojo no pasaba: la duración ya se recortaba a 35 min. El fallo real era que se mantenían el tipo, la distancia, el desnivel y el texto. Ya está corregido.
- **C11:** contar a favor y en contra el mismo día fue una decisión del arreglo anterior, protegida por un test. Se cambia a la propuesta del auditor, que es mejor.

## Fase B · entrega 1 (hecha)
- Datos del atleta en Supabase (`athlete_docs`): perfil, entrenos, check-ins, memoria, carrera objetivo, historial .md y tokens de Suunto **cifrados** (AES-256-GCM).
- Suunto lo sincroniza el servidor: cron diario (07:00 UTC), al abrir la app si hace >3 h y con el botón. Las reglas de fusión viven en `src/brain/suuntoMerge.ts` (una sola fuente para servidor y cliente).
- Subida única desde el navegador con confirmación (gana el más reciente; lo medido lo pone Suunto).
- Sin conexión: caché de lectura; los cambios exigen conexión y avisan "no se ha guardado".
- Tests: `tests/faseb.test.ts` y `tests/apiauth.test.ts`.

## Pendiente: Fase B
1. Segunda entrega de datos: gut training, peso, hidratación y chat.
2. Quitar `status` guardado del check-in (C3).
3. Esquemas en tiempo de ejecución (C27).
4. Personalización con `factIds` comprobables (C10).
5. Memoria 2.0 estructurada (C12 completo).
6. Identidad de carrera y edición (C15).
7. HRV de referencia persistente (C31).
8. Separar recuperación y carga (C4).
