// ==============================================================================
// SHIFRA SPA - CÓDIGO COMPLETO (INCLUYE GESTIÓN DE SERVICIOS Y RECETAS)
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
let currentRecipeTemp = [];

let selectedLocationFilter = 'TODOS';
let chartSkusInstance = null;
let chartVolumeInstance = null;

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

    if (localInv) { try { inventory = JSON.parse(localInv); } catch(e) { inventory = []; } }
    if (localHist) { try { historyLogs = JSON.parse(localHist); } catch(e) { historyLogs = []; } }
    if (localServ) { try { servicesCatalog = JSON.parse(localServ); } catch(e) {} }
    
    renderAllViews();

    const { data: invData } = await supabaseClient.from('inventory').select('*');
    const { data: histData } = await supabaseClient.from('history').select('*').order('id', { ascending: false });
    const { data: servData } = await supabaseClient.from('services').select('*');

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

    if (servData && servData.length > 0) {
      servicesCatalog = servData.map(s => ({
        ...s,
        recipe: typeof s.recipe === 'string' ? JSON.parse(s.recipe) : s.recipe
      }));
      localStorage.setItem('shifra_spa_services', JSON.stringify(servicesCatalog));
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
  renderAllViews();

  try {
    await supabaseClient.from('inventory').delete().not('id', 'is', null);
    if (inventory.length > 0) {
      const cleanInv = inventory.map(({ id, ...rest }) => rest);
      await supabaseClient.from('inventory').insert(cleanInv);
    }

    await supabaseClient.from('history').delete().not('id', 'is', null);
    if (historyLogs.length > 0) {
      const cleanHist = historyLogs.map(({ id, ...rest }) => rest);
      await supabaseClient.from('history').insert(cleanHist);
    }

    await supabaseClient.from('services').delete().not('id', 'is', null);
    if (servicesCatalog.length > 0) {
      const cleanServ = servicesCatalog.map(({ id, ...rest }) => ({
        name: rest.name,
        recipe: typeof rest.recipe === 'string' ? rest.recipe : JSON.stringify(rest.recipe)
      }));
      await supabaseClient.from('services').insert(cleanServ);
    }

    showToast('Sincronizado en la nube con éxito.');
  } catch (e) {
    console.error("Aviso de sincronización:", e);
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

  if (tabId === 'graficos') renderCharts();
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
  populateTrendSelect();
}

function updateMetrics() {
  const skus = inventory.length;
  const stock = inventory.reduce((a, b) => a + Number(b.stock || 0), 0);

  const mSkus = document.getElementById('metric-skus');
  const mStock = document.getElementById('metric-stock');
  const invTotal = document.getElementById('inv-total-art');

  if (mSkus) mSkus.innerText = skus;
  if (mStock) mStock.innerText = stock;
  if (invTotal) invTotal.innerText = skus;

  const gSkus = document.getElementById('g-skus');
  const gStock = document.getElementById('g-stock');
  const gStores = document.getElementById('g-stores');

  if (gSkus) gSkus.innerText = skus;
  if (gStock) gStock.innerText = stock;

  const locations = [...new Set(inventory.map(i => (i.detail || 'Almacen General').trim()))].length;
  if (gStores) gStores.innerText = locations;
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

  list.forEach((item, index) => {
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

// IMPORTAR EXCEL CON FUSIÓN
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
          const detail = String(row['Ubicación'] || row['UBICACIÓN'] || row['Ubicacion'] || row['UBICACION'] || row['Detalle'] || row['DETALLE'] || 'Almacen General').trim();
          const unit = String(row['Unidad'] || row['UNIDAD'] || row['Medida'] || row['MEDIDA'] || 'Piezas').trim();
          const stock = Number(row['Stock'] || row['STOCK'] || row['Inventario'] || row['INVENTARIO'] || row['Cantidad'] || 0);
          const price = Number(row['Precio'] || row['PRECIO'] || row['price'] || 0);

          if (!name || name === 'Sin Nombre') return;

          const existingIndex = inventory.findIndex(i => 
            i.name && i.name.toLowerCase().trim() === name.toLowerCase().trim() && 
            (i.detail || 'Almacen General').toLowerCase().trim() === detail.toLowerCase().trim()
          );

          if (existingIndex !== -1) {
            inventory[existingIndex].stock = stock;
            inventory[existingIndex].price = price > 0 ? price : inventory[existingIndex].price;
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

// DOSIFICACIÓN: FILTRADO RÁPIDO POR ÁREA
function populateDosiLocationFilter() {
  const select = document.getElementById('dosi-filter-location');
  if (!select) return;
  
  const locations = [...new Set(inventory.map(i => (i.detail || i.location || 'Almacen General').toString().trim()))];
  const currentVal = select.value;
  
  select.innerHTML = `<option value="TODOS">Todas las áreas...</option>` +
    locations.map(l => `<option value="${l}">${l}</option>`).join('');
    
  if (currentVal) select.value = currentVal;
}

function populateDosiDropdown() {
  const select = document.getElementById('dosi-select-item');
  if (!select) return;

  const locFilter = document.getElementById('dosi-filter-location') ? document.getElementById('dosi-filter-location').value : 'TODOS';

  select.innerHTML = '';

  const filteredItems = inventory.filter(item => {
    const locValue = (item.detail || item.location || 'Almacen General').toString().trim();
    return locFilter === 'TODOS' || locValue.toUpperCase() === locFilter.toUpperCase();
  });

  if (filteredItems.length === 0) {
    const opt = document.createElement('option');
    opt.value = "";
    opt.innerText = "Sin productos registrados en esta área...";
    select.appendChild(opt);
  } else {
    filteredItems.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.name;
      const stockVal = item.stock !== undefined ? item.stock : (item.cantidad || 0);
      const unitVal = item.unit || item.unidad || 'Piezas';
      const detailVal = item.detail || item.location || 'General';
      
      opt.innerText = `${item.name} (${detailVal}) — Stock: ${stockVal} ${unitVal}`;
      select.appendChild(opt);
    });
  }

  updateDosiAvailableStock();
}

function updateDosiAvailableStock() {
  const select = document.getElementById('dosi-select-item');
  if (!select) return;
  const name = select.value;
  const item = inventory.find(i => i.name === name);
  const label = document.getElementById('dosi-stock-label');
  if (label) {
    const stockVal = item ? (item.stock !== undefined ? item.stock : (item.cantidad || 0)) : 0;
    const unitVal = item ? (item.unit || item.unidad || 'Piezas') : 'Piezas';
    label.innerText = `${stockVal} ${unitVal}`;
  }
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
        detail: `Salida dosificada: -${p.qty} ${p.unit} (${item.detail || 'General'})`
      });
    }
  });

  dosiPendingList = [];
  renderDosiPendingList();
  saveAndSync();
  showToast('Dosificación descontada con éxito.');
}

// ==============================================================================
// GESTIÓN DE SERVICIOS Y RECETAS (CREAR, EDITAR, ELIMINAR Y APLICAR)
// ==============================================================================

function populateServiceSelect() {
  const select = document.getElementById('service-select');
  if (!select) return;
  select.innerHTML = '';
  
  if (servicesCatalog.length === 0) {
    select.innerHTML = `<option value="">No hay servicios configurados</option>`;
    return;
  }

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
  if (!select || !previewBox) return;

  const idx = select.value;
  if (idx === "" || !servicesCatalog[idx]) {
    previewBox.innerHTML = "Selecciona un servicio...";
    return;
  }

  const service = servicesCatalog[idx];
  const count = Number(document.getElementById('service-count-input').value) || 1;

  previewBox.innerHTML = service.recipe.map(r => {
    const totalQty = r.qty * count;
    return `• <strong>${r.name}</strong>: ${totalQty} ${r.unit}`;
  }).join('<br>');
}

function renderServicesCatalog() {
  const tbody = document.getElementById('services-catalog-list');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (servicesCatalog.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#888;">No hay servicios registrados.</td></tr>`;
    return;
  }

  servicesCatalog.forEach((s, index) => {
    const recipeText = s.recipe.map(r => `${r.name}: ${r.qty} ${r.unit}`).join(', ');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${s.name}</strong></td>
      <td>${recipeText}</td>
      <td>
        <div class="action-btn-group">
          <button class="btn-icon" title="Editar" onclick="openServiceModal(${index})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon delete" title="Borrar" onclick="deleteService(${index})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openServiceModal(index = -1) {
  const modal = document.getElementById('modal-service');
  const title = document.getElementById('modal-service-title');
  const nameInput = document.getElementById('service-name-input');
  const editIndexInput = document.getElementById('service-edit-index');
  
  if (!modal) return;

  editIndexInput.value = index;
  currentRecipeTemp = [];

  if (index >= 0 && servicesCatalog[index]) {
    title.innerHTML = `<i class="fa-solid fa-pen"></i> Editar Servicio`;
    nameInput.value = servicesCatalog[index].name;
    currentRecipeTemp = JSON.parse(JSON.stringify(servicesCatalog[index].recipe));
  } else {
    title.innerHTML = `<i class="fa-solid fa-hand-holding-heart"></i> Nuevo Servicio / Tratamiento`;
    nameInput.value = '';
  }

  populateRecipeItemSelect();
  renderRecipeItemsTable();
  modal.style.display = 'flex';
}

function closeServiceModal() {
  document.getElementById('modal-service').style.display = 'none';
}

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
  const unit = itemObj ? (itemObj.unit || 'Piezas') : 'Piezas';

  // Verificar si ya está en la receta temporal para actualizarlo
  const existing = currentRecipeTemp.find(r => r.name.toLowerCase() === itemName.toLowerCase());
  if (existing) {
    existing.qty = qty;
  } else {
    currentRecipeTemp.push({ name: itemName, qty, unit });
  }

  renderRecipeItemsTable();
}

function renderRecipeItemsTable() {
  const tbody = document.getElementById('recipe-items-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (currentRecipeTemp.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#888;">No hay insumos agregados a la receta.</td></tr>`;
    return;
  }

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

  if (!name) return alert('Escribe el nombre del servicio.');
  if (currentRecipeTemp.length === 0) return alert('Agrega al menos un insumo a la receta del servicio.');

  if (editIndex >= 0 && servicesCatalog[editIndex]) {
    servicesCatalog[editIndex] = { name, recipe: currentRecipeTemp };
  } else {
    servicesCatalog.push({ name, recipe: currentRecipeTemp });
  }

  saveAndSync();
  closeServiceModal();
  showToast('Servicio guardado con éxito.');
}

function deleteService(index) {
  if (confirm(`¿Estás seguro de eliminar el servicio "${servicesCatalog[index].name}"?`)) {
    servicesCatalog.splice(index, 1);
    saveAndSync();
    showToast('Servicio eliminado.');
  }
}

function applyServiceToStock() {
  const select = document.getElementById('service-select');
  if (!select || select.value === "") return alert('Selecciona un servicio válido.');

  const idx = select.value;
  const service = servicesCatalog[idx];
  const count = Number(document.getElementById('service-count-input').value) || 1;

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX');
  const timeStr = now.toLocaleTimeString('es-MX');

  let errorOccurred = false;

  service.recipe.forEach(r => {
    const totalDeduction = r.qty * count;
    const item = inventory.find(i => i.name.toLowerCase() === r.name.toLowerCase());

    if (item) {
      item.stock = Math.max(0, Number(item.stock || 0) - totalDeduction);
      historyLogs.unshift({
        dateRaw: dateStr,
        time: timeStr,
        type: 'Servicio',
        item: item.name,
        detail: `Aplicación de ${count}x "${service.name}": -${totalDeduction} ${r.unit} (${item.detail || 'General'})`
      });
    } else {
      errorOccurred = true;
    }
  });

  saveAndSync();
  showToast(`Servicio "${service.name}" aplicado correctamente.`);
}

// TENDENCIAS
function populateTrendSelect() {
  const select = document.getElementById('trend-item-select');
  if (!select) return;
  select.innerHTML = '';
  inventory.forEach(i => {
    const opt = document.createElement('option');
    opt.value = i.name;
    opt.innerText = `${i.name} (${(i.detail || 'General').toUpperCase()})`;
    select.appendChild(opt);
  });
}

function loadItemTrendDetails() {
  const select = document.getElementById('trend-item-select');
  if (!select) return;
  const name = select.value;
  const logs = historyLogs.filter(h => h.item === name);

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
    const totalQty = logs.reduce((sum, l) => {
      const match = l.detail.match(/-([0-9.]+)/);
      return sum + (match ? Number(match[1]) : 0);
    }, 0);
    totalVal.innerText = `${totalQty} Piezas`;
  }
}

// SERVICIOS (CATÁLOGO RENDER)
function renderServicesCatalog() {
  const tbody = document.getElementById('services-catalog-list');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (servicesCatalog.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#888;">No hay servicios registrados.</td></tr>`;
    return;
  }

  servicesCatalog.forEach((s, index) => {
    const recipeText = s.recipe.map(r => `${r.name}: ${r.qty} ${r.unit}`).join(', ');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${s.name}</strong></td>
      <td>${recipeText}</td>
      <td>
        <div class="action-btn-group">
          <button class="btn-icon" title="Editar" onclick="openServiceModal(${index})"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon delete" title="Borrar" onclick="deleteService(${index})"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// GRÁFICOS
function renderCharts() {
  const locations = [...new Set(inventory.map(i => i.detail || 'General'))];
  const skuCounts = locations.map(l => inventory.filter(i => (i.detail || 'General') === l).length);
  const volumeCounts = locations.map(l => inventory.filter(i => (i.detail || 'General') === l).reduce((a, b) => a + Number(b.stock), 0));

  if (chartSkusInstance) chartSkusInstance.destroy();
  if (chartVolumeInstance) chartVolumeInstance.destroy();

  const ctxSkus = document.getElementById('chart-skus');
  if (ctxSkus) {
    chartSkusInstance = new Chart(ctxSkus.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: locations,
        datasets: [{ data: skuCounts, backgroundColor: ['#a88d55', '#333333', '#3498db', '#e74c3c'] }]
      }
    });
  }

  const ctxVol = document.getElementById('chart-volume');
  if (ctxVol) {
    chartVolumeInstance = new Chart(ctxVol.getContext('2d'), {
      type: 'bar',
      data: {
        labels: locations,
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
  const name = document.getElementById('add-item-name').value.trim();
  const detail = document.getElementById('add-item-location').value.trim() || 'Almacen General';
  const unit = document.getElementById('add-item-unit').value.trim() || 'Piezas';
  const stock = Number(document.getElementById('add-item-stock').value) || 0;
  const price = Number(document.getElementById('add-item-price').value) || 0;

  if (!name) return alert('Escribe el nombre del artículo.');

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
