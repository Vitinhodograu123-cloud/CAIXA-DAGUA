const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Modelo do usuário
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' }
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
    try {
        // Conecta ao MongoDB
        await mongoose.connect('mongodb://localhost:27017/watertank', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000 // Timeout após 5 segundos
        });

        // Verifica se já existe um admin
        const adminExists = await User.findOne({ role: 'admin' });
        if (adminExists) {
            console.log('Admin já existe!');
            process.exit(0);
        }

        // Cria o admin
        const hashedPassword = await bcrypt.hash('admin123', 12);
        const admin = new User({
            username: 'admin',
            password: hashedPassword,
            role: 'admin'
        });

        await admin.save();
        console.log('Admin criado com sucesso!');
        console.log('Username: admin');
        console.log('Senha: admin123');
    } catch (error) {
        console.error('Erro:', error);
    } finally {
        mongoose.connection.close();
    }
}

createAdmin();