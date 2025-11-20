const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../database/models/User');
const PasswordResetToken = require('../database/models/PasswordResetToken');
const PasswordChangeLog = require('../database/models/PasswordChangeLog');
const { sendPasswordResetEmail } = require('../services/emailService');

const router = express.Router();

// Rota de teste rápida
router.post('/test-forgot', async (req, res) => {
  console.log('🎯 TESTE: Rota /test-forgot acessada');
  console.log('Dados recebidos:', req.body);
  
  // Resposta rápida para teste
  res.json({
    success: true,
    message: 'Rota de teste funcionando!',
    data: req.body,
    timestamp: new Date().toISOString()
  });
});

// Solicitar recuperação de senha - VERSÃO RÁPIDA
router.post('/forgot-password', async (req, res) => {
  console.log('🎯 === ROTA FORGOT-PASSWORD INICIADA (VERSÃO RÁPIDA) ===');
  console.log('📧 Dados recebidos:', JSON.stringify(req.body));
  
  try {
    const { username, email } = req.body;

    console.log('🔍 Validando dados...');
    if (!username || !email) {
      return res.status(400).json({
        success: false,
        message: 'Nome de usuário e email são obrigatórios'
      });
    }

    console.log(`🔍 Buscando usuário: "${username}"`);
    const user = await User.findOne({ username: username.trim() });
    
    if (!user) {
      console.log('❌ Usuário não encontrado');
      return res.json({
        success: true,
        message: 'Se o usuário e email estiverem corretos, você receberá um email de recuperação'
      });
    }

    console.log('✅ Usuário encontrado:', user.username);
    
    // Gere um token único
    const resetToken = crypto.randomBytes(32).toString('hex');
    console.log('✅ Token gerado');
    
    // Salve o token no banco de dados
    await PasswordResetToken.create({
      userId: user._id,
      username: user.username,
      token: resetToken
    });
    console.log('✅ Token salvo no banco');

    // Construa a URL de reset
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;
    console.log('🔗 URL de reset gerada:', resetUrl);

    // ✅ VERSÃO RÁPIDA: Retorna o link diretamente
    console.log('📨 Enviando resposta COM LINK...');
    res.json({
      success: true,
      message: 'Link de recuperação gerado com sucesso!',
      resetUrl: resetUrl, // 🔥 ENVIA O LINK DIRETAMENTE
      instructions: 'Clique no botão abaixo para redefinir sua senha:'
    });

  } catch (error) {
    console.error('💥 ERRO CRÍTICO:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Verificar token válido
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    console.log('🔍 Verificando token:', token);

    const resetToken = await PasswordResetToken.findOne({ 
      token,
      expiresAt: { $gt: new Date() }
    }).populate('userId');

    if (!resetToken) {
      console.log('❌ Token inválido ou expirado');
      return res.status(400).json({
        success: false,
        message: 'Token inválido ou expirado'
      });
    }

    console.log('✅ Token válido para usuário:', resetToken.username);
    res.json({
      success: true,
      username: resetToken.username
    });

  } catch (error) {
    console.error('💥 Erro ao verificar token:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Redefinir senha com token - ATUALIZADA PARA REGISTRAR NO LOG
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword, email } = req.body; // Adiciona email no body

    console.log('🔄 Iniciando redefinição de senha...');

    if (!token || !newPassword) {
      console.log('❌ Token ou senha não fornecidos');
      return res.status(400).json({
        success: false,
        message: 'Token e nova senha são obrigatórios'
      });
    }

    if (newPassword.length < 6) {
      console.log('❌ Senha muito curta');
      return res.status(400).json({
        success: false,
        message: 'A senha deve ter pelo menos 6 caracteres'
      });
    }

    console.log('🔍 Buscando token válido...');
    // Encontre o token válido
    const resetToken = await PasswordResetToken.findOne({ 
      token,
      expiresAt: { $gt: new Date() }
    }).populate('userId');

    if (!resetToken) {
      console.log('❌ Token inválido ou expirado');
      return res.status(400).json({
        success: false,
        message: 'Token inválido ou expirado'
      });
    }

    console.log('✅ Token válido encontrado para:', resetToken.username);
    console.log('🔐 Gerando hash da nova senha...');

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    console.log('💾 Atualizando senha do usuário...');
    // Atualize a senha do usuário
    await User.findByIdAndUpdate(resetToken.userId._id, {
      password: hashedPassword
    });

    // ✅ REGISTRAR A TROCA DE SENHA NO LOG
    console.log('📝 Registrando troca de senha no log...');
    await PasswordChangeLog.create({
      userId: resetToken.userId._id,
      username: resetToken.username,
      email: email || 'Não informado', // Usa o email fornecido ou padrão
      changeType: 'reset',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    });

    console.log('🧹 Limpando tokens...');
    // Delete o token usado
    await PasswordResetToken.deleteOne({ _id: resetToken._id });

    // Delete todos os tokens antigos deste usuário
    await PasswordResetToken.deleteMany({ userId: resetToken.userId._id });

    console.log('✅ Senha redefinida com sucesso para:', resetToken.username);
    res.json({
      success: true,
      message: 'Senha redefinida com sucesso!'
    });

  } catch (error) {
    console.error('💥 Erro ao redefinir senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota para visualizar logs de troca de senha (apenas para admin)
router.get('/change-logs', async (req, res) => {
  try {
    console.log('📋 Buscando logs de troca de senha...');
    
    const logs = await PasswordChangeLog.find({})
      .populate('userId', 'username')
      .sort({ createdAt: -1 })
      .limit(50);

    console.log(`✅ ${logs.length} logs encontrados`);
    res.json({
      success: true,
      logs: logs
    });

  } catch (error) {
    console.error('💥 Erro ao buscar logs:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Rota de teste
router.get('/test', (req, res) => {
  console.log('✅ Rota de teste funcionando');
  res.json({
    success: true,
    message: 'Rota de passwordReset funcionando!',
    timestamp: new Date().toISOString()
  });
});

// ✅ EXPORTAÇÃO CORRETA - APENAS O ROUTER
module.exports = router;
