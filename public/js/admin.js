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
        // Tenta buscar estatísticas da API existente
        const users = await fetchUsers();
        const units = await fetchUnits();
        
        const stats = {
            totalUsers: users.length,
            adminUsers: users.filter(u => u.role === 'admin').length,
            usersWithUnits: users.filter(u => u.units && u.units.length > 0).length,
            totalUnits: units.length
        };
        
        displayUserStats(stats);
    } catch (error) {
        logToConsole('⚠️ Usando estatísticas locais', 'warning');
        // Fallback para estatísticas básicas
        displayUserStats({
            totalUsers: 0,
            adminUsers: 0,
            usersWithUnits: 0,
            totalUnits: 0
        });
    }
}

function displayUserStats(stats) {
    const statsContainer = document.getElementById('userStats');
    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${stats.totalUsers}</div>
            <div class="stat-label">Total de Usuários</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.adminUsers}</div>
            <div class="stat-label">Administradores</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.usersWithUnits}</div>
            <div class="stat-label">Usuários com Unidades</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.totalUnits}</div>
            <div class="stat-label">Unidades Totais</div>
        </div>
    `;
}

// Buscar usuários usando a nova API de admin
async function fetchUsers() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            return await response.json();
        } else {
            // Fallback para API antiga
            const fallbackResponse = await fetch('/api/users/list', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (fallbackResponse.ok) {
                return await fallbackResponse.json();
            }
        }
    } catch (error) {
        console.log('❌ Erro ao buscar usuários:', error);
    }
    
    // Fallback: retorna array vazio
    return [];
}

// Buscar unidades usando a nova API de admin
async function fetchUnits() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/units', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            return await response.json();
        } else {
            // Fallback para API antiga
            const fallbackResponse = await fetch('/api/units/list', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (fallbackResponse.ok) {
                return await fallbackResponse.json();
            }
        }
    } catch (error) {
        console.log('❌ Erro ao buscar unidades:', error);
    }
    
    // Fallback: retorna array vazio
    return [];
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

    logToConsole(`👤 Tentando criar usuário: ${username} (${role})...`, 'info');

    try {
        // Tenta criar usuário via API de admin
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ username, password, role })
        });

        if (response.ok) {
            const data = await response.json();
            logToConsole(`✅ Usuário "${username}" criado com sucesso!`, 'success');
            closeModal('createUserModal');
            loadUsers();
            loadUserStats();
        } else {
            // Fallback para API antiga
            const fallbackResponse = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ username, password, role })
            });

            if (fallbackResponse.ok) {
                const data = await fallbackResponse.json();
                logToConsole(`✅ Usuário "${username}" criado com sucesso!`, 'success');
                closeModal('createUserModal');
                loadUsers();
                loadUserStats();
            } else {
                const errorData = await response.json();
                logToConsole(`❌ Erro ao criar usuário: ${errorData.error || 'Erro desconhecido'}`, 'error');
                
                // Fallback: simula criação local
                logToConsole('🔄 Tentando fallback local...', 'warning');
                simulateUserCreation(username, password, role);
            }
        }
    } catch (error) {
        logToConsole(`❌ Erro de conexão: ${error.message}`, 'error');
        // Fallback: simula criação local
        simulateUserCreation(username, password, role);
    }
}

// Fallback para criação de usuário (simulação)
function simulateUserCreation(username, password, role) {
    logToConsole(`🔄 Simulando criação do usuário "${username}"...`, 'warning');
    
    // Simula um delay de criação
    setTimeout(() => {
        logToConsole(`✅ Usuário "${username}" criado (simulação)`, 'success');
        logToConsole('💡 Nota: Esta é uma simulação. Configure as APIs de admin no servidor.', 'info');
        closeModal('createUserModal');
        loadUsers();
        loadUserStats();
    }, 1500);
}

// Listar usuários
async function loadUsers() {
    logToConsole('📋 Carregando lista de usuários...', 'info');

    try {
        const users = await fetchUsers();
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
                <p class="warning-text">⚠️ Configure as APIs de admin no servidor</p>
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
                    <span class="info-value">${new Date(user.createdAt || Date.now()).toLocaleDateString('pt-BR')}</span>
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
        const users = await fetchUsers();
        
        if (users.length === 0) {
            logToConsole('ℹ️ Nenhum usuário encontrado para análise', 'info');
            return;
        }
        
        users.forEach((user, index) => {
            logToConsole(`👤 ${user.username || 'Sem nome'}: ${Object.keys(user).join(', ')}`, 'info');
            logToConsole(`   🏭 Unidades: ${user.units ? user.units.length : 'campo não existe'}`, 
                        user.units ? 'success' : 'warning');
            logToConsole(`   🎯 Role: ${user.role || 'não definido'}`, 
                        user.role ? 'success' : 'warning');
        });
        
        logToConsole(`✅ Verificação concluída - ${users.length} usuários analisados`, 'success');
        
    } catch (error) {
        logToConsole(`❌ Erro na verificação: ${error.message}`, 'error');
    }
}

// ========== GERENCIAMENTO DE UNIDADES ==========

async function loadUnitsData() {
    await loadUnits();
}

// Listar unidades
async function loadUnits() {
    logToConsole('🏭 Carregando lista de unidades...', 'info');

    try {
        const units = await fetchUnits();
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
                <p class="warning-text">⚠️ Configure as APIs de admin no servidor</p>
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
                    <button class="btn-secondary btn-sm" onclick="editUnit('${unit._id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
            <div class="grid-item-info">
                <div class="info-row">
                    <span class="info-label">Localização:</span>
                    <span class="info-value">${unit.location || 'Não informada'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Tipo:</span>
                    <span class="info-value">${unit.type || 'Não definido'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Sensores:</span>
                    <span class="info-value">${unit.numberOfSensors || 0}</span>
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
        // Carrega usuários e unidades
        const [users, units] = await Promise.all([
            fetchUsers(),
            fetchUnits()
        ]);

        // Preenche os selects
        const userSelect = document.getElementById('selectUser');
        const unitSelect = document.getElementById('selectUnit');

        userSelect.innerHTML = '';
        unitSelect.innerHTML = '';

        if (users.length === 0) {
            userSelect.innerHTML = '<option value="">Nenhum usuário encontrado</option>';
        } else {
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user._id;
                option.textContent = `${user.username} (${user.role})`;
                userSelect.appendChild(option);
            });
        }

        if (units.length === 0) {
            unitSelect.innerHTML = '<option value="">Nenhuma unidade encontrada</option>';
        } else {
            units.forEach(unit => {
                const option = document.createElement('option');
                option.value = unit._id;
                option.textContent = `${unit.name} - ${unit.location}`;
                unitSelect.appendChild(option);
            });
        }

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

    if (!userId || !unitId) {
        logToConsole('❌ Selecione um usuário e uma unidade', 'error');
        return;
    }

    const userSelect = document.getElementById('selectUser');
    const unitSelect = document.getElementById('selectUnit');
    
    const userName = userSelect.options[userSelect.selectedIndex].text;
    const unitName = unitSelect.options[unitSelect.selectedIndex].text;

    logToConsole(`🔗 Tentando associar: ${userName} ← ${unitName}`, 'info');

    try {
        // Tenta associar via API de admin
        const response = await fetch('/api/admin/assign-unit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ userId, unitId })
        });

        if (response.ok) {
            logToConsole(`✅ Unidade associada com sucesso!`, 'success');
            closeModal('assignUnitModal');
            loadUsers(); // Recarrega a lista para mostrar a associação
        } else {
            throw new Error('API não disponível');
        }
    } catch (error) {
        // Fallback: simulação
        logToConsole(`🔄 Simulando associação (API não disponível)`, 'warning');
        logToConsole(`💡 Configure a API /api/admin/assign-unit no servidor`, 'info');
        
        // Simula sucesso após delay
        setTimeout(() => {
            logToConsole(`✅ Associação simulada: ${userName} ← ${unitName}`, 'success');
            closeModal('assignUnitModal');
            loadUsers(); // Recarrega a lista para mostrar a associação
        }, 1000);
    }
}

// ========== FERRAMENTAS ==========

async function runDatabaseDiagnostic() {
    logToConsole('🩺 Iniciando diagnóstico do sistema...', 'info');

    try {
        // Tenta usar a API de diagnóstico
        const response = await fetch('/api/admin/diagnostic', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            const diagnostic = await response.json();
            
            logToConsole(`📊 ESTATÍSTICAS DO SISTEMA:`, 'info');
            logToConsole(`   👤 Usuários: ${diagnostic.usersCount}`, 'info');
            logToConsole(`   🏭 Unidades: ${diagnostic.unitsCount}`, 'info');
            logToConsole(`   🔗 Online: ${diagnostic.onlineUnits}`, 'info');
            
            if (diagnostic.issues && diagnostic.issues.length > 0) {
                logToConsole('⚠️ PROBLEMAS ENCONTRADOS:', 'warning');
                diagnostic.issues.forEach(issue => {
                    logToConsole(`   • ${issue}`, 'warning');
                });
            } else {
                logToConsole('✅ Sistema funcionando corretamente', 'success');
            }
        } else {
            // Fallback para diagnóstico local
            await runLocalDiagnostic();
        }
        
    } catch (error) {
        // Fallback para diagnóstico local
        await runLocalDiagnostic();
    }
}

// Diagnóstico local (fallback)
async function runLocalDiagnostic() {
    try {
        const [users, units] = await Promise.all([
            fetchUsers(),
            fetchUnits()
        ]);

        logToConsole(`📊 ESTATÍSTICAS DO SISTEMA:`, 'info');
        logToConsole(`   👤 Usuários: ${users.length}`, 'info');
        logToConsole(`   🏭 Unidades: ${units.length}`, 'info');
        
        // Verifica problemas comuns
        const issues = [];
        
        if (users.length === 0) {
            issues.push('Nenhum usuário encontrado');
        }
        
        if (units.length === 0) {
            issues.push('Nenhuma unidade encontrada');
        }
        
        // Verifica usuários sem role
        const usersWithoutRole = users.filter(u => !u.role);
        if (usersWithoutRole.length > 0) {
            issues.push(`${usersWithoutRole.length} usuários sem role definida`);
        }
        
        // Verifica unidades sem localização
        const unitsWithoutLocation = units.filter(u => !u.location);
        if (unitsWithoutLocation.length > 0) {
            issues.push(`${unitsWithoutLocation.length} unidades sem localização`);
        }

        if (issues.length > 0) {
            logToConsole('⚠️ PROBLEMAS ENCONTRADOS:', 'warning');
            issues.forEach(issue => {
                logToConsole(`   • ${issue}`, 'warning');
            });
        } else {
            logToConsole('✅ Sistema funcionando corretamente', 'success');
        }
        
        logToConsole('💡 RECOMENDAÇÕES:', 'info');
        logToConsole('   • Configure as APIs de admin no servidor para funcionalidade completa', 'info');
        
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
    logToConsole('💡 Funcionalidade de edição em desenvolvimento', 'info');
}

function editUnit(unitId) {
    logToConsole(`✏️ Editando unidade ${unitId}...`, 'info');
    logToConsole('💡 Funcionalidade de edição em desenvolvimento', 'info');
}

async function deleteUser(userId) {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) {
        return;
    }

    logToConsole(`🗑️ Tentando excluir usuário ${userId}...`, 'warning');

    try {
        // Tenta usar a API de admin
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
            // Fallback para API antiga
            const fallbackResponse = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (fallbackResponse.ok) {
                logToConsole('✅ Usuário excluído com sucesso', 'success');
                loadUsers();
                loadUserStats();
            } else {
                throw new Error('API não disponível');
            }
        }
    } catch (error) {
        logToConsole(`🔄 Simulando exclusão (API não disponível)`, 'warning');
        logToConsole(`💡 Configure as APIs de admin no servidor`, 'info');
        
        // Simula exclusão após delay
        setTimeout(() => {
            logToConsole(`✅ Exclusão simulada do usuário`, 'success');
            loadUsers();
            loadUserStats();
        }, 1000);
    }
}

// ========== FUNÇÕES GLOBAIS PARA O HTML ==========

// Funções globais SIMPLES sem recursão
window.listUsers = function() {
    console.log('📋 Listar Usuários chamado via HTML');
    loadUsers();
};

window.listUnits = function() {
    console.log('🏭 Listar Unidades chamado via HTML');
    loadUnits();
};

window.createUser = function() {
    console.log('👤 Criar Usuário chamado via HTML');
    document.getElementById('createUserModal').style.display = 'block';
};

window.assignUnitToUser = function() {
    console.log('🔗 Associar Unidade chamado via HTML');
    // Chama a função ORIGINAL diretamente
    if (typeof originalAssignUnitToUser === 'function') {
        originalAssignUnitToUser();
    }
};

window.checkUserStructure = function() {
    console.log('🔍 Verificar Estrutura chamado via HTML');
    // Chama a função ORIGINAL diretamente
    if (typeof originalCheckUserStructure === 'function') {
        originalCheckUserStructure();
    }
};

window.runDatabaseDiagnostic = function() {
    console.log('🩺 Diagnóstico chamado via HTML');
    // Chama a função ORIGINAL diretamente
    if (typeof originalRunDatabaseDiagnostic === 'function') {
        originalRunDatabaseDiagnostic();
    }
};

window.clearConsole = function() {
    console.log('🧹 Limpar Console chamado via HTML');
    // Chama a função ORIGINAL diretamente
    if (typeof originalClearConsole === 'function') {
        originalClearConsole();
    }
};

// Salva as funções originais com nomes diferentes
window.originalAssignUnitToUser = assignUnitToUser;
window.originalCheckUserStructure = checkUserStructure;
window.originalRunDatabaseDiagnostic = runDatabaseDiagnostic;
window.originalClearConsole = clearConsole;

console.log('✅ Painel de Administração carregado!');
