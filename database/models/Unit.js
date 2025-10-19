const mongoose = require('mongoose');

const UnitSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  location: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['CAIXA', 'CISTERNA'],
    required: true
  },
  endpoint: {
    type: String,
    unique: true
  },
  apiKey: {
    type: String,
    unique: true,
    default: () => require('crypto').randomBytes(32).toString('hex')
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastData: {
    waterLevel: Number,
    temperature: Number,
    vibration: Boolean,
    vibrationCount: Number,
    isLowLevel: Boolean,
    isHighTemp: Boolean,
    isVibrating: Boolean,
    boias: [{
      pino: Number,
      porcentagem: Number,
      estado: String
    }],
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  numberOfSensors: {
    type: Number,
    required: true,
    default: 4
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'],
    default: 'ACTIVE'
  },
  lastUpdate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // NOVO CAMPO: Referência ao usuário que criou a unidade
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tanks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tank'
  }]
});

// Método para gerar o endpoint único
UnitSchema.pre('save', function(next) {
  if (!this.endpoint) {
    const sanitizedName = this.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    this.endpoint = `/api/units/${sanitizedName}/data`;
  }
  next();
});

module.exports = mongoose.model('Unit', UnitSchema);
