const Unit = require('../database/models/Unit');

module.exports = {
  validateApiKey: async (req, res, next) => {
    try {
      console.log('🔐 Validando API Key...');
      const apiKey = req.header('X-API-Key');
      
      console.log('📨 Header recebido:', req.headers);
      console.log('🔑 API Key recebida:', apiKey);
      
      if (!apiKey) {
        console.log('❌ API Key não fornecida');
        return res.status(401).json({ message: 'API Key não fornecida' });
      }

      // Busca a unidade pela API Key
      console.log('🔍 Buscando unidade com API Key...');
      const unit = await Unit.findOne({ apiKey });
      
      if (!unit) {
        console.log('❌ API Key inválida - nenhuma unidade encontrada');
        return res.status(401).json({ message: 'API Key inválida' });
      }

      console.log('✅ API Key válida para unidade:', unit.name);
      
      // Adiciona a unidade ao request
      req.unit = unit;
      
      next();
    } catch (error) {
      console.error('💥 Erro na validação da API Key:', error);
      res.status(500).json({ message: 'Erro no servidor' });
    }
  },

  validateDeviceData: (req, res, next) => {
    console.log('📋 Validando dados do dispositivo...');
    console.log('📦 Dados recebidos:', req.body);
    
    const { device_id, water_level, temperature, vibration } = req.body;

    if (!device_id || water_level === undefined || !temperature || vibration === undefined) {
      console.log('❌ Dados inválidos ou incompletos');
      return res.status(400).json({ 
        message: 'Dados inválidos',
        required: ['device_id', 'water_level', 'temperature', 'vibration'],
        received: req.body
      });
    }

    console.log('✅ Dados do dispositivo válidos');
    next();
  }
};
