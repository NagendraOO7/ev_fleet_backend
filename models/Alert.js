const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  vehicle_id:         { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  type:               { type: String, required: true },
  severity:           { type: String, enum: ['warning', 'critical'], required: true },
  message:            { type: String, required: true },
  value:              { type:mongoose.Schema.Types.Mixed },
  threshold:          { ype:mongoose.Schema.Types.Mixed },
  telemetry_timestamp:{ type: Date },
  status:             { type: String, enum: ['active', 'resolved'], default: 'active' },
  created_at:         { type: Date, default: Date.now, index: true }
}, { strict: true });

schema.index({ vehicle_id: 1, status: 1, created_at: -1 });

module.exports = mongoose.model('Alert', schema);