// Configuração do Socket.IO
const socket = io();

// Variáveis globais
let currentUnit = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    loadUnits();
});

// Verificação de autenticação
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    const user = JSON.parse(localStorage.getItem('user'));
    document.getElementById('username').textContent = user.username;
    
    // Mostra botão de adicionar unidade para admin
    if (user.role === 'admin') {
        document.getElementById('addUnitBtn').style.display = 'block';
    }
}

// Setup de event listeners
function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    });
}

// Carregar unidades
async function loadUnits() {
    try {
        const response = await fetch('/api/units', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar unidades');
        }

        const units = await response.json();
        
        if (!units || units.length === 0) {
            document.getElementById('unitsList').innerHTML = '<div class="no-units">Nenhuma unidade encontrada</div>';
            return;
        }

        displayUnits(units);
        
        // Se tiver apenas uma unidade, seleciona automaticamente após um pequeno delay
        // para garantir que os elementos do DOM foram criados
        if (units.length === 1) {
            setTimeout(() => selectUnit(units[0]), 100);
        }
    } catch (error) {
        console.error('Erro:', error);
        document.getElementById('unitsList').innerHTML = `<div class="error-message">Erro ao carregar unidades</div>`;
    }
}

// Exibir unidades
function displayUnits(units) {
    const unitsList = document.getElementById('unitsList');
    unitsList.innerHTML = '';

    units.forEach(unit => {
        const unitElement = document.createElement('div');
        unitElement.className = 'unit-item';
        unitElement.innerHTML = `
            <h3 data-id="${unit._id}">${unit.name}</h3>
            <p class="unit-location">${unit.location || ''}</p>
            <div class="unit-status ${unit.isOnline ? 'online' : 'offline'}">
                ${unit.isOnline ? 'Online' : 'Offline'}
            </div>
        `;
        unitElement.addEventListener('click', (e) => selectUnit(unit, unitElement));
        unitsList.appendChild(unitElement);
    });
}

// Selecionar uma unidade
function selectUnit(unit, clickedElement = null) {
    currentUnit = unit;
    document.getElementById('currentUnit').textContent = unit.name;
    document.getElementById('noSelection').style.display = 'none';
    document.getElementById('tankContent').style.display = 'block';

    // Remove seleção anterior
    const unitItems = document.querySelectorAll('.unit-item');
    unitItems.forEach(item => item.classList.remove('active'));
    
    // Adiciona classe active apenas se foi clicado
    if (clickedElement) {
        clickedElement.classList.add('active');
    } else {
        // Se foi seleção automática, encontra e ativa o elemento correspondente
        const unitElement = document.querySelector(`.unit-item h3[data-id="${unit._id}"]`)?.parentElement;
        if (unitElement) {
            unitElement.classList.add('active');
        }
    }

    // Exibe os dados atuais da unidade
    if (unit.lastData) {
        displayUnitData(unit.lastData);
    } else {
        displayUnitData({});
    }
}

// Exibir dados da unidade
function displayUnitData(data) {
    const tanksGrid = document.getElementById('tanksGrid');
    tanksGrid.innerHTML = `
        <div class="data-display">
            <div class="data-item ${data.isLowLevel ? 'warning' : ''}">
                <span class="data-label">Nível:</span>
                <span class="data-value">${data.waterLevel || 0}%</span>
            </div>
            <div class="data-item ${data.isHighTemp ? 'warning' : ''}">
                <span class="data-label">Temperatura:</span>
                <span class="data-value">${data.temperature || 0}°C</span>
            </div>
            <div class="data-item ${data.isVibrating ? 'warning' : ''}">
                <span class="data-label">Vibração:</span>
                <span class="data-value">${data.isVibrating ? 'Detectada' : 'Normal'}</span>
            </div>
            <div class="data-item">
                <span class="data-label">Contagem de Vibrações:</span>
                <span class="data-value">${data.vibrationCount || 0}</span>
            </div>
            <div class="update-time">
                Última atualização: ${data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Nunca'}
            </div>
        </div>
    `;
}

// Socket.IO event listeners
socket.on('connect', () => {
    console.log('Conectado ao servidor');
});

socket.on('unitUpdate', (data) => {
    console.log('Atualização recebida:', data);
    if (currentUnit && data.unitId === currentUnit._id) {
        displayUnitData(data.data);
    }
});