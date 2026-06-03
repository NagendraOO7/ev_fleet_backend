const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    id: { type: mongoose.Schema.Types.ObjectId, unique: true }, // EV-00001
    make: String,
    model: String,
    battery_capacity_kwh: Number
});
module.exports = mongoose.model('Vehicle', schema);