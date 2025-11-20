const mongoose = require('mongoose');

const maintenanceTicketSchema = new mongoose.Schema({
  unitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: true
  },
  tankId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tank',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  issueType: {
    type: String,
    enum: ['vibration', 'low_water', 'high_temperature', 'sensor_failure', 'other'],
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  readingsData: {
    waterLevel: Number,
    temperature: Number,
    vibration: Boolean,
    vibrationCount: Number,
    timestamp: Date
  },
  resolutionNotes: {
    type: String
  },
  resolvedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Índices para consultas eficientes
maintenanceTicketSchema.index({ unitId: 1, status: 1 });
maintenanceTicketSchema.index({ tankId: 1 });
maintenanceTicketSchema.index({ issueType: 1 });
maintenanceTicketSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MaintenanceTicket', maintenanceTicketSchema);
