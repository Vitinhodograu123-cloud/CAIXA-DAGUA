// Variáveis globais
let currentSection = 'users';

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    loadUserStats();
});

// Verificação de autenticação
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = '/';
        return;
    }

    try {
        const userData = JSON.parse(user);
        if (userData.role !== 'admin') {
            window.location.href = '/dashboard.html';
            return;
        }
        
        document.getElementById('username').textContent = userData.username;
    } catch (error) {
        console.error('❌ Erro ao verificar autenticação:', error);
        window.location.href = '/';
    }
}

// Setup de event listeners
function setupEventListeners() {
    // Menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => switchSection(item.dataset.section));
    });

    // Botão de adicionar
    document.getElementById('addBtn').addEventListener('click', () => {
        if (currentSection === 'users') {
            document.getElementById('createUserModal').style.display = 'block';
        }
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    });

    // Forms
    document.getElementById('createUserForm').addEventListener('submit', handleCreateUser);
    document.getElementById('assignUnitForm').addEventListener('submit', handleAssignUnit);

    // Fechar modais ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });
}

// Trocar seção
function switchSection(section) {
    currentSection = section;
    
    // Atualiza título
    const titles = {
        'users': 'Gerenciamento de Usuários',
        'units': 'Gerenciamento de Unidades', 
        'tools': 'Ferramentas de Administração'
    };
    document.getElementById('sectionTitle').textContent = titles[section];
    
    // Atualiza menu ativo
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });

    // Mostra/esconde seções
    document.querySelectorAll('.section-content').forEach(sectionEl => {
        sectionEl.style.display = sectionEl.id === `${section}Section` ? 'block' : 'none';
    });

    // Carrega dados da seção
    switch(section) {
        case 'users':
            loadUsers();
            break;
        case 'units':
            loadUnitsData();
            break;
    }
}

// ========== FUNÇÕES DO CONSOLE ==========

function logToConsole(message, type = 'info') {
    const consoleOutput = document.getElementById('consoleOutput');
    const line = document.createElement('div');
    line.className = `console-line console-${type}`;
    
    const timestamp = new Date().toLocaleTimeString();
    line.innerHTML = `<span style="opacity:0.7">[${timestamp}]</span> ${message}`;
    
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function clearConsole() {
    document.getElementById('consoleOutput').innerHTML = `
        <div class="console-line console-info">🧹 Console limpo</div>
        <div class="console-line console-info">💡 Use os botões para executar ações</div>
    `;
}

// ========== GERENCIAMENTO DE USUÁRIOS ==========

async function loadUserStats() {
    try {
        const response = await fetch('/api/admin/stats', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            const stats = await response.json();
            displayUserStats(stats);
        }
    } catch (error) {
        console.log('Não foi possível carregar estatísticas');
    }
}

function displayUserStats(stats) {
    const statsContainer = document.getElementById('userStats');
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${stats.totalUsers || 0}</div>
            <div class="stat-label">Total de Usuários</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.adminUsers || 0}</div>
            <div class="stat-label">Administradores</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.usersWithUnits || 0}</div>
            <div class="stat-label">Usuários com Unidades</div>
        </div>
    `;
}

// Criar usuário
async function createUser() {
    document.getElementById('createUserModal').style.display = 'block';
}

async function handleCreateUser(e) {
    e.preventDefault();

    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;

    logToConsole(`👤 Criando usuário: ${username} (${role})...`, 'info');

    try {
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ username, password, role })
        });

        const data = await response.json();

        if (response.ok) {
            logToConsole(`✅ Usuário "${username}" criado com sucesso!`, 'success');
            closeModal('createUserModal');
            loadUsers();
            loadUserStats();
        } else {
            logToConsole(`❌ Erro ao criar usuário: ${data.error}`, 'error');
        }
    } catch (error) {
        logToConsole(`❌ Erro de conexão: ${error.message}`, 'error');
    }
}

// Listar usuários
async function listUsers() {
    logToConsole('📋 Carregando lista de usuários...', 'info');

    try {
        const response = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error(`Erro ${response.status}`);
        }

        const users = await response.json();
        displayUsers(users);
        logToConsole(`✅ ${users.length} usuários carregados`, 'success');
        
    } catch (error) {
        logToConsole(`❌ Erro ao carregar usuários: ${error.message}`, 'error');
        displayUsers([]);
    }
}

// Exibir usuários
function displayUsers(users) {
    const usersList = document.getElementById('usersList');
    
    if (!users || users.length === 0) {
        usersList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users fa-3x"></i>
                <h3>Nenhum usuário encontrado</h3>
                <p>Use o botão "Criar Usuário" para adicionar um novo usuário.</p>
            </div>
        `;
        return;
    }

    usersList.innerHTML = '';
    
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'grid-item';
        userElement.innerHTML = `
            <div class="grid-item-header">
                <h3 class="grid-item-title">
                    ${user.username}
                    <span class="role-badge ${user.role}">${user.role}</span>
                </h3>
                <div class="grid-item-actions">
                    <button class="btn-secondary btn-sm" onclick="editUser('${user._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-danger btn-sm" onclick="deleteUser('${user._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="grid-item-info">
                <div class="info-row">
                    <span class="info-label">Unidades:</span>
                    <span class="info-value">${user.units?.length || 0}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Criado em:</span>
                    <span class="info-value">${new Date(user.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
            </div>
        `;
        usersList.appendChild(userElement);
    });
}

// Verificar estrutura dos usuários
async function checkUserStructure() {
    logToConsole('🔍 Verificando estrutura dos usuários...', 'info');

    try {
        const response = await fetch('/api/admin/users/structure', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error(`Erro ${response.status}`);
        }

        const structure = await response.json();
        
        structure.forEach((user, index) => {
            logToConsole(`👤 ${user.username}: ${Object.keys(user).join(', ')}`, 'info');
            logToConsole(`   🏭 Unidades: ${user.units ? user.units.length : 'campo não existe'}`, 
                        user.units ? 'success' : 'warning');
        });
        
        logToConsole(`✅ Verificação concluída - ${structure.length} usuários analisados`, 'success');
        
    } catch (error) {
        logToConsole(`❌ Erro na verificação: ${error.message}`, 'error');
    }
}

// ========== GERENCIAMENTO DE UNIDADES ==========

async function loadUnitsData() {
    await listUnits();
}

// Listar unidades
async function listUnits() {
    logToConsole('🏭 Carregando lista de unidades...', 'info');

    try {
        const response = await fetch('/api/admin/units', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error(`Erro ${response.status}`);
        }

        const units = await response.json();
        displayUnits(units);
        logToConsole(`✅ ${units.length} unidades carregadas`, 'success');
        
    } catch (error) {
        logToConsole(`❌ Erro ao carregar unidades: ${error.message}`, 'error');
        displayUnits([]);
    }
}

// Exibir unidades
function displayUnits(units) {
    const unitsList = document.getElementById('unitsList');
    
    if (!units || units.length === 0) {
        unitsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-water fa-3x"></i>
                <h3>Nenhuma unidade encontrada</h3>
                <p>As unidades do sistema aparecerão aqui.</p>
            </div>
        `;
        return;
    }

    unitsList.innerHTML = '';
    
    units.forEach(unit => {
        const unitElement = document.createElement('div');
        unitElement.className = 'grid-item';
        unitElement.innerHTML = `
            <div class="grid-item-header">
                <h3 class="grid-item-title">${unit.name}</h3>
                <div class="grid-item-actions">
                    <button class="btn-secondary btn-sm">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
            <div class="grid-item-info">
                <div class="info-row">
                    <span class="info-label">Localização:</span>
                    <span class="info-value">${unit.location}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Tipo:</span>
                    <span class="info-value">${unit.type}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Sensores:</span>
                    <span class="info-value">${unit.numberOfSensors}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Status:</span>
                    <span class="info-value ${unit.isOnline ? 'online' : 'offline'}">
                        ${unit.isOnline ? '🟢 Online' : '🔴 Offline'}
                    </span>
                </div>
            </div>
        `;
        unitsList.appendChild(unitElement);
    });
}

// Associar unidade a usuário
async function assignUnitToUser() {
    logToConsole('🔗 Preparando associação de unidade...', 'info');

    try {
        // Carrega usuários
        const usersResponse = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const users = await usersResponse.json();

        // Carrega unidades
        const unitsResponse = await fetch('/api/admin/units', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const units = await unitsResponse.json();

        // Preenche os selects
        const userSelect = document.getElementById('selectUser');
        const unitSelect = document.getElementById('selectUnit');

        userSelect.innerHTML = '';
        unitSelect.innerHTML = '';

        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user._id;
            option.textContent = `${user.username} (${user.role})`;
            userSelect.appendChild(option);
        });

        units.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit._id;
            option.textContent = `${unit.name} - ${unit.location}`;
            unitSelect.appendChild(option);
        });

        document.getElementById('assignUnitModal').style.display = 'block';
        logToConsole('✅ Modal de associação carregado', 'success');
        
    } catch (error) {
        logToConsole(`❌ Erro ao carregar dados: ${error.message}`, 'error');
    }
}

async function handleAssignUnit(e) {
    e.preventDefault();

    const userId = document.getElementById('selectUser').value;
    const unitId = document.getElementById('selectUnit').value;

    const userSelect = document.getElementById('selectUser');
    const unitSelect = document.getElementById('selectUnit');
    
    const userName = userSelect.options[userSelect.selectedIndex].text;
    const unitName = unitSelect.options[unitSelect.selectedIndex].text;

    logToConsole(`🔗 Associando: ${userName} ← ${unitName}`, 'info');

    try {
        const response = await fetch('/api/admin/assign-unit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ userId, unitId })
        });

        const data = await response.json();

        if (response.ok) {
            logToConsole(`✅ Unidade associada com sucesso!`, 'success');
            closeModal('assignUnitModal');
            loadUsers();
        } else {
            logToConsole(`❌ Erro na associação: ${data.error}`, 'error');
        }
    } catch (error) {
        logToConsole(`❌ Erro de conexão: ${error.message}`, 'error');
    }
}

// ========== FERRAMENTAS ==========

async function runDatabaseDiagnostic() {
    logToConsole('🩺 Iniciando diagnóstico do banco de dados...', 'info');

    try {
        const response = await fetch('/api/admin/diagnostic', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error(`Erro ${response.status}`);
        }

        const diagnostic = await response.json();
        
        logToConsole(`📊 ESTATÍSTICAS DO BANCO:`, 'info');
        logToConsole(`   👤 Usuários: ${diagnostic.usersCount}`, 'info');
        logToConsole(`   🏭 Unidades: ${diagnostic.unitsCount}`, 'info');
        logToConsole(`   🔗 Associações: ${diagnostic.associationsCount}`, 'info');
        
        if (diagnostic.issues && diagnostic.issues.length > 0) {
            logToConsole('⚠️ PROBLEMAS ENCONTRADOS:', 'warning');
            diagnostic.issues.forEach(issue => {
                logToConsole(`   • ${issue}`, 'warning');
            });
        } else {
            logToConsole('✅ Nenhum problema encontrado', 'success');
        }
        
    } catch (error) {
        logToConsole(`❌ Erro no diagnóstico: ${error.message}`, 'error');
    }
}

// ========== FUNÇÕES AUXILIARES ==========

function closeModal(modalId = null) {
    let modal;
    
    if (modalId) {
        modal = document.getElementById(modalId);
    } else {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
            modal.querySelector('form')?.reset();
        });
        return;
    }
    
    if (modal) {
        modal.style.display = 'none';
        modal.querySelector('form')?.reset();
    }
}

// Funções placeholder para ações futuras
function editUser(userId) {
    logToConsole(`✏️ Editando usuário ${userId}...`, 'info');
}

async function deleteUser(userId) {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) {
        return;
    }

    logToConsole(`🗑️ Excluindo usuário ${userId}...`, 'warning');

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            logToConsole('✅ Usuário excluído com sucesso', 'success');
            loadUsers();
            loadUserStats();
        } else {
            throw new Error('Erro ao excluir usuário');
        }
    } catch (error) {
        logToConsole(`❌ Erro ao excluir usuário: ${error.message}`, 'error');
    }
}

console.log('✅ Painel de Administração carregado!');
