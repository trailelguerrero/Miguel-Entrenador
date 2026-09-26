import FitParser from 'fit-file-parser';

export interface ParsedFitResult {
  fileName: string;
  startTime?: string;
  totalDurationMin: number;
  totalDistanceKm: number;
  totalAscentM: number;
  totalDescentM: number;
  avgHeartRate: number;
  maxHeartRate: number;
  avgCadence?: number;
  avgSpeedKmh?: number;
  maxSpeedKmh?: number;
  calories?: number;
  // % del tiempo por FRECUENCIA CARDÍACA respecto a tus umbrales (no es
  // ZoneSense: el .FIT no trae ZoneSense, así que no se estima).
  hasHeartRate: boolean;
  // null si no hay AeT y AnT MEDIDOS (Suunto o manual): nunca umbrales por defecto
  timeInAerobicPct: number | null; // FC <= AeT
  timeInTransitionPct: number | null; // AeT < FC <= AnT
  timeInAnaerobicPct: number | null; // FC > AnT
  recordsSample: Array<{
    timestamp: string;
    heartRate?: number;
    altitude?: number;
    distance?: number;
  }>;
}

export function parseFitFile(
  fileBuffer: ArrayBuffer,
  fileName: string,
  /** Umbrales MEDIDOS (resolveIntensityPrescription). Sin ellos no se reparte el tiempo por FC. */
  aetHr?: number | null,
  antHr?: number | null,
): Promise<ParsedFitResult> {
  return new Promise((resolve, reject) => {
    try {
      const fitParser = new FitParser({
        force: true,
        speedUnit: 'km/h',
        lengthUnit: 'km',
        temperatureUnit: 'celsius',
        elapsedRecordField: true,
        mode: 'cascade',
      });

      fitParser.parse(fileBuffer, (error, data) => {
        if (error) {
          return reject(new Error(`Error al leer archivo FIT: ${error}`));
        }

        if (!data) {
          return reject(new Error('El archivo FIT no contiene datos legibles.'));
        }

        const session = data.activity?.sessions?.[0] || data.sessions?.[0] || {};
        const records: any[] = data.records || [];

        let durationSec = session.total_elapsed_time || session.total_timer_time || 0;
        let distanceKm = session.total_distance || 0;
        let ascentM = session.total_ascent || 0;
        let descentM = session.total_descent || 0;
        let avgHr = session.avg_heart_rate || 0;
        let maxHr = session.max_heart_rate || 0;
        let avgCadence = session.avg_cadence || undefined;
        let avgSpeedKmh = session.avg_speed || undefined;
        let maxSpeedKmh = session.max_speed || undefined;
        let calories = session.total_calories || undefined;
        let startTime = session.start_time ? new Date(session.start_time).toISOString() : undefined;

        // If session summary is missing values, compute from records
        if (records.length > 0) {
          if (!durationSec && records.length > 1) {
            const first = new Date(records[0].timestamp).getTime();
            const last = new Date(records[records.length - 1].timestamp).getTime();
            durationSec = Math.max(0, (last - first) / 1000);
          }
          if (!distanceKm) {
            const lastRecord = records[records.length - 1];
            if (lastRecord && typeof lastRecord.distance === 'number') {
              distanceKm = lastRecord.distance;
            }
          }
          if (!avgHr) {
            const hrRecords = records.filter(r => typeof r.heart_rate === 'number');
            if (hrRecords.length > 0) {
              const sum = hrRecords.reduce((acc, r) => acc + r.heart_rate, 0);
              avgHr = Math.round(sum / hrRecords.length);
              maxHr = Math.max(...hrRecords.map(r => r.heart_rate));
            }
          }
          if (!ascentM) {
            // Compute total ascent from altitude changes
            let totalAsc = 0;
            let totalDesc = 0;
            for (let i = 1; i < records.length; i++) {
              const alt1 = records[i - 1].altitude;
              const alt2 = records[i].altitude;
              if (typeof alt1 === 'number' && typeof alt2 === 'number') {
                const diff = alt2 - alt1;
                if (diff > 0.5) totalAsc += diff;
                if (diff < -0.5) totalDesc += Math.abs(diff);
              }
            }
            ascentM = Math.round(totalAsc);
            descentM = Math.round(totalDesc);
          }
        }

        // Distribución del tiempo por FC respecto a AeT / AnT del perfil (solo si están medidos)
        const zonesOk = typeof aetHr === 'number' && aetHr > 0 && typeof antHr === 'number' && antHr > aetHr;
        let aerobicCount = 0;
        let transitionCount = 0;
        let anaerobicCount = 0;
        let totalHrPoints = 0;

        for (const r of records) {
          if (typeof r.heart_rate === 'number') {
            totalHrPoints++;
            if (!zonesOk) continue;
            if (r.heart_rate <= aetHr!) {
              aerobicCount++;
            } else if (r.heart_rate <= antHr!) {
              transitionCount++;
            } else {
              anaerobicCount++;
            }
          }
        }

        const totalPointsSafe = Math.max(1, totalHrPoints);
        const pct = (n: number) => (zonesOk && totalHrPoints > 0 ? Math.round((n / totalPointsSafe) * 100) : null);
        const timeInAerobicPct = pct(aerobicCount);
        const timeInTransitionPct = pct(transitionCount);
        const timeInAnaerobicPct = pct(anaerobicCount);


        // Sample records for UI display (downsample to ~50-100 points for smooth charts)
        const sampleStep = Math.max(1, Math.floor(records.length / 80));
        const recordsSample = records
          .filter((_, idx) => idx % sampleStep === 0)
          .map(r => ({
            timestamp: r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            heartRate: r.heart_rate,
            altitude: typeof r.altitude === 'number' ? Math.round(r.altitude) : undefined,
            distance: typeof r.distance === 'number' ? Math.round(r.distance * 10) / 10 : undefined,
          }));

        resolve({
          fileName,
          startTime,
          totalDurationMin: Math.round(durationSec / 60),
          totalDistanceKm: Math.round(distanceKm * 10) / 10,
          totalAscentM: Math.round(ascentM),
          totalDescentM: Math.round(descentM),
          avgHeartRate: Math.round(avgHr),
          maxHeartRate: Math.round(maxHr),
          avgCadence: avgCadence ? Math.round(avgCadence) : undefined,
          avgSpeedKmh: avgSpeedKmh ? Math.round(avgSpeedKmh * 10) / 10 : undefined,
          maxSpeedKmh: maxSpeedKmh ? Math.round(maxSpeedKmh * 10) / 10 : undefined,
          calories,
          hasHeartRate: totalHrPoints > 0,
          timeInAerobicPct,
          timeInTransitionPct,
          timeInAnaerobicPct,
          recordsSample,
        });
      });
    } catch (err: any) {
      reject(new Error(`Fallo inesperado al procesar FIT: ${err.message}`));
    }
  });
}
