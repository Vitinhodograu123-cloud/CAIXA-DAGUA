const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../database/models/User');
const PasswordResetToken = require('../database/models/PasswordResetToken');
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

// Solicitar recuperação de senha
router.post('/forgot-password', async (req, res) => {
  console.log('🎯 === ROTA FORGOT-PASSWORD INICIADA ===');
  console.log('📧 Dados recebidos:', JSON.stringify(req.body));
  console.log('🕒 Timestamp:', new Date().toISOString());
  
  try {
    const { username, email } = req.body;

    console.log('🔍 Validando dados...');
    if (!username || !email) {
      console.log('❌ Dados faltando - username ou email vazio');
      return res.status(400).json({
        success: false,
        message: 'Nome de usuário e email são obrigatórios'
      });
    }

    console.log(`🔍 Buscando usuário no banco: "${username}"`);
    
    // Encontre o usuário pelo username
    const user = await User.findOne({ username: username.trim() });
    console.log('✅ Busca no banco concluída');
    
    if (!user) {
      console.log('❌ Usuário não encontrado no banco');
      // Por segurança, não revele se o usuário existe ou não
      return res.json({
        success: true,
        message: 'Se o usuário e email estiverem corretos, você receberá um email de recuperação'
      });
    }

    console.log('✅ Usuário encontrado:', user.username);
    console.log('🔐 Gerando token...');
    
    // Gere um token único
    const resetToken = crypto.randomBytes(32).toString('hex');
    console.log('✅ Token gerado');
    
    console.log('💾 Salvando token no banco...');
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

    console.log('📤 Enviando email...');
    
    // Envie o email com timeout para evitar travamento
    const emailPromise = sendPasswordResetEmail(email, username, resetToken, resetUrl);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout no envio de email')), 15000)
    );

    try {
      const emailResult = await Promise.race([emailPromise, timeoutPromise]);
      
      if (!emailResult.success) {
        console.error('❌ Falha ao enviar email:', emailResult.error);
        // Mesmo com erro de email, retorne sucesso para o usuário
        console.log('⚠️  Email falhou, mas continuando o processo...');
      } else {
        console.log('✅ Email enviado com sucesso');
        if (emailResult.previewUrl) {
          console.log('🔗 Preview URL:', emailResult.previewUrl);
        }
      }

    } catch (emailError) {
      console.error('❌ Erro/Timeout no envio de email:', emailError);
      // Mesmo com erro, retorne sucesso para o usuário
      console.log('⚠️  Email com problemas, mas continuando...');
    }

    console.log('📨 Enviando resposta para o cliente...');
    res.json({
      success: true,
      message: 'Se o usuário e email estiverem corretos, você receberá um email de recuperação'
    });
    console.log('🎯 === ROTA FORGOT-PASSWORD FINALIZADA ===');

  } catch (error) {
    console.error('💥 ERRO CRÍTICO na recuperação de senha:', error);
    console.error('💥 Stack trace:', error.stack);
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

// Redefinir senha com token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

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
