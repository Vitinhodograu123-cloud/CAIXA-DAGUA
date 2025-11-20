const mongoose = require('mongoose');

const passwordChangeLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  changeType: {
    type: String,
    enum: ['reset', 'update'],
    default: 'reset'
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  }
}, {
  timestamps: true // Cria createdAt e updatedAt automaticamente
});

// Índice para buscas mais rápidas
passwordChangeLogSchema.index({ userId: 1, createdAt: -1 });
passwordChangeLogSchema.index({ email: 1 });
passwordChangeLogSchema.index({ username: 1 });

module.exports = mongoose.model('PasswordChangeLog', passwordChangeLogSchema);
