const nodemailer = require('nodemailer');

const sendPasswordResetEmail = async (email, username, resetToken, resetUrl) => {
  console.log('📧 Iniciando envio de email...');
  console.log('Para:', email);
  console.log('Usuário:', username);
  console.log('URL:', resetUrl);

  try {
    // SEMPRE use Ethereal Email para evitar problemas com configuração
    console.log('🔧 Criando transporter Ethereal...');
    const testAccount = await nodemailer.createTestAccount();
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });

    console.log('✅ Transporter criado');

    const mailOptions = {
      from: '"AcquaTrack System" <noreply@acquatrack.com>',
      to: email,
      subject: 'Recuperação de Senha - Sistema AcquaTrack',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4361ee;">Recuperação de Senha</h2>
          <p>Olá, <strong>${username}</strong>!</p>
          <p>Recebemos uma solicitação para redefinir sua senha no Sistema AcquaTrack.</p>
          <p>Clique no link abaixo para redefinir sua senha:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #4361ee; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Redefinir Senha
            </a>
          </div>
          <p><strong>Link direto:</strong> ${resetUrl}</p>
          <p>Se você não solicitou esta redefinição, ignore este email.</p>
          <p><strong>Este link expira em 1 hora.</strong></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Sistema de Monitoramento AcquaTrack
          </p>
        </div>
      `
    };

    console.log('📤 Enviando email...');
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email enviado com sucesso!');
    console.log('📧 Preview URL:', nodemailer.getTestMessageUrl(info));
    
    return { 
      success: true, 
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info)
    };
    
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error);
    console.error('❌ Stack trace:', error.stack);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

module.exports = { sendPasswordResetEmail };
