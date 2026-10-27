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
  saveAndRender();
});

// CONTROL DE PORTADA E INICIO
function entrarAlSistema() {
  const portada = document.getElementById('viewPortada');
  const mainApp = document.getElementById('mainApp');
  if (portada) portada.style.display = 'none';
  if (mainApp) mainApp.style.display = 'block';
  switchView('inicio');
}

function volverAPortada() {
  const portada = document.getElementById('viewPortada');
  const mainApp = document.getElementById('mainApp');
  if (portada) portada.style.display = 'flex';
  if (mainApp) mainApp.style.display = 'none';
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
  } else if (viewName === 'dosificacion') {
    initDosificacionView();
  } else if (viewName === 'servicios') {
    initServiciosView();
  } else if (viewName === 'aceite') {
    initAceiteView();
  } else if (viewName === 'tendencias') {
    initTendenciasView();
  } else if (viewName === 'dashboard') {
    renderDashboardCharts();
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
  buildWarehouseTabs();
  filterProducts();
  updateStats();
  updateHomeStats();
}

function updateStats() {
  const statTotal = document.getElementById('statTotal');
  if (statTotal) statTotal.innerText = inventory.length;
}

function buildWarehouseTabs() {
  const container = document.getElementById('warehouseTabsContainer');
  if (!container) return;

  const categories = [...new Set(inventory.map(item => item.cat))].filter(Boolean).sort();
  let html = `<div class="warehouse-tab ${currentWarehouse === 'ALL' ? 'active' : ''}" onclick="setWarehouse('ALL', this)">TODAS las ubicaciones</div>`;
  categories.forEach(c => {
    const activeClass = (currentWarehouse === c) ? 'active' : '';
    html += `<div class="warehouse-tab ${activeClass}" onclick="setWarehouse('${c}', this)">${c}</div>`;
  });
  container.innerHTML = html;

  const datalist = document.getElementById('warehouseOptions');
  if (datalist) {
    datalist.innerHTML = categories.map(c => `<option value="${c}">`).join('');
  }
}

function setWarehouse(warehouse, el) {
  currentWarehouse = warehouse;
  document.querySelectorAll('.warehouse-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  currentPage = 1;
  filterProducts();
}

function filterProducts() {
  const searchInput = document.getElementById('searchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filtered = inventory.filter(item => {
    const matchesWarehouse = (currentWarehouse === 'ALL' || item.cat === currentWarehouse);
    const matchesQuery = !query || item.name.toLowerCase().includes(query) || (item.cat && item.cat.toLowerCase().includes(query));
    const matchesLowStock = !hideLowStockFlag || item.stock > 3;
    return matchesWarehouse && matchesQuery && matchesLowStock;
  });

  renderTablePage(filtered);
}

function renderTablePage(items) {
  const tbody = document.getElementById('tableBody');
  const pageInfo = document.getElementById('pageInfo');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No se encontraron artículos. Sube tu Excel o agrega uno nuevo.</td></tr>`;
    if (pageInfo) pageInfo.innerText = '0 de 0';
    return;
  }

  const totalPages = Math.ceil(items.length / pageSize);
  if (currentPage > totalPages) currentPage = totalPages;
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, items.length);
  const pageItems = items.slice(startIdx, endIdx);

  let rowsHtml = '';
  pageItems.forEach((item) => {
    const globalIdx = inventory.indexOf(item);
    rowsHtml += `
      <tr>
        <td class="fw-bold" style="color: #3a322d;">${item.name}</td>
        <td><span class="badge bg-secondary text-white">${item.cat}</span></td>
        <td>${item.unit || 'Piezas'}</td>
        <td>$${(parseFloat(item.price) || 0).toFixed(2)}</td>
        <td><span class="fs-6 fw-bold px-2 py-1 bg-white border border-light-subtle rounded">${item.stock}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary me-1" onclick="openDirectTransfer(${globalIdx})" title="Traspasar"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="editProduct(${globalIdx})" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn btn-sm btn-outline-success me-1" onclick="adjustStock(${globalIdx}, 1)" title="Aumentar"><i class="fa-solid fa-plus"></i></button>
          <button class="btn btn-sm btn-outline-warning me-1" onclick="adjustStock(${globalIdx}, -1)" title="Reducir"><i class="fa-solid fa-minus"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteProduct(${globalIdx})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = rowsHtml;
  if (pageInfo) pageInfo.innerText = `Mostrando ${startIdx + 1}-${endIdx} de ${items.length} artículos`;
}

function changePage(direction) {
  currentPage += direction;
  filterProducts();
}

function adjustStock(index, amount) {
  if (inventory[index].stock + amount < 0) return;
  inventory[index].stock += amount;
  logMovement(amount > 0 ? 'ENTRADA' : 'SALIDA', inventory[index].name, `${amount > 0 ? '+1' : '-1'}. Total: ${inventory[index].stock}`);
  saveAndRender();
}

function logMovement(type, itemName, detail) {
  const now = new Date();
  const timestamp = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  historyLogs.unshift({ time: timestamp, type: type, item: itemName, detail: detail });
  localStorage.setItem('shifra_spa_history', JSON.stringify(historyLogs));
}

function renderHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  tbody.innerHTML = historyLogs.map(l => `<tr><td class="small text-muted">${l.time}</td><td><span class="badge bg-secondary">${l.type}</span></td><td class="fw-bold">${l.item}</td><td class="small">${l.detail}</td></tr>`).join('') || `<tr><td colspan="4" class="text-center py-3 text-muted">Sin historial.</td></tr>`;
}

function exportExcelReport() {
  if (inventory.length === 0) return alert("Sin datos.");
  const ws = XLSX.utils.json_to_sheet(inventory);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  XLSX.writeFile(wb, `Reporte_Shifra_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ inventory, historyLogs, dosiBatches, servicesCatalog, oilData }, null, 2));
  const a = document.createElement('a');
  a.href = dataStr; a.download = "respaldo_shifra.json";
  document.body.appendChild(a); a.click(); a.remove();
}

function handleExcelUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      let newInv = [];
      wb.SheetNames.forEach(sheet => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1 });
        rows.forEach((r, i) => {
          if (i > 0 && r[0]) {
            newInv.push({ cat: sheet.toUpperCase(), name: String(r[0] || '').trim(), unit: String(r[1] || 'Piezas'), price: parseFloat(r[2]) || 0, stock: parseInt(r[3]) || 0 });
          }
        });
      });
      if (newInv.length > 0) {
        inventory = newInv;
        saveAndRender();
        document.getElementById('uploadStatus').innerText = `¡Éxito! ${inventory.length} cargados.`;
      }
    } catch (err) { alert("Error al leer archivo."); }
  };
  reader.readAsArrayBuffer(file);
}
