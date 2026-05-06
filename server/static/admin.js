const state = {
  scenarios: [],
  products: [],
  filterScenario: null,
  filterKeyword: '',
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
  const keyword = state.filterKeyword.trim().toLowerCase();
  const filtered = state.products.filter((p) => {
    if (state.filterScenario && p.scenario_id !== state.filterScenario) return false;
    if (keyword && !p.name.toLowerCase().includes(keyword)) return false;
    return true;
  });
  els.countText.textContent = `共 ${filtered.length} 个产品`;
  els.ruleBody.innerHTML = filtered.map(productRow).join('');
  filtered.forEach((p) => bindRow(p.id));
}

function productRow(p) {
  const updated = p.rule_updated_at ? `${escapeHtml(p.updated_by || '-')}<br>${formatTime(p.rule_updated_at)}` : '<span class="muted">未维护</span>';
  return `<tr data-id="${p.id}">
    <td class="col-name product-name">
      ${escapeHtml(p.name)}
      <small>${escapeHtml(p.scenario_label || '')}${(p.aliases || []).length ? ' · 别名 ' + escapeHtml((p.aliases || []).join(',')) : ''}</small>
    </td>
    <td><input type="text" data-field="normal_discount" value="${escapeHtml(p.normal_discount || '')}" placeholder="9折"></td>
    <td><input type="text" data-field="normal_commission" value="${escapeHtml(p.normal_commission || '')}" placeholder="5%返佣 / 无返佣"></td>
    <td><input type="text" data-field="breakthrough_discount" value="${escapeHtml(p.breakthrough_discount || '')}" placeholder="8折"></td>
    <td><input type="text" data-field="breakthrough_commission" value="${escapeHtml(p.breakthrough_commission || '')}" placeholder="10%返佣 / 无返佣"></td>
    <td style="text-align:center"><label class="commission-toggle"><input type="checkbox" data-field="no_commission" ${p.no_commission ? 'checked' : ''}><span>${p.no_commission ? '不支持' : '支持'}</span></label></td>
    <td><input type="text" data-field="remark" value="${escapeHtml(p.remark || '')}" placeholder="适用条件 / 注意事项"></td>
    <td>${updated}</td>
    <td class="actions">
      <button class="primary small" data-action="save">保存规则</button>
      <button class="ghost" data-action="edit">修改</button>
      <button class="danger" data-action="archive">停用</button>
    </td>
  </tr>`;
}

function bindRow(productId) {
  const row = els.ruleBody.querySelector(`tr[data-id="${productId}"]`);
  if (!row) return;
  row.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => row.classList.add('dirty'));
    input.addEventListener('change', () => {
      row.classList.add('dirty');
      if (input.dataset.field === 'no_commission') {
        const label = input.closest('.commission-toggle')?.querySelector('span');
        if (label) label.textContent = input.checked ? '不支持' : '支持';
      }
    });
  });
  row.querySelector('[data-action="save"]').addEventListener('click', () => saveRow(row, productId));
  row.querySelector('[data-action="edit"]').addEventListener('click', () => openEditDialog(productId));
  row.querySelector('[data-action="archive"]').addEventListener('click', () => archiveProduct(productId));
}

async function saveRow(row, productId) {
  row.classList.add('saving');
  const body = {};
  row.querySelectorAll('input').forEach((input) => {
    const field = input.dataset.field;
    if (!field) return;
    body[field] = input.type === 'checkbox' ? input.checked : input.value;
  });
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

async function archiveProduct(productId) {
  if (!confirm('停用后，销售生成器里不再显示这个产品。确定停用吗？')) return;
  const resp = await fetchJson(`/api/products/${productId}`, {method: 'DELETE'});
  if (resp.code === 0) {
    await refreshProducts();
  } else {
    alert(resp.msg || '停用失败');
  }
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
els.searchInput.addEventListener('input', (event) => {
  state.filterKeyword = event.target.value;
  renderProducts();
});
els.logoutBtn.addEventListener('click', async () => {
  await fetchJson('/api/auth/logout', {method: 'POST'});
  window.location.href = '/login';
});

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
