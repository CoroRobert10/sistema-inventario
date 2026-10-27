let inventory = JSON.parse(localStorage.getItem('shifra_spa_db')) || [];
let historyLogs = JSON.parse(localStorage.getItem('shifra_spa_history')) || [];
let dosiBatches = JSON.parse(localStorage.getItem('shifra_spa_dosi_batches')) || [];
let servicesCatalog = JSON.parse(localStorage.getItem('shifra_spa_services')) || [];
let oilData = JSON.parse(localStorage.getItem('shifra_spa_oil')) || {
  maxCapacity: 20,
  currentLiters: 20,
  logs: []
};

let dosiList = [];
let currentServiceRecipe = [];
let currentWarehouse = 'ALL';
let hideLowStockFlag = false;
let currentPage = 1;
const pageSize = 20;

window.addEventListener('DOMContentLoaded', () => {
  console.log("Shifra Spa cargado correctamente.");
  saveAndRender();
});

// CONTROL DE PORTADA E INICIO (Directo y forzado)
function entrarAlSistema() {
  const portada = document.getElementById('viewPortada');
  const mainApp = document.getElementById('mainApp');
  
  if (portada) {
    portada.style.display = 'none';
  }
  if (mainApp) {
    mainApp.style.display = 'block';
  }
  switchView('inicio');
}

function volverAPortada() {
  const portada = document.getElementById('viewPortada');
  const mainApp = document.getElementById('mainApp');
  
  if (portada) {
    portada.style.display = 'flex';
  }
  if (mainApp) {
    mainApp.style.display = 'none';
  }
}

// CAMBIO DE VISTAS Y PESTAÑAS
function switchView(viewName) {
  const views = {
    inicio: document.getElementById('viewInicio'),
    inventario: document.getElementById('viewInventario'),
    dosificacion: document.getElementById('viewDosificacion'),
    servicios: document.getElementById('viewServicios'),
    aceite: document.getElementById('viewAceite'),
    tendencias: document.getElementById('viewTendencias'),
    dashboard: document.getElementById('viewDashboard')
  };

  const buttons = {
    inicio: document.getElementById('navBtnInicio'),
    inventario: document.getElementById('navBtnInventario'),
    dosificacion: document.getElementById('navBtnDosificacion'),
    servicios: document.getElementById('navBtnServicios'),
    aceite: document.getElementById('navBtnAceite'),
    tendencias: document.getElementById('navBtnTendencias'),
    dashboard: document.getElementById('navBtnDashboard')
  };

  Object.values(views).forEach(v => { if (v) v.style.display = 'none'; });
  Object.values(buttons).forEach(b => { if (b) b.classList.remove('active-nav-tab'); });

  if (views[viewName]) {
    views[viewName].style.display = 'block';
  }
  if (buttons[viewName]) {
    buttons[viewName].classList.add('active-nav-tab');
  }

  if (viewName === 'inventario') {
    saveAndRender();
  } else {
    updateHomeStats();
  }
}

function updateHomeStats() {
  const totalSkusEl = document.getElementById('homeTotalSkus');
  const totalUnitsEl = document.getElementById('homeTotalUnits');
  if (!totalSkusEl || !totalUnitsEl) return;

  let totalUnits = 0;
  inventory.forEach(i => { totalUnits += (parseInt(i.stock) || 0); });
  totalSkusEl.innerText = inventory.length;
  totalUnitsEl.innerText = totalUnits;
}

function saveAndRender() {
  localStorage.setItem('shifra_spa_db', JSON.stringify(inventory));
  updateHomeStats();
}
