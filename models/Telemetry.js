const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    vehicle_id: { type: String ,  ref: 'Vehicle', required: true },
    timestamp: { type: Date, required: true },
    soc_pct: Number,
    battery_temp_c: Number,
    speed_kph: Number,
    location_lat: Number,
    location_lng: Number,
    charging_status: { type: String, enum: ['driving', 'charging', 'parked'] }
}, { timestamps: false });
schema.index({ vehicle_id: 1, timestamp: -1 });
schema.index({ timestamp: -1 });
module.exports = mongoose.model('Telemetry', schema , 'telemetry');