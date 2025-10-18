const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');
const User = require('../database/models/User');

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Verifica se o usuário existe
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Verifica a senha
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Gera o token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'AcquaTrack_2024_Super_Secret_Key@123!',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Registro (apenas admin)
router.post('/register', auth, async (req, res) => {
  try {
    // Verifica se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const { username, password, role } = req.body;

    // Verifica se o usuário já existe
    let user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ message: 'Usuário já existe' });
    }

    // Cria o novo usuário
    user = new User({
      username,
      password: await bcrypt.hash(password, 12),
      role: role || 'user'
    });

    await user.save();

    res.status(201).json({ message: 'Usuário criado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Verificar token
router.get('/verify', auth, (req, res) => {
  res.json({ 
    user: {
      id: req.user._id,
      username: req.user.username,
      role: req.user.role
    }
  });
});

// Test endpoint - ADICIONE ESTAS LINHAS
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Auth route working',
    hasJwtSecret: !!process.env.JWT_SECRET,
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint para ver usuários
router.get('/debug-users', async (req, res) => {
  try {
    const users = await User.find({});
    console.log('Usuários no banco:', users);
    res.json({ 
      totalUsers: users.length,
      users: users.map(u => ({
        username: u.username,
        role: u.role,
        hasPassword: !!u.password
      }))
    });
  } catch (error) {
    console.error('Erro no debug:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug login detalhado
router.post('/debug-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('🔐 Tentativa de login para:', username);
    
    // Busca usuário
    const user = await User.findOne({ username });
    console.log('👤 Usuário encontrado:', user ? 'SIM' : 'NÃO');
    
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    
    // Verifica senha
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('🔑 Senha correta:', isMatch);
    console.log('📝 Hash no banco:', user.password);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }
    
    // Verifica JWT
    console.log('🔐 JWT_SECRET existe:', !!process.env.JWT_SECRET);
    
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'AcquaTrack_2024_Super_Secret_Key@123!',
      { expiresIn: '24h' }
    );
    
    console.log('✅ Login bem-sucedido!');
    res.json({ 
      success: true, 
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;


