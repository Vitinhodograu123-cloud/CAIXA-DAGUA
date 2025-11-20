const express = require('express');
const router = express.Router();
const MaintenanceTicket = require('../database/models/MaintenanceTicket');
const issueDetectionService = require('../services/issueDetectionService');

// Middleware de autenticação
const auth = require('../middleware/auth');

// Listar todos os tickets
router.get('/', auth, async (req, res) => {
  try {
    console.log('📋 Buscando tickets...');
    
    const { status, issueType, priority } = req.query;
    const filters = {};
    
    if (status) filters.status = status;
    if (issueType) filters.issueType = issueType;
    if (priority) filters.priority = priority;

    let tickets;
    
    // Se for admin, mostra todos os tickets
    if (req.user && req.user.role === 'admin') {
      tickets = await MaintenanceTicket.find(filters)
        .populate('tankId', 'name deviceId')
        .populate('unitId', 'name location')
        .populate('reportedBy', 'username')
        .populate('assignedTo', 'username')
        .sort({ createdAt: -1 });
    } else {
      // Se for usuário normal, mostra apenas tickets das suas unidades
      const User = require('../database/models/User');
      const user = await User.findById(req.user.id).populate('units');
      
      const unitIds = user.units.map(unit => unit._id);
      filters.unitId = { $in: unitIds };
      
      tickets = await MaintenanceTicket.find(filters)
        .populate('tankId', 'name deviceId')
        .populate('unitId', 'name location')
        .populate('reportedBy', 'username')
        .populate('assignedTo', 'username')
        .sort({ createdAt: -1 });
    }

    console.log(`✅ ${tickets.length} tickets encontrados`);
    
    res.json({
      success: true,
      count: tickets.length,
      tickets: tickets
    });

  } catch (error) {
    console.error('❌ Erro ao buscar tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar tickets'
    });
  }
});

// Buscar ticket por ID
router.get('/:id', auth, async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findById(req.params.id)
      .populate('tankId', 'name deviceId')
      .populate('unitId', 'name location')
      .populate('reportedBy', 'username')
      .populate('assignedTo', 'username');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket não encontrado'
      });
    }

    res.json({
      success: true,
      ticket: ticket
    });

  } catch (error) {
    console.error('❌ Erro ao buscar ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar ticket'
    });
  }
});

// Atualizar ticket
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, assignedTo, resolutionNotes } = req.body;
    
    const updateData = {};
    if (status) updateData.status = status;
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
    
    if (status === 'resolved' || status === 'closed') {
      updateData.resolvedAt = new Date();
    }

    const ticket = await MaintenanceTicket.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('tankId', 'name deviceId')
     .populate('unitId', 'name location');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket não encontrado'
      });
    }

    console.log(`✅ Ticket atualizado: ${ticket.title}`);
    
    res.json({
      success: true,
      message: 'Ticket atualizado com sucesso',
      ticket: ticket
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar ticket'
    });
  }
});

// Excluir ticket
router.delete('/:id', auth, async (req, res) => {
  try {
    const ticket = await MaintenanceTicket.findByIdAndDelete(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket não encontrado'
      });
    }

    console.log(`🗑️ Ticket excluído: ${ticket.title}`);
    
    res.json({
      success: true,
      message: 'Ticket excluído com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao excluir ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir ticket'
    });
  }
});

// Criar ticket manualmente
router.post('/', auth, async (req, res) => {
  try {
    const { tankId, title, description, issueType, priority } = req.body;

    const Tank = require('../database/models/Tank');
    const tank = await Tank.findById(tankId).populate('unitId');

    if (!tank) {
      return res.status(404).json({
        success: false,
        message: 'Tanque não encontrado'
      });
    }

    const ticket = new MaintenanceTicket({
      unitId: tank.unitId._id,
      tankId: tankId,
      title: title,
      description: description,
      issueType: issueType,
      priority: priority || 'medium',
      status: 'open',
      reportedBy: req.user.id
    });

    await ticket.save();
    
    console.log(`✅ Ticket criado manualmente: ${title}`);
    
    res.status(201).json({
      success: true,
      message: 'Ticket criado com sucesso',
      ticket: ticket
    });

  } catch (error) {
    console.error('❌ Erro ao criar ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar ticket'
    });
  }
});

module.exports = router;
