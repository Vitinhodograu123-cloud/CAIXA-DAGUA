const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configuração do Socket.io para produção
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ["https://acquatrack.onrender.com"]
      : "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
// Configuração de CORS para produção
app.use(cors({
    origin: [
        'https://acquatrack.onrender.com',
        'http://localhost:3000',
        'http://192.168.100.120:3000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
app.use(express.json());
app.use(express.static('public'));

// Conexão com MongoDB - Versão para Render
const connectDB = async () => {
    try {
        // No Render, use a variável de ambiente MONGODB_URI
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/watertank';
        
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB conectado com sucesso');
    } catch (err) {
        console.error('Erro ao conectar ao MongoDB:', err.message);
        process.exit(1);
    }
};

// Conectar ao MongoDB
connectDB();

// Importar modelos (apenas os necessários para este arquivo)
const Unit = require('./database/models/Unit');
const UnitData = require('./database/models/UnitData');

// Rotas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/units', require('./routes/units'));
app.use('/api/readings', require('./routes/readings'));
app.use('/api/units', require('./routes/unitData'));
app.use('/api/bases', require('./routes/bases'));
app.use('/api/users', require('./routes/users'));

// =============================================
// ROTAS ADICIONAIS PARA O DASHBOARD - ADICIONE AQUI
// =============================================

// GET /api/units/list - Listar todas as unidades
app.get('/api/units/list', async (req, res) => {
    try {
        console.log('📋 Buscando unidades para dashboard...');
        
        // Verificar autenticação
        const token = req.headers.authorization?.replace('Bearer ', '');
        let userUnits = [];
        
        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
                
                // Buscar o usuário para pegar suas unidades
                const User = require('./database/models/User');
                const user = await User.findById(decoded.userId);
                
                if (user && user.units) {
                    userUnits = user.units;
                    console.log(`✅ Usuário ${user.username} tem ${user.units.length} unidades`);
                }
            } catch (authError) {
                console.log('⚠️  Token inválido');
            }
        }

        // Se o usuário tem unidades específicas, filtra por elas
        // Se não tem unidades (array vazio) ou é admin, mostra todas
        let units;
        if (userUnits.length > 0) {
            units = await Unit.find({ _id: { $in: userUnits } });
            console.log(`🔍 Filtrando ${units.length} unidades do usuário`);
        } else {
            units = await Unit.find({});
            console.log(`🔍 Mostrando TODAS as ${units.length} unidades (usuário sem unidades específicas)`);
        }
        
        res.json(units);
    } catch (error) {
        console.error('❌ Erro ao listar unidades:', error);
        res.status(500).json({ error: 'Erro ao listar unidades' });
    }
});

// ROTA TEMPORÁRIA - Listar TODAS as unidades (sem autenticação)
app.get('/api/units/all', async (req, res) => {
    try {
        const units = await Unit.find({});
        console.log('📋 Unidades encontradas:', units.length);
        res.json(units);
    } catch (error) {
        console.error('Erro ao listar unidades:', error);
        res.status(500).json({ error: 'Erro ao listar unidades' });
    }
});

// POST /api/units/create - Criar nova unidade
app.post('/api/units/create', async (req, res) => {
    try {
        const { name, type, location } = req.body;
        
        // Verifica se já existe uma unidade com este nome
        const existingUnit = await Unit.findOne({ name });
        if (existingUnit) {
            return res.status(400).json({ success: false, error: 'Já existe uma unidade com este nome' });
        }

        // Cria uma nova unidade
        const unit = new Unit({
            name,
            type,
            location,
            description: `${type} em ${location}`,
            apiKey: require('crypto').randomBytes(32).toString('hex')
        });

        await unit.save();

        // Emitir evento via Socket.io para atualizar todos os clientes
        const io = req.app.get('io');
        io.emit('newUnit', { unitId: unit._id });

        res.json({
            success: true,
            unit: {
                _id: unit._id,
                name: unit.name,
                type: unit.type,
                location: unit.location,
                apiEndpoint: '/api/units/data',
                apiToken: unit.apiKey
            }
        });
    } catch (error) {
        console.error('Erro ao criar unidade:', error);
        res.status(500).json({ success: false, error: 'Erro ao criar unidade' });
    }
});

// GET /api/units/:id/data - Buscar dados de uma unidade específica
app.get('/api/units/:id/data', async (req, res) => {
    try {
        const unitId = req.params.id;
        
        // Busca os dados mais recentes da unidade
        const latestData = await UnitData.findOne({ unitId })
            .sort({ timestamp: -1 });
        
        if (!latestData) {
            return res.json({
                waterLevel: 0,
                temperature: 0,
                isVibrating: false,
                isLowLevel: false,
                isHighTemp: false
            });
        }

        res.json({
            waterLevel: latestData.waterLevel || 0,
            temperature: latestData.temperature || 0,
            isVibrating: latestData.isVibrating || false,
            isLowLevel: latestData.waterLevel < 20,
            isHighTemp: latestData.temperature > 40
        });
    } catch (error) {
        console.error('Erro ao buscar dados da unidade:', error);
        res.status(500).json({ error: 'Erro ao buscar dados' });
    }
});

// =============================================
// FIM DAS ROTAS DO DASHBOARD
// =============================================

// Health check endpoint (OBRIGATÓRIO para Render)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        message: 'Servidor funcionando',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Página inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint para gerenciar unidades
app.get('/manage-units', async (req, res) => {
  try {
    const units = await Unit.find({});
    res.send(`
      <html>
        <head>
          <title>Gerenciar Unidades</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
            .delete-btn { background-color: #ff4444; color: white; border: none; padding: 5px 10px; cursor: pointer; }
            .create-btn { background-color: #44aa44; color: white; border: none; padding: 10px 20px; cursor: pointer; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Gerenciar Unidades</h1>
          <button class="create-btn" onclick="window.location.href='/create-test-unit'">Criar Nova Unidade</button>
          <table>
            <tr>
              <th>Nome</th>
              <th>Local</th>
              <th>Tipo</th>
              <th>API Key</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
            ${units.map(unit => `
              <tr>
                <td>${unit.name}</td>
                <td>${unit.location}</td>
                <td>${unit.type}</td>
                <td>${unit.apiKey}</td>
                <td>${unit.isOnline ? 'Online' : 'Offline'}</td>
                <td>
                  <button class="delete-btn" onclick="deleteUnit('${unit._id}', '${unit.name}')">Apagar</button>
                </td>
              </tr>
            `).join('')}
          </table>

          <script>
            function deleteUnit(id, name) {
              if (confirm('Tem certeza que deseja apagar a unidade ' + name + '?')) {
                fetch('/delete-unit/' + id, { method: 'DELETE' })
                  .then(response => response.json())
                  .then(data => {
                    if (data.success) {
                      alert('Unidade apagada com sucesso!');
                      window.location.reload();
                    } else {
                      alert('Erro ao apagar unidade: ' + data.error);
                    }
                  })
                  .catch(error => alert('Erro ao apagar unidade: ' + error));
              }
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Erro ao listar unidades:', error);
    res.status(500).json({ error: 'Erro ao listar unidades' });
  }
});

// Endpoint para apagar unidade
app.delete('/delete-unit/:id', async (req, res) => {
  try {
    console.log('Tentando apagar unidade:', req.params.id);
    
    // Primeiro apaga os dados históricos
    console.log('Apagando dados históricos...');
    await UnitData.deleteMany({ unitId: req.params.id });
    
    // Depois apaga a unidade
    console.log('Apagando unidade...');
    const unit = await Unit.findByIdAndDelete(req.params.id);
    
    if (!unit) {
      console.log('Unidade não encontrada');
      return res.status(404).json({ success: false, error: 'Unidade não encontrada' });
    }
    
    console.log('Unidade apagada com sucesso:', unit.name);
    res.json({ success: true, message: 'Unidade apagada com sucesso' });
  } catch (error) {
    console.error('Erro ao apagar unidade:', error);
    res.status(500).json({ success: false, error: 'Erro ao apagar unidade' });
  }
});

// Endpoint temporário para criar unidade de teste
app.get('/create-test-unit', async (req, res) => {
  try {
    // Verifica se já existe uma unidade de teste
    let unit = await Unit.findOne({ name: "THE ONE pa" });
    
    if (!unit) {
      // Cria uma nova unidade
      unit = new Unit({
        name: "THE ONE pa",
        description: "Unidade de teste",
        location: "THE ONE",
        type: "CAIXA",
        numberOfSensors: 1,
        apiKey: require('crypto').randomBytes(32).toString('hex')
      });
      await unit.save();
      console.log('Nova unidade criada:', unit);
    }
    
    // URL dinâmica para produção
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `https://${req.get('host')}`
      : `http://192.168.100.120:${process.env.PORT || 3000}`;
    
    res.json({
      message: 'Configure o ESP32 com:',
      api_url: `${baseUrl}/api/units/data`,
      api_token: unit.apiKey
    });
  } catch (error) {
    console.error('Erro ao criar unidade:', error);
    res.status(500).json({ error: 'Erro ao criar unidade' });
  }
});

// Verificar conexões das unidades periodicamente
setInterval(async () => {
  try {
    const offlineThreshold = new Date(Date.now() - 2 * 60 * 1000);
    await Unit.updateMany(
      { lastUpdate: { $lt: offlineThreshold } },
      { isOnline: false }
    );
  } catch (error) {
    console.error('Erro ao verificar status das unidades:', error);
  }
}, 30000);

// WebSocket para atualizações em tempo real
io.on('connection', (socket) => {
  console.log('Cliente conectado');

  socket.on('join-tank', (tankId) => {
    socket.join(`tank-${tankId}`);
  });

  socket.on('leave-tank', (tankId) => {
    socket.leave(`tank-${tankId}`);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

// Exporta io para ser usado em outras partes da aplicação
app.set('io', io);

// Inicia o servidor
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  
  if (process.env.NODE_ENV === 'production') {
    console.log('✅ Ambiente de PRODUÇÃO');
  } else {
    console.log('🔧 Ambiente de DESENVOLVIMENTO');
  }
});

module.exports = app;




