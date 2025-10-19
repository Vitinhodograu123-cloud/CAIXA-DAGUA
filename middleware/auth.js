const jwt = require('jsonwebtoken');
const User = require('../database/models/User');

module.exports = async (req, res, next) => {
  try {
    // Verifica o token no header Authorization
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.log('⚠️  Token não fornecido');
      // Em vez de retornar erro, continua sem usuário autenticado
      req.user = null;
      return next();
    }

    // Decodifica o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Busca o usuário
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      console.log('⚠️  Usuário não encontrado no token');
      req.user = null;
      return next();
    }

    // Adiciona o usuário ao request
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    console.log('⚠️  Erro de autenticação:', error.message);
    // Continua sem autenticação em vez de bloquear
    req.user = null;
    next();
  }
};
