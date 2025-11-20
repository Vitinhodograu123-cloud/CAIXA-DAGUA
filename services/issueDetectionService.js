const MaintenanceTicket = require('../database/models/MaintenanceTicket');
const Reading = require('../database/models/Reading');

class IssueDetectionService {
  // Detectar problemas baseados nas leituras
  async detectIssues(tankId, readingData) {
    const issues = [];
    
    // Verificar vibração excessiva
    if (readingData.vibrationCount > 10) {
      issues.push({
        type: 'vibration',
        priority: 'high',
        title: 'Vibração excessiva detectada',
        description: `O tanque apresentou ${readingData.vibrationCount} vibrações. Pode indicar problemas estruturais ou na instalação.`
      });
    }

    // Verificar nível de água baixo
    if (readingData.waterLevel < 20) {
      issues.push({
        type: 'low_water',
        priority: 'critical',
        title: 'Nível de água crítico',
        description: `Nível de água está em ${readingData.waterLevel}%. Pode afetar o funcionamento do sistema.`
      });
    }

    // Verificar temperatura alta
    if (readingData.temperature > 40) {
      issues.push({
        type: 'high_temperature',
        priority: 'medium',
        title: 'Temperatura elevada',
        description: `Temperatura está em ${readingData.temperature}°C. Pode indicar problemas no sistema.`
      });
    }

    // Verificar se há tickets abertos recentemente para evitar duplicação
    for (const issue of issues) {
      const existingTicket = await MaintenanceTicket.findOne({
        tankId: tankId,
        issueType: issue.type,
        status: { $in: ['open', 'in_progress'] },
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Últimas 24 horas
      });

      if (!existingTicket) {
        await this.createTicket(tankId, issue, readingData);
      }
    }

    return issues;
  }

  // Criar ticket de manutenção
  async createTicket(tankId, issue, readingData) {
    try {
      // Buscar informações do tanque
      const Tank = require('../database/models/Tank');
      const tank = await Tank.findById(tankId).populate('unitId');
      
      const ticket = new MaintenanceTicket({
        unitId: tank.unitId._id,
        tankId: tankId,
        title: issue.title,
        description: issue.description,
        issueType: issue.type,
        priority: issue.priority,
        status: 'open',
        readingsData: {
          waterLevel: readingData.waterLevel,
          temperature: readingData.temperature,
          vibration: readingData.vibration,
          vibrationCount: readingData.vibrationCount,
          timestamp: new Date()
        }
      });

      await ticket.save();
      console.log(`✅ Ticket criado: ${issue.title} para tanque ${tank.name}`);
      
      return ticket;
    } catch (error) {
      console.error('❌ Erro ao criar ticket:', error);
      throw error;
    }
  }

  // Buscar tickets por unidade
  async getTicketsByUnit(unitId, filters = {}) {
    const query = { unitId };
    
    if (filters.status) query.status = filters.status;
    if (filters.issueType) query.issueType = filters.issueType;
    if (filters.priority) query.priority = filters.priority;

    const tickets = await MaintenanceTicket.find(query)
      .populate('tankId', 'name deviceId')
      .populate('unitId', 'name location')
      .populate('reportedBy', 'username')
      .populate('assignedTo', 'username')
      .sort({ createdAt: -1 });

    return tickets;
  }
}

module.exports = new IssueDetectionService();
