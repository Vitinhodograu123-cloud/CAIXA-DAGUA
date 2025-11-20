const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../database/models/User');
const PasswordResetToken = require('../database/models/PasswordResetToken');
const { sendPasswordResetEmail } = require('../services/emailService');

const router = express.Router();

// Solicitar recuperação de senha
router.post('/forgot-password', async (req, res) => {
  try {
    const { username, email } = req.body;

    if (!username || !email) {
      return res.status(400).json({
        success: false,
        message: 'Nome de usuário e email são obrigatórios'
      });
    }

    // Encontre o usuário pelo username
    const user = await User.findOne({ username });
    if (!user) {
      // Por segurança, não revele se o usuário existe ou não
      return res.json({
        success: true,
        message: 'Se o usuário e email estiverem corretos, você receberá um email de recuperação'
      });
    }

    // Aqui você pode adicionar uma verificação adicional se tiver email no usuário
    // Por enquanto, vamos confiar que o usuário forneceu o email correto

    // Gere um token único
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Salve o token no banco de dados
    await PasswordResetToken.create({
      userId: user._id,
      username: user.username,
      token: resetToken
    });

    // Construa a URL de reset
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;

    // Envie o email
    const emailResult = await sendPasswordResetEmail(email, username, resetToken, resetUrl);

    if (!emailResult.success) {
      console.error('Falha ao enviar email:', emailResult.error);
      // Não retorne erro ao usuário para não revelar informações
    }

    res.json({
      success: true,
      message: 'Se o usuário e email estiverem corretos, você receberá um email de recuperação'
    });

  } catch (error) {
    console.error('Erro na recuperação de senha:', error);
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

    const resetToken = await PasswordResetToken.findOne({ 
      token,
      expiresAt: { $gt: new Date() }
    }).populate('userId');

    if (!resetToken) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido ou expirado'
      });
    }

    res.json({
      success: true,
      username: resetToken.username
    });

  } catch (error) {
    console.error('Erro ao verificar token:', error);
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

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token e nova senha são obrigatórios'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'A senha deve ter pelo menos 6 caracteres'
      });
    }

    // Encontre o token válido
    const resetToken = await PasswordResetToken.findOne({ 
      token,
      expiresAt: { $gt: new Date() }
    }).populate('userId');

    if (!resetToken) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido ou expirado'
      });
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Atualize a senha do usuário
    await User.findByIdAndUpdate(resetToken.userId._id, {
      password: hashedPassword
    });

    // Delete o token usado
    await PasswordResetToken.deleteOne({ _id: resetToken._id });

    // Delete todos os tokens antigos deste usuário
    await PasswordResetToken.deleteMany({ userId: resetToken.userId._id });

    res.json({
      success: true,
      message: 'Senha redefinida com sucesso!'
    });

  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
