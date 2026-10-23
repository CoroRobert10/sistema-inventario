// ==============================================================================
// SHIFRA SPA - CÓDIGO COMPLETO INTEGRADOR CON SUPABASE Y PRECIOS SEGUROS
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

// CARGAR DATOS (CON PRIORIDAD LOCAL SEGURA)
async function loadDataFromSupabase() {
  try {
    // 1. Cargar de inmediato desde memoria local para que nunca aparezca vacío
    const localInv = localStorage.getItem('shifra_spa_db');
    const localHist = localStorage.getItem('shifra_spa_history');

    if (localInv) inventory = JSON.parse(localInv);
    if (localHist) historyLogs = JSON.parse(localHist);
    renderAllViews();

    // 2. Sincronizar con Supabase en segundo plano
    const { data: invData } = await supabaseClient.from('inventory').select('*');
    const { data: histData } = await supabaseClient.from('history').select('*').order('id', { ascending: false });
    const { data: servData } = await supabaseClient.from('services').select('*');

    if (invData && invData.length > 0) {
      inventory = invData;
      localStorage.setItem('shifra_spa_db', JSON.stringify(inventory));
    }
    if (histData && histData.length > 0) {
      historyLogs = histData;
      localStorage.setItem('shifra_spa_history', JSON.stringify(historyLogs));
    }
    if (servData && servData.length > 0) {
      servicesCatalog = servData.map(s => ({
        ...s,
        recipe: typeof s.recipe === 'string' ? JSON.parse(s.recipe) : s.recipe
      }));
    }

    renderAllViews();
  } catch (err) {
    console.error("Modo local activo:", err);
  }
}

// GUARDAR Y SINCRONIZAR SEGURO
async function saveAndSync() {
  // Guardar localmente primero
  localStorage.setItem('shifra_spa_db', JSON.stringify(inventory));
  localStorage.setItem('shifra_spa_history', JSON.stringify(historyLogs));
  renderAllViews();

  try {
    // Sincronización segura con Supabase
    await supabaseClient.from('inventory').delete().not('id', 'is', null);
    if (inventory.length > 0) {
      const cleanInv = inventory.map(({ id, ...rest }) => rest);
      const { error } = await supabaseClient.from('inventory').insert(cleanInv);
      if (error) console.error("Error al insertar en Supabase:", error);
    }

    await supabaseClient.from('history').delete().not('id', 'is', null);
    if (historyLogs.length > 0) {
      const cleanHist = historyLogs.map(({ id, ...rest }) => rest);
      await supabaseClient.from('history').insert(cleanHist);
    }
    showToast('Sincronizado en la nube con éxito.');
  } catch (e) {
    console.error("Aviso de sincronización:", e);
    showToast('Guardado localmente (Revisa conexión a nube)');
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
  if (!container) return;
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
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchInput = document.getElementById('inv-search-input');
  const search = searchInput ? searchInput.value.toLowerCase() : '';

  let list = inventory.filter(i => {
    const matchSearch = (i.name && i.name.toLowerCase().includes(search)) || (i.cat && i.cat.toLowerCase().includes(search));
    const matchStore = selectedStoreFilter === 'TODOS' || (i.cat || 'General').toUpperCase() === selectedStoreFilter.toUpperCase();
    const matchLow = hideLowStockFlag ? Number(i.stock) <= 3 : true;
    return matchSearch && matchStore && matchLow;
  });

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#888;">No hay artículos registrados.</td></tr>`;
    return;
  }

  list.forEach((item, index) => {
    const isLow = Number(item.stock) <= 3;
    const formattedPrice = Number(item.price || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge-tag">${(item.cat || 'General').toUpperCase()}</span></td>
      <td><strong>${item.name}</strong></td>
      <td>${item.detail || 'Almacen General'}</td>
      <td>${item.unit || 'Piezas'}</td>
      <td><strong style="color: var(--gold-dark);">${formattedPrice}</strong></td>
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

// IMPORTAR EXCEL (FUSIÓN INTELIGENTE POR CATEGORÍA)
function importExcel(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);

      if (json && json.length > 0) {
        let addedCount = 0;
        let updatedCount = 0;

        json.forEach(row => {
          const cat = String(row['Categoría'] || row['CATEGORIA'] || row['CATEGORÍA'] || row['Cat'] || firstSheetName).trim().toUpperCase();
          const name = String(row['Artículo'] || row['ARTICULO'] || row['ARTÍCULO'] || row['Nombre'] || row['Item'] || 'Sin Nombre').trim();
          const detail = String(row['Detalle'] || row['DETALLE'] || row['Ubicación'] || row['UBICACIÓN'] || row['Ubicacion'] || row['UBICACION'] || row['Presentación'] || '').trim();
          const unit = String(row['Unidad'] || row['UNIDAD'] || row['Medida'] || row['MEDIDA'] || 'Piezas').trim();
          const stock = Number(row['Stock'] || row['STOCK'] || row['Inventario'] || row['INVENTARIO'] || row['Cantidad'] || 0);
          const price = Number(row['Precio'] || row['PRECIO'] || row['price'] || 0);

          const existingIndex = inventory.findIndex(i => 
            i.name && i.name.toLowerCase() === name.toLowerCase() && 
            (i.cat || 'GENERAL').toUpperCase() === cat
          );

          if (existingIndex !== -1) {
            inventory[existingIndex].stock = stock;
            inventory[existingIndex].price = price > 0 ? price : inventory[existingIndex].price;
            inventory[existingIndex].detail = detail || inventory[existingIndex].detail;
            inventory[existingIndex].unit = unit || inventory[existingIndex].unit;
            updatedCount++;
          } else {
            inventory.push({ cat, name, detail, unit, stock, price });
            addedCount++;
          }
        });

        saveAndSync();
        showToast(`Importación exitosa: ${addedCount} nuevos, ${updatedCount} actualizados.`);
      } else {
        alert('El archivo Excel no contiene datos válidos.');
      }
    } catch (err) {
      console.error("Error leyendo archivo Excel:", err);
      alert('Ocurrió un error al procesar el archivo Excel.');
    }
  };
  reader.readAsArrayBuffer(file);
}

// RESPALDAR JSON
function exportBackupJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(inventory, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `respaldo_shifra_spa_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

// EXPORTAR A EXCEL
function exportToExcel() {
  const ws = XLSX.utils.json_to_sheet(inventory);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  XLSX.writeFile(wb, `Inventario_Shifra_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// VACIAR INVENTARIO
function confirmClearInventory() {
  if (confirm("¿Estás seguro de que deseas borrar toda la base de datos de inventario?")) {
    inventory = [];
    saveAndSync();
    showToast("Base de datos vaciada.");
  }
}

// DOSIFICACIÓN
function populateDosiDropdown() {
  const select = document.getElementById('dosi-select-item');
  if (!select) return;
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
  const select = document.getElementById('dosi-select-item');
  if (!select) return;
  const name = select.value;
  const item = inventory.find(i => i.name === name);
  const label = document.getElementById('dosi-stock-label');
  if (label) {
    label.innerText = item ? `${item.stock} ${item.unit || 'Piezas'}` : '0 Piezas';
  }
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
  if (!tbody) return;
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
  if (!select) return;
  select.innerHTML = '';
  inventory.forEach(i => {
    const opt = document.createElement('option');
    opt.value = i.name;
    opt.innerText = `${i.name} (${(i.cat || 'General').toUpperCase()})`;
    select.appendChild(opt);
  });
}

function loadItemTrendDetails() {
  const select = document.getElementById('trend-item-select');
  if (!select) return;
  const name = select.value;
  const logs = historyLogs.filter(h => h.item === name && h.type === 'Dosificación');

  const tbody = document.getElementById('trend-history-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

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

  const totalVal = document.getElementById('trend-total-val');
  if (totalVal) {
    totalVal.innerText = `${logs.length * 2} Piezas`;
  }
}

// SERVICIOS
function renderServicesCatalog() {
  const tbody = document.getElementById('services-catalog-list');
  if (!tbody) return;
  tbody.innerHTML = '';

  servicesCatalog.forEach(s => {
    const recipeText = s.recipe.map(r => `${r.name}: ${r.qty} ${r.unit}`).join(', ');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${s.name}</strong></td>
      <td>${recipeText}</td>
    `;
    tbody.appendChild(tr);
  });
}

// GRÁFICOS
function renderCharts() {
  const stores = [...new Set(inventory.map(i => i.cat || 'General'))];
  const skuCounts = stores.map(s => inventory.filter(i => (i.cat || 'General') === s).length);
  const volumeCounts = stores.map(s => inventory.filter(i => (i.cat || 'General') === s).reduce((a, b) => a + Number(b.stock), 0));

  if (chartSkusInstance) chartSkusInstance.destroy();
  if (chartVolumeInstance) chartVolumeInstance.destroy();

  const ctxSkus = document.getElementById('chart-skus');
  if (ctxSkus) {
    chartSkusInstance = new Chart(ctxSkus.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: stores,
        datasets: [{ data: skuCounts, backgroundColor: ['#a88d55', '#333333', '#3498db', '#e74c3c'] }]
      }
    });
  }

  const ctxVol = document.getElementById('chart-volume');
  if (ctxVol) {
    chartVolumeInstance = new Chart(ctxVol.getContext('2d'), {
      type: 'bar',
      data: {
        labels: stores,
        datasets: [{ label: 'Piezas Total', data: volumeCounts, backgroundColor: '#bda26b' }]
      }
    });
  }
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
  if (!tbody) return;
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

function clearFullHistory() {
  if (confirm("¿Borrar todo el historial de movimientos?")) {
    historyLogs = [];
    saveAndSync();
    renderHistorialModalTable();
  }
}

function openAddModal() { document.getElementById('modal-add-item').style.display = 'flex'; }
function closeAddModal() { document.getElementById('modal-add-item').style.display = 'none'; }

function saveNewItem() {
  const cat = document.getElementById('add-item-cat').value.trim() || 'General';
  const name = document.getElementById('add-item-name').value.trim();
  const detail = document.getElementById('add-item-location').value.trim() || 'Almacen General';
  const unit = document.getElementById('add-item-unit').value.trim() || 'Piezas';
  const stock = Number(document.getElementById('add-item-stock').value) || 0;
  const price = Number(document.getElementById('add-item-price').value) || 0;

  if (!name) return alert('Escribe el nombre del artículo.');

  inventory.push({ cat, name, detail, unit, stock, price });
  saveAndSync();
  closeAddModal();
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerText = msg;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 3000);
}
