const nodemailer = require('nodemailer');

// Configuração para Gmail (ou configure com seu provedor)
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Para testes, você pode usar Ethereal Email
const createTestTransporter = async () => {
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransporter({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
};

const sendPasswordResetEmail = async (email, username, resetToken, resetUrl) => {
  let emailTransporter;
  
  // Use Ethereal para desenvolvimento, Gmail para produção
  if (process.env.NODE_ENV === 'production' && process.env.EMAIL_USER) {
    emailTransporter = transporter;
  } else {
    emailTransporter = await createTestTransporter();
  }

  const mailOptions = {
    from: process.env.EMAIL_USER || 'noreply@acquatrack.com',
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
        <p>Se você não solicitou esta redefinição, ignore este email.</p>
        <p><strong>Este link expira em 1 hora.</strong></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          Sistema de Monitoramento AcquaTrack
        </p>
      </div>
    `
  };

  try {
    const info = await emailTransporter.sendMail(mailOptions);
    
    // Em desenvolvimento, mostra o link do Ethereal Email
    if (process.env.NODE_ENV !== 'production') {
      console.log('📧 Email de recuperação enviado (Ethereal):');
      console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendPasswordResetEmail };
