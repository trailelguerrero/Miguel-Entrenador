/**
 * PROCEDENCIA DE LOS DATOS. Cada dato que llega a Miguel (y a la interfaz)
 * lleva una etiqueta para no mezclar lo medido con lo calculado o lo supuesto.
 *
 *   REAL          → medido: Suunto, .FIT, test del atleta o lo que él declara
 *   DERIVADO      → calculado por código a partir de datos reales (CTL, TSB, readiness)
 *   ESTIMADO      → aproximación por fórmula cuando falta el dato real (TSS sin Suunto)
 *   HIPÓTESIS     → aprendizaje con pocas evidencias; se vigila, no se aplica
 *   RECOMENDACIÓN → lo que Miguel propone
 */
export type DataProvenance = 'real' | 'derived' | 'estimated' | 'hypothesis' | 'recommendation';

export const PROVENANCE_LABEL: Record<DataProvenance, string> = {
  real: 'REAL',
  derived: 'DERIVADO',
  estimated: 'ESTIMADO',
  hypothesis: 'HIPÓTESIS',
  recommendation: 'RECOMENDACIÓN',
};

export const tag = (p: DataProvenance) => `[${PROVENANCE_LABEL[p]}]`;

export const PROVENANCE_PROMPT_RULES = `ETIQUETAS DE PROCEDENCIA DE LOS DATOS QUE RECIBES:
   - ${tag('real')}: medido (Suunto, .FIT, test o lo que declara el atleta). Es la base de tus decisiones.
   - ${tag('derived')}: calculado por la app a partir de datos reales (CTL/ATL/TSB, readiness). Úsalo tal cual; no lo recalcules.
   - ${tag('estimated')}: aproximación por fórmula porque falta el dato real. Dilo cuando lo uses y no lo presentes como medido.
   - ${tag('hypothesis')}: aprendizaje con pocas evidencias. Se vigila; nunca lo presentes como regla.
   - Lo que tú propones es una ${tag('recommendation')}: no lo mezcles con los datos. Si citas un dato, di de qué tipo es cuando no sea REAL.`;
