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

let chartDoughnutInstance = null;
let chartBarUnitsInstance = null;
let chartBarLowInstance = null;

window.addEventListener('DOMContentLoaded', () => {
  saveAndRender();
});

// CAMBIO DE PESTAÑAS
function switchView(viewName) {
  const invView = document.getElementById('viewInventario');
  const dosiView = document.getElementById('viewDosificacion');
  const servView = document.getElementById('viewServicios');
  const aceiteView = document.getElementById('viewAceite');
  const trendView = document.getElementById('viewTendencias');
  const dashView = document.getElementById('viewDashboard');

  const btnInv = document.getElementById('navBtnInventario');
  const btnDosi = document.getElementById('navBtnDosificacion');
  const btnServ = document.getElementById('navBtnServicios');
  const btnAceite = document.getElementById('navBtnAceite');
  const btnTrend = document.getElementById('navBtnTendencias');
  const btnDash = document.getElementById('navBtnDashboard');

  if (!invView || !dosiView || !servView || !aceiteView || !trendView || !dashView) return;

  invView.style.display = 'none';
  dosiView.style.display = 'none';
  servView.style.display = 'none';
  aceiteView.style.display = 'none';
  trendView.style.display = 'none';
  dashView.style.display = 'none';

  if (btnInv) btnInv.classList.remove('active-nav-tab');
  if (btnDosi) btnDosi.classList.remove('active-nav-tab');
  if (btnServ) btnServ.classList.remove('active-nav-tab');
  if (btnAceite) btnAceite.classList.remove('active-nav-tab');
  if (btnTrend) btnTrend.classList.remove('active-nav-tab');
  if (btnDash) btnDash.classList.remove('active-nav-tab');

  if (viewName === 'dosificacion') {
    dosiView.style.display = 'block';
    if (btnDosi) btnDosi.classList.add('active-nav-tab');
    initDosificacionView();
  } else if (viewName === 'servicios') {
    servView.style.display = 'block';
    if (btnServ) btnServ.classList.add('active-nav-tab');
    initServiciosView();
  } else if (viewName === 'aceite') {
    aceiteView.style.display = 'block';
    if (btnAceite) btnAceite.classList.add('active-nav-tab');
    initAceiteView();
  } else if (viewName === 'tendencias') {
    trendView.style.display = 'block';
    if (btnTrend) btnTrend.classList.add('active-nav-tab');
    initTendenciasView();
  } else if (viewName === 'dashboard') {
    dashView.style.display = 'block';
    if (btnDash) btnDash.classList.add('active-nav-tab');
    renderDashboardCharts();
  } else {
    invView.style.display = 'block';
    if (btnInv) btnInv.classList.add('active-nav-tab');
    saveAndRender();
  }
}

// DOSIFICACIÓN DIARIA
function initDosificacionView() {
  const select = document.getElementById('dosiItemSelect');
  if (!select) return;
  select.innerHTML = '';

  if (inventory.length === 0) {
    select.innerHTML = '<option value="-1">No hay productos en inventario</option>';
    const availStock = document.getElementById('dosiAvailableStock');
    if (availStock) availStock.innerText = '0 Piezas';
    return;
  }

  inventory.forEach((item, index) => {
    select.innerHTML += `<option value="${index}">${item.name} (${item.cat}) — Stock: ${item.stock} ${item.unit || 'Pzs'}</option>`;
  });

  updateDosiStockInfo();
  renderDosiTable();
}

function updateDosiStockInfo() {
  const select = document.getElementById('dosiItemSelect');
  if (!select) return;
  const selectIdx = parseInt(select.value);
  const availStock = document.getElementById('dosiAvailableStock');
  const qtyInput = document.getElementById('dosiQtyInput');

  if (selectIdx < 0 || isNaN(selectIdx) || !inventory[selectIdx]) {
    if (availStock) availStock.innerText = '0 Piezas';
    return;
  }

  const prod = inventory[selectIdx];
  if (availStock) availStock.innerText = `${prod.stock} ${prod.unit || 'Piezas'}`;
  if (qtyInput) qtyInput.max = prod.stock;
}

const dosiForm = document.getElementById('dosiAddForm');
if (dosiForm) {
  dosiForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const selectIdx = parseInt(document.getElementById('dosiItemSelect').value);
    const qty = parseInt(document.getElementById('dosiQtyInput').value) || 0;

    if (selectIdx < 0 || isNaN(selectIdx) || !inventory[selectIdx]) return;

    const prod = inventory[selectIdx];

    if (qty > prod.stock) {
      alert(`La cantidad no puede superar el stock disponible (${prod.stock} ${prod.unit}).`);
      return;
    }

    const existingIndex = dosiList.findIndex(item => item.globalIdx === selectIdx);
    if (existingIndex >= 0) {
      if ((dosiList[existingIndex].qty + qty) > prod.stock) {
        alert("La suma de las dosificaciones excede el stock total disponible.");
        return;
      }
      dosiList[existingIndex].qty += qty;
    } else {
      dosiList.push({
        globalIdx: selectIdx,
        cat: prod.cat,
        name: prod.name,
        unit: prod.unit || 'Piezas',
        qty: qty
      });
    }

    renderDosiTable();
    document.getElementById('dosiQtyInput').value = '1';
  });
}

function renderDosiTable() {
  const tbody = document.getElementById('dosiTableBody');
  const badgeCount = document.getElementById('dosiBadgeCount');
  if (!tbody) return;

  if (badgeCount) badgeCount.innerText = `${dosiList.length} Artículos`;

  if (dosiList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">No has agregado artículos a la lista de dosificación.</td></tr>`;
    return;
  }

  let html = '';
  dosiList.forEach((item, index) => {
    html += `
      <tr>
        <td><span class="badge bg-secondary">${item.cat}</span></td>
        <td class="fw-bold">${item.name}</td>
        <td class="text-center"><span class="fs-6 fw-bold text-danger px-2 py-1 bg-white border border-light-subtle rounded">-${item.qty} ${item.unit}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-danger" onclick="removeDosiItem(${index})" title="Quitar de la lista"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function removeDosiItem(index) {
  dosiList.splice(index, 1);
  renderDosiTable();
}

function processDosiBatch() {
  if (dosiList.length === 0) {
    alert("La lista de dosificación está vacía.");
    return;
  }

  if (confirm(`¿Deseas confirmar y descontar los ${dosiList.length} ítems de la dosificación diaria?`)) {
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let batchItems = [];

    dosiList.forEach(item => {
      if (inventory[item.globalIdx]) {
        inventory[item.globalIdx].stock -= item.qty;
        if (inventory[item.globalIdx].stock < 0) inventory[item.globalIdx].stock = 0;

        batchItems.push({
          time: timeStr,
          cat: item.cat,
          name: item.name,
          unit: item.unit,
          qty: item.qty
        });

        logMovement('DOSIFICACION', item.name, `Salida dosificada: -${item.qty} ${item.unit} (${item.cat})`);
      }
    });

    let existingBatch = dosiBatches.find(b => b.date === dateStr);
    if (existingBatch) {
      existingBatch.items.push(...batchItems);
    } else {
      dosiBatches.unshift({
        date: dateStr,
        items: batchItems
      });
    }

    localStorage.setItem('shifra_spa_dosi_batches', JSON.stringify(dosiBatches));
    generateTicketPreview(dateStr, batchItems, "Comprobante de Dosificación Diaria");

    dosiList = [];
    saveAndRender();
    initDosificacionView();
  }
}

// DOSIFICACIÓN POR SERVICIOS
function initServiciosView() {
  const select = document.getElementById('applyServiceSelect');
  const tbody = document.getElementById('servicesTableBody');
  if (!select || !tbody) return;

  select.innerHTML = '';
  if (servicesCatalog.length === 0) {
    select.innerHTML = '<option value="">No hay servicios configurados</option>';
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-4 text-muted">No hay servicios configurados. Crea uno nuevo.</td></tr>`;
    document.getElementById('recipePreviewList').innerText = 'Crea un servicio primero...';
    return;
  }

  servicesCatalog.forEach((srv, idx) => {
    select.innerHTML += `<option value="${idx}">${srv.name} (${srv.recipe.length} insumos)</option>`;
  });

  let rows = '';
  servicesCatalog.forEach((srv, idx) => {
    let recipeStr = srv.recipe.map(r => `• <b>${r.name}</b>: ${r.qty} ${r.unit}`).join('<br>');
    if (!recipeStr) recipeStr = '<span class="text-danger">Sin insumos configurados</span>';

    rows += `
      <tr>
        <td class="fw-bold">${srv.name}</td>
        <td class="small">${recipeStr}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary me-1" onclick="editService(${idx})" title="Editar Servicio"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteService(${idx})" title="Eliminar Servicio"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = rows;
  renderServiceRecipePreview();
}

function renderServiceRecipePreview() {
  const select = document.getElementById('applyServiceSelect');
  const previewDiv = document.getElementById('recipePreviewList');
  const countInput = document.getElementById('applyServiceCount');
  if (!select || !previewDiv || !countInput) return;

  const srvIdx = parseInt(select.value);
  const multiplier = parseInt(countInput.value) || 1;

  if (srvIdx < 0 || isNaN(srvIdx) || !servicesCatalog[srvIdx]) {
    previewDiv.innerText = 'Selecciona un servicio válido...';
    return;
  }

  const srv = servicesCatalog[srvIdx];
  if (srv.recipe.length === 0) {
    previewDiv.innerText = 'Este servicio no tiene insumos en su receta.';
    return;
  }

  let html = '<ul class="list-unstyled mb-0">';
  srv.recipe.forEach(r => {
    let totalNeeded = r.qty * multiplier;
    html += `<li>• <b>${r.name}</b> (${r.cat}): Descontará <span class="text-danger fw-bold">-${totalNeeded} ${r.unit}</span></li>`;
  });
  html += '</ul>';
  previewDiv.innerHTML = html;
}

const applyServiceForm = document.getElementById('applyServiceForm');
if (applyServiceForm) {
  applyServiceForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const select = document.getElementById('applyServiceSelect');
    const countInput = document.getElementById('applyServiceCount');
    const srvIdx = parseInt(select.value);
    const servicesCount = parseInt(countInput.value) || 1;

    if (srvIdx < 0 || isNaN(srvIdx) || !servicesCatalog[srvIdx]) return;
    const srv = servicesCatalog[srvIdx];

    if (srv.recipe.length === 0) {
      alert("El servicio seleccionado no tiene insumos configurados.");
      return;
    }

    for (let r of srv.recipe) {
      let prod = inventory.find(i => i.name.toLowerCase() === r.name.toLowerCase() && i.cat === r.cat);
      let needed = r.qty * servicesCount;
      if (!prod || prod.stock < needed) {
        alert(`Stock insuficiente para "${r.name}" en almacén [${r.cat}]. Stock actual: ${prod ? prod.stock : 0}, Requerido: ${needed}.`);
        return;
      }
    }

    if (confirm(`¿Confirmas la aplicación de ${servicesCount} servicio(s) de "${srv.name}"? Se descontarán los insumos automáticamente.`)) {
      const now = new Date();
      const dateStr = now.toLocaleDateString();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let batchItems = [];

      srv.recipe.forEach(r => {
        let prod = inventory.find(i => i.name.toLowerCase() === r.name.toLowerCase() && i.cat === r.cat);
        if (prod) {
          let qtyToDeduct = r.qty * servicesCount;
          prod.stock -= qtyToDeduct;
          if (prod.stock < 0) prod.stock = 0;

          batchItems.push({
            time: timeStr,
            cat: r.cat,
            name: r.name,
            unit: r.unit,
            qty: qtyToDeduct
          });

          logMovement('DOSIFICACION', r.name, `Servicio [${srv.name}] x${servicesCount}: -${qtyToDeduct} ${r.unit}`);
        }
      });

      let existingBatch = dosiBatches.find(b => b.date === dateStr);
      if (existingBatch) {
        existingBatch.items.push(...batchItems);
      } else {
        dosiBatches.unshift({
          date: dateStr,
          items: batchItems
        });
      }

      localStorage.setItem('shifra_spa_dosi_batches', JSON.stringify(dosiBatches));
      generateTicketPreview(dateStr, batchItems, `Comprobante de Servicio: ${srv.name} (x${servicesCount})`);

      countInput.value = '1';
      saveAndRender();
      initServiciosView();
    }
  });
}

function resetServiceForm() {
  document.getElementById('editServiceIndex').value = '-1';
  document.getElementById('serviceName').value = '';
  currentServiceRecipe = [];
  renderModalRecipeTable();
  populateModalItemSelect();
  document.getElementById('modalServiceTitle').innerText = 'Configurar Servicio y Receta';
}

function populateModalItemSelect() {
  const select = document.getElementById('modalItemSelect');
  if (!select) return;
  select.innerHTML = '';

  if (inventory.length === 0) {
    select.innerHTML = '<option value="">No hay artículos en inventario</option>';
    return;
  }

  inventory.forEach((item, idx) => {
    select.innerHTML += `<option value="${idx}">${item.name} (${item.cat}) — Stock: ${item.stock}</option>`;
  });
}

function addRecipeItemToCurrentService() {
  const select = document.getElementById('modalItemSelect');
  const qtyInput = document.getElementById('modalItemQty');
  if (!select || !qtyInput) return;

  const idx = parseInt(select.value);
  const qty = parseInt(qtyInput.value) || 0;

  if (idx < 0 || isNaN(idx) || !inventory[idx]) return;
  if (qty <= 0) {
    alert("Ingresa una cantidad válida.");
    return;
  }

  const prod = inventory[idx];
  const existing = currentServiceRecipe.find(r => r.name.toLowerCase() === prod.name.toLowerCase() && r.cat === prod.cat);

  if (existing) {
    existing.qty += qty;
  } else {
    currentServiceRecipe.push({
      cat: prod.cat,
      name: prod.name,
      unit: prod.unit || 'Piezas',
      qty: qty
    });
  }

  renderModalRecipeTable();
  qtyInput.value = '1';
}

function renderModalRecipeTable() {
  const tbody = document.getElementById('modalRecipeTableBody');
  if (!tbody) return;

  if (currentServiceRecipe.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">Aún no hay insumos agregados.</td></tr>`;
    return;
  }

  let html = '';
  currentServiceRecipe.forEach((r, i) => {
    html += `
      <tr>
        <td><span class="badge bg-secondary">${r.cat}</span></td>
        <td class="fw-bold">${r.name}</td>
        <td class="text-center"><span class="badge bg-dark">${r.qty} ${r.unit}</span></td>
        <td class="text-end">
          <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeRecipeItem(${i})"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function removeRecipeItem(index) {
  currentServiceRecipe.splice(index, 1);
  renderModalRecipeTable();
}

const serviceForm = document.getElementById('serviceForm');
if (serviceForm) {
  serviceForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const editIdx = parseInt(document.getElementById('editServiceIndex').value);
    const name = document.getElementById('serviceName').value.trim();

    if (!name) return;
    if (currentServiceRecipe.length === 0) {
      alert("Debes agregar al menos un insumo a la receta del servicio.");
      return;
    }

    if (editIdx >= 0) {
      servicesCatalog[editIdx] = { name, recipe: [...currentServiceRecipe] };
      logMovement('EDICION', name, `Servicio actualizado con ${currentServiceRecipe.length} insumos`);
    } else {
      servicesCatalog.push({ name, recipe: [...currentServiceRecipe] });
      logMovement('ALTA', name, `Nuevo servicio configurado con ${currentServiceRecipe.length} insumos`);
    }

    localStorage.setItem('shifra_spa_services', JSON.stringify(servicesCatalog));
    saveAndRender();
    bootstrap.Modal.getInstance(document.getElementById('addServiceModal')).hide();
    initServiciosView();
  });
}

function editService(index) {
  const srv = servicesCatalog[index];
  document.getElementById('editServiceIndex').value = index;
  document.getElementById('serviceName').value = srv.name;
  currentServiceRecipe = JSON.parse(JSON.stringify(srv.recipe));
  
  document.getElementById('modalServiceTitle').innerText = 'Editar Servicio y Receta';
  populateModalItemSelect();
  renderModalRecipeTable();

  const modal = new bootstrap.Modal(document.getElementById('addServiceModal'));
  modal.show();
}

function deleteService(index) {
  const srv = servicesCatalog[index];
  if (confirm(`¿Deseas eliminar el servicio "${srv.name}"?`)) {
    logMovement('ELIMINADO', srv.name, `Servicio eliminado del catálogo`);
    servicesCatalog.splice(index, 1);
    localStorage.setItem('shifra_spa_services', JSON.stringify(servicesCatalog));
    saveAndRender();
    initServiciosView();
  }
}

// CONTROL DE ACEITE CORPORAL
function initAceiteView() {
  updateOilVisuals();
  renderOilLogs();
}

function updateOilVisuals() {
  const liquidEl = document.getElementById('oilLiquidLevel');
  const percentEl = document.getElementById('oilPercentText');
  const currentLitText = document.getElementById('oilCurrentLitersText');

  let percentage = (oilData.currentLiters / oilData.maxCapacity) * 100;
  if (percentage < 0) percentage = 0;
  if (percentage > 100) percentage = 100;

  if (liquidEl) liquidEl.style.height = `${percentage}%`;
  if (percentEl) percentEl.innerText = `${Math.round(percentage)}%`;
  if (currentLitText) currentLitText.innerText = `${oilData.currentLiters.toFixed(2)} L`;
}

const oilForm = document.getElementById('oilDosageForm');
if (oilForm) {
  oilForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const therapist = document.getElementById('oilTherapistSelect').value;
    const qty = parseFloat(document.getElementById('oilExtractQty').value) || 0;

    if (qty <= 0) {
      alert("Ingresa una cantidad válida.");
      return;
    }

    if (qty > oilData.currentLiters) {
      alert(`No hay suficiente aceite en el galón. Disponible: ${oilData.currentLiters.toFixed(2)} Litros.`);
      return;
    }

    oilData.currentLiters -= qty;
    if (oilData.currentLiters < 0) oilData.currentLiters = 0;

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    oilData.logs.unshift({
      time: timeStr,
      therapist: therapist,
      qty: qty
    });

    localStorage.setItem('shifra_spa_oil', JSON.stringify(oilData));
    logMovement('DOSIFICACION', 'Aceite Corporal (Galón 20L)', `Terapeuta [${therapist}] extrajo -${qty} L. Restante: ${oilData.currentLiters.toFixed(2)}L`);

    updateOilVisuals();
    renderOilLogs();
    this.reset();
    document.getElementById('oilExtractQty').value = '0.25';
  });
}

function renderOilLogs() {
  const tbody = document.getElementById('oilLogsTableBody');
  if (!tbody) return;

  if (oilData.logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-2 text-muted">Sin extracciones registradas hoy.</td></tr>`;
    return;
  }

  let html = '';
  oilData.logs.slice(0, 10).forEach(log => {
    html += `
      <tr>
        <td class="text-muted">${log.time}</td>
        <td><span class="badge bg-secondary">${log.therapist}</span></td>
        <td class="text-end fw-bold text-danger">-${log.qty} Litros</td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function refillOilTank() {
  if (confirm("¿Deseas rellenar el galón principal a su máxima capacidad (20 Litros)?")) {
    oilData.currentLiters = oilData.maxCapacity;
    localStorage.setItem('shifra_spa_oil', JSON.stringify(oilData));
    logMovement('ENTRADA', 'Aceite Corporal (Galón 20L)', 'Galón recargado al 100% (20 Litros)');
    updateOilVisuals();
    alert("¡Galón recargado con éxito!");
  }
}

// TENDENCIAS DE CONSUMO CON BUSCADOR
function initTendenciasView() {
  const searchInput = document.getElementById('trendSearchInput');
  if (searchInput) searchInput.value = '';
  populateTrendSelect(inventory);
}

function populateTrendSelect(itemsToDisplay) {
  const select = document.getElementById('trendItemSelect');
  if (!select) return;
  select.innerHTML = '';

  if (itemsToDisplay.length === 0) {
    select.innerHTML = '<option value="">No se encontraron artículos</option>';
    document.getElementById('trendTotalQty').innerText = '0 Piezas';
    document.getElementById('trendDetailTableBody').innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">Sin resultados.</td></tr>`;
    return;
  }

  itemsToDisplay.forEach(item => {
    select.innerHTML += `<option value="${item.name}">${item.name} (${item.cat})</option>`;
  });

  select.selectedIndex = 0;
  calculateTrend();
}

function filterTrendItems() {
  const query = document.getElementById('trendSearchInput').value.toLowerCase().trim();
  const filtered = inventory.filter(item => 
    item.name.toLowerCase().includes(query) || (item.cat && item.cat.toLowerCase().includes(query))
  );
  populateTrendSelect(filtered);
}

function calculateTrend() {
  const select = document.getElementById('trendItemSelect');
  const totalQtyEl = document.getElementById('trendTotalQty');
  const tbody = document.getElementById('trendDetailTableBody');
  if (!select || !totalQtyEl || !tbody || select.value === "") return;

  const selectedName = select.value.toLowerCase();
  let totalConsumed = 0;
  let detailsHtml = '';

  dosiBatches.forEach(batch => {
    batch.items.forEach(i => {
      if (i.name.toLowerCase() === selectedName) {
        totalConsumed += i.qty;
        detailsHtml += `
          <tr>
            <td class="small fw-bold">${batch.date}</td>
            <td class="small text-muted">${i.time}</td>
            <td><span class="badge bg-secondary">${i.cat}</span></td>
            <td class="text-center"><span class="badge bg-primary">-${i.qty} ${i.unit}</span></td>
          </tr>
        `;
      }
    });
  });

  totalQtyEl.innerText = `${totalConsumed} Piezas`;

  if (detailsHtml === '') {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">No hay registros de salidas para este artículo.</td></tr>`;
  } else {
    tbody.innerHTML = detailsHtml;
  }
}

// HISTORIAL POR DÍAS
function renderDosiLogsByDateList() {
  const select = document.getElementById('dosiDateSelect');
  const tbody = document.getElementById('dosiLogTableBody');
  const totalBadge = document.getElementById('dosiLogTotalItems');
  if (!select || !tbody) return;

  if (dosiBatches.length === 0) {
    select.innerHTML = '<option value="">No hay fechas registradas</option>';
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">Aún no hay dosificaciones aplicadas.</td></tr>`;
    if (totalBadge) totalBadge.innerText = '0 ítems';
    return;
  }

  const currentDateVal = select.value;
  let optionsHtml = '';
  dosiBatches.forEach(batch => {
    const selectedAttr = (batch.date === currentDateVal) ? 'selected' : '';
    optionsHtml += `<option value="${batch.date}" ${selectedAttr}>📅 ${batch.date} (${batch.items.length} registros)</option>`;
  });
  select.innerHTML = optionsHtml;

  const selectedDate = select.value || dosiBatches[0].date;
  const targetBatch = dosiBatches.find(b => b.date === selectedDate);

  if (!targetBatch || targetBatch.items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">No hay registros para esta fecha.</td></tr>`;
    if (totalBadge) totalBadge.innerText = '0 ítems';
    return;
  }

  let rows = '';
  targetBatch.items.forEach(item => {
    rows += `
      <tr>
        <td class="small text-muted">${item.time}</td>
        <td><span class="badge bg-secondary">${item.cat}</span></td>
        <td class="fw-bold">${item.name}</td>
        <td class="text-center"><span class="badge bg-warning text-dark">-${item.qty} ${item.unit}</span></td>
      </tr>
    `;
  });

  tbody.innerHTML = rows;
  if (totalBadge) totalBadge.innerText = `${targetBatch.items.length} movimientos en ${selectedDate}`;
}

function generateTicketPreview(dateStr, items, subtitle = "Comprobante de Dosificación") {
  document.getElementById('ticketDate').innerText = `Fecha del Turno: ${dateStr}`;
  document.getElementById('ticketSubtitle').innerText = subtitle;
  const listContainer = document.getElementById('ticketItemsList');
  let html = '<ul class="list-group list-group-flush">';
  let totalQty = 0;

  items.forEach(i => {
    totalQty += i.qty;
    html += `<li class="list-group-item d-flex justify-content-between align-items-center bg-transparent px-0 py-1">
              <span><b>${i.name}</b> <small class="text-muted">(${i.cat})</small></span>
              <span class="badge bg-dark rounded-pill">-${i.qty} ${i.unit}</span>
             </li>`;
  });
  html += '</ul>';
  listContainer.innerHTML = html;
  document.getElementById('ticketTotalCount').innerText = totalQty;

  const ticketModal = new bootstrap.Modal(document.getElementById('dosiTicketModal'));
  ticketModal.show();
}

// DASHBOARD
function renderDashboardCharts() {
  let warehouseMap = {};
  let totalUnits = 0;
  let totalLowCount = 0;

  inventory.forEach(item => {
    const stock = parseInt(item.stock) || 0;
    const cat = item.cat || 'GENERAL';
    totalUnits += stock;
    if (stock <= 3) totalLowCount++;

    if (!warehouseMap[cat]) {
      warehouseMap[cat] = { skus: 0, units: 0, lowStock: 0 };
    }
    warehouseMap[cat].skus++;
    warehouseMap[cat].units += stock;
    if (stock <= 3) warehouseMap[cat].lowStock++;
  });

  const categories = Object.keys(warehouseMap).sort();
  
  const elSkus = document.getElementById('dashSkus');
  const elUnits = document.getElementById('dashUnits');
  const elWarehouses = document.getElementById('dashWarehouses');
  const elLow = document.getElementById('dashLowStock');

  if (elSkus) elSkus.innerText = inventory.length;
  if (elUnits) elUnits.innerText = totalUnits;
  if (elWarehouses) elWarehouses.innerText = categories.length;
  if (elLow) elLow.innerText = totalLowCount;

  const skuCounts = categories.map(c => warehouseMap[c].skus);
  const unitCounts = categories.map(c => warehouseMap[c].units);
  const lowCounts = categories.map(c => warehouseMap[c].lowStock);

  const colorsGold = ['#c5a880', '#3a322d', '#8c7860', '#d4be9c', '#5c4f45', '#a69076', '#e0d2bd'];

  if (chartDoughnutInstance) chartDoughnutInstance.destroy();
  if (chartBarUnitsInstance) chartBarUnitsInstance.destroy();
  if (chartBarLowInstance) chartBarLowInstance.destroy();

  const cD = document.getElementById('chartDoughnut');
  if (cD) {
    chartDoughnutInstance = new Chart(cD.getContext('2d'), {
      type: 'doughnut',
      data: { labels: categories, datasets: [{ data: skuCounts, backgroundColor: colorsGold }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
    });
  }

  const cU = document.getElementById('chartBarUnits');
  if (cU) {
    chartBarUnitsInstance = new Chart(cU.getContext('2d'), {
      type: 'bar',
      data: { labels: categories, datasets: [{ label: 'Piezas Físicas', data: unitCounts, backgroundColor: '#c5a880', borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }

  const cL = document.getElementById('chartBarLow');
  if (cL) {
    chartBarLowInstance = new Chart(cL.getContext('2d'), {
      type: 'bar',
      data: { labels: categories, datasets: [{ label: 'Artículos en Stock Bajo (≤3)', data: lowCounts, backgroundColor: '#dc3545', borderRadius: 6 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
  }
}

// MOVIMIENTOS E HISTORIAL
function logMovement(type, itemName, detail) {
  const now = new Date();
  const dateStrYMD = now.toISOString().split('T')[0];
  const timestamp = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  historyLogs.unshift({ dateRaw: dateStrYMD, time: timestamp, type: type, item: itemName, detail: detail });
  localStorage.setItem('shifra_spa_history', JSON.stringify(historyLogs));
}

function renderHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const dateFrom = document.getElementById('filterDateFrom').value;
  const dateTo = document.getElementById('filterDateTo').value;

  let filteredLogs = historyLogs.filter(log => {
    if (!log.dateRaw) return true;
    if (dateFrom && log.dateRaw < dateFrom) return false;
    if (dateTo && log.dateRaw > dateTo) return false;
    return true;
  });

  if (filteredLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3 text-muted">No hay movimientos en el rango de fechas seleccionado.</td></tr>`;
    return;
  }

  let html = '';
  filteredLogs.forEach(log => {
    let typeBadge = '';
    if (log.type === 'ALTA') typeBadge = '<span class="badge bg-success">Alta</span>';
    else if (log.type === 'EDICION') typeBadge = '<span class="badge bg-primary">Edición</span>';
    else if (log.type === 'ENTRADA') typeBadge = '<span class="badge bg-info text-dark">+ Stock</span>';
    else if (log.type === 'SALIDA') typeBadge = '<span class="badge bg-warning text-dark">- Stock</span>';
    else if (log.type === 'DOSIFICACION') typeBadge = '<span class="badge text-white" style="background:#fd7e14;">Dosificación</span>';
    else if (log.type === 'CONTEO') typeBadge = '<span class="badge bg-secondary">Ajuste Conteo</span>';
    else if (log.type === 'TRASPASO') typeBadge = '<span class="badge text-white" style="background:#6f42c1;">Traspaso</span>';
    else if (log.type === 'ELIMINADO') typeBadge = '<span class="badge bg-danger">Eliminado</span>';
    else if (log.type === 'EXCEL') typeBadge = '<span class="badge bg-dark">Carga Excel</span>';

    html += `
      <tr>
        <td class="small text-muted">${log.time}</td>
        <td>${typeBadge}</td>
        <td class="fw-bold">${log.item}</td>
        <td class="small">${log.detail}</td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function clearHistoryDateFilter() {
  document.getElementById('filterDateFrom').value = '';
  document.getElementById('filterDateTo').value = '';
  renderHistoryTable();
}

function clearHistory() {
  if (confirm('¿Deseas vaciar todo el historial general?')) {
    historyLogs = [];
    localStorage.removeItem('shifra_spa_history');
    renderHistoryTable();
  }
}

function saveAndRender() {
  localStorage.setItem('shifra_spa_db', JSON.stringify(inventory));
  buildWarehouseTabs();
  filterProducts();
  updateStats();
}

function updateStats() {
  const statTotal = document.getElementById('statTotal');
  const statLow = document.getElementById('statLow');
  if (statTotal) statTotal.innerText = inventory.length;
  if (statLow) {
    const lowCount = inventory.filter(i => i.stock <= 3).length;
    statLow.innerText = lowCount;
  }
}

function buildWarehouseTabs() {
  const container = document.getElementById('warehouseTabsContainer');
  if (!container) return;

  const categories = [...new Set(inventory.map(item => item.cat))].filter(Boolean).sort();
  
  let html = `<div class="warehouse-tab ${currentWarehouse === 'ALL' ? 'active' : ''}" onclick="setWarehouse('ALL', this)">TODOS los almacenes</div>`;
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
  if(el) el.classList.add('active');
  currentPage = 1;
  filterProducts();
}

function toggleLowStockFilter() {
  hideLowStockFlag = !hideLowStockFlag;
  const btn = document.getElementById('btnToggleLow');
  if (btn) {
    btn.style.background = hideLowStockFlag ? '#c5a880' : 'transparent';
    btn.style.color = hideLowStockFlag ? '#ffffff' : 'inherit';
  }
  currentPage = 1;
  filterProducts();
}

function filterProducts() {
  const searchInput = document.getElementById('searchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filtered = inventory.filter(item => {
    const matchesWarehouse = (currentWarehouse === 'ALL' || item.cat === currentWarehouse);
    const matchesQuery = !query || 
                         (item.name && item.name.toLowerCase().includes(query)) || 
                         (item.cat && item.cat.toLowerCase().includes(query)) ||
                         (item.detail && item.detail.toLowerCase().includes(query));
    const matchesLowStock = !hideLowStockFlag || item.stock > 3;

    return matchesWarehouse && matchesQuery && matchesLowStock;
  });

  renderTablePage(filtered);
}

function renderTablePage(items) {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const pageInfo = document.getElementById('pageInfo');
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No se encontraron artículos. Sube tu archivo Excel o agrega uno nuevo.</td></tr>`;
    if (pageInfo) pageInfo.innerText = '0 de 0';
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
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
    const isLow = item.stock <= 3;
    const badge = isLow 
      ? `<span class="badge badge-low px-2 py-1"><i class="fa-solid fa-triangle-exclamation me-1"></i> Stock Bajo</span>` 
      : `<span class="badge badge-stock px-2 py-1">Normal</span>`;

    rowsHtml += `
      <tr>
        <td><span class="badge bg-secondary text-white">${item.cat}</span></td>
        <td class="fw-bold" style="color: #3a322d;">${item.name}</td>
        <td class="text-muted small">${item.detail || '-'}</td>
        <td>${item.unit || 'Piezas'}</td>
        <td><span class="fs-6 fw-bold px-2 py-1 bg-white border border-light-subtle rounded">${item.stock}</span></td>
        <td>${badge}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary me-1" onclick="openDirectTransfer(${globalIdx})" title="Traspasar"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>
          <button class="btn btn-sm btn-outline-dark me-1" onclick="openQuickCount(${globalIdx})" title="Conteo Físico Rápido"><i class="fa-solid fa-calculator"></i></button>
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
  if (btnPrev) btnPrev.disabled = (currentPage === 1);
  if (btnNext) btnNext.disabled = (currentPage === totalPages);
}

function changePage(direction) {
  currentPage += direction;
  filterProducts();
}

function adjustStock(index, amount) {
  if (inventory[index].stock + amount < 0) return;
  inventory[index].stock += amount;
  const actionType = amount > 0 ? 'ENTRADA' : 'SALIDA';
  logMovement(actionType, inventory[index].name, `${amount > 0 ? '+1' : '-1'} ${inventory[index].unit}. Nuevo total: ${inventory[index].stock}`);
  saveAndRender();
}

// TRASPASOS Y CONTEOS
function prepareGlobalTransfer() {
  const select = document.getElementById('tfItemSelect');
  if (!select) return;
  select.innerHTML = '';
  
  if (inventory.length === 0) {
    select.innerHTML = '<option value="-1">No hay productos disponibles</option>';
    document.getElementById('tfOrigin').value = '-';
    document.getElementById('tfMaxStock').value = '0';
    return;
  }

  inventory.forEach((item, index) => {
    select.innerHTML += `<option value="${index}">${item.name} (${item.cat}) - Stock: ${item.stock}</option>`;
  });

  updateTransferMax();
}

function openDirectTransfer(index) {
  prepareGlobalTransfer();
  const select = document.getElementById('tfItemSelect');
  if (select) select.value = index;
  updateTransferMax();
  const modal = new bootstrap.Modal(document.getElementById('transferModal'));
  modal.show();
}

function updateTransferMax() {
  const select = document.getElementById('tfItemSelect');
  if (!select) return;
  const selectIdx = parseInt(select.value);
  if (selectIdx < 0 || isNaN(selectIdx)) return;

  const prod = inventory[selectIdx];
  document.getElementById('tfOrigin').value = prod.cat;
  document.getElementById('tfMaxStock').value = `${prod.stock} ${prod.unit}`;
  document.getElementById('tfQuantity').max = prod.stock;
}

const tfForm = document.getElementById('transferForm');
if (tfForm) {
  tfForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const originIdx = parseInt(document.getElementById('tfItemSelect').value);
    const destCat = document.getElementById('tfDestination').value.toUpperCase().trim();
    const qty = parseInt(document.getElementById('tfQuantity').value) || 0;

    if (originIdx < 0 || isNaN(originIdx) || !inventory[originIdx]) return;

    const originProd = inventory[originIdx];

    if (destCat === originProd.cat) {
      alert("El almacén destino no puede ser igual al de origen.");
      return;
    }

    if (qty > originProd.stock) {
      alert("La cantidad excede el stock disponible.");
      return;
    }

    originProd.stock -= qty;

    let destProd = inventory.find(i => i.cat === destCat && i.name.toLowerCase() === originProd.name.toLowerCase());
    
    if (destProd) {
      destProd.stock += qty;
    } else {
      destProd = {
        cat: destCat,
        name: originProd.name,
        detail: originProd.detail || '',
        unit: originProd.unit || 'Piezas',
        stock: qty
      };
      inventory.push(destProd);
    }

    logMovement('TRASPASO', originProd.name, `Traspaso de ${qty} ${originProd.unit} de [${originProd.cat}] ➔ [${destCat}]`);

    saveAndRender();
    bootstrap.Modal.getInstance(document.getElementById('transferModal')).hide();
    this.reset();
  });
}

function openQuickCount(index) {
  const prod = inventory[index];
  document.getElementById('qcIndex').value = index;
  document.getElementById('qcItemName').innerText = prod.name;
  document.getElementById('qcItemDetail').innerText = `${prod.cat} | Ubicación: ${prod.detail || 'General'}`;
  document.getElementById('qcOldStock').innerText = `${prod.stock} ${prod.unit}`;
  document.getElementById('qcNewStock').value = prod.stock;
  calculateQcDiff();

  const modal = new bootstrap.Modal(document.getElementById('quickCountModal'));
  modal.show();
}

function calculateQcDiff() {
  const index = parseInt(document.getElementById('qcIndex').value);
  if (index < 0) return;
  const oldStock = inventory[index].stock;
  const newStock = parseInt(document.getElementById('qcNewStock').value) || 0;
  const diff = newStock - oldStock;

  const diffEl = document.getElementById('qcDiff');
  if (diffEl) {
    if (diff > 0) {
      diffEl.innerText = `+${diff}`;
      diffEl.className = 'fs-4 fw-bold text-success';
    } else if (diff < 0) {
      diffEl.innerText = `${diff}`;
      diffEl.className = 'fs-4 fw-bold text-danger';
    } else {
      diffEl.innerText = '0';
      diffEl.className = 'fs-4 fw-bold text-secondary';
    }
  }
}

const qcForm = document.getElementById('quickCountForm');
if (qcForm) {
  qcForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const index = parseInt(document.getElementById('qcIndex').value);
    const newStock = parseInt(document.getElementById('qcNewStock').value) || 0;
    const oldStock = inventory[index].stock;
    const diff = newStock - oldStock;

    inventory[index].stock = newStock;
    logMovement('CONTEO', inventory[index].name, `Ajuste Físico: de ${oldStock} a ${newStock} (${diff >= 0 ? '+' : ''}${diff})`);

    saveAndRender();
    bootstrap.Modal.getInstance(document.getElementById('quickCountModal')).hide();
  });
}

function deleteProduct(index) {
  const prod = inventory[index];
  if (confirm(`¿Deseas eliminar el artículo "${prod.name}"?`)) {
    logMovement('ELIMINADO', prod.name, `Eliminado de ${prod.cat}`);
    inventory.splice(index, 1);
    saveAndRender();
  }
}

function editProduct(index) {
  const prod = inventory[index];
  document.getElementById('editIndex').value = index;
  document.getElementById('pCat').value = prod.cat;
  document.getElementById('pName').value = prod.name;
  document.getElementById('pDetail').value = prod.detail || '';
  document.getElementById('pUnit').value = prod.unit || 'Piezas';
  document.getElementById('pStock').value = prod.stock;

  document.getElementById('modalProductTitle').innerText = 'Editar Artículo';
  document.getElementById('btnSubmitProduct').innerText = 'Actualizar Cambios';

  const modal = new bootstrap.Modal(document.getElementById('addProductModal'));
  modal.show();
}

function resetProductForm() {
  document.getElementById('editIndex').value = "-1";
  const pForm = document.getElementById('productForm');
  if (pForm) pForm.reset();
  document.getElementById('pUnit').value = 'Piezas';
  document.getElementById('pStock').value = '0';
  document.getElementById('modalProductTitle').innerText = 'Registrar Nuevo Artículo';
  document.getElementById('btnSubmitProduct').innerText = 'Guardar Artículo';
}

const pForm = document.getElementById('productForm');
if (pForm) {
  pForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const editIndex = parseInt(document.getElementById('editIndex').value);
    const cat = document.getElementById('pCat').value.toUpperCase();
    const name = document.getElementById('pName').value;
    const detail = document.getElementById('pDetail').value;
    const unit = document.getElementById('pUnit').value;
    const stock = parseInt(document.getElementById('pStock').value) || 0;

    if (editIndex >= 0) {
      inventory[editIndex] = { cat, name, detail, unit, stock };
      logMovement('EDICION', name, `Datos actualizados (${cat}, Stock: ${stock} ${unit})`);
    } else {
      inventory.push({ cat, name, detail, unit, stock });
      logMovement('ALTA', name, `Nuevo artículo en ${cat} con stock inicial: ${stock} ${unit}`);
    }

    saveAndRender();
    bootstrap.Modal.getInstance(document.getElementById('addProductModal')).hide();
    resetProductForm();
  });
}

// EXPORTAR Y EXCEL
function exportExcelReport() {
  if (inventory.length === 0) {
    alert("No hay artículos en el inventario para exportar.");
    return;
  }

  const exportDataArr = inventory.map((item, idx) => ({
    'N°': idx + 1,
    'Categoría': item.cat,
    'Artículo': item.name,
    'Ubicación / Detalle': item.detail || '-',
    'Unidad': item.unit || 'Piezas',
    'Stock Actual': item.stock,
    'Estatus': item.stock <= 3 ? 'STOCK BAJO' : 'OK'
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportDataArr);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario Shifra");

  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Reporte_Inventario_ShifraSpa_${today}.xlsx`);
}

function handleExcelUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const statusDiv = document.getElementById('uploadStatus');
  if (statusDiv) statusDiv.innerText = "Procesando pestañas del Excel...";

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      let newInventory = [];
      let ignoredSheets = ['Indicadores', 'Lista de Compras', 'Movimientos', '1', '2', 'Control Mensual', 'Dashboard', 'Control Mensual Aceite'];

      workbook.SheetNames.forEach(sheetName => {
        if (ignoredSheets.includes(sheetName)) return;

        const worksheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        let headerIdx = -1;
        for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
          const rowStr = (rawRows[i] || []).join(' ').toLowerCase();
          if (rowStr.includes('nombre') || rowStr.includes('articulo') || rowStr.includes('conteo') || rowStr.includes('inventario')) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx !== -1) {
          const headers = rawRows[headerIdx].map(h => String(h || '').toLowerCase().trim());
          const catCol = headers.findIndex(h => h.includes('categoría') || h.includes('categoria'));
          const nameCol = headers.findIndex(h => h.includes('nombre') || h.includes('articulo'));
          const stockCol = headers.findIndex(h => h.includes('inventario') || h.includes('conteo') || h.includes('stock'));
          const unitCol = headers.findIndex(h => h.includes('unidad'));
          const locCol = headers.findIndex(h => h.includes('ubicación') || h.includes('ubicacion'));

          for (let r = headerIdx + 1; r < rawRows.length; r++) {
            const row = rawRows[r];
            if (!row || row.length === 0) continue;

            const nameVal = nameCol !== -1 && row[nameCol] ? String(row[nameCol]).trim() : '';
            if (!nameVal || nameVal.toLowerCase().includes('total') || nameVal.toLowerCase().includes('nombre del')) continue;

            const catVal = catCol !== -1 && row[catCol] ? String(row[catCol]).trim() : sheetName;
            const stockRaw = stockCol !== -1 ? row[stockCol] : 0;
            const stockVal = parseInt(stockRaw) || 0;
            const unitVal = unitCol !== -1 && row[unitCol] ? String(row[unitCol]).trim() : 'Piezas';
            const locVal = locCol !== -1 && row[locCol] ? String(row[locCol]).trim() : sheetName;

            newInventory.push({
              cat: catVal.toUpperCase(),
              name: nameVal,
              detail: locVal,
              unit: unitVal,
              stock: stockVal >= 0 ? stockVal : 0
            });
          }
        }
      });

      if (newInventory.length > 0) {
        inventory = newInventory;
        logMovement('EXCEL', 'Carga Masiva', `Se cargaron ${inventory.length} artículos desde archivo Excel`);
        saveAndRender();
        if (statusDiv) statusDiv.innerText = `¡Éxito! Se cargaron ${inventory.length} artículos correctamente.`;
        setTimeout(() => {
          const modalEl = document.getElementById('importExcelModal');
          if (modalEl) bootstrap.Modal.getInstance(modalEl).hide();
          if (statusDiv) statusDiv.innerText = '';
        }, 1600);
      } else {
        if (statusDiv) statusDiv.innerText = "No se encontraron datos compatibles.";
      }

    } catch (error) {
      if (statusDiv) statusDiv.innerText = "Error al leer el archivo Excel.";
    }
  };
  reader.readAsArrayBuffer(file);
}

function exportData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ inventory, historyLogs, dosiBatches, servicesCatalog, oilData }, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "respaldo_inventario_shifra.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
