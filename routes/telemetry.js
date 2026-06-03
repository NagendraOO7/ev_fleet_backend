const router = require('express').Router();
const Telemetry = require('../models/Telemetry');
const mongoose = require('mongoose');

// POST /telemetry/batch
router.post('/batch', async (req, res) => {
    try {
        const { data } = req.body;
        if (!Array.isArray(data) || data.length === 0) return res.status(400).json({ error: "Data must be an array" });
        
        const sanitized = data.map(d => ({
            vehicle_id: new mongoose.Types.ObjectId(d.vehicle_id),
            timestamp: new Date(d.timestamp),
            soc_pct: d.soc_pct,
            battery_temp_c: d.battery_temp_c,
            speed_kph: d.speed_kph || 0,
            location_lat: d.location_lat,
            location_lng: d.location_lng,
            charging_status: d.charging_status || 'parked'
        }));

        await Telemetry.insertMany(sanitized, { ordered: false });
        res.status(201).json({ success: true, inserted: sanitized.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;