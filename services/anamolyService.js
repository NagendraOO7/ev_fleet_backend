/**
 * Anomaly Detection Rules
 * Runs on individual telemetry records against recent context.
 */

const THRESHOLDS = {
  HIGH_BATTERY_TEMP:     45,   // °C
  CRITICAL_BATTERY_TEMP: 50,
  EXCESSIVE_SPEED:       150,  // kph
  CRITICAL_SPEED:        180,
  RAPID_SOC_DROP_PCT:    5,    // % in lookback window
  RAPID_SOC_DROP_MIN:    10,   // minutes
  RAPID_TEMP_RISE:       5,    // °C in lookback window
  RAPID_TEMP_RISE_MIN:   10,
};

function detectAnomalies(current, previous = []) {
  const alerts = [];
  const curTs = new Date(current.timestamp).getTime();

  // 1. High battery temperature
  if (current.battery_temp_c > THRESHOLDS.HIGH_BATTERY_TEMP) {
    alerts.push({
      type: 'HIGH_BATTERY_TEMP',
      severity: current.battery_temp_c > THRESHOLDS.CRITICAL_BATTERY_TEMP ? 'critical' : 'warning',
      message: `Battery temp ${current.battery_temp_c.toFixed(1)}°C exceeds ${THRESHOLDS.HIGH_BATTERY_TEMP}°C`,
      value: current.battery_temp_c,
      threshold: THRESHOLDS.HIGH_BATTERY_TEMP,
    });
  }

  // 2. Excessive speed
  if (current.speed_kph > THRESHOLDS.EXCESSIVE_SPEED) {
    alerts.push({
      type: 'EXCESSIVE_SPEED',
      severity: current.speed_kph > THRESHOLDS.CRITICAL_SPEED ? 'critical' : 'warning',
      message: `Speed ${current.speed_kph.toFixed(1)} kph exceeds ${THRESHOLDS.EXCESSIVE_SPEED} kph limit`,
      value: current.speed_kph,
      threshold: THRESHOLDS.EXCESSIVE_SPEED,
    });
  }

  // 3. SOC out of valid range
  if (current.soc_pct != null && (current.soc_pct < 0 || current.soc_pct > 100)) {
    alerts.push({
      type: 'SOC_OUT_OF_RANGE',
      severity: 'critical',
      message: `SOC ${current.soc_pct}% is outside valid [0, 100] range`,
      value: current.soc_pct,
      threshold: '0-100',
    });
  }

  // 4. Charging while driving
  if (current.charging_status === 'charging' && current.speed_kph > 1) {
    alerts.push({
      type: 'CHARGING_WHILE_DRIVING',
      severity: 'critical',
      message: `Charging reported while moving at ${current.speed_kph.toFixed(1)} kph`,
      value: current.speed_kph,
      threshold: 0,
    });
  }

  // 5. Rapid SOC drop (needs previous context)
  if (previous.length && current.charging_status === 'driving') {
    const lookbackMs = THRESHOLDS.RAPID_SOC_DROP_MIN * 60000;
    for (const prev of previous) {
      const pt = new Date(prev.timestamp).getTime();
      const dt = curTs - pt;
      if (dt > 0 && dt <= lookbackMs) {
        const drop = prev.soc_pct - current.soc_pct;
        if (drop > THRESHOLDS.RAPID_SOC_DROP_PCT) {
          alerts.push({
            type: 'RAPID_SOC_DROP',
            severity: drop > 10 ? 'critical' : 'warning',
            message: `SOC dropped ${drop.toFixed(1)}% in ${Math.round(dt / 60000)} min`,
            value: drop,
            threshold: THRESHOLDS.RAPID_SOC_DROP_PCT,
          });
          break;
        }
      }
    }
  }

  // 6. Rapid temperature rise
  if (previous.length) {
    const lookbackMs = THRESHOLDS.RAPID_TEMP_RISE_MIN * 60000;
    for (const prev of previous) {
      const pt = new Date(prev.timestamp).getTime();
      const dt = curTs - pt;
      if (dt > 0 && dt <= lookbackMs) {
        const rise = current.battery_temp_c - prev.battery_temp_c;
        if (rise > THRESHOLDS.RAPID_TEMP_RISE) {
          alerts.push({
            type: 'RAPID_TEMP_RISE',
            severity: rise > 8 ? 'critical' : 'warning',
            message: `Battery temp rose ${rise.toFixed(1)}°C in ${Math.round(dt / 60000)} min`,
            value: rise,
            threshold: THRESHOLDS.RAPID_TEMP_RISE,
          });
          break;
        }
      }
    }
  }

  return alerts;
}

module.exports = { detectAnomalies };