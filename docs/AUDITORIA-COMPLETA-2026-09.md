# Auditoría completa de la app y del cerebro de Miguel — 25 de septiembre de 2026

Segunda auditoría (la primera, centrada en el cerebro, está en `AUDITORIA-CEREBRO-2026-09.md`).
Esta vez se han comparado **los datos reales de tu cuenta Suunto** con lo que la app hace con ellos:

- 197 entrenos de 365 días (del 20/01/2026 a hoy), leídos al completo;
- 28 días de sueño y de Recovery;
- los datos oficiales de la Transvulcania en su web.

Estado: `npm test` → 95/95 · `tsc` OK · `build` OK. **Todos los pendientes se han resuelto aplicando las recomendaciones (§4); las recomendaciones finales están en §5.**

---

## 1. Resumen

| # | Hallazgo | Gravedad | Estado |
|---|---|---|---|
| A1 | Tus "umbrales" AeT 142 / AnT 160 son las **zonas de fábrica** del reloj (72/77/82/87 % de FC máx 184), no umbrales medidos. Miguel los usaba como medidos. | 🔴 | ✅ Arreglado |
| A2 | Con esas zonas la app te **diagnosticaba ADS** (siempre sale > 10 %). | 🔴 | ✅ Arreglado |
| A3 | **"Cargar Prueba" borraba tus datos reales** (entrenos, check-ins, peso, gut training, hidratación) sin avisar, y al quitarla se perdían los check-ins. | 🔴 | ✅ Arreglado |
| A4 | El **test de deriva** interpretaba el resultado al revés del manual Uphill Athlete y cambiaba el AeT inventando cifras. | 🔴 | ✅ Arreglado |
| A5 | El check-in manual guardaba **HRV 55, sueño 7,5 h y FC 48 inventados** si no tocabas los controles, y ese check-in manual **impedía que Suunto** pusiera tus datos reales de ese día. | 🔴 | ✅ Arreglado |
| A6 | 32 actividades **añadidas a mano en Suunto** (pilates, funcional) tienen un TSS fijo de 35/h sin pulso: 1.050 TSS (9 % del total) contados como medidos. | 🟠 | ✅ Arreglado |
| A7 | Un entreno de Suunto de **cualquier deporte** completaba la sesión planificada del día (un pilates marcaba como hechas tus series). | 🟠 | ✅ Arreglado |
| A8 | **Kcal y minutos "ahorrados" por kilo** en la ficha y la guía (con la fórmula mal en unidades, ×4), cuando Miguel tiene prohibido dar esas cifras. | 🟠 | ✅ Arreglado |
| A9 | **% de probabilidad de lesión** del ACWR (15–25 %, 35–50 %) sin respaldo para un corredor individual. | 🟠 | ✅ Arreglado |
| A10 | La regla de ADS estaba copiada en 4 sitios; sin AeT medido y con AnT 160 salía "ADS". | 🟡 | ✅ Arreglado |
| A11 | La fórmula de CTL/ATL que muestra la pantalla PMC no era la que usa el código. | 🟡 | ✅ Arreglado |
| A12 | El desnivel negativo del PMC era siempre 0. | 🟡 | ✅ Arreglado |
| A13 | No había botón de sincronizar Suunto en la pantalla principal. | — | ✅ Añadido |
| P1–P9 | Pendientes de la auditoría (ver §4). | 🟠/🟡 | ✅ Resueltos con la recomendación |

---

## 2. Comparación con tus datos reales de Suunto

### Entrenos (365 días, 197 actividades)

| Dato | Valor real | Qué hacía la app |
|---|---|---|
| Deportes | 112 carreras (76 carrera + 36 trail), 51 bici de montaña, 16 funcional, 17 pilates, 1 desconocido | Funcional (73) y pilates (120) salían como "Actividad" genérica → ahora fuerza |
| Añadidas a mano | 32 (sin FC, TSS fijo 35/h) | Contaban como TSS REAL → ahora ESTIMADO |
| Con ZoneSense | 77 | Cobertura media 83 % del tiempo (mínimo 15 %) |
| FC máx configurada | 184 en todas | Tu máximo registrado es 186 (y 185) |
| Zonas de FC de carrera | 132/142/151/160 en 162 entrenos | = 72/77/82/87 % de 184: **las de fábrica** |
| Umbrales ZoneSense | Suunto no los envía en ningún entreno | La app caía a las zonas del reloj como "umbral medido" |
| Días con > 1 actividad | 44 | Ver A7 |

### Sueño y recuperación (28 días)
- La HRV nocturna media es de unos 45 ms. Hoy has tenido 44 ms (−2 %): verde. El 15/09 tuviste 24 ms (−47 %): rojo. **Coincide con lo que calcula la app.**
- El Recovery de hoy es de 0,45, uno de los más bajos del mes. La app lo muestra, pero no cambia el nivel del día: es una decisión de diseño.
- ⚠️ Suunto marca como **"siesta"** tramos largos que coinciden con la noche (por ejemplo, 179 min con HRV 19 la noche del 14 al 15/09). La app descarta las siestas, así que las horas de sueño **pueden quedarse cortas** esas noches. Hay que comprobarlo con la App de Suunto (P3).

### Transvulcania (web oficial)
- 73 km, +4.350 m y −4.057 m: **correcto**.
- El Roque de los Muchachos tiene 2.426 m, pero la organización usa 2.421 m en el recorrido. Es menor.
- La fecha de la edición 2027 (08/05/2027) **aún no es oficial**. La de 2026 fue el 9 de mayo.

---

## 3. Qué se ha arreglado y cómo

- **A1–A2 (zonas de fábrica):** `server/suunto-profile.ts` detecta si las zonas de carrera son las de fábrica (±1 ppm sobre 72/77/82/87 % de la FC máx). En ese caso no rellena el AeT, el AnT ni el ADS, y **vacía** los que puso Suunto antes; los que pusiste a mano no se tocan. Miguel recibe el aviso ("no des pulsaciones como si fueran umbrales") y la explicación en la ficha.
  **Efecto para ti:** tras la próxima sincronización tu AeT y tu AnT quedarán vacíos y desaparecerá el aviso de ADS. Miguel pasará a usar ZoneSense (con banda) o las sensaciones hasta que hagas el **test de deriva** o fijes tus umbrales.
- **A3 (datos de prueba):** cargarlos pide confirmación y **añade** datos sin sustituir nada. Los check-ins de ejemplo van marcados y al salir solo se borran esos. También se quitan el gut training, los resúmenes, el WUT y la simulación de ejemplo si no los has cambiado.
- **A4 (test de deriva, según el manual):**
  - < 3,5 %: la FC del test está por debajo de tu AeT; se guarda como mínimo.
  - 3,5–5 %: la FC de la primera mitad es tu AeT.
  - > 5 %: el test estuvo por encima de tu AeT; **no se cambia** el AeT y se te pide repetirlo 5–10 ppm más bajo.

  El test ya no diagnostica ADS y los campos de FC empiezan vacíos (antes traían 139/146 de ejemplo).
- **A5 (check-in):** los controles empiezan en "sin dato" y lo que no tocas se guarda como 0 (sin dato). Al sincronizar, **lo medido lo pone Suunto** (HRV, sueño, FC mínima, Recovery) y se conservan tu dolor y tu estrés, recalculando el semáforo.
- **A6:** las actividades añadidas a mano en Suunto se marcan (`suuntoManualEntry`) y su TSS cuenta como **estimado**.
- **A7:** un entreno de Suunto solo completa la sesión planificada si es del mismo deporte (carrera con carrera, fuerza con fuerza).
- **A8–A9:** se quitan las kcal y los minutos "ahorrados" y los % de lesión; el ACWR muestra solo niveles (bajo, elevado, muy elevado).
- **A10:** una sola regla de ADS (`hasAerobicDeficiency`): AeT más de un 10 % por debajo del AnT, y solo con los dos umbrales medidos.
- **A11–A12:** la fórmula del PMC ahora coincide con el código (`/42` y `/7`) y el desnivel negativo se suma de verdad.
- **A13:** hay una barra fija arriba en todas las pantallas. Con Suunto conectado muestra "Suunto: hace 3 h" y un botón **Sincronizar**; sin conectar, un botón **Conectar Suunto**.

---

## 4. Pendientes resueltos con la recomendación

| # | Qué pasaba | Qué se ha hecho |
|---|---|---|
| P1 | 33 de 112 carreras salían como "rodaje suave" aunque pasaron más del 20 % del tiempo en amarillo o rojo. | Nuevo tipo **"Carrera con intensidad"** (`intensity_run`) para las carreras importadas con más del 20 % en amarillo o rojo y ZoneSense fiable. Con tus datos: 32 carreras. Salen en naranja en el calendario, cuentan como series para el motor (en ámbar o rojo pasan a rodaje) y ya no alteran el ritmo "suave" estimado. Las ya importadas se reclasifican en la próxima sincronización. |
| P2 | El % de ZoneSense no decía qué parte de la sesión se había medido. | Se guarda `measuredPct`. Miguel ve "sobre el X % que ZoneSense midió" y, con menos del 50 %, "poco representativo". Los minutos en verde del PMC se calculan sobre el tiempo medido. |
| P3 | "Siestas" de Suunto que pueden ser parte de la noche. | Se guardan aparte (`napMinutes`) y Miguel las ve, pero **no se suman** al sueño: Suunto no da la hora y no se puede saber si son de la noche. |
| P4 | FC máx del reloj = 220 − edad. | Si la FC máx de Suunto coincide con 220 − edad, no cuenta como medida. Miguel te sugiere confirmarla. Si la fijas a mano, vale. |
| P5 | Cuatro "semáforos" de fatiga que se contradecían. El más grave ("NFOR") saltaba con **menos** carga que el intermedio. | El orden de gravedad es ahora coherente: la fatiga acumulada exige carga **muy alta**. Los paneles de HRV-carga pasan a ser **tendencia de 7 días** ("fatiga acumulada", "carga alta asumida"…), sin diagnósticos clínicos ni % de riesgo inventados. Todos remiten al semáforo del día para decidir qué hacer hoy. |
| P6 | La carrera objetivo estaba escrita a mano en el cerebro. | El prompt, el plan, los análisis, el consejo y el filtro de cifras usan la carrera objetivo de la app (`describeTargetRace`, `targetFigures`). La Transvulcania queda solo como valor por defecto. |
| P7 | La fecha de 2027 se mostraba como oficial. | `dateConfirmed: false`: la ficha, el informe PDF y Miguel dicen "por confirmar". |
| M3 | Sin check-in no había límites. | El motor evalúa siempre: la carga sola (TSB, TSS de 7 días) puede subir el nivel. Sin datos de recuperación, **sin series ni intensidad**. |
| M4 | El plan semanal ignoraba el estado de hoy. | La sesión de hoy del plan se recorta a los límites del motor (`applyTodayReadinessToPlan`). |
| M5 | Un mismo hallazgo redactado distinto quedaba repartido y nunca llegaba a regla. | Un hallazgo "nuevo" que comparte al menos el 60 % de las palabras clave con uno de la misma categoría suma como evidencia a ese. |
| M6 | En ámbar se permitía la tirada larga completa. | En ámbar, como mucho el **75 %** de lo planificado. |
| M7 | Texto de la biblioteca con rango de instrucción del sistema. | La biblioteca y las conversaciones van en el mensaje del atleta, entre `<biblioteca>` / `<conversaciones>`, con una regla que prohíbe seguir órdenes de ahí. Se neutralizan las etiquetas que intenten "escaparse". |
| m1 | Las sesiones sin fecha válida se amontonaban en domingo. | Se colocan en su día solo si está libre; si no, se descartan con aviso. |
| m3 | La memoria del prompt crecía sin tope. | Como mucho 15 observaciones o hipótesis y 10 caducadas o descartadas (las más recientes). |
| m6 | Un pendiente se perdía en silencio si su aprendizaje se había borrado. | Ahora se avisa. |
| m7 | Dos semáforos distintos en el prompt del chat. | Solo cuenta el del motor. |
| P9 | Umbrales genéricos presentados como tuyos. | Etiquetados como orientativos. Los carbohidratos por hora sin tolerancia registrada dicen "valor general, no tuyo". |

**Sigue abierto (menor):**
- **m2:** el chat manda todo el historial y el `.md` en cada mensaje.
- **m4:** la evidencia del chat lleva la fecha del día en que se extrae, no la del hecho.
- **m5:** la verificación de cifras del `.md` es laxa.
- **m8:** la memoria solo vive en el navegador.

Ver §5.

## 5. Recomendaciones

### Para ti (atleta), por orden
1. **Fusiona la PR y sincroniza Suunto.** Tu AeT y tu AnT de fábrica se vaciarán, desaparecerá el aviso de ADS y tus 32 carreras con intensidad se reclasificarán.
2. **Haz el test de deriva de 60 minutos** en terreno llano o en cinta, sin intensidad el día anterior.
   - Empieza a una FC cómoda, **no a la Z3 de fábrica (142)**.
   - Si la deriva sale entre 3,5 y 5 %, la app fijará tu AeT de verdad.
   - Hasta entonces, Miguel no te dará pulsaciones.
3. **Ponte la banda de pecho en los rodajes.** Sin ella no hay ZoneSense y Miguel solo puede guiarte por sensaciones. De tus 197 entrenos, solo 77 tienen ZoneSense.
4. **Confirma tu FC máxima.** El reloj tiene 184, que podría ser 220 − edad; has registrado 186. Si tras un esfuerzo máximo real ves más, cámbiala en el reloj y en la ficha (a mano).
5. **Haz el check-in cada mañana, aunque sea solo el dolor y el estrés.** HRV y sueño llegan de Suunto al sincronizar, pero el dolor y el estrés solo los sabes tú, y con estrés de 8 o más el nivel sube.
6. **Actividades añadidas a mano en Suunto:** si puedes, regístralas con el reloj. A mano, Suunto les pone 35 TSS/h sin pulso y la app ahora las cuenta como estimadas.
7. **Pon la fecha oficial de la Transvulcania 2027** en la ficha en cuanto salga.

### Para la app (siguientes pasos técnicos)
| Prioridad | Qué | Por qué |
|---|---|---|
| Alta | **"Añadir al cerebro" desde el chat** (diseño en curso: opción A, con tarjeta de confirmación). | Pediste que Miguel pueda guardar lo que le digas o le enlaces. |
| Alta | **Restricciones médicas con fecha de caducidad** (p. ej. "2 semanas sin series"). | Deben bloquear planes y adaptaciones de inmediato, sin esperar 3 evidencias. |
| Media | **Memoria de Miguel en Supabase** (m8). | Hoy vive solo en el navegador: móvil y ordenador tienen "cerebros" distintos y se pierde si borras los datos. |
| Media | **Recortar el historial del chat** (m2): últimos N mensajes + resumen. | Coste y tiempo de respuesta crecen con cada mensaje (límite de 60 s en Vercel). |
| Media | **Pasar las pantallas de fatiga al motor del día** (resto de P5). | Hoy ya no se contradicen en diagnóstico, pero siguen calculando su propia banda. |
| Baja | Fecha real del hecho en la evidencia del chat (m4); verificación de cifras del `.md` por etiqueta (m5). | Precisión de la memoria y del historial. |
| Baja | Aviso "sincroniza" si la última sincronización tiene más de 24 h. | Que Miguel no decida con datos de ayer. |
