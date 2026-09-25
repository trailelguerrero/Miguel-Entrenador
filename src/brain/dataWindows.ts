/**
 * Ventanas temporales de los datos de Suunto. Son distintas a propósito y
 * Miguel debe conocerlas para no suponer, por ejemplo, 365 días de HRV.
 */
export const DATA_WINDOWS = {
  /** Entrenos (TSS, duración, ZoneSense…): base de CTL/ATL/TSB. Máximo del MCP de Suunto. */
  workouts: 365,
  /** Sueño, HRV nocturna y Recovery: máximo que permite la 247 Data API de Suunto. */
  sleepRecovery: 28,
  /** Entrenos usados para deducir el perfil (FC máx., zonas, día de tirada larga…). */
  profileEvidence: 90,
} as const;

export function describeDataWindows(): string {
  return `Ventanas de datos: entrenos de los últimos ${DATA_WINDOWS.workouts} días; sueño/HRV/Recovery solo de los últimos ${DATA_WINDOWS.sleepRecovery} días; perfil deducido de los últimos ${DATA_WINDOWS.profileEvidence} días. No supongas datos fuera de esas ventanas.`;
}
