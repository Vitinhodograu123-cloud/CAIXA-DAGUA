const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../database/models/User');
const PasswordResetToken = require('../database/models/PasswordResetToken');
const { sendPasswordResetEmail } = require('../services/emailService');

const router = express.Router();

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
    // Envie o email
    const emailResult = await sendPasswordResetEmail(email, username, resetToken, resetUrl);

    if (!emailResult.success) {
      console.error('❌ Falha ao enviar email:', emailResult.error);
    } else {
      console.log('✅ Email enviado com sucesso');
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

// ... resto do código permanece igual
