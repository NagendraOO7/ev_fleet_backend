/**
 * Trip Detection Service
 * A trip starts when speed > 1 kph and ends when speed stays ≤ 1 kph
 * for `idleThresholdMinutes` consecutive minutes.
 */

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function detectTrips(records, idleThresholdMinutes = 5) {
  if (!records || !records.length) return [];

  const sorted = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const trips = [];
  let trip = null;
  let idleStart = null;
  const idleMs = idleThresholdMinutes * 60 * 1000;

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const ts = new Date(r.timestamp).getTime();
    const spd = r.speed_kph ?? 0;

    if (spd > 1) {
      if (!trip) {
        trip = {
          start_time: r.timestamp,
          end_time: null,
          start_location: { lat: r.location_lat, lng: r.location_lng },
          end_location: null,
          distance_km: 0,
          max_speed_kph: spd,
          speed_sum: spd,
          speed_count: 1,
          _prev: r,
        };
      } else {
        // Accumulate distance (cap at 4 km per interval to filter GPS jitter)
        const d = haversineKm(trip._prev.location_lat, trip._prev.location_lng,
                              r.location_lat, r.location_lng);
        if (d < 4) trip.distance_km += d;
        trip.speed_sum += spd;
        trip.speed_count++;
        if (spd > trip.max_speed_kph) trip.max_speed_kph = spd;
        trip._prev = r;
      }
      idleStart = null;
    } else {
      if (trip) {
        if (!idleStart) {
          idleStart = ts;
        } else if (ts - idleStart >= idleMs) {
          // Close trip
          trip.end_time = trip._prev.timestamp;
          trip.end_location = { lat: trip._prev.location_lat, lng: trip._prev.location_lng };
          trip.avg_speed_kph = Math.round(trip.speed_sum / trip.speed_count * 100) / 100;
          trip.distance_km = Math.round(trip.distance_km * 100) / 100;
          trip.max_speed_kph = Math.round(trip.max_speed_kph * 100) / 100;
          const clean = { ...trip };
          delete clean.speed_sum;
          delete clean.speed_count;
          delete clean._prev;
          trips.push(clean);
          trip = null;
          idleStart = null;
        }
      }
    }
  }

  // Close dangling trip
  if (trip) {
    trip.end_time = trip._prev.timestamp;
    trip.end_location = { lat: trip._prev.location_lat, lng: trip._prev.location_lng };
    trip.avg_speed_kph = Math.round(trip.speed_sum / trip.speed_count * 100) / 100;
    trip.distance_km = Math.round(trip.distance_km * 100) / 100;
    trip.max_speed_kph = Math.round(trip.max_speed_kph * 100) / 100;
    const clean = { ...trip };
    delete clean.speed_sum;
    delete clean.speed_count;
    delete clean._prev;
    trips.push(clean);
  }

  return trips;
}

module.exports = { detectTrips };