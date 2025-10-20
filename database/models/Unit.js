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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tanks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tank'
  }],
  
  // ⭐⭐ NOVO CAMPO - ADICIONE ESTAS LINHAS ⭐⭐
  calibration: [{
    percentage: Number,    // 25%, 50%, 75%, 100%
    liters: Number,        // 300L, 800L, etc.
    sensorCount: Number    // Quantidade de sensores ativos
  }]
});

// Método para gerar o endpoint único
UnitSchema.pre('save', function(next) {
  if (!this.endpoint) {
    const sanitizedName = this.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    this.endpoint = `/api/units/${sanitizedName}/data`;
  }
  
  // ⭐⭐ NOVA LÓGICA - Gera calibração automática se não existir ⭐⭐
  if (!this.calibration || this.calibration.length === 0) {
    this.calibration = this.generateDefaultCalibration();
  }
  
  next();
});

// ⭐⭐ NOVO MÉTODO - Adicione esta função ao schema ⭐⭐
UnitSchema.methods.generateDefaultCalibration = function() {
  const steps = this.numberOfSensors;
  const calibration = [];
  
  for (let i = 1; i <= steps; i++) {
    const percentage = Math.round((i / steps) * 100);
    const defaultLiters = i * 250; // 250L por sensor como padrão
    
    calibration.push({
      percentage: percentage,
      liters: defaultLiters,
      sensorCount: i
    });
  }
  
  return calibration;
};

// ⭐⭐ NOVO MÉTODO - Calcular litros baseado na porcentagem ⭐⭐
UnitSchema.methods.calculateLiters = function(percentage) {
  if (!this.calibration || this.calibration.length === 0) {
    return null;
  }

  const sortedCalibration = [...this.calibration].sort((a, b) => a.percentage - b.percentage);
  
  for (let i = 0; i < sortedCalibration.length; i++) {
    const current = sortedCalibration[i];
    const next = sortedCalibration[i + 1];
    
    if (percentage === current.percentage) {
      return current.liters;
    }
    
    if (next && percentage > current.percentage && percentage <= next.percentage) {
      const ratio = (percentage - current.percentage) / (next.percentage - current.percentage);
      return Math.round(current.liters + (next.liters - current.liters) * ratio);
    }
  }
  
  return null;
};

module.exports = mongoose.model('Unit', UnitSchema);
