// Configuração do Socket.IO
const socket = io();

// Variáveis globais
let currentUnit = null;

// ⭐⭐ FUNÇÃO PARA GERAR TABELA DE CALIBRAÇÃO DINÂMICA ⭐⭐
function generateCalibrationTable() {
    const sensorCount = parseInt(document.getElementById('unitSensors').value) || 4;
    const calibrationSection = document.getElementById('calibrationSection');
    const calibrationTable = document.getElementById('calibrationTable');
    
    if (sensorCount < 1) return;
    
    // Mostra a seção de calibração
    calibrationSection.style.display = 'block';
    
    // Gera as linhas da tabela COMPACTA
    let tableHTML = `
        <table class="calibration-input-table" style="width: 100%; font-size: 13px;">
            <thead>
                <tr>
                    <th style="padding: 8px; width: 25%;">% Nível</th>
                    <th style="padding: 8px; width: 35%;">Sensores</th>
                    <th style="padding: 8px; width: 40%;">Litros</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    for (let i = 1; i <= sensorCount; i++) {
        const percentage = Math.round((i / sensorCount) * 100);
        tableHTML += `
            <tr>
                <td style="padding: 6px;"><strong>${percentage}%</strong></td>
                <td style="padding: 6px;">${i}/${sensorCount}</td>
                <td style="padding: 6px;">
                    <input type="number" 
                           id="calibration_${percentage}" 
                           class="calibration-input" 
                           placeholder="${i * 250}L"
                           min="0"
                           value="${i * 250}"
                           style="width: 100%; padding: 4px; font-size: 12px;">
                </td>
            </tr>
        `;
    }
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    calibrationTable.innerHTML = tableHTML;
    
    // ⭐⭐ SCROLL AUTOMÁTICO PARA A TABELA SE FOR MUITOS SENSORES ⭐⭐
    if (sensorCount > 6) {
        calibrationTable.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}


// ⭐⭐ FUNÇÃO PARA OBTER OS DADOS DE CALIBRAÇÃO DO FORMULÁRIO ⭐⭐
function getCalibrationData() {
    const sensorCount = parseInt(document.getElementById('unitSensors').value) || 4;
    const calibration = [];
    
    for (let i = 1; i <= sensorCount; i++) {
        const percentage = Math.round((i / sensorCount) * 100);
        const litersInput = document.getElementById(`calibration_${percentage}`);
        const liters = litersInput ? parseInt(litersInput.value) || (i * 250) : (i * 250);
        
        calibration.push({
            percentage: percentage,
            liters: liters,
            sensorCount: i
        });
    }
    
    return calibration;
}

// Inicialização
// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Dashboard inicializando...');
    checkAuth();
    setupMobileMenu();
    setupEventListeners();
    loadUnits();
    
    // ⭐⭐ INICIALIZA A TABELA DE CALIBRAÇÃO ⭐⭐
    generateCalibrationTable();
});

// Configuração do menu mobile
function setupMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    let sidebarOverlay = document.querySelector('.sidebar-overlay');
    
    // Cria o overlay se não existir
    if (!sidebarOverlay) {
        sidebarOverlay = document.createElement('div');
        sidebarOverlay.className = 'sidebar-overlay';
        document.body.appendChild(sidebarOverlay);
    }

    // Toggle do menu
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
            document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
        });
    }

    // Fechar menu ao clicar no overlay
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
    });

    // Fechar menu ao selecionar uma unidade (no mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            sidebar.classList.contains('active') && 
            e.target.closest('.unit-item')) {
            closeMobileMenu();
        }
    });

    // Fechar menu ao redimensionar para desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeMobileMenu();
        }
    });
}

// Fechar menu mobile
function closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Verificação de autenticação
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user || !isTokenValid()) {
        console.log('🔐 Token inválido ou expirado, redirecionando...');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
        return;
    }

    try {
        const userData = JSON.parse(user);
        // Atualiza o username em todos os lugares
        const usernameElements = document.querySelectorAll('#username, .username');
        usernameElements.forEach(element => {
            element.textContent = userData.username;
        });

        // Mostra botão de adicionar unidade apenas para admin
        if (userData.role === 'admin') {
            document.getElementById('addUnitBtn').style.display = 'block';
        }
    } catch (error) {
        console.error('❌ Erro ao verificar autenticação:', error);
        window.location.href = '/';
    }
}

// Verificar se o token é válido
function isTokenValid() {
    const token = localStorage.getItem('token');
    if (!token) return false;
    
    try {
        // Decodifica o token JWT para verificar expiração
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000; // Converte para milissegundos
        return Date.now() < exp;
    } catch (error) {
        return false;
    }
}

// Setup de event listeners - ⭐⭐ ATUALIZADA ⭐⭐
function setupEventListeners() {
    console.log('🔧 Configurando event listeners...');
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    });

    // Modal de adicionar unidade
    const addUnitBtn = document.getElementById('addUnitBtn');
    const addUnitModal = document.getElementById('addUnitModal');
    const closeBtn = addUnitModal.querySelector('.close');

    if (addUnitBtn) {
        addUnitBtn.addEventListener('click', () => {
            console.log('🎯 Abrindo modal de adicionar unidade...');
            addUnitModal.style.display = 'block';
            // ⭐⭐ GERA TABELA AO ABRIR MODAL ⭐⭐
            setTimeout(() => generateCalibrationTable(), 100);
        });
    }

    // ⭐⭐ FECHAR MODAL COM BOTÃO X ⭐⭐
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // Form de adicionar unidade
    const addUnitForm = document.getElementById('addUnitForm');
    if (addUnitForm) {
        addUnitForm.addEventListener('submit', handleAddUnit);
    }

    // Fechar modal ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target === addUnitModal) {
            closeModal();
        }
    });
}

// Carregar unidades
async function loadUnits() {
    try {
        console.log('📋 Carregando unidades...');
        
        const token = localStorage.getItem('token');
        
        const response = await fetch('/api/units/list', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                console.log('🔐 Token inválido ou expirado');
                window.location.href = '/';
                return;
            }
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const units = await response.json();
        console.log(`✅ ${units.length} unidades carregadas:`, units.map(u => u.name));
        
        if (!units || units.length === 0) {
            document.getElementById('unitsList').innerHTML = '<div class="no-units">Nenhuma unidade encontrada</div>';
            return;
        }

        displayUnits(units);
        
    } catch (error) {
        console.error('❌ Erro ao carregar unidades:', error);
        document.getElementById('unitsList').innerHTML = `
            <div class="error-message">
                Erro ao carregar unidades: ${error.message}
            </div>
        `;
    }
}

// Exibir unidades na sidebar
function displayUnits(units) {
    const unitsList = document.getElementById('unitsList');
    unitsList.innerHTML = '';

    units.forEach(unit => {
        const unitElement = document.createElement('div');
        unitElement.className = 'unit-item';
        unitElement.innerHTML = `
            <div class="unit-item-content">
                <h3>${unit.name}</h3>
                <p class="unit-location">📍 ${unit.location || 'Sem localização'}</p>
                <p class="unit-type">🔧 ${unit.type || 'CAIXA'}</p>
                <div class="unit-status ${unit.isOnline ? 'online' : 'offline'}">
                    ${unit.isOnline ? '🟢 Online' : '🔴 Offline'}
                </div>
            </div>
        `;
        
        unitElement.addEventListener('click', () => {
            console.log(`🎯 Selecionando unidade: ${unit.name}`);
            selectUnit(unit, unitElement);
        });
        
        unitsList.appendChild(unitElement);
    });

    // Seleciona a primeira unidade automaticamente
    if (units.length > 0) {
        setTimeout(() => {
            const firstUnitElement = unitsList.querySelector('.unit-item');
            if (firstUnitElement) {
                selectUnit(units[0], firstUnitElement);
            }
        }, 500);
    }
}

// Selecionar uma unidade
function selectUnit(unit, unitElement = null) {
    console.log(`🎯 Selecionando unidade: ${unit.name}`);
    
    currentUnit = unit;
    
    // Atualiza o título
    updateUnitTitle(unit);
    document.getElementById('noSelection').style.display = 'none';
    document.getElementById('tankContent').style.display = 'block';

    // Remove seleção anterior
    const unitItems = document.querySelectorAll('.unit-item');
    unitItems.forEach(item => item.classList.remove('active'));
    
    // Adiciona seleção atual
    if (unitElement) {
        unitElement.classList.add('active');
    } else {
        // Encontra o elemento correspondente
        const items = document.querySelectorAll('.unit-item');
        for (let item of items) {
            if (item.querySelector('h3').textContent === unit.name) {
                item.classList.add('active');
                break;
            }
        }
    }

    // Carrega dados da unidade
    loadUnitData(unit._id);

    // Fecha o menu no mobile após seleção
    if (window.innerWidth <= 768) {
        closeMobileMenu();
    }
}

// Atualizar título da unidade (com suporte a mobile)
function updateUnitTitle(unit) {
    const currentUnitElement = document.getElementById('currentUnit');
    
    if (window.innerWidth <= 768) {
        // Formato compacto para mobile
        currentUnitElement.innerHTML = `
            ${unit.name}
            <small style="display: block; font-size: 0.7em; opacity: 0.8; margin-top: 0.25rem;">
                📍 ${unit.location} • ${unit.type}
            </small>
        `;
    } else {
        // Formato normal para desktop
        currentUnitElement.textContent = unit.name;
    }
}

// Carregar dados da unidade
// Carregar dados da unidade - ⭐⭐ CORRIGIDA ⭐⭐
async function loadUnitData(unitId) {
    try {
        console.log(`📊 Carregando dados da unidade: ${unitId}`);
        
        const token = localStorage.getItem('token');
        
        const response = await fetch(`/api/units/${unitId}/data`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                console.log('🔐 Token inválido ou expirado');
                window.location.href = '/';
                return;
            }
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Dados carregados:', data);
        console.log('📊 Unidade atual:', currentUnit); // Debug
        
        // ⭐⭐ CORREÇÃO: Passe currentUnit como segundo parâmetro ⭐⭐
        displayUnitData(data, currentUnit);
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        displayUnitData({ 
            waterLevel: 0, 
            temperature: 0, 
            isVibrating: false,
            error: true 
        }, currentUnit);
    }
}

// Exibir dados da unidade
function displayUnitData(data, unit) {
    const tanksGrid = document.getElementById('tanksGrid');
    
    if (data.error) {
        tanksGrid.innerHTML = `
            <div class="error-message">
                ❌ Erro ao carregar dados da unidade
            </div>
        `;
        return;
    }

    // ⭐⭐ NOVA LÓGICA - Formata o nível com litros ⭐⭐
    const waterLevel = data.waterLevel || 0;
    const temperature = data.temperature || 0;
    const vibrationCount = data.vibrationCount || 0;
    const isVibrating = data.isVibrating || false;
    const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleString('pt-BR') : 'Nunca';

    // ⭐⭐ CALCULA LITROS - Use a calibração da unidade ⭐⭐
    let waterLevelDisplay = `${waterLevel}%`;
    if (unit && unit.calibration) {
        const liters = calculateLiters(waterLevel, unit.calibration);
        if (liters !== null) {
            waterLevelDisplay = `${waterLevel}% (${liters}L)`;
        }
    }

    // ⭐⭐ FUNÇÃO AUXILIAR - Adicione esta função ⭐⭐
    function calculateLiters(percentage, calibration) {
        if (!calibration || calibration.length === 0) return null;
        
        const sortedCalibration = [...calibration].sort((a, b) => a.percentage - b.percentage);
        
        for (let i = 0; i < sortedCalibration.length; i++) {
            const current = sortedCalibration[i];
            const next = sortedCalibration[i + 1];
            
            if (percentage === current.percentage) {
                return current.liters;
            }
            
            if (next && percentage > current.percentage && percentage <= next.percentage) {
                const ratio = (percentage - current.percentage) / (next.percentage - current.percentage);
                return Math.round(current.liters + (next.liters - current.liters) * ratio);
            }
        }
        
        return null;
    }

    tanksGrid.innerHTML = `
        <div class="data-display">
            <div class="data-item ${data.isLowLevel ? 'warning' : ''}">
                <span class="data-label">💧 Nível de Água:</span>
                <span class="data-value">${waterLevelDisplay}</span>
                ${data.isLowLevel ? '<span class="alert-badge">⚠️ Baixo</span>' : ''}
            </div>
            <div class="data-item ${data.isHighTemp ? 'warning' : ''}">
                <span class="data-label">🌡️ Temperatura:</span>
                <span class="data-value">${temperature}°C</span>
                ${data.isHighTemp ? '<span class="alert-badge">⚠️ Alta</span>' : ''}
            </div>
            <div class="data-item">
                <span class="data-label">🔢 Contagem de Vibrações:</span>
                <span class="data-value">${vibrationCount}</span>
            </div>
            <div class="update-time">
                ⏰ Última atualização: ${timestamp}
            </div>
            
            <!-- ⭐⭐ NOVA SEÇÃO - Tabela de Calibração ⭐⭐ -->
            ${unit && unit.calibration ? `
            <div class="calibration-section">
                <h4>📊 Tabela de Calibração (${unit.numberOfSensors} sensores)</h4>
                <table class="calibration-table">
                    <thead>
                        <tr>
                            <th>%</th>
                            <th>Litros</th>
                            <th>Sensores Ativos</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${unit.calibration.map(item => `
                            <tr>
                                <td>${item.percentage}%</td>
                                <td>${item.liters}L</td>
                                <td>${item.sensorCount}/${unit.numberOfSensors}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}
        </div>
    `;
}

// Adicionar nova unidade
// Adicionar nova unidade - ⭐⭐ ATUALIZADA ⭐⭐
async function handleAddUnit(e) {
    e.preventDefault();
    
    console.log('🎯 Iniciando criação de nova unidade...');

    const formData = {
        name: document.getElementById('unitName').value.trim(),
        location: document.getElementById('unitLocation').value.trim(),
        type: document.getElementById('unitType').value,
        numberOfSensors: parseInt(document.getElementById('unitSensors').value) || 4,
        description: document.getElementById('unitDescription').value.trim(),
        // ⭐⭐ NOVO: Inclui os dados de calibração ⭐⭐
        calibration: getCalibrationData()
    };

    // Validação básica
    if (!formData.name || !formData.location || !formData.type) {
        alert('❌ Por favor, preencha todos os campos obrigatórios.');
        return;
    }

    // ⭐⭐ VALIDAÇÃO DA CALIBRAÇÃO ⭐⭐
    const calibrationValid = formData.calibration.every(item => item.liters > 0);
    if (!calibrationValid) {
        alert('❌ Por favor, preencha todos os valores de litros na tabela de calibração.');
        return;
    }

    try {
        console.log('📤 Enviando dados:', formData);
        
        const token = localStorage.getItem('token');
        
        const response = await fetch('/api/units/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Erro HTTP: ${response.status}`);
        }

        console.log('✅ Unidade criada com sucesso:', data);
        
        // Mostra mensagem de sucesso com a API Key
        alert(`✅ Unidade criada com sucesso!\n\n🏭 Nome: ${data.unit.name}\n🔑 API Key: ${data.unit.apiToken}\n\n⚠️ Guarde esta API Key! Ela não será mostrada novamente.`);
        
        // Fecha o modal e recarrega a lista
        closeModal();
        loadUnits();
        
    } catch (error) {
        console.error('❌ Erro ao criar unidade:', error);
        alert(`❌ Erro ao criar unidade:\n${error.message}`);
    }
}

// Fechar modal
function closeModal() {
    const modal = document.getElementById('addUnitModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    const form = document.getElementById('addUnitForm');
    if (form) {
        form.reset();
        // ⭐⭐ RESETA A TABELA DE CALIBRAÇÃO ⭐⭐
        document.getElementById('calibrationSection').style.display = 'none';
        document.getElementById('calibrationTable').innerHTML = '';
    }
}

// Socket.IO event listeners
socket.on('connect', () => {
    console.log('✅ Conectado ao servidor via Socket.IO');
});

// Socket.IO event listeners - ⭐⭐ CORRIGIDA ⭐⭐
socket.on('unitUpdate', (data) => {
    console.log('🔄 Atualização em tempo real recebida:', data);
    
    if (currentUnit && data.unitId === currentUnit._id.toString()) {
        console.log('🔄 Atualizando dados da unidade atual...');
        console.log('📊 Unidade com calibração:', currentUnit.calibration); // Debug
        // ⭐⭐ CORREÇÃO: Passe currentUnit como segundo parâmetro ⭐⭐
        displayUnitData(data.data, currentUnit);
        
        // Atualiza o status online/offline na lista
        updateUnitStatus(data.unitId, true);
    }
});

socket.on('newUnit', (data) => {
    console.log('🆕 Nova unidade detectada, recarregando lista...', data);
    loadUnits();
});

socket.on('unitOffline', (data) => {
    console.log('🔴 Unidade offline:', data);
    if (currentUnit && data.unitId === currentUnit._id.toString()) {
        updateUnitStatus(data.unitId, false);
    }
});

socket.on('disconnect', () => {
    console.log('🔌 Desconectado do servidor Socket.IO');
});

// Atualizar status da unidade na lista
function updateUnitStatus(unitId, isOnline) {
    const unitItems = document.querySelectorAll('.unit-item');
    unitItems.forEach(item => {
        const unitName = item.querySelector('h3').textContent;
        // Aqui você precisaria de uma maneira de associar o unitId com o elemento
        // Por enquanto, vamos atualizar a unidade atual se for a selecionada
        if (currentUnit && currentUnit._id === unitId) {
            const statusElement = item.querySelector('.unit-status');
            if (statusElement) {
                statusElement.className = `unit-status ${isOnline ? 'online' : 'offline'}`;
                statusElement.textContent = isOnline ? '🟢 Online' : '🔴 Offline';
            }
        }
    });
}

// Funções auxiliares para debug
window.debugDashboard = {
    reloadUnits: () => loadUnits(),
    showCurrentUnit: () => console.log('Unidade atual:', currentUnit),
    testSocket: () => socket.emit('test', { message: 'Teste do dashboard' }),
    toggleMenu: () => {
        const sidebar = document.querySelector('.sidebar');
        const sidebarOverlay = document.querySelector('.sidebar-overlay');
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
    }
};

// Adiciona listener para redimensionamento da tela
window.addEventListener('resize', () => {
    // Atualiza o título da unidade quando a tela é redimensionada
    if (currentUnit) {
        updateUnitTitle(currentUnit);
    }
});

// ⭐⭐ ESTILOS ATUALIZADOS PARA MODAL RESPONSIVO ⭐⭐
const calibrationStyles = `
.modal {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.5);
    overflow: auto;
}

.modal-content {
    background-color: white;
    margin: 2% auto;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
    from { transform: translateY(-50px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

.calibration-table-container {
    background: #f8f9fa;
    border-radius: 6px;
    margin-top: 8px;
}

.calibration-input-table {
    border-collapse: collapse;
}

.calibration-input-table th {
    background-color: #e9ecef;
    position: sticky;
    top: 0;
    z-index: 5;
}

.calibration-input-table tr:nth-child(even) {
    background-color: #f8f9fa;
}

.calibration-input-table tr:hover {
    background-color: #e3f2fd;
}

.calibration-input {
    transition: all 0.2s ease;
}

.calibration-input:focus {
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    transform: scale(1.02);
}

/* Responsividade */
@media (max-width: 768px) {
    .modal-content {
        margin: 5% auto;
        width: 95%;
        max-height: 85vh;
    }
    
    .calibration-input-table {
        font-size: 12px;
    }
    
    .calibration-input {
        font-size: 11px;
        padding: 3px;
    }
}
`;

// Adicione os estilos ao documento
const styleElement = document.createElement('style');
styleElement.textContent = calibrationStyles;
document.head.appendChild(styleElement);

console.log('✅ Dashboard carregado e pronto!');







