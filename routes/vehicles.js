const router = require('express').Router();
const Vehicle = require('../models/Vehicle');
const Telemetry = require('../models/Telemetry');
const mongoose = require('mongoose');

// GET /vehicles (List & Search)
router.get('/', async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
        const match = search ? { $or: [{ id: new RegExp(search, 'i') }, { make: new RegExp(search, 'i') }] } : {};

        const [total, vehicles] = await Promise.all([
            Vehicle.countDocuments(match),
            Vehicle.find(match)
                .select('id make model battery_capacity_kwh')
                .skip((page - 1) * limit)
                .limit(parseInt(limit))
                .lean()
        ]);

        const ids = vehicles.map(v => v.id);
        const latestData = await Telemetry.aggregate([
            { $match: { vehicle_id: { $in: ids } } },
            {
                $setWindowFields: {
                    partitionBy: "$vehicle_id",
                    sortBy: { timestamp: -1 },
                    output: { rank: { $rank: {} } }
                }
            },
            { $match: { rank: 1 } },
            { $project: { rank: 0 } }
        ]).allowDiskUse(true);

        const telemetryMap = Object.fromEntries(latestData.map(d => [d.vehicle_id, d]));

        res.json({
            data: vehicles.map(v => ({ ...v, latest_telemetry: telemetryMap[v.id] || null })),
            pagination: { page: +page, limit: +limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /vehicles/:id/latest
router.get('/:id/latest', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid ID" });
        const vehicle = await Vehicle.findById(req.params.id);
        if (!vehicle) return res.status(404).json({ error: "Not found" });
        
        const latest = await Telemetry.findOne({ vehicle_id: req.params.id }).sort({ timestamp: -1 });
        res.json({ vehicle, telemetry: latest });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /vehicles/:id/telemetry
router.get('/:id/telemetry', async (req, res) => {
    try {
        const { start_time, end_time, limit = 500 } = req.query;

        // find the vehicle first to get its string id
        const vehicle = await Vehicle.findById(req.params.id).lean();
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

        const match = { vehicle_id: vehicle.id }; // "EV-00001"
        if (start_time || end_time) {
            match.timestamp = {};
            if (start_time) match.timestamp.$gte = new Date(start_time);
            if (end_time) match.timestamp.$lte = new Date(end_time);
        }

        const data = await Telemetry.find(match).sort({ timestamp: 1 }).limit(parseInt(limit)).lean();
        res.json({ data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /vehicles/:id/trips (STATE MACHINE IMPLEMENTATION)
router.get('/:id/trips', async (req, res) => {
    try {
         if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: "Invalid ID" });

        // look up vehicle to get string id
        const vehicle = await Vehicle.findById(req.params.id).lean();
        if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

        const { start_time, end_time, idle_threshold_min = 5 } = req.query;
        const match = { vehicle_id: vehicle.id };

        // Handle time filtering
        if (start_time || end_time) {
            match.timestamp = {};
            if (start_time) match.timestamp.$gte = new Date(start_time);
            if (end_time) match.timestamp.$lte = new Date(end_time);
        } else {
            // Default to last 7 days to prevent pulling millions of records
            match.timestamp = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
        }

        // MUST fetch ALL points (including speed=0) to detect when vehicle stops
        const records = await Telemetry.find(match)
            .sort({ timestamp: 1 })
            .select('timestamp speed_kph location_lat location_lng')
            .limit(50000) // Safety cap to prevent server crash
            .lean();

        if (!records.length) return res.json({ total_trips: 0, total_distance_km: 0, trips: [] });

        const IDLE_MS = (parseInt(idle_threshold_min) || 5) * 60 * 1000;
        let trips = [];
        let currentTrip = null;
        let idleStart = null;

        // Haversine formula to calculate distance between two GPS points
        const haversineKm = (lat1, lon1, lat2, lon2) => {
            const R = 6371;
            const toRad = d => d * Math.PI / 180;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        };

        // State Machine Loop
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const ts = new Date(r.timestamp).getTime();
            const speed = r.speed_kph || 0;

            if (speed > 0) {
                if (!currentTrip) {
                    // STATE: IDLE -> DRIVING (Trip Starts)
                    currentTrip = {
                        start_time: r.timestamp,
                        end_time: null,
                        start_location: { lat: r.location_lat, lng: r.location_lng },
                        end_location: null,
                        distance_km: 0,
                        max_speed_kph: speed,
                        prev: r
                    };
                } else {
                    // STATE: DRIVING (Continue Trip)
                    // Calculate distance from previous point, cap at 2km to filter GPS jitter
                    const d = haversineKm(currentTrip.prev.location_lat, currentTrip.prev.location_lng, r.location_lat, r.location_lng);
                    if (d < 2) currentTrip.distance_km += d;
                    
                    if (speed > currentTrip.max_speed_kph) currentTrip.max_speed_kph = speed;
                    currentTrip.prev = r;
                }
                idleStart = null; // Reset idle timer because vehicle is moving
            } else {
                // Speed is 0
                if (currentTrip) {
                    if (!idleStart) {
                        // STATE: DRIVING -> POTENTIALLY STOPPED
                        idleStart = ts; 
                    } else if (ts - idleStart >= IDLE_MS) {
                        // STATE: POTENTIALLY STOPPED -> IDLE (Trip Ends)
                        // Use the PREVIOUS moving point as the end of the trip
                        currentTrip.end_time = currentTrip.prev.timestamp;
                        currentTrip.end_location = {
                            lat: currentTrip.prev.location_lat,
                            lng: currentTrip.prev.location_lng
                        };
                        currentTrip.distance_km = Math.round(currentTrip.distance_km * 100) / 100;
                        
                        trips.push(currentTrip);
                        currentTrip = null;
                        idleStart = null;
                    }
                }
            }
        }

        // If vehicle is still driving at the end of the dataset, close the trip
        if (currentTrip) {
            currentTrip.end_time = currentTrip.prev.timestamp;
            currentTrip.end_location = { lat: currentTrip.prev.location_lat, lng: currentTrip.prev.location_lng };
            currentTrip.distance_km = Math.round(currentTrip.distance_km * 100) / 100;
            trips.push(currentTrip);
        }

        const totalDistance = trips.reduce((sum, t) => sum + t.distance_km, 0);

        res.json({
            total_trips: trips.length,
            total_distance_km: Math.round(totalDistance * 100) / 100,
            trips: trips
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;