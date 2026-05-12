// 变更记录弹窗：规则变更 / 产品类型变更 / 行业匹配变更
// 用法：在页面里调 ChangeLog.open()；首次调用会自动注入 dialog
(function () {
  const FIELD_LABELS = {
    price_type: "价格模式",
    normal_discount: "常规折扣",
    normal_commission: "常规返佣",
    breakthrough_discount: "突破折扣",
    breakthrough_commission: "突破返佣",
    billing_modes: "计费方式",
    no_commission: "返佣支持",
    remark: "说明",
  };
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
    }[c]));
  }
  function fmtVal(field, v) {
    if (field === "price_type") return v === "fixed_price" ? "一口价" : "折扣";
    if (field === "billing_modes") return formatBillingModes(v);
    if (field === "no_commission") return Number(v) ? "不支持" : "支持";
    if (v === null || v === undefined || v === "") return "—";
    return v;
  }
  function formatBillingModes(v) {
    const map = { prepaid: "预付费", postpaid: "后付费" };
    let list = v;
    if (typeof list === "string") {
      try { list = JSON.parse(list); } catch (_) { list = list ? [list] : []; }
    }
    if (!Array.isArray(list) || !list.length) return "—";
    return list.map((x) => map[x] || x).join(" / ");
  }
  function fmtTime(s) { return (s || "").replace("T", " ").slice(0, 16); }

  function ensureDialog() {
    if (document.getElementById("changeLogDialog")) return;
    const dlg = document.createElement("dialog");
    dlg.id = "changeLogDialog";
    dlg.innerHTML = `
      <div class="cl-head">
        <strong>变更记录</strong>
        <div class="cl-tabs">
          <button class="cl-tab active" data-tab="rule">规则变更</button>
          <button class="cl-tab" data-tab="type">产品类型变更</button>
          <button class="cl-tab" data-tab="industry">行业匹配变更</button>
        </div>
        <button class="cl-close" title="关闭">×</button>
      </div>
      <div class="cl-toolbar">
        <span class="cl-hint" id="clHint">最近 200 条</span>
        <select id="clIndustryFilter" hidden></select>
      </div>
      <div class="cl-body" id="clBody"></div>
    `;
    document.body.appendChild(dlg);
    // 样式注入一次
    const style = document.createElement("style");
    style.textContent = `
      #changeLogDialog { border:none;border-radius:10px;padding:0;width:min(820px,calc(100% - 24px));box-shadow:0 20px 50px rgba(20,30,60,0.2); }
      #changeLogDialog .cl-head { display:flex;align-items:center;gap:14px;padding:14px 18px 0;border-bottom:1px solid #f1f5f9; }
      #changeLogDialog .cl-head strong { font-size:14px; }
      #changeLogDialog .cl-tabs { display:flex;gap:2px;margin-left:auto;margin-right:auto; }
      #changeLogDialog .cl-tab { background:transparent;border:none;border-bottom:2px solid transparent;padding:8px 14px;font-size:13px;color:#6b7280;cursor:pointer; }
      #changeLogDialog .cl-tab.active { color:#111827;border-bottom-color:#111827;font-weight:600; }
      #changeLogDialog .cl-tab:hover { color:#111827; }
      #changeLogDialog .cl-close { border:none;background:transparent;font-size:20px;cursor:pointer;color:#6b7280;padding:0 4px; }
      #changeLogDialog .cl-toolbar { display:flex;justify-content:space-between;align-items:center;padding:8px 18px;border-bottom:1px solid #f1f5f9; font-size:12px;color:#6b7280; }
      #changeLogDialog .cl-toolbar select { height:26px;border:1px solid #e5e7eb;border-radius:6px;padding:0 8px;font-size:12.5px; }
      #changeLogDialog .cl-body { max-height:65vh;overflow:auto;padding:0; }
      #changeLogDialog .cl-item { padding:11px 18px;border-bottom:1px solid #f1f5f9; font-size:12.5px;line-height:1.55; }
      #changeLogDialog .cl-item-head { display:flex;justify-content:space-between;color:#6b7280;font-size:11.5px;margin-bottom:5px; }
      #changeLogDialog .cl-item-head strong { color:#111827;font-weight:500;font-size:13px; }
      #changeLogDialog .cl-diff-row { display:grid;grid-template-columns:90px 1fr;gap:8px;padding:1px 0; }
      #changeLogDialog .cl-diff-key { color:#6b7280; }
      #changeLogDialog .cl-from { background:#fef2f2;color:#b91c1c;padding:0 5px;border-radius:3px;text-decoration:line-through;margin-right:6px; }
      #changeLogDialog .cl-to { background:#f0fdf4;color:#15803d;padding:0 5px;border-radius:3px; }
      #changeLogDialog .cl-tag { display:inline-block;background:#f3f4f6;color:#1f2937;border-radius:4px;padding:1px 7px;margin:2px 4px 2px 0;font-size:12px; }
      #changeLogDialog .cl-add { color:#15803d;font-weight:500; }
      #changeLogDialog .cl-del { color:#b91c1c;font-weight:500; }
      #changeLogDialog .cl-empty { padding:40px;text-align:center;color:#9ca3af; }
    `;
    document.head.appendChild(style);

    let currentTab = "rule";
    const $ = (id) => document.getElementById(id);
    function setTab(tab) {
      currentTab = tab;
      dlg.querySelectorAll(".cl-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
      $("clIndustryFilter").hidden = tab !== "industry";
      $("clHint").textContent = tab === "rule"
        ? "最近 200 条规则变更"
        : (tab === "type" ? "最近 100 条产品类型变更" : "最近 100 条行业匹配变更");
      load();
    }

    async function load() {
      const body = $("clBody");
      body.innerHTML = `<div class="cl-empty">加载中…</div>`;
      if (currentTab === "rule") {
        const resp = await fetch("/api/rule-history").then((r) => r.json()).catch(() => ({ code: -1 }));
        if (resp.code !== 0) { body.innerHTML = `<div class="cl-empty">加载失败（需要 admin 权限）</div>`; return; }
        renderRule(resp.data || []);
      } else if (currentTab === "type") {
        const resp = await fetch("/api/scenarios/change-log").then((r) => r.json()).catch(() => ({ code: -1 }));
        if (resp.code !== 0) { body.innerHTML = `<div class="cl-empty">加载失败（需要 admin 权限）</div>`; return; }
        renderType(resp.data || []);
      } else {
        const key = $("clIndustryFilter").value;
        const url = "/api/industries/change-log" + (key ? `?industry_key=${encodeURIComponent(key)}` : "");
        const resp = await fetch(url).then((r) => r.json()).catch(() => ({ code: -1 }));
        if (resp.code !== 0) { body.innerHTML = `<div class="cl-empty">加载失败</div>`; return; }
        renderIndustry(resp.data || []);
      }
    }

    function renderRule(list) {
      if (!list.length) { $("clBody").innerHTML = `<div class="cl-empty">暂无规则变更</div>`; return; }
      $("clBody").innerHTML = list.map((it) => {
        const diff = it.diff || {};
        const keys = Object.keys(diff);
        const action = it.action === "create" ? "新建" : "修改";
        const diffHtml = keys.length
          ? keys.map((k) => `
            <div class="cl-diff-row">
              <span class="cl-diff-key">${esc(FIELD_LABELS[k] || k)}</span>
              <span><span class="cl-from">${esc(fmtVal(k, diff[k].from))}</span>→<span class="cl-to" style="margin-left:6px;">${esc(fmtVal(k, diff[k].to))}</span></span>
            </div>`).join("")
          : `<div class="cl-diff-row"><span class="cl-diff-key">说明</span><span style="color:#9ca3af;">${action === "新建" ? "首次新建规则" : "无字段变化"}</span></div>`;
        return `<div class="cl-item">
          <div class="cl-item-head">
            <span><strong>${esc(it.product_name || `产品#${it.product_id}`)}</strong> · ${esc(it.actor || "系统")} · ${action}</span>
            <span>${fmtTime(it.created_at)}</span>
          </div>
          ${diffHtml}
        </div>`;
      }).join("");
    }

    function renderIndustry(list) {
      if (!list.length) { $("clBody").innerHTML = `<div class="cl-empty">暂无行业匹配变更</div>`; return; }
      $("clBody").innerHTML = list.map((it) => {
        const tag = (label, cls, items) => items.length
          ? `<div style="margin-top:3px;"><span class="${cls}">${label} ${items.length}</span>：${items.map((i) => `<span class="cl-tag">${esc(i.name)}</span>`).join("")}</div>`
          : "";
        return `<div class="cl-item">
          <div class="cl-item-head">
            <span><strong>${esc(it.industry_key)}</strong> · ${esc(it.actor || "系统")}</span>
            <span>${fmtTime(it.created_at)}</span>
          </div>
          ${tag("新增", "cl-add", it.added || [])}
          ${tag("移除", "cl-del", it.removed || [])}
        </div>`;
      }).join("");
    }

    function renderType(list) {
      if (!list.length) { $("clBody").innerHTML = `<div class="cl-empty">暂无产品类型变更</div>`; return; }
      const actionMap = { create: "新增", update: "修改", delete: "删除" };
      $("clBody").innerHTML = list.map((it) => {
        const before = it.before || {};
        const after = it.after || {};
        let bodyHtml = "";
        if (it.action === "create") {
          bodyHtml = `<div class="cl-diff-row"><span class="cl-diff-key">名称</span><span><span class="cl-to">${esc(after.label || "—")}</span></span></div>`;
        } else if (it.action === "update") {
          bodyHtml = `<div class="cl-diff-row"><span class="cl-diff-key">名称</span><span><span class="cl-from">${esc(before.label || "—")}</span>→<span class="cl-to" style="margin-left:6px;">${esc(after.label || "—")}</span></span></div>`;
        } else {
          bodyHtml = `
            <div class="cl-diff-row"><span class="cl-diff-key">删除</span><span><span class="cl-from">${esc(before.label || "—")}</span></span></div>
            <div class="cl-diff-row"><span class="cl-diff-key">产品转移</span><span>${esc(before.product_count || 0)} 个 → ${esc(after.moved_to || "—")}</span></div>`;
        }
        return `<div class="cl-item">
          <div class="cl-item-head">
            <span><strong>${esc(before.label || after.label || it.type_key || `类型#${it.type_id}`)}</strong> · ${esc(it.actor || "系统")} · ${actionMap[it.action] || it.action}</span>
            <span>${fmtTime(it.created_at)}</span>
          </div>
          ${bodyHtml}
        </div>`;
      }).join("");
    }

    dlg.querySelector(".cl-close").addEventListener("click", () => dlg.close());
    dlg.querySelectorAll(".cl-tab").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
    $("clIndustryFilter").addEventListener("change", load);

    dlg._reload = load;
    dlg._setTab = setTab;
  }

  async function fillIndustries(presetKey) {
    const sel = document.getElementById("clIndustryFilter");
    if (!sel) return;
    if (!sel.options.length) {
      const resp = await fetch("/api/industries").then((r) => r.json()).catch(() => ({ data: [] }));
      const data = resp.data || [];
      sel.innerHTML = `<option value="">全部行业</option>` + data.map((i) => `<option value="${i.key}">${i.key}</option>`).join("");
    }
    if (presetKey != null) sel.value = presetKey;
  }

  window.ChangeLog = {
    async open(tab = "rule", presetIndustryKey = null) {
      ensureDialog();
      await fillIndustries(presetIndustryKey);
      const dlg = document.getElementById("changeLogDialog");
      dlg._setTab(tab);
      if (!dlg.open) dlg.showModal();
    }
  };
})();
