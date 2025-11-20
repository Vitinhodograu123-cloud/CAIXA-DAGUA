const express = require('express');
const router = express.Router();
const Tank = require('../database/models/Tank');
const Reading = require('../database/models/Reading');
const { validateApiKey, validateDeviceData } = require('../middleware/validation');

// Receber dados do ESP32
router.post('/receive', validateApiKey, validateDeviceData, async (req, res) => {
  try {
    console.log('📥 Dados recebidos do ESP32:', req.body);
    console.log('🏭 Unidade:', req.unit.name);

    const { device_id, water_level, temperature, vibration, vibration_count, boias } = req.body;

    // Busca o tanque pelo device_id
    let tank = await Tank.findOne({ deviceId: device_id });
    console.log('🔍 Tanque encontrado:', tank ? tank.name : 'Não encontrado, criando novo...');

    if (!tank) {
      // Se o tanque não existe, cria um novo
      tank = new Tank({
        unitId: req.unit._id,
        deviceId: device_id,
        name: `Tanque ${device_id}`,
        totalCapacity: 1000, // Valor padrão
        numberOfSensors: boias ? boias.length : 1
      });
      await tank.save();
      console.log('✅ Novo tanque criado:', tank.name);

      // Adiciona o tanque à unidade
      await req.unit.updateOne({ $push: { tanks: tank._id } });
      console.log('✅ Tanque adicionado à unidade');
    }

    // Cria nova leitura
    const reading = new Reading({
      tankId: tank._id,
      waterLevel: water_level,
      temperature: temperature,
      vibration: vibration,
      vibrationCount: vibration_count || 0,
      sensorStates: boias ? boias.map(b => b.estado === 'ativo') : []
    });

    await reading.save();
    console.log('✅ Leitura salva no banco');

    // Atualiza última leitura do tanque
    await Tank.findByIdAndUpdate(tank._id, {
      lastReading: {
        waterLevel: water_level,
        temperature: temperature,
        vibration: vibration,
        vibrationCount: vibration_count || 0,
        timestamp: new Date()
      }
    });
    console.log('✅ Última leitura atualizada');

    res.status(201).json({ 
      success: true,
      message: 'Dados recebidos e processados com sucesso',
      tankId: tank._id,
      readingId: reading._id
    });

  } catch (error) {
    console.error('❌ Erro ao processar dados:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro ao processar dados',
      error: error.message 
    });
  }
});

// Buscar histórico de leituras
router.get('/:tankId/history', async (req, res) => {
  try {
    const { start, end } = req.query;
    const query = { tankId: req.params.tankId };

    if (start || end) {
      query.timestamp = {};
      if (start) query.timestamp.$gte = new Date(start);
      if (end) query.timestamp.$lte = new Date(end);
    }

    const readings = await Reading.find(query)
      .sort({ timestamp: -1 })
      .limit(1000);

    res.json({
      success: true,
      count: readings.length,
      readings: readings
    });
  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro ao buscar histórico' 
    });
  }
});

module.exports = router;
