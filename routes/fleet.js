const router = require('express').Router();
const Telemetry = require('../models/Telemetry');
const Vehicle = require("../models/Vehicle")
// GET /fleet/dashboard
router.get('/dashboard', async (req, res) => {
    try {

        
        const stats = await Telemetry.aggregate([
            { $sort: { vehicle_id: 1, timestamp: -1 } },
            { $group: { _id: "$vehicle_id", latest: { $first: "$$ROOT" } } },
            { $group: {
                _id: null,
                total_vehicles: { $sum: 1 },
                active_driving: { $sum: { $cond: [{ $eq: ["$latest.charging_status", "driving"] }, 1, 0] } },
                active_charging: { $sum: { $cond: [{ $eq: ["$latest.charging_status", "charging"] }, 1, 0] } },
                avg_soc: { $avg: "$latest.soc_pct" },
                avg_temp: { $avg: "$latest.battery_temp_c" }
            }}
        ]).exec();
        
        
        const socDist = await Telemetry.aggregate([
            { $sort: { vehicle_id: 1, timestamp: -1 } },
            { $group: { _id: "$vehicle_id", latest: { $first: "$$ROOT" } } },
            { $bucket: {
                groupBy: "$latest.soc_pct",
                boundaries: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
                default: "100+",
                output: { count: { $sum: 1 } }
            }}
        ]).exec();
        const totalVehicles = await Vehicle.countDocuments();
        
        res.json({
        total_vehicles: totalVehicles,
        active_driving: stats[0]?.active_driving || 0,
        active_charging: stats[0]?.active_charging || 0,
        avg_soc: stats[0]?.avg_soc || 0,
        avg_temp: stats[0]?.avg_temp || 0,
        soc_distribution: socDist
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /fleet/alerts/active
rrouter.get('/alerts/active', async (req, res) => {
    try {
        const anomalies = await Telemetry.aggregate([
            {
                $setWindowFields: {
                    partitionBy: "$vehicle_id",
                    sortBy: { timestamp: -1 },
                    output: { rank: { $rank: {} } }
                }
            },
            { $match: { rank: 1 } },  // latest per vehicle
            {
                $match: {
                    $or: [
                        { battery_temp_c: { $gt: 45 } },  // ← direct fields now
                        { speed_kph: { $gt: 130 } },
                        { soc_pct: { $lt: 10 } }
                    ]
                }
            }
        ]).exec();

        const alerts = anomalies.flatMap(a => {
            const res = [];
            if (a.battery_temp_c > 45) res.push({ vehicle_id: a.vehicle_id, type: 'HIGH_TEMP', severity: a.battery_temp_c > 50 ? 'critical' : 'warning', message: `Temp at ${a.battery_temp_c}°C`, value: a.battery_temp_c });
            if (a.speed_kph > 130) res.push({ vehicle_id: a.vehicle_id, type: 'EXCESSIVE_SPEED', severity: 'critical', message: `Speed at ${a.speed_kph} kph`, value: a.speed_kph });
            if (a.soc_pct < 10) res.push({ vehicle_id: a.vehicle_id, type: 'LOW_SOC', severity: 'warning', message: `SOC critically low at ${a.soc_pct}%`, value: a.soc_pct });
            return res;
        });

        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;