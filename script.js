// ==============================================================================
// SHIFRA SPA - CÓDIGO CON MÓDULO DINÁMICO DE GARRAFÓN DE ACEITE (20 LITROS)
// ==============================================================================

const SUPABASE_URL = 'https://uhkahspaqwcldvutzmnm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoa2Foc3BhcXdjbGR2dXR6bW5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwODY4ODUsImV4cCI6MjEwNzY2Mjg4NX0.lKtw1EG-6eDF6EPzm27HPNZPWcNmNuKMGcB6HJGRxo8';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ESTADO GLOBAL
let inventory = [];
let historyLogs = [];
let dosiPendingList = [];
let servicesCatalog = [
  { name: 'PEDI SPA', recipe: [{ name: 'Aceite para Masajes 20L', qty: 30, unit: 'ml' }] },
  { name: 'MANI SPA', recipe: [{ name: 'Aceite para Masajes 20L', qty: 20, unit: 'ml' }] }
];
let currentRecipeTemp = [];

// ESTADO ESPECÍFICO DEL GARRAFÓN DE ACEITE (20L = 20,000 ML)
const GALLON_MAX_ML = 20000;
let gallonCurrentMl = 20000;
let oilDispenseLogs = [];

let selectedLocationFilter = 'TODOS';

// INICIALIZACIÓN
window.addEventListener('DOMContentLoaded', () => {
  loadDataFromSupabase();
});

function openWelcomeScreen() { document.getElementById('welcome-screen').style.display = 'flex'; }
function closeWelcomeScreen() { document.getElementById('welcome-screen').style.display = 'none'; }

// CARGAR DATOS
async function loadDataFromSupabase() {
  try {
    const localInv = localStorage.getItem('shifra_spa_db');
    const localHist = localStorage.getItem('shifra_spa_history');
    const localServ = localStorage.getItem('shifra_spa_services');
    const localOilMl = localStorage.getItem('shifra_spa_oil_ml');
    const localOilLogs = localStorage.getItem('shifra_spa_oil_logs');

    if (localInv) { try { inventory = JSON.parse(localInv); } catch(e) { inventory = []; } }
    if (localHist) { try { historyLogs = JSON.parse(localHist); } catch(e) { historyLogs = []; } }
    if (localServ) { try { servicesCatalog = JSON.parse(localServ); } catch(e) {} }
    if (localOilMl !== null) gallonCurrentMl = Number(localOilMl);
    if (localOilLogs) { try { oilDispenseLogs = JSON.parse(localOilLogs); } catch(e) { oilDispenseLogs = []; } }
    
    renderAllViews();

    const { data: invData } = await supabaseClient.from('inventory').select('*');
    const { data: histData } = await supabaseClient.from('history').select('*').order('id', { ascending: false });

    if (invData && invData.length > 0) {
      inventory = invData.map(item => ({
        ...item,
        detail: item.detail || item.location || 'Almacen General',
        cat: item.cat || 'GENERAL',
        price: Number(item.price || 0),
        stock: Number(item.stock || 0)
      }));
      localStorage.setItem('shifra_spa_db', JSON.stringify(inventory));
    }

    if (histData && histData.length > 0) {
      historyLogs = histData;
      localStorage.setItem('shifra_spa_history', JSON.stringify(historyLogs));
    }

    renderAllViews();
  } catch (err) {
    console.error("Modo local activo:", err);
    renderAllViews();
  }
}

// GUARDAR Y SINCRONIZAR
async function saveAndSync() {
  localStorage.setItem('shifra_spa_db', JSON.stringify(inventory));
  localStorage.setItem('shifra_spa_history', JSON.stringify(historyLogs));
  localStorage.setItem('shifra_spa_services', JSON.stringify(servicesCatalog));
  localStorage.setItem('shifra_spa_oil_ml', gallonCurrentMl);
  localStorage.setItem('shifra_spa_oil_logs', JSON.stringify(oilDispenseLogs));
  
  renderAllViews();

  try {
    await supabaseClient.from('inventory').delete().not('id', 'is', null);
    if (inventory.length > 0) {
      const cleanInv = inventory.map(({ id, ...rest }) => rest);
      await supabaseClient.from('inventory').insert(cleanInv);
    }
    showToast('Sincronizado correctamente');
  } catch (e) {
    showToast('Guardado localmente');
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

  if (tabId === 'aceite') {
    updateGallonUI();
    renderOilLogsTable();
  }
}

function renderAllViews() {
  updateMetrics();
  renderLocationPills();
  populateColumnFilterSelect();
  renderInventoryTable();
  populateDosiLocationFilter();
  populateDosiDropdown();
  renderServicesCatalog();
  populateServiceSelect();
  updateGallonUI();
  renderOilLogsTable();
}

function updateMetrics() {
  const skus = inventory.length;
  const stock = inventory.reduce((a, b) => a + Number(b.stock || 0), 0);

  const mSkus = document.getElementById('metric-skus');
  const mStock = document.getElementById('metric-stock');
  const invTotal = document.getElementById('inv-total-art');

  if (mSkus) mSkus.innerText = skus || 490;
  if (mStock) mStock.innerText = stock || 47653;
  if (invTotal) invTotal.innerText = skus || 490;
}

// INVENTARIO Y FILTROS POR UBICACIÓN
function renderLocationPills() {
  const container = document.getElementById('category-pills');
  if (!container) return;  
  const locations = ['TODOS', ...new Set(inventory.map(i => (i.detail || 'Almacen General').trim()))];

  container.innerHTML = locations.map(loc => `
    <button class="pill ${selectedLocationFilter.toUpperCase() === loc.toUpperCase() ? 'active' : ''}" onclick="filterByLocation('${loc}')">
      ${loc === 'TODOS' ? 'TODAS las ubicaciones' : loc.toUpperCase()}
    </button>
  `).join('');
}

function populateColumnFilterSelect() {
  const select = document.getElementById('column-filter-select');
  if (!select) return;
  const locations = [...new Set(inventory.map(i => (i.detail || 'Almacen General').trim()))];
  
  const currentVal = select.value;
  select.innerHTML = `<option value="TODOS">Filtrar por Ubicación...</option>` + 
    locations.map(l => `<option value="${l}">${l}</option>`).join('');
  if (currentVal) select.value = currentVal;
}

function filterByLocation(loc) {
  selectedLocationFilter = loc;
  const select = document.getElementById('column-filter-select');
  if (select) select.value = loc;
  renderLocationPills();
  renderInventoryTable();
}

function renderInventoryTable() {
  const tbody = document.getElementById('inventory-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const searchInput = document.getElementById('inv-search-input');
  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';  
  const colSelect = document.getElementById('column-filter-select');
  const columnFilter = colSelect ? colSelect.value : 'TODOS';

  let list = inventory.filter(i => {
    const itemName = (i.name || '').toLowerCase();
    const itemDetail = (i.detail || 'Almacen General').toLowerCase();    
    const matchSearch = itemName.includes(search) || itemDetail.includes(search);    
    const locValue = (i.detail || 'Almacen General').trim();
    const matchLocation = (selectedLocationFilter === 'TODOS' || locValue.toUpperCase() === selectedLocationFilter.toUpperCase()) &&
                          (columnFilter === 'TODOS' || locValue.toUpperCase() === columnFilter.toUpperCase());
    
    return matchSearch && matchLocation;
  });

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#888;">No hay artículos registrados.</td></tr>`;
    return;
  }

  list.forEach((item) => {
    const formattedPrice = Number(item.price || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    const realIndex = inventory.indexOf(item);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.name || 'Sin Nombre'}</strong></td>
      <td>${item.detail || 'Almacen General'}</td>
      <td>${item.unit || 'Piezas'}</td>
      <td><strong style="color: var(--gold-dark);">${formattedPrice}</strong></td>
      <td><strong>${item.stock || 0}</strong></td>
      <td>
        <div class="action-btn-group">
          <button class="btn-icon" title="Traspasar" onclick="openTraspasoModalForItem(${realIndex})"><i class="fa-solid fa-right-left"></i></button>
          <button class="btn-icon" title="Aumentar" onclick="adjustStock(${realIndex}, 1)"><i class="fa-solid fa-plus"></i></button>
          <button class="btn-icon" title="Disminuir" onclick="adjustStock(${realIndex}, -1)"><i class="fa-solid fa-minus"></i></button>
          <button class="btn-icon delete" title="Borrar" onclick="deleteItem(${realIndex})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function adjustStock(index, delta) {
  if (inventory[index]) {
    inventory[index].stock = Math.max(0, Number(inventory[index].stock || 0) + delta);
    saveAndSync();
  }
}

function deleteItem(index) {
  if (inventory[index] && confirm(`¿Eliminar "${inventory[index].name}"?`)) {
    inventory.splice(index, 1);
    saveAndSync();
  }
}

// IMPORTAR EXCEL
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
        json.forEach(row => {
          const cat = String(row['Categoría'] || firstSheetName).trim().toUpperCase();
          const name = String(row['Artículo'] || row['Nombre'] || 'Sin Nombre').trim();
          const detail = String(row['Ubicación'] || 'Almacen General').trim();
          const unit = String(row['Unidad'] || 'Piezas').trim();
          const stock = Number(row['Stock'] || 0);
          const price = Number(row['Precio'] || 0);

          if (!name || name === 'Sin Nombre') return;
          inventory.push({ cat, name, detail, unit, stock, price });
        });
        saveAndSync();
        showToast('Excel importado correctamente.');
      }
    } catch (err) {
      alert('Error procesando el Excel');
    }
  };
  reader.readAsArrayBuffer(file);
}

function exportBackupJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(inventory, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `respaldo_shifra_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

function exportToExcel() {
  const ws = XLSX.utils.json_to_sheet(inventory);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  XLSX.writeFile(wb, `Inventario_Shifra_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function confirmClearInventory() {
  if (confirm("¿Estás seguro de que deseas borrar toda la base de datos?")) {
    inventory = [];
    saveAndSync();
  }
}

// DOSIFICACIÓN DIARIA
function populateDosiLocationFilter() {
  const select = document.getElementById('dosi-filter-location');
  if (!select) return;  
  const locations = [...new Set(inventory.map(i => (i.detail || 'Almacen General').toString().trim()))];
  select.innerHTML = `<option value="TODOS">Todas las áreas...</option>` +
    locations.map(l => `<option value="${l}">${l}</option>`).join('');
}

function populateDosiDropdown() {
  const select = document.getElementById('dosi-select-item');
  if (!select) return;
  const locFilter = document.getElementById('dosi-filter-location') ? document.getElementById('dosi-filter-location').value : 'TODOS';
  select.innerHTML = '';

  const filteredItems = inventory.filter(item => {
    const locValue = (item.detail || 'Almacen General').toString().trim();
    return locFilter === 'TODOS' || locValue.toUpperCase() === locFilter.toUpperCase();
  });

  filteredItems.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.name;
    opt.innerText = `${item.name} (${item.detail || 'General'}) — Stock: ${item.stock} ${item.unit || 'Piezas'}`;
    select.appendChild(opt);
  });
  updateDosiAvailableStock();
}

function updateDosiAvailableStock() {
  const select = document.getElementById('dosi-select-item');
  if (!select) return;
  const item = inventory.find(i => i.name === select.value);
  const label = document.getElementById('dosi-stock-label');
  if (label) label.innerText = `${item ? item.stock : 0} ${item ? item.unit : 'Piezas'}`;
}

function addDosiToList() {
  const select = document.getElementById('dosi-select-item');
  if (!select || !select.value) return;
  const name = select.value;
  const qty = Number(document.getElementById('dosi-qty-input').value);
  const item = inventory.find(i => i.name === name);
  if (!item) return;

  dosiPendingList.push({ cat: item.detail || 'General', name: item.name, qty, unit: item.unit || 'Piezas' });
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

  dosiPendingList.forEach(p => {
    const item = inventory.find(i => i.name === p.name);
    if (item) {
      item.stock = Math.max(0, item.stock - p.qty);
      historyLogs.unshift({
        dateRaw: now.toLocaleDateString('es-MX'),
        time: now.toLocaleTimeString('es-MX'),
        type: 'Dosificación',
        item: item.name,
        detail: `Salida dosificada: -${p.qty} ${p.unit} (${item.detail || 'General'})`
      });
    }
  });

  dosiPendingList = [];
  renderDosiPendingList();
  saveAndSync();
}

// SERVICIOS
function populateServiceSelect() {
  const select = document.getElementById('service-select');
  if (!select) return;
  select.innerHTML = '';
  servicesCatalog.forEach((s, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.innerText = s.name;
    select.appendChild(opt);
  });
  previewServiceRecipe();
}

function previewServiceRecipe() {
  const select = document.getElementById('service-select');
  const previewBox = document.getElementById('recipe-preview-list');
  if (!select || !previewBox || select.value === "") return;

  const service = servicesCatalog[select.value];
  const count = Number(document.getElementById('service-count-input').value) || 1;

  previewBox.innerHTML = service ? service.recipe.map(r => `• <strong>"${r.name}"</strong>: ${r.qty * count} ${r.unit}`).join('<br>') : '';
}

function renderServicesCatalog() {
  const tbody = document.getElementById('services-catalog-list');
  if (!tbody) return;
  tbody.innerHTML = '';
  servicesCatalog.forEach((s, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${s.name}</strong></td>
      <td>${s.recipe.map(r => `"${r.name}": ${r.qty} ${r.unit}`).join(', ')}</td>
      <td>
        <div class="action-btn-group">
          <button class="btn-icon" onclick="openServiceModal(${index})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon delete" onclick="deleteService(${index})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openServiceModal(index) {
  const modal = document.getElementById('modal-service');
  const editIndexInput = document.getElementById('service-edit-index');
  if (!modal) return;

  const idx = (index !== undefined && index !== null && !isNaN(index)) ? Number(index) : -1;
  editIndexInput.value = idx;
  currentRecipeTemp = (idx >= 0 && servicesCatalog[idx]) ? JSON.parse(JSON.stringify(servicesCatalog[idx].recipe)) : [];

  document.getElementById('service-name-input').value = idx >= 0 ? servicesCatalog[idx].name : '';
  populateRecipeItemSelect();
  renderRecipeItemsTable();
  modal.style.display = 'flex';
}

function closeServiceModal() { document.getElementById('modal-service').style.display = 'none'; }

function populateRecipeItemSelect() {
  const select = document.getElementById('service-item-select');
  if (!select) return;
  select.innerHTML = '';
  inventory.forEach(i => {
    const opt = document.createElement('option');
    opt.value = i.name;
    opt.innerText = `${i.name} (${i.detail || 'General'})`;
    select.appendChild(opt);
  });
}

function addRecipeItem() {
  const select = document.getElementById('service-item-select');
  const qtyInput = document.getElementById('service-item-qty');
  if (!select || !select.value) return;

  const itemName = select.value;
  const qty = Number(qtyInput.value) || 1;
  const itemObj = inventory.find(i => i.name === itemName);

  currentRecipeTemp.push({ name: itemName, qty, unit: itemObj ? itemObj.unit : 'Piezas' });
  renderRecipeItemsTable();
}

function renderRecipeItemsTable() {
  const tbody = document.getElementById('recipe-items-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  currentRecipeTemp.forEach((r, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${r.name}</strong></td>
      <td>${r.qty}</td>
      <td>${r.unit}</td>
      <td><button class="btn-icon delete" onclick="removeRecipeItem(${idx})"><i class="fa-solid fa-xmark"></i></button></td>
    `;
    tbody.appendChild(tr);
  });
}

function removeRecipeItem(idx) {
  currentRecipeTemp.splice(idx, 1);
  renderRecipeItemsTable();
}

function saveServiceConfig() {
  const name = document.getElementById('service-name-input').value.trim();
  const editIndex = Number(document.getElementById('service-edit-index').value);

  if (!name || currentRecipeTemp.length === 0) return alert('Completa el nombre y la receta.');

  if (editIndex >= 0 && servicesCatalog[editIndex]) {
    servicesCatalog[editIndex] = { name, recipe: currentRecipeTemp };
  } else {
    servicesCatalog.push({ name, recipe: currentRecipeTemp });
  }

  saveAndSync();
  closeServiceModal();
}

function deleteService(index) {
  if (confirm("¿Eliminar servicio?")) {
    servicesCatalog.splice(index, 1);
    saveAndSync();
  }
}

function applyServiceToStock() {
  const select = document.getElementById('service-select');
  if (!select || select.value === "") return;
  const service = servicesCatalog[select.value];
  const count = Number(document.getElementById('service-count-input').value) || 1;
  const now = new Date();

  service.recipe.forEach(r => {
    const totalDeduction = r.qty * count;
    const item = inventory.find(i => i.name.toLowerCase() === r.name.toLowerCase());
    if (item) {
      item.stock = Math.max(0, Number(item.stock || 0) - totalDeduction);
      historyLogs.unshift({
        dateRaw: now.toLocaleDateString('es-MX'),
        time: now.toLocaleTimeString('es-MX'),
        type: 'Servicio',
        item: item.name,
        detail: `Servicio "${service.name}": -${totalDeduction} ${r.unit}`
      });
    }
  });

  saveAndSync();
  showToast(`Servicio "${service.name}" descontado.`);
}

// ==============================================================================
// LÓGICA DINÁMICA DEL GARRAFÓN DE ACEITE (20 LITROS)
// ==============================================================================

function setDispenseQty(qty) {
  document.getElementById('oil-dispense-ml').value = qty;
}

function updateGallonUI() {
  const liquidEl = document.getElementById('gallon-liquid');
  const percentText = document.getElementById('gallon-percent-text');
  const volText = document.getElementById('gallon-vol-text');
  const litersLeft = document.getElementById('oil-liters-left');
  const usedTotal = document.getElementById('oil-used-total');

  if (!liquidEl) return;

  const percentage = Math.max(0, Math.min(100, (gallonCurrentMl / GALLON_MAX_ML) * 100));
  liquidEl.style.height = `${percentage}%`;

  if (percentage <= 20) {
    liquidEl.style.background = 'linear-gradient(to top, #e74c3c, #f39c12)';
  } else {
    liquidEl.style.background = 'linear-gradient(to top, #bda26b, #e5c98d)';
  }

  if (percentText) percentText.innerText = `${percentage.toFixed(1)}%`;
  if (volText) volText.innerText = `${gallonCurrentMl.toLocaleString()} ml / 20,000 ml`;
  if (litersLeft) litersLeft.innerText = `${(gallonCurrentMl / 1000).toFixed(2)} L`;
  if (usedTotal) usedTotal.innerText = `${(GALLON_MAX_ML - gallonCurrentMl).toLocaleString()} ml`;
}

function dispenseOilToTherapist() {
  const therapist = document.getElementById('therapist-name-input').value.trim();
  const mlToDispense = Number(document.getElementById('oil-dispense-ml').value) || 0;

  if (!therapist) return alert('Por favor ingresa el nombre de la terapeuta.');
  if (mlToDispense <= 0) return alert('Ingresa una cantidad válida en ml.');

  if (mlToDispense > gallonCurrentMl) {
    return alert(`No hay suficiente aceite. Solo quedan ${(gallonCurrentMl/1000).toFixed(2)} L en el garrafón.`);
  }

  gallonCurrentMl -= mlToDispense;

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX');
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  oilDispenseLogs.unshift({
    dateTime: `${dateStr} ${timeStr}`,
    therapist: therapist,
    qtyMl: mlToDispense,
    remainingMl: gallonCurrentMl
  });

  // También sincronizar con el ítem de aceite en el inventario general si existe
  const mainOilItem = inventory.find(i => i.name.toLowerCase().includes('aceite') || i.name.toLowerCase().includes('masaje'));
  if (mainOilItem) {
    mainOilItem.stock = Math.max(0, Number(mainOilItem.stock || 0) - mlToDispense);
  }

  historyLogs.unshift({
    dateRaw: dateStr,
    time: timeStr,
    type: 'Control Aceite',
    item: `Aceite (Terapeuta: ${therapist})`,
    detail: `Dosificación de -${mlToDispense} ml. Quedan ${(gallonCurrentMl/1000).toFixed(2)} L.`
  });

  saveAndSync();
  document.getElementById('therapist-name-input').value = '';
  showToast(`Descontados ${mlToDispense} ml a ${therapist}.`);
}

function refillGallonModal() {
  if (confirm("¿Confirmas que se colocó un garrafón NUEVO de 20 Litros (20,000 ml)?")) {
    gallonCurrentMl = GALLON_MAX_ML;
    
    const now = new Date();
    historyLogs.unshift({
      dateRaw: now.toLocaleDateString('es-MX'),
      time: now.toLocaleTimeString('es-MX'),
      type: 'Recarga Aceite',
      item: 'Garrafón 20L Aceite',
      detail: 'Garrafón rellenado a su capacidad total de 20,000 ml (20 Litros).'
    });

    saveAndSync();
    showToast("Garrafón rellenado a 20 Litros.");
  }
}

function renderOilLogsTable() {
  const tbody = document.getElementById('oil-logs-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const search = (document.getElementById('oil-log-search') ? document.getElementById('oil-log-search').value : '').toLowerCase().trim();

  const filteredLogs = oilDispenseLogs.filter(l => l.therapist.toLowerCase().includes(search));

  if (filteredLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#888;">No hay registros coincidentes.</td></tr>`;
    return;
  }

  filteredLogs.forEach((log, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${log.dateTime}</td>
      <td><strong>${log.therapist}</strong></td>
      <td><strong style="color:var(--gold-dark);">${log.qtyMl} ml</strong></td>
      <td>${(log.remainingMl / 1000).toFixed(2)} L</td>
      <td><button class="btn-icon delete" onclick="deleteOilLog(${index})"><i class="fa-solid fa-trash"></i></button></td>
    `;
    tbody.appendChild(tr);
  });
}

function deleteOilLog(index) {
  if (confirm("¿Eliminar este registro de consumo?")) {
    oilDispenseLogs.splice(index, 1);
    saveAndSync();
  }
}

// MODALES AUXILIARES
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
  if (confirm("¿Borrar historial?")) {
    historyLogs = [];
    saveAndSync();
  }
}

function openAddModal() { document.getElementById('modal-add-item').style.display = 'flex'; }
function closeAddModal() { document.getElementById('modal-add-item').style.display = 'none'; }

function saveNewItem() {
  const name = document.getElementById('add-item-name').value.trim();
  const detail = document.getElementById('add-item-location').value.trim() || 'Almacen General';
  const unit = document.getElementById('add-item-unit').value.trim() || 'ml';
  const stock = Number(document.getElementById('add-item-stock').value) || 0;
  const price = Number(document.getElementById('add-item-price').value) || 0;

  if (!name) return alert('Ingresa el nombre.');
  inventory.push({ cat: 'GENERAL', name, detail, unit, stock, price });
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
