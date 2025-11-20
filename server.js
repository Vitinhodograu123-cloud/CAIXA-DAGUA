const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const passwordResetRoutes = require('./routes/passwordReset');
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
        'http://192.168.100.120:3000',
        'null'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
app.use(express.json());
app.use(express.static('public'));
app.use('/api/auth', passwordResetRoutes);
app.use('/api/auth', require('./routes/passwordReset'));

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
        console.log('📋 Buscando unidades para usuário...');
        
        // Verificar autenticação
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Não autenticado' });
        }

        let userId;
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
            userId = decoded.userId;
        } catch (authError) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        // Buscar usuário com suas unidades
        const User = require('./database/models/User');
        const user = await User.findById(userId).populate('units');
        
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        console.log(`✅ Usuário ${user.username} tem ${user.units.length} unidades`);

        // Retorna APENAS as unidades do usuário
        res.json(user.units);
        
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
// POST /api/units/create - ⭐⭐ ATUALIZADA ⭐⭐
app.post('/api/units/create', async (req, res) => {
    try {
        const { name, type, location, numberOfSensors, description, calibration } = req.body;
        
        console.log('🎯 Criando nova unidade para usuário...');

        // Verificar autenticação
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ success: false, error: 'Não autenticado' });
        }

        let userId;
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
            userId = decoded.userId;
        } catch (authError) {
            return res.status(401).json({ success: false, error: 'Token inválido' });
        }

        // Buscar usuário
        const User = require('./database/models/User');
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
        }

        // Verifica se já existe uma unidade com este nome
        const existingUnit = await Unit.findOne({ name });
        if (existingUnit) {
            return res.status(400).json({ success: false, error: 'Já existe uma unidade com este nome' });
        }

        // ⭐⭐ FUNÇÃO AUXILIAR (mantém como fallback) ⭐⭐
        function generateDefaultCalibration(sensorCount) {
            const calibration = [];
            for (let i = 1; i <= sensorCount; i++) {
                const percentage = Math.round((i / sensorCount) * 100);
                calibration.push({
                    percentage: percentage,
                    liters: i * 250,
                    sensorCount: i
                });
            }
            return calibration;
        }

        // Cria uma nova unidade
        // ⭐⭐ ATUALIZE A CRIAÇÃO DA UNIDADE - Usa a calibração enviada ⭐⭐
        const unit = new Unit({
            name,
            type,
            location,
            numberOfSensors: parseInt(numberOfSensors) || 4,
            description: description || `${type} em ${location}`,
            apiKey: require('crypto').randomBytes(32).toString('hex'),
            createdBy: userId,
            // ⭐⭐ USA A CALIBRAÇÃO ENVIADA PELO FORMULÁRIO OU GERA UMA PADRÃO ⭐⭐
            calibration: calibration || generateDefaultCalibration(parseInt(numberOfSensors) || 4)
        });

        await unit.save();

        // ASSOCIA A UNIDADE AO USUÁRIO QUE A CRIOU
        await User.findByIdAndUpdate(
            userId,
            { $addToSet: { units: unit._id } }
        );

        console.log(`✅ Nova unidade criada por ${user.username}: ${unit.name}`);
        console.log(`📊 Calibração configurada:`, unit.calibration);

        // Emitir evento via Socket.io
        io.emit('newUnit', { unitId: unit._id });

        res.json({
            success: true,
            unit: {
                _id: unit._id,
                name: unit.name,
                type: unit.type,
                location: unit.location,
                apiEndpoint: '/api/units/data',
                apiToken: unit.apiKey,
                calibration: unit.calibration // ⭐⭐ INCLUI A CALIBRAÇÃO NA RESPOSTA ⭐⭐
            }
        });
    } catch (error) {
        console.error('❌ Erro ao criar unidade:', error);
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

app.get('/api/migrate-units', async (req, res) => {
    try {
        const User = require('./database/models/User');
        const Unit = require('./database/models/Unit');
        
        console.log('🔄 Migrando unidades para multitenant...');
        
        // Buscar todas as unidades existentes
        const units = await Unit.find({});
        const adminUser = await User.findOne({ username: 'admin' });
        
        if (!adminUser) {
            return res.json({ error: 'Usuário admin não encontrado' });
        }
        
        let migrated = 0;
        
        // Associar cada unidade ao admin e adicionar createdBy
        for (let unit of units) {
            if (!unit.createdBy) {
                unit.createdBy = adminUser._id;
                await unit.save();
                
                // Adicionar à lista de unidades do admin
                await User.findByIdAndUpdate(
                    adminUser._id,
                    { $addToSet: { units: unit._id } }
                );
                
                migrated++;
            }
        }
        
        res.json({ 
            message: `✅ ${migrated} unidades migradas para o usuário admin`,
            admin: adminUser.username,
            totalUnits: units.length
        });
        
    } catch (error) {
        console.error('❌ Erro na migração:', error);
        res.status(500).json({ error: 'Erro na migração' });
    }
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

// =============================================
// ROTAS PARA O PAINEL DE ADMINISTRAÇÃO
// =============================================

// GET /api/admin/users - Listar todos os usuários (apenas admin)
app.get('/api/admin/users', async (req, res) => {
    try {
        console.log('📋 Admin: Listando todos os usuários...');
        
        // Verificar autenticação e permissão de admin
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Não autenticado' });
        }

        let userId;
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
            userId = decoded.userId;
        } catch (authError) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        // Verificar se o usuário é admin
        const User = require('./database/models/User');
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }

        // Buscar todos os usuários
        const users = await User.find({})
            .select('-password') // Não retornar senhas
            .populate('units', 'name location type')
            .populate('base', 'name');

        console.log(`✅ Admin: ${users.length} usuários encontrados`);
        res.json(users);
        
    } catch (error) {
        console.error('❌ Erro ao listar usuários (admin):', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

// GET /api/admin/units - Listar todas as unidades (apenas admin)
app.get('/api/admin/units', async (req, res) => {
    try {
        console.log('🏭 Admin: Listando todas as unidades...');
        
        // Verificar autenticação e permissão de admin
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Não autenticado' });
        }

        let userId;
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
            userId = decoded.userId;
        } catch (authError) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        // Verificar se o usuário é admin
        const User = require('./database/models/User');
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }

        // Buscar todas as unidades
        const units = await Unit.find({})
            .populate('createdBy', 'username')
            .sort({ createdAt: -1 });

        console.log(`✅ Admin: ${units.length} unidades encontradas`);
        res.json(units);
        
    } catch (error) {
        console.error('❌ Erro ao listar unidades (admin):', error);
        res.status(500).json({ error: 'Erro ao listar unidades' });
    }
});

// POST /api/admin/users - Criar novo usuário (apenas admin)
app.post('/api/admin/users', async (req, res) => {
    try {
        console.log('👤 Admin: Criando novo usuário...');
        
        const { username, password, role } = req.body;

        // Verificar autenticação e permissão de admin
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Não autenticado' });
        }

        let adminId;
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
            adminId = decoded.userId;
        } catch (authError) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        // Verificar se o usuário é admin
        const User = require('./database/models/User');
        const adminUser = await User.findById(adminId);
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }

        // Validar dados
        if (!username || !password) {
            return res.status(400).json({ error: 'Username e senha são obrigatórios' });
        }

        // Verificar se usuário já existe
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Usuário já existe' });
        }

        // Criar novo usuário
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = new User({
            username,
            password: hashedPassword,
            role: role || 'user',
            units: [],
            createdAt: new Date()
        });

        await newUser.save();

        console.log(`✅ Admin: Usuário "${username}" criado com sucesso por ${adminUser.username}`);

        res.json({
            success: true,
            user: {
                _id: newUser._id,
                username: newUser.username,
                role: newUser.role,
                createdAt: newUser.createdAt
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao criar usuário (admin):', error);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// POST /api/admin/assign-unit - Associar unidade a usuário (apenas admin)
app.post('/api/admin/assign-unit', async (req, res) => {
    try {
        console.log('🔗 Admin: Associando unidade a usuário...');
        
        const { userId, unitId } = req.body;

        // Verificar autenticação e permissão de admin
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Não autenticado' });
        }

        let adminId;
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
            adminId = decoded.userId;
        } catch (authError) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        // Verificar se o usuário é admin
        const User = require('./database/models/User');
        const adminUser = await User.findById(adminId);
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }

        // Verificar se usuário e unidade existem
        const user = await User.findById(userId);
        const unit = await Unit.findById(unitId);

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        if (!unit) {
            return res.status(404).json({ error: 'Unidade não encontrada' });
        }

        // Associar unidade ao usuário
        await User.findByIdAndUpdate(
            userId,
            { $addToSet: { units: unitId } }
        );

        console.log(`✅ Admin: Unidade "${unit.name}" associada ao usuário "${user.username}" por ${adminUser.username}`);

        res.json({
            success: true,
            message: `Unidade "${unit.name}" associada ao usuário "${user.username}"`
        });
        
    } catch (error) {
        console.error('❌ Erro ao associar unidade (admin):', error);
        res.status(500).json({ error: 'Erro ao associar unidade' });
    }
});

// GET /api/admin/stats - Estatísticas do sistema (apenas admin)
app.get('/api/admin/stats', async (req, res) => {
    try {
        console.log('📊 Admin: Gerando estatísticas...');
        
        // Verificar autenticação e permissão de admin
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Não autenticado' });
        }

        let userId;
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
            userId = decoded.userId;
        } catch (authError) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        // Verificar se o usuário é admin
        const User = require('./database/models/User');
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }

        // Buscar estatísticas
        const totalUsers = await User.countDocuments();
        const adminUsers = await User.countDocuments({ role: 'admin' });
        const totalUnits = await Unit.countDocuments();
        
        // Usuários com unidades
        const usersWithUnits = await User.countDocuments({
            units: { $exists: true, $not: { $size: 0 } }
        });

        // Unidades online
        const onlineUnits = await Unit.countDocuments({ isOnline: true });

        console.log(`✅ Admin: Estatísticas geradas - ${totalUsers} usuários, ${totalUnits} unidades`);

        res.json({
            totalUsers,
            adminUsers,
            totalUnits,
            onlineUnits,
            usersWithUnits,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('❌ Erro ao gerar estatísticas (admin):', error);
        res.status(500).json({ error: 'Erro ao gerar estatísticas' });
    }
});

// GET /api/admin/diagnostic - Diagnóstico do sistema (apenas admin)
app.get('/api/admin/diagnostic', async (req, res) => {
    try {
        console.log('🩺 Admin: Executando diagnóstico...');
        
        // Verificar autenticação e permissão de admin
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Não autenticado' });
        }

        let userId;
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
            userId = decoded.userId;
        } catch (authError) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        // Verificar se o usuário é admin
        const User = require('./database/models/User');
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }

        // Coletar dados para diagnóstico
        const users = await User.find({});
        const units = await Unit.find({});
        
        const issues = [];
        
        // Verificar problemas
        if (users.length === 0) {
            issues.push('Nenhum usuário cadastrado no sistema');
        }
        
        if (units.length === 0) {
            issues.push('Nenhuma unidade cadastrada no sistema');
        }
        
        // Verificar usuários sem role
        const usersWithoutRole = users.filter(u => !u.role);
        if (usersWithoutRole.length > 0) {
            issues.push(`${usersWithoutRole.length} usuários sem role definida`);
        }
        
        // Verificar unidades sem createdBy
        const unitsWithoutOwner = units.filter(u => !u.createdBy);
        if (unitsWithoutOwner.length > 0) {
            issues.push(`${unitsWithoutOwner.length} unidades sem proprietário definido`);
        }

        console.log(`✅ Admin: Diagnóstico completo - ${issues.length} problemas encontrados`);

        res.json({
            usersCount: users.length,
            unitsCount: units.length,
            onlineUnits: units.filter(u => u.isOnline).length,
            issues,
            database: 'MongoDB',
            status: issues.length === 0 ? 'healthy' : 'needs_attention',
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('❌ Erro no diagnóstico (admin):', error);
        res.status(500).json({ error: 'Erro no diagnóstico do sistema' });
    }
});

// DELETE /api/admin/users/:id - Deletar usuário (apenas admin)
app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        console.log('🗑️ Admin: Deletando usuário...');
        
        const userId = req.params.id;

        // Verificar autenticação e permissão de admin
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Não autenticado' });
        }

        let adminId;
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
            adminId = decoded.userId;
        } catch (authError) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        // Verificar se o usuário é admin
        const User = require('./database/models/User');
        const adminUser = await User.findById(adminId);
        if (!adminUser || adminUser.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }

        // Não permitir deletar a si mesmo
        if (userId === adminId) {
            return res.status(400).json({ error: 'Não é possível deletar seu próprio usuário' });
        }

        // Buscar e deletar usuário
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        await User.findByIdAndDelete(userId);

        console.log(`✅ Admin: Usuário "${user.username}" deletado por ${adminUser.username}`);

        res.json({
            success: true,
            message: `Usuário "${user.username}" deletado com sucesso`
        });
        
    } catch (error) {
        console.error('❌ Erro ao deletar usuário (admin):', error);
        res.status(500).json({ error: 'Erro ao deletar usuário' });
    }
});

// =============================================
// FIM DAS ROTAS DO ADMIN
// =============================================

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














