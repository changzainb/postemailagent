const state = {
  scenarios: [],
  products: [],
  filterScenario: null,
  filterKeyword: '',
  selectedIds: new Set(),
  batchDeleteMode: false,
};

const els = {
  userInfo: document.getElementById('userInfo'),
  scenarioList: document.getElementById('scenarioList'),
  missingList: document.getElementById('missingList'),
  ruleBody: document.getElementById('ruleTableBody'),
  countText: document.getElementById('countText'),
  searchInput: document.getElementById('searchInput'),
  addBtn: document.getElementById('addProductBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  dialog: document.getElementById('productDialog'),
  dlgName: document.getElementById('dlgName'),
  dlgScenario: document.getElementById('dlgScenario'),
  dlgAliases: document.getElementById('dlgAliases'),
  dlgTitle: document.getElementById('dialogTitle'),
  dlgForm: document.getElementById('productForm'),
};

let editingProductId = null;

async function fetchJson(url, options = {}) {
  const resp = await fetch(url, {
    credentials: 'same-origin',
    headers: {'Content-Type': 'application/json'},
    ...options,
  });
  if (resp.status === 401) {
    window.location.href = '/login';
    throw new Error('unauthorized');
  }
  return resp.json();
}

async function bootstrap() {
  const me = await fetchJson('/api/auth/me');
  if (!me.data) {
    window.location.href = '/login';
    return;
  }
  els.userInfo.textContent = `${me.data.username} · ${me.data.role}`;
  const [scenariosResp, productsResp, missingResp] = await Promise.all([
    fetchJson('/api/scenarios'),
    fetchJson('/api/products?status=active'),
    fetchJson('/api/match/missing'),
  ]);
  state.scenarios = scenariosResp.data || [];
  state.products = productsResp.data || [];
  renderScenarios();
  renderProducts();
  renderMissing(missingResp.data || []);
  populateScenarioOptions();
}

function renderScenarios() {
  const counts = new Map();
  for (const p of state.products) {
    counts.set(p.scenario_id, (counts.get(p.scenario_id) || 0) + 1);
  }
  const items = [];
  items.push(scenarioItem(null, '全部', state.products.length));
  for (const s of state.scenarios) {
    items.push(scenarioItem(s.id, s.label, counts.get(s.id) || 0));
  }
  els.scenarioList.innerHTML = items.join('');
  els.scenarioList.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', () => {
      const value = li.dataset.id === '' ? null : Number(li.dataset.id);
      state.filterScenario = value;
      renderScenarios();
      renderProducts();
    });
  });
}

function scenarioItem(id, label, count) {
  const active = (id === state.filterScenario) ? ' active' : '';
  return `<li class="${active.trim()}" data-id="${id ?? ''}">
    <span>${escapeHtml(label)}</span><span class="badge">${count}</span>
  </li>`;
}

function renderMissing(items) {
  if (!items.length) {
    els.missingList.innerHTML = '<li class="muted">暂无</li>';
    return;
  }
  els.missingList.innerHTML = items.slice(0, 30).map((item) =>
    `<li title="${escapeHtml(item.raw_name)}">
      <span>${escapeHtml(truncate(item.raw_name, 18))}</span>
    </li>`
  ).join('');
}

function renderProducts() {
  const filtered = filteredProducts();
  // 把不在当前列表里的选中清掉，避免误删
  const visibleIds = new Set(filtered.map((p) => p.id));
  for (const id of [...state.selectedIds]) {
    if (!visibleIds.has(id)) state.selectedIds.delete(id);
  }
  els.countText.textContent = `共 ${filtered.length} 个产品`;
  document.querySelector('.rule-table')?.classList.toggle('batch-mode', state.batchDeleteMode);
  els.ruleBody.innerHTML = filtered.map(productRow).join('');
  filtered.forEach((p) => bindRow(p.id));
  syncSelectionUI(filtered);
}

function syncSelectionUI(filtered) {
  const total = filtered.length;
  const selected = state.selectedIds.size;
  const selectAll = document.getElementById('selectAll');
  if (selectAll) {
    selectAll.hidden = !state.batchDeleteMode;
    selectAll.checked = total > 0 && selected === total;
    selectAll.indeterminate = selected > 0 && selected < total;
  }
  const btn = document.getElementById('batchDeleteBtn');
  if (btn) {
    btn.disabled = state.batchDeleteMode && selected === 0;
    btn.textContent = state.batchDeleteMode
      ? (selected ? `确认删除 (${selected})` : '选择要删除的产品')
      : '批量删除';
  }
  const cancelBtn = document.getElementById('batchCancelBtn');
  if (cancelBtn) cancelBtn.hidden = !state.batchDeleteMode;
}

function normalizeBillingModes(modes) {
  const list = Array.isArray(modes) ? modes : ['prepaid', 'postpaid'];
  const allowed = list.filter((x) => x === 'prepaid' || x === 'postpaid');
  return allowed.length ? allowed : ['prepaid', 'postpaid'];
}

function billingModeText(modes) {
  const labels = {prepaid: '预付费', postpaid: '后付费'};
  return normalizeBillingModes(modes).map((x) => labels[x]).join(' / ');
}

function parseDiscountNum(s) {
  const m = String(s || '').match(/(\d+(?:\.\d+)?)\s*折/);
  return m ? m[1] : '';
}
function parseCommissionNum(s) {
  const m = String(s || '').match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? m[1] : '';
}

function productRow(p) {
  const updated = p.rule_updated_at
    ? `<div class="meta"><b>${escapeHtml(p.updated_by || '系统')}</b>${formatTime(p.rule_updated_at)}</div>`
    : '<span class="muted" style="font-size:12px">未维护</span>';
  const cell = (field, val, ph) => `<td>
    <span class="cell-view" data-view="${field}">${val ? escapeHtml(val) : '<span class="muted">—</span>'}</span>
    <input class="cell-edit" type="text" data-field="${field}" value="${escapeHtml(val || '')}" placeholder="${ph}" hidden>
  </td>`;
  const numCell = (field, val, suffix, ph) => {
    const num = suffix === '折' ? parseDiscountNum(val) : parseCommissionNum(val);
    return `<td>
      <span class="cell-view" data-view="${field}">${val ? escapeHtml(val) : '<span class="muted">—</span>'}</span>
      <span class="cell-edit input-suffix" data-suffix-field="${field}" hidden>
        <input type="text" inputmode="decimal" data-field="${field}" data-suffix="${suffix}" value="${escapeHtml(num)}" placeholder="${ph}">
        <span class="suffix">${suffix}</span>
      </span>
    </td>`;
  };
  const supported = !p.no_commission;
  const checked = state.selectedIds.has(p.id) ? 'checked' : '';
  const billingModes = normalizeBillingModes(p.billing_modes);
  return `<tr data-id="${p.id}">
    <td class="col-check"><input type="checkbox" class="row-check" data-id="${p.id}" ${checked} ${state.batchDeleteMode ? '' : 'hidden'}></td>
    <td class="col-name product-name">
      ${escapeHtml(p.name)}
      <small>${escapeHtml(p.scenario_label || '')}${(p.aliases || []).length ? ' · 别名 ' + escapeHtml((p.aliases || []).join(',')) : ''}</small>
    </td>
    <td>
      <span class="cell-view billing-mode-view" data-view="billing_modes">${escapeHtml(billingModeText(billingModes))}</span>
      <div class="cell-edit billing-mode-edit" hidden>
        <label><input type="checkbox" data-field="billing_modes" data-mode="prepaid" ${billingModes.includes('prepaid') ? 'checked' : ''}>预付费</label>
        <label><input type="checkbox" data-field="billing_modes" data-mode="postpaid" ${billingModes.includes('postpaid') ? 'checked' : ''}>后付费</label>
      </div>
    </td>
    ${numCell('normal_discount', p.normal_discount, '折', '9')}
    ${numCell('normal_commission', p.normal_commission, '%返佣', '5')}
    ${numCell('breakthrough_discount', p.breakthrough_discount, '折', '8')}
    ${numCell('breakthrough_commission', p.breakthrough_commission, '%返佣', '10')}
    <td class="col-center" title="返佣支持">
      <span class="cell-view" data-view="no_commission">${supported ? '✓' : '—'}</span>
      <input class="cell-edit" type="checkbox" data-field="no_commission" ${supported ? 'checked' : ''} hidden>
    </td>
    ${cell('remark', p.remark, '适用条件 / 注意事项')}
    <td>${updated}</td>
    <td class="actions">
      <button class="ghost small" data-action="enter-edit" title="编辑这一行">编辑</button>
      <button class="primary small" data-action="save" title="保存改动" hidden>保存</button>
      <button class="ghost small" data-action="cancel-edit" title="放弃改动" hidden>取消</button>
      <button class="icon-btn" data-action="meta" title="改产品名/场景/别名">改</button>
      <button class="icon-btn danger" data-action="delete" title="删除产品">删</button>
    </td>
  </tr>`;
}

function bindRow(productId) {
  const row = els.ruleBody.querySelector(`tr[data-id="${productId}"]`);
  if (!row) return;
  row.querySelectorAll('input.cell-edit, .input-suffix input, .billing-mode-edit input').forEach((input) => {
    input.addEventListener('input', () => row.classList.add('dirty'));
    input.addEventListener('change', () => row.classList.add('dirty'));
  });
  // 数字输入：只允许数字和小数点
  row.querySelectorAll('.input-suffix input').forEach((input) => {
    input.addEventListener('input', () => {
      const cleaned = input.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
      if (cleaned !== input.value) input.value = cleaned;
    });
  });
  const checkbox = row.querySelector('input.row-check');
  if (checkbox) {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) state.selectedIds.add(productId);
      else state.selectedIds.delete(productId);
      syncSelectionUI(filteredProducts());
    });
  }
  row.querySelector('[data-action="enter-edit"]').addEventListener('click', () => setRowEditing(row, true));
  row.querySelector('[data-action="cancel-edit"]').addEventListener('click', () => {
    setRowEditing(row, false);
    renderProducts(); // 还原原值
  });
  row.querySelector('[data-action="save"]').addEventListener('click', () => saveRow(row, productId));
  row.querySelector('[data-action="meta"]').addEventListener('click', () => openEditDialog(productId));
  row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteProduct(productId));
}

function filteredProducts() {
  const keyword = state.filterKeyword.trim().toLowerCase();
  return state.products.filter((p) => {
    if (state.filterScenario && p.scenario_id !== state.filterScenario) return false;
    if (keyword && !p.name.toLowerCase().includes(keyword)) return false;
    return true;
  });
}

function setRowEditing(row, editing) {
  row.classList.toggle('editing', editing);
  row.querySelectorAll('.cell-view').forEach((el) => { el.hidden = editing; });
  row.querySelectorAll('.cell-edit').forEach((el) => { el.hidden = !editing; });
  row.querySelector('[data-action="enter-edit"]').hidden = editing;
  row.querySelector('[data-action="save"]').hidden = !editing;
  row.querySelector('[data-action="cancel-edit"]').hidden = !editing;
  row.querySelector('[data-action="meta"]').hidden = editing;
  row.querySelector('[data-action="delete"]').hidden = editing;
  if (editing) {
    const first = row.querySelector('.input-suffix input, input.cell-edit:not([type=checkbox])');
    if (first) first.focus();
  }
}

async function saveRow(row, productId) {
  row.classList.add('saving');
  const body = {billing_modes: []};
  row.querySelectorAll('input.cell-edit, .input-suffix input, .billing-mode-edit input').forEach((input) => {
    const field = input.dataset.field;
    if (!field) return;
    if (field === 'billing_modes') {
      if (input.checked) body.billing_modes.push(input.dataset.mode);
      return;
    }
    if (input.type === 'checkbox') {
      // UI 复选框语义：勾 = 支持返佣；DB 字段是 no_commission（true = 不支持），需翻转
      body[field] = field === 'no_commission' ? !input.checked : input.checked;
    } else if (input.dataset.suffix) {
      const v = input.value.trim();
      body[field] = v ? v + input.dataset.suffix : '';
    } else {
      body[field] = input.value;
    }
  });
  if (!body.billing_modes.length) {
    row.classList.remove('saving');
    alert('计费方式至少选一个');
    return;
  }
  const resp = await fetchJson(`/api/products/${productId}/rule`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  row.classList.remove('saving');
  if (resp.code === 0) {
    row.classList.remove('dirty');
    await refreshProducts();
  } else {
    alert(resp.msg || '保存失败');
  }
}

async function deleteProduct(productId) {
  const p = state.products.find((x) => x.id === productId);
  const name = p ? p.name : `#${productId}`;
  if (!confirm(`确认删除「${name}」？\n该产品的报价规则、变更历史、行业匹配会一起清掉，无法恢复。`)) return;
  const resp = await fetchJson(`/api/products/${productId}`, {method: 'DELETE'});
  if (resp.code === 0) {
    state.selectedIds.delete(productId);
    await refreshProducts();
  } else {
    alert(resp.msg || '删除失败');
  }
}

async function batchDelete() {
  if (!state.batchDeleteMode) {
    state.batchDeleteMode = true;
    state.selectedIds.clear();
    renderProducts();
    return;
  }
  const ids = [...state.selectedIds];
  if (!ids.length) return;
  if (!confirm(`确认批量删除 ${ids.length} 个产品？\n相关报价规则、变更历史、行业匹配会一起清掉，无法恢复。`)) return;
  const resp = await fetchJson('/api/products/batch-delete', {
    method: 'POST',
    body: JSON.stringify({ids}),
  });
  if (resp.code === 0) {
    state.selectedIds.clear();
    state.batchDeleteMode = false;
    await refreshProducts();
  } else {
    alert(resp.msg || '批量删除失败');
  }
}

function cancelBatchDelete() {
  state.batchDeleteMode = false;
  state.selectedIds.clear();
  renderProducts();
}

async function refreshProducts() {
  const resp = await fetchJson('/api/products?status=active');
  state.products = resp.data || [];
  renderScenarios();
  renderProducts();
}

function populateScenarioOptions() {
  els.dlgScenario.innerHTML = state.scenarios.map((s) =>
    `<option value="${s.id}">${escapeHtml(s.label)}</option>`
  ).join('');
}

function openCreateDialog() {
  editingProductId = null;
  els.dlgTitle.textContent = '新增产品';
  els.dlgName.value = '';
  els.dlgAliases.value = '';
  if (state.filterScenario) els.dlgScenario.value = state.filterScenario;
  els.dialog.showModal();
}

function openEditDialog(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;
  editingProductId = productId;
  els.dlgTitle.textContent = '修改产品';
  els.dlgName.value = product.name;
  els.dlgScenario.value = product.scenario_id;
  els.dlgAliases.value = (product.aliases || []).join(',');
  els.dialog.showModal();
}

els.dlgForm.addEventListener('submit', async (event) => {
  if (event.submitter && event.submitter.value === 'cancel') return;
  event.preventDefault();
  const body = {
    name: els.dlgName.value.trim(),
    scenario_id: Number(els.dlgScenario.value),
    aliases: els.dlgAliases.value.split(/[,，;；\s]+/).map((s) => s.trim()).filter(Boolean),
  };
  if (!body.name || !body.scenario_id) return;
  const url = editingProductId ? `/api/products/${editingProductId}` : '/api/products';
  const method = editingProductId ? 'PUT' : 'POST';
  const resp = await fetchJson(url, {method, body: JSON.stringify(body)});
  if (resp.code === 0) {
    els.dialog.close();
    await refreshProducts();
  } else {
    alert(resp.msg || '保存失败');
  }
});

els.addBtn.addEventListener('click', openCreateDialog);
document.getElementById('dlgCancel').addEventListener('click', () => els.dialog.close('cancel'));
els.searchInput.addEventListener('input', (event) => {
  state.filterKeyword = event.target.value;
  renderProducts();
});
els.logoutBtn.addEventListener('click', async () => {
  await fetchJson('/api/auth/logout', {method: 'POST'});
  window.location.href = '/login';
});

document.getElementById('changeLogBtn')?.addEventListener('click', () => {
  if (window.ChangeLog) window.ChangeLog.open('rule');
});

document.getElementById('selectAll')?.addEventListener('change', (e) => {
  if (!state.batchDeleteMode) return;
  const list = filteredProducts();
  if (e.target.checked) list.forEach((p) => state.selectedIds.add(p.id));
  else list.forEach((p) => state.selectedIds.delete(p.id));
  renderProducts();
});

document.getElementById('batchDeleteBtn')?.addEventListener('click', batchDelete);
document.getElementById('batchCancelBtn')?.addEventListener('click', cancelBatchDelete);

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function truncate(text, n) {
  if (!text) return '';
  return text.length > n ? text.slice(0, n) + '…' : text;
}

function formatTime(value) {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 16);
}

bootstrap();
