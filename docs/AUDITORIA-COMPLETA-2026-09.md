# Auditoría completa de la app y del cerebro de Miguel — 25 de septiembre de 2026

Segunda auditoría (la primera, centrada en el cerebro, está en `AUDITORIA-CEREBRO-2026-09.md`).
Esta vez se han comparado **los datos reales de tu cuenta Suunto** con lo que la app hace con ellos:

- 197 entrenos de 365 días (del 20/01/2026 a hoy), leídos al completo;
- 28 días de sueño y de Recovery;
- los datos oficiales de la Transvulcania en su web.

Estado: `npm test` → 85/85 · `tsc` OK · `build` OK.

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
| P1–P9 | Pendientes de decisión (ver §4). | 🟠/🟡 | ⏳ |

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

## 4. Pendiente (necesita tu decisión)

| # | Qué pasa | Propuesta |
|---|---|---|
| P1 | 33 de tus 112 carreras se clasifican como **"rodaje suave"** aunque pasaron > 20 % del tiempo en amarillo o rojo de ZoneSense. Miguel y la estructura semanal las cuentan como suaves. | Clasificar por el tiempo real en zonas cuando haya ZoneSense (nuevo tipo "carrera con intensidad"). |
| P2 | El % de ZoneSense se calcula sobre el tiempo **medido**, no sobre la duración total. Una carrera de 12 min con 2 min medidos sale "verde 100 %". | Mostrar también "medido X de Y min" y no usar repartos con menos del 50 % medido. |
| P3 | Posibles tramos de la noche marcados como "siesta" por Suunto (§2). | Sumar a la noche las "siestas" que terminan el mismo día que la noche principal, tras comprobarlo en la App de Suunto. |
| P4 | Tu FC máx configurada (184) podría ser la fórmula 220 − edad (si tienes 36 años). Has registrado 186. | Confirmar en el reloj. La app ya avisa si se supera 3 veces en 2 semanas distintas. |
| P5 | Hay **cuatro "semáforos" de fatiga** con reglas distintas: readiness (±10/20 % de HRV), panel HRV-carga (media de 7 días vs. SWC ±0,5 DE, "NFOR" < 82 %), puntuación HRV (50 + 120×Δ) y widget semanal. Pueden contradecirse en la misma pantalla. | Que todas las pantallas usen el motor de readiness como fuente única y dejen el resto como gráficas. |
| P6 | La carrera objetivo está **escrita a mano** en el prompt de Miguel, en el filtro de carreras y en varias pantallas. Si cambias el objetivo en la app, Miguel sigue pensando en la Transvulcania. | Pasarlo todo a los datos de `targetRace`. |
| P7 | La fecha de la Transvulcania 2027 se muestra como segura. | Marcarla "por confirmar" hasta que salga la oficial. |
| P8 | Pendientes de la 1.ª auditoría: sin check-in de hoy no hay límites (M3), el plan no aplica el readiness de hoy (M4), aprendizajes fragmentados (M5), la tirada larga completa en ámbar (M6), instrucciones colándose desde la biblioteca (M7). | Ver `AUDITORIA-CEREBRO-2026-09.md`. |
| P9 | Umbrales genéricos en pantalla (calidad de sueño < 65 / > 80, "rango general" de nutrición). | Etiquetarlos como orientativos o personalizarlos con tu historial. |
