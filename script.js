// ==============================================================================
// SHIFRA SPA - CÓDIGO COMPLETO INTEGRADOR CON SUPABASE
// ==============================================================================

const SUPABASE_URL = 'https://uhkahspaqwcldvutzmnm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoa2Foc3BhcXdjbGR2dXR6bW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwODY4ODUsImV4cCI6MjEwNzY2Mjg4NX0.lKtw1EG-6eDF6EPzm27HPNZPWcNmNuKMGcB6HJGRxo8';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ESTADO GLOBAL
let inventory = [];
let historyLogs = [];
let dosiPendingList = [];
let servicesCatalog = [
  { name: 'SUE 50', recipe: [{ name: 'Aceite para Masajes', qty: 30, unit: 'ml' }] },
  { name: 'HOL 80', recipe: [{ name: 'Aceite para Masajes', qty: 50, unit: 'ml' }] }
];

let selectedStoreFilter = 'TODOS';
let hideLowStockFlag = false;
let chartSkusInstance = null;
let chartVolumeInstance = null;

// INICIALIZACIÓN
window.addEventListener('DOMContentLoaded', () => {
  loadDataFromSupabase();
});

function openWelcomeScreen() { document.getElementById('welcome-screen').style.display = 'flex'; }
function closeWelcomeScreen() { document.getElementById('welcome-screen').style.display = 'none'; }

// CARGAR DATOS SUPABASE
async function loadDataFromSupabase() {
  try {
    const { data: invData } = await supabaseClient.from('inventory').select('*');
    const { data: histData } = await supabaseClient.from('history').select('*').order('id', { ascending: false });
    const { data: servData } = await supabaseClient.from('services').select('*');

    if (invData && invData.length > 0) inventory = invData;
    if (histData && histData.length > 0) historyLogs = histData;
    if (servData && servData.length > 0) {
      servicesCatalog = servData.map(s => ({
        ...s,
        recipe: typeof s.recipe === 'string' ? JSON.parse(s.recipe) : s.recipe
      }));
    }

    renderAllViews();
    showToast('Sincronizado con Supabase');
  } catch (err) {
    console.error("Error al cargar de Supabase:", err);
  }
}

// GUARDAR Y SINCRONIZAR
async function saveAndSync() {
  localStorage.setItem('shifra_spa_db', JSON.stringify(inventory));
  localStorage.setItem('shifra_spa_history', JSON.stringify(historyLogs));

  renderAllViews();

  try {
    await supabaseClient.from('inventory').delete().neq('id', 0);
    if (inventory.length > 0) {
      const cleanInv = inventory.map(({ id, ...rest }) => rest);
      await supabaseClient.from('inventory').insert(cleanInv);
    }

    await supabaseClient.from('history').delete().neq('id', 0);
    if (historyLogs.length > 0) {
      const cleanHist = historyLogs.map(({ id, ...rest }) => rest);
      await supabaseClient.from('history').insert(cleanHist);
    }
  } catch (e) {
    console.error("Error de guardado en la nube:", e);
  }
}

// NAVEGACIÓN
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

  const targetSec = document.getElementById(`sec-${tabId}`);
  const targetBtn = document.getElementById(`tab-btn-${tabId}`);

  if (targetSec) targetSec.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  if (tabId === 'graficos') renderCharts();
}

function renderAllViews() {
  updateMetrics();
  renderCategoryPills();
  renderInventoryTable();
  populateDosiDropdown();
  renderServicesCatalog();
  populateTrendSelect();
}

function updateMetrics() {
  const skus = inventory.length;
  const stock = inventory.reduce((a, b) => a + Number(b.stock || 0), 0);
  const low = inventory.filter(i => Number(i.stock) <= 3).length;

  document.getElementById('metric-skus').innerText = skus;
  document.getElementById('metric-stock').innerText = stock;
  document.getElementById('metric-alerts').innerText = low;

  document.getElementById('inv-total-art').innerText = skus;
  document.getElementById('inv-low-art').innerText = low;

  document.getElementById('g-skus').innerText = skus;
  document.getElementById('g-stock').innerText = stock;
  document.getElementById('g-critical').innerText = low;

  const stores = [...new Set(inventory.map(i => i.cat || 'General'))].length;
  document.getElementById('g-stores').innerText = stores;
}

// INVENTARIO
function renderCategoryPills() {
  const container = document.getElementById('category-pills');
  const stores = ['TODOS', ...new Set(inventory.map(i => i.cat || 'General'))];

  container.innerHTML = stores.map(store => `
    <button class="pill ${selectedStoreFilter === store ? 'active' : ''}" onclick="filterByStore('${store}')">
      ${store === 'TODOS' ? 'TODOS los almacenes' : store.toUpperCase()}
    </button>
  `).join('');
}

function filterByStore(store) {
  selectedStoreFilter = store;
  renderCategoryPills();
  renderInventoryTable();
}

function toggleLowStockFilter() {
  hideLowStockFlag = !hideLowStockFlag;
  renderInventoryTable();
}

function renderInventoryTable() {
  const tbody = document.getElementById('inventory-table-body');
  tbody.innerHTML = '';

  const search = document.getElementById('inv-search-input').value.toLowerCase();

  let list = inventory.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search) || (i.cat && i.cat.toLowerCase().includes(search));
    const matchStore = selectedStoreFilter === 'TODOS' || (i.cat || 'General').toUpperCase() === selectedStoreFilter.toUpperCase();
    const matchLow = hideLowStockFlag ? Number(i.stock) <= 3 : true;
    return matchSearch && matchStore && matchLow;
  });

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#888;">No hay artículos registrados.</td></tr>`;
    return;
  }

  list.forEach((item, index) => {
    const isLow = Number(item.stock) <= 3;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge-tag">${(item.cat || 'General').toUpperCase()}</span></td>
      <td><strong>${item.name}</strong></td>
      <td>${item.detail || 'Almacen General'}</td>
      <td>${item.unit || 'Piezas'}</td>
      <td><strong>${item.stock}</strong></td>
      <td><span class="badge-status ${isLow ? 'low' : ''}">${isLow ? 'Stock Bajo' : 'Normal'}</span></td>
      <td>
        <div class="action-btn-group">
          <button class="btn-icon" title="Traspasar" onclick="openTraspasoModalForItem(${index})"><i class="fa-solid fa-right-left"></i></button>
          <button class="btn-icon" title="Aumentar" onclick="adjustStock(${index}, 1)"><i class="fa-solid fa-plus"></i></button>
          <button class="btn-icon" title="Disminuir" onclick="adjustStock(${index}, -1)"><i class="fa-solid fa-minus"></i></button>
          <button class="btn-icon delete" title="Borrar" onclick="deleteItem(${index})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function adjustStock(index, delta) {
  inventory[index].stock = Math.max(0, Number(inventory[index].stock) + delta);
  saveAndSync();
}

function deleteItem(index) {
  if (confirm(`¿Eliminar "${inventory[index].name}"?`)) {
    inventory.splice(index, 1);
    saveAndSync();
  }
}

// DOSIFICACIÓN
function populateDosiDropdown() {
  const select = document.getElementById('dosi-select-item');
  select.innerHTML = '';
  inventory.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.name;
    opt.innerText = `${item.name} (${item.cat || 'General'}) — Stock: ${item.stock} ${item.unit || 'Piezas'}`;
    select.appendChild(opt);
  });
  updateDosiAvailableStock();
}

function updateDosiAvailableStock() {
  const name = document.getElementById('dosi-select-item').value;
  const item = inventory.find(i => i.name === name);
  document.getElementById('dosi-stock-label').innerText = item ? `${item.stock} ${item.unit || 'Piezas'}` : '0 Piezas';
}

function addDosiToList() {
  const name = document.getElementById('dosi-select-item').value;
  const qty = Number(document.getElementById('dosi-qty-input').value);

  const item = inventory.find(i => i.name === name);
  if (!item) return;

  dosiPendingList.push({ cat: item.cat || 'General', name: item.name, qty, unit: item.unit || 'Piezas' });
  renderDosiPendingList();
}

function renderDosiPendingList() {
  const tbody = document.getElementById('dosi-pending-list');
  tbody.innerHTML = '';

  dosiPendingList.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.cat}</td>
      <td><strong>${item.name}</strong></td>
      <td>${item.qty} ${item.unit}</td>
      <td><button class="btn-icon delete" onclick="removeDosiPending(${index})"><i class="fa-solid fa-xmark"></i></button></td>
    `;
    tbody.appendChild(tr);
  });
}

function removeDosiPending(index) {
  dosiPendingList.splice(index, 1);
  renderDosiPendingList();
}

function confirmDosiBatch() {
  if (dosiPendingList.length === 0) return alert('La lista está vacía.');

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX');
  const timeStr = now.toLocaleTimeString('es-MX');

  dosiPendingList.forEach(p => {
    const item = inventory.find(i => i.name === p.name);
    if (item) {
      item.stock = Math.max(0, item.stock - p.qty);
      historyLogs.unshift({
        dateRaw: dateStr,
        time: timeStr,
        type: 'Dosificación',
        item: item.name,
        detail: `Salida dosificada: -${p.qty} ${p.unit} (${item.cat || 'General'})`
      });
    }
  });

  dosiPendingList = [];
  renderDosiPendingList();
  saveAndSync();
  showToast('Dosificación descontada con éxito.');
}

// TENDENCIAS
function populateTrendSelect() {
  const select = document.getElementById('trend-item-select');
  select.innerHTML = '';
  inventory.forEach(i => {
    const opt = document.createElement('option');
    opt.value = i.name;
    opt.innerText = `${i.name} (${(i.cat || 'General').toUpperCase()})`;
    select.appendChild(opt);
  });
}

function loadItemTrendDetails() {
  const name = document.getElementById('trend-item-select').value;
  const logs = historyLogs.filter(h => h.item === name && h.type === 'Dosificación');

  const tbody = document.getElementById('trend-history-tbody');
  tbody.innerHTML = '';

  let totalOut = 0;
  logs.forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${l.dateRaw}</td>
      <td>${l.time}</td>
      <td><span class="badge-tag">${l.item}</span></td>
      <td><strong style="color:var(--danger-main);">${l.detail}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('trend-total-val').innerText = `${logs.length * 2} Piezas`;
}

// GRÁFICOS
function renderCharts() {
  const stores = [...new Set(inventory.map(i => i.cat || 'General'))];
  const skuCounts = stores.map(s => inventory.filter(i => (i.cat || 'General') === s).length);
  const volumeCounts = stores.map(s => inventory.filter(i => (i.cat || 'General') === s).reduce((a, b) => a + Number(b.stock), 0));

  if (chartSkusInstance) chartSkusInstance.destroy();
  if (chartVolumeInstance) chartVolumeInstance.destroy();

  const ctxSkus = document.getElementById('chart-skus').getContext('2d');
  chartSkusInstance = new Chart(ctxSkus, {
    type: 'doughnut',
    data: {
      labels: stores,
      datasets: [{ data: skuCounts, backgroundColor: ['#a88d55', '#333333', '#3498db', '#e74c3c'] }]
    }
  });

  const ctxVol = document.getElementById('chart-volume').getContext('2d');
  chartVolumeInstance = new Chart(ctxVol, {
    type: 'bar',
    data: {
      labels: stores,
      datasets: [{ label: 'Piezas Total', data: volumeCounts, backgroundColor: '#bda26b' }]
    }
  });
}

// MODALES
function openTraspasoModal() { document.getElementById('modal-traspaso').style.display = 'flex'; }
function closeTraspasoModal() { document.getElementById('modal-traspaso').style.display = 'none'; }

function openHistorialModal() {
  renderHistorialModalTable();
  document.getElementById('modal-historial').style.display = 'flex';
}
function closeHistorialModal() { document.getElementById('modal-historial').style.display = 'none'; }

function renderHistorialModalTable() {
  const tbody = document.getElementById('historial-modal-tbody');
  tbody.innerHTML = '';

  historyLogs.forEach(h => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${h.dateRaw} ${h.time}</td>
      <td><span class="badge-status">${h.type}</span></td>
      <td><strong>${h.item}</strong></td>
      <td>${h.detail}</td>
    `;
    tbody.appendChild(tr);
  });
}

function openAddModal() { document.getElementById('modal-add-item').style.display = 'flex'; }
function closeAddModal() { document.getElementById('modal-add-item').style.display = 'none'; }

function saveNewItem() {
  const cat = document.getElementById('add-item-cat').value.trim() || 'General';
  const name = document.getElementById('add-item-name').value.trim();
  const detail = document.getElementById('add-item-location').value.trim() || 'Almacen General';
  const unit = document.getElementById('add-item-unit').value.trim() || 'Piezas';
  const stock = Number(document.getElementById('add-item-stock').value) || 0;

  if (!name) return alert('Escribe el nombre del artículo.');

  inventory.push({ cat, name, detail, unit, stock });
  saveAndSync();
  closeAddModal();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.innerText = msg;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 3000);
}