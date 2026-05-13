const SCENARIO_KEYWORDS = {
  aigc_media: ["漫剧", "短剧", "真人剧", "漫画", "动漫", "二次元", "aigc", "AIGC", "内容制作", "生图", "生视频", "文生图", "文生视频", "影视", "媒资", "MPS", "云点播", "VOD", "点播", "转码", "视频处理"],
  trtc_live: ["TRTC", "实时音视频", "直播", "音视频", "混流", "语音房", "社交", "连麦", "K歌", "CSS", "云直播", "直播云", "游戏语音", "GME"],
  edge_cdn: ["CDN", "边缘加速", "EdgeOne", "EO", "内容分发", "加速线路", "DCDN", "动态加速", "全球加速", "GAAP"],
  cvm_db: ["CVM", "云服务器", "数据库", "MySQL", "Redis", "MongoDB", "PostgreSQL", "TDSQL", "CDB", "GPU", "裸金属", "高性能计算"],
  cos: ["对象存储", "COS", "文件存储", "图片存储", "视频存储", "CFS"],
  security: ["天御", "审核", "安全", "人脸核身", "内容安全", "OCR", "实名", "黑库", "反诈", "WAF", "DDoS", "验证码"],
  mq: ["消息队列", "CKafka", "RocketMQ", "TDMQ", "Kafka", "Pulsar"],
};

// 每个场景只默认加载这些关键词命中的产品，避免一口气列 32 个
const SCENARIO_PRESET_TOKENS = {
  // AIGC：列出历史 ≥3 次的 14 条，MPS 子模型下沉到搜索
  aigc_media: [
    "云点播-流量计费",
    "云点播-标准存储",
    "云点播-AIGC-生图模型-GG",
    "云点播-AIGC-生图模型-JV",
    "云点播-AIGC-生图模型-Kling",
    "云点播-AIGC-生图模型-SI",
    "云点播-AIGC-生视频模型-GV",
    "云点播-AIGC-生视频模型-Hunyuan",
    "云点播-AIGC-生视频模型-JV",
    "云点播-AIGC-生视频模型-OS",
    "云点播-AIGC-生视频模型-SV",
    "云点播-AIGC-生视频模型-hailuo",
    "云点播-AIGC-生视频模型-kling",
    "云点播-AIGC-生视频模型-vidu",
    "云点播-AIGC-生视频模型-明眨",
  ],
  // TRTC：8 个主要计费档全列（历史 7-9 次都是高频）
  trtc_live: [
    "实时音视频TRTC-标清视频日结",
    "实时音视频TRTC-标清视频月结",
    "实时音视频TRTC-高清视频日结",
    "实时音视频TRTC-高清视频月结",
    "实时音视频TRTC-超高清视频月结",
    "实时音视频TRTC-语音日结",
    "实时音视频TRTC-语音月结",
    "实时音视频TRTC-混流转码",
  ],
  edge_cdn: [
    "边缘加速平台EO-企业版",
    "边缘加速平台EO-基础服务资费套餐（超额流量）-中国境内-后付费",
    "边缘加速平台EO-基础服务资费套餐（超额安全请求次数）-中国境内-后付费",
  ],
  // 出海专用的 EO 白名单
  edge_cdn_overseas: [
    "边缘加速平台EO-企业版",
    "边缘加速平台EO-基础服务资费套餐（超额流量）-中国境内+海外地区-后付费",
    "边缘加速平台EO-基础服务资费套餐（超额安全请求次数）-中国境内+海外地区-后付费",
  ],
  cvm_db: [
    "云服务器cvm-标准型S4\u3001S5\u3001S6\u3001S8\u3001SA2\u3001SA3\u3001SA4\u3001SA5\uff1b\u8ba1\u7b97\u578bC3\u3001C5\u3001C6\uff08\u56fd\u5185\u5730\u533a\uff09",
    "云服务器cvm-标准型S9",
  ],
  cvm_db_overseas: [
    "云服务器cvm-\uff08\u4e2d\u56fd\u5883\u5185+\u6d77\u5916\u5730\u533a\uff09",
  ],
  cos: ["对象存储 COS-标准存储\u3001\u6d41\u91cf-\u540e\u4ed8\u8d39"],
  // 安全：只默认视频审核 + 人脸核身（高频）
  security: ["天御-视频审核", "人脸核身-基础版人脸核身\uff08\u6743\u5a01\u5e93\uff09"],
  mq: ["CKafka", "RocketMQ"],
};

// 行业关键词 → 需要叠加的场景（一个行业常同时需要几类产品）
const INDUSTRY_SCENARIO_BUNDLES = {
  // 出海 / 跨境优先判定，避免被下面的行业覆盖
  "出海|海外|跨境": ["edge_cdn_overseas", "cvm_db_overseas", "cos", "security"],
  "漫剧|短剧|aigc|内容制作|影视": ["aigc_media", "cos", "edge_cdn", "trtc_live"],
  "漫画|动漫|二次元": ["aigc_media", "cos", "edge_cdn"],
  "直播|语音房|社交|连麦|K歌": ["trtc_live", "security", "cos", "edge_cdn"],
  "会议|IM|即时通讯|协作": ["trtc_live", "cos", "security"],
  "游戏|互娱": ["cvm_db", "trtc_live", "cos", "edge_cdn"],
  "短视频|图文|MCN|营销": ["cos", "edge_cdn", "aigc_media", "security"],
  "物联网|智能硬件": ["cvm_db", "mq", "cos"],
  "物流|交通运输": ["cvm_db", "mq", "cos"],
  "教育|校园": ["trtc_live", "aigc_media", "cos", "security"],
  "医疗|健康": ["trtc_live", "cvm_db", "cos", "security"],
  "电商|零售|SaaS": ["cvm_db", "cos", "edge_cdn", "security"],
  "政企|信息化|软件开发": ["cvm_db", "cos", "security"],
  "金融|人脸核身": ["security", "cvm_db", "cos"],
  "企业|网盘|OA": ["cvm_db", "cos", "edge_cdn"],
};

const fixedApplicationInfo = {
  managerTitle: "腾讯云渠道经理",
  agentName: "广州西骋网络科技有限公司",
  agentAccount: "2677906140",
  agentContribution: "代理商能提供本地化服务，帮助客户提供测试、选型，以及在产品上问题的解答和服务的跟进，同时代理商在引导客户新项目更多的转向腾讯云等起了关键作用，比如客情攻关及技术服务。",
};

const competitorPools = {
  cloud: ["阿里云", "AWS", "华为云", "百度云", "金山云", "京东云", "七牛云", "白山云"],
  voiceSocial: ["即构", "声网"],
};

const fieldIds = [
  "managerTitle",
  "projectName",
  "agentName",
  "agentAccount",
  "customerName",
  "customerAccount",
  "startDate",
  "endDate",
  "foundedYear",
  "companyScale",
  "currentProject",
  "customerBackground",
  "projectBackground",
  "competition",
  "agentContribution",
];

const fields = Object.fromEntries(fieldIds.map((id) => [id, document.getElementById(id)]));
const productList = document.getElementById("productList");
const productRowTemplate = document.getElementById("productRowTemplate");
const emailSubject = document.getElementById("emailSubject");
const emailBody = document.getElementById("emailBody");
const copyStatus = document.getElementById("copyStatus");
const industryInput = document.getElementById("industryInput");
const industryTagsEl = document.getElementById("industryTags");
const matchStatus = document.getElementById("matchStatus");
const thresholdBox = document.getElementById("thresholdBox");
const thresholdList = document.getElementById("thresholdList");

const catalog = {
  scenarios: [],
  scenarioByKey: {},
  scenarioById: {},
  products: [],
  productsByScenarioId: new Map(),
  productById: new Map(),
  industryProducts: {}, // { industryKey: [productId, ...] }
  industries: [], // [{key, label, count}]
};
let selectedIndustryTags = new Set();

async function loadCatalog() {
  try {
    const [scResp, prResp, ipResp] = await Promise.all([
      fetch("/api/scenarios").then((r) => r.json()),
      fetch("/api/products?status=active").then((r) => r.json()),
      fetch("/api/industry-products").then((r) => r.json()),
    ]);
    catalog.scenarios = scResp.data || [];
    catalog.products = prResp.data || [];
    catalog.industryProducts = ipResp.data || {};
    catalog.industries = (await fetch("/api/industries").then((r) => r.json())).data || [];
    catalog.scenarioByKey = {};
    catalog.scenarioById = {};
    catalog.productsByScenarioId = new Map();
    catalog.productById = new Map();
    catalog.scenarios.forEach((s) => {
      catalog.scenarioByKey[s.key] = s;
      catalog.scenarioById[s.id] = s;
      catalog.productsByScenarioId.set(s.id, []);
    });
    catalog.products.forEach((p) => {
      catalog.productById.set(p.id, p);
      const list = catalog.productsByScenarioId.get(p.scenario_id) || [];
      list.push(p);
      catalog.productsByScenarioId.set(p.scenario_id, list);
    });
  } catch (err) {
    matchStatus.textContent = "无法加载商务库，先用本地空库工作。";
  }
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultEndDate(startDate) {
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);
  endDate.setDate(endDate.getDate() - 1);
  return endDate;
}

function initializeFixedFields() {
  Object.entries(fixedApplicationInfo).forEach(([id, value]) => {
    fields[id].value = value;
    const textElement = document.getElementById(`${id}Text`);
    if (textElement) textElement.textContent = value;
  });
}

function initializeDefaultDates() {
  const today = new Date();
  fields.startDate.value = toDateInputValue(today);
  fields.endDate.value = toDateInputValue(getDefaultEndDate(today));
}

function formatDate(dateValue) {
  if (!dateValue) return "";
  const [year, month, day] = dateValue.split("-");
  return `${Number(year)}年${Number(month)}月${Number(day)}日`;
}

function normalizeCommission(value) {
  const trimmed = (value || "").trim();
  return trimmed || "无返佣";
}

function parseDiscount(value) {
  const trimmed = (value || "").trim();
  if (trimmed === "原价") return 10;
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const match = trimmed.match(/(\d+(?:\.\d+)?)\s*折/);
  if (!match) return null;
  const discount = Number(match[1]);
  return discount > 10 ? discount / 10 : discount;
}

function parseCommissionPercent(value) {
  const trimmed = (value || "").trim();
  if (/无|^0$/.test(trimmed)) return 0;
  const match = trimmed.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : null;
}

function normalizeBillingModes(modes) {
  const list = Array.isArray(modes) ? modes : ["prepaid", "postpaid"];
  const allowed = list.filter((x) => x === "prepaid" || x === "postpaid");
  return allowed.length ? allowed : ["prepaid", "postpaid"];
}

function billingModeLabel(mode) {
  return mode === "postpaid" ? "后付费" : "预付费";
}

function normalizePriceType(value, productName = "") {
  if (value === "fixed_price") return "fixed_price";
  return String(productName || "").includes("一口价") ? "fixed_price" : "discount";
}

function priceTypeLabel(value) {
  return normalizePriceType(value) === "fixed_price" ? "特批一口价" : "特批折扣";
}

function formatFixedPrice(value, unit) {
  const price = String(value || "").trim();
  const suffix = String(unit || "").trim();
  if (!price) return "";
  if (!suffix) return price;
  return `${price}${suffix}`;
}

function stripDiscountSuffix(value) {
  return String(value || "").trim().replace(/\s*折$/, "");
}

function formatDiscountValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text === "原价" || text.includes("折")) return text;
  return `${text}折`;
}

function setupProductPriceControls(row, priceType = row.dataset.priceType || "discount") {
  const type = normalizePriceType(priceType, row.querySelector(".product-name")?.value || "");
  row.dataset.priceType = type;
  const select = row.querySelector(".product-price-mode");
  const typeSelect = row.querySelector(".product-price-type");
  const priceInput = row.querySelector(".product-discount");
  const unitField = row.querySelector(".product-unit-field");
  const unitInput = row.querySelector(".product-price-unit");
  row.classList.toggle("fixed-price", type === "fixed_price");
  if (typeSelect) typeSelect.value = type;
  if (select) select.querySelector('option[value="manual"]').textContent = type === "fixed_price" ? "手动单价" : "手动折扣";
  if (priceInput) {
    priceInput.placeholder = type === "fixed_price" ? "例如：0.357" : "例如：8";
  }
  if (unitField && unitInput) {
    unitField.hidden = type !== "fixed_price";
    unitInput.disabled = type !== "fixed_price";
    if (type !== "fixed_price") unitInput.value = "";
  }
}

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  }[c]));
}

function setupBillingModeSelect(row, modes, preferred) {
  const select = row.querySelector(".product-billing-mode");
  const available = normalizeBillingModes(modes);
  const value = available.includes(preferred) ? preferred : available[0];
  select.innerHTML = available.map((mode) => `<option value="${mode}">${billingModeLabel(mode)}</option>`).join("");
  select.value = value;
  select.disabled = available.length === 1;
  row.dataset.billingModes = JSON.stringify(available);
}

function getProducts() {
  return Array.from(productList.querySelectorAll(".product-row")).map((row) => ({
    productId: row.dataset.productId || "",
    name: row.querySelector(".product-name").value.trim(),
    billingMode: row.querySelector(".product-billing-mode").value,
    priceType: row.querySelector(".product-price-type")?.value || row.dataset.priceType || "discount",
    priceMode: row.querySelector(".product-price-mode").value,
    discount: row.querySelector(".product-discount").value.trim(),
    priceUnit: row.querySelector(".product-price-unit")?.value.trim() || "",
    commission: normalizeCommission(row.querySelector(".product-commission").value),
    normalDiscount: row.dataset.normalDiscount || "",
    normalCommission: row.dataset.normalCommission || "",
    breakthroughDiscount: row.dataset.breakthroughDiscount || "",
    breakthroughCommission: row.dataset.breakthroughCommission || "",
    noCommission: row.dataset.noCommission === "1",
    matched: row.dataset.matched === "1",
    suggesting: row.dataset.suggesting === "1",
  })).filter((p) => p.name || p.discount || p.commission);
}

function hasFilledProductRows() {
  return Array.from(productList.querySelectorAll(".product-row")).some((row) => {
    const name = row.querySelector(".product-name").value.trim();
    const discount = row.querySelector(".product-discount").value.trim();
    const unit = row.querySelector(".product-price-unit")?.value.trim() || "";
    const commission = row.querySelector(".product-commission").value.trim();
    return Boolean(name || discount || unit || commission);
  });
}

function applyModeToRow(row, mode) {
  setupProductPriceControls(row);
  if (mode === "manual") return;
  if (mode === "original") {
    row.querySelector(".product-discount").value = "原价";
    row.querySelector(".product-commission").value = "无返佣";
    return;
  }
  if (mode === "breakthrough") {
    const value = row.dataset.breakthroughDiscount || row.dataset.normalDiscount || "";
    row.querySelector(".product-discount").value = row.dataset.priceType === "fixed_price" ? value : stripDiscountSuffix(value);
    row.querySelector(".product-commission").value = row.dataset.breakthroughCommission || row.dataset.normalCommission || "";
    return;
  }
  row.querySelector(".product-discount").value = row.dataset.priceType === "fixed_price" ? row.dataset.normalDiscount || "" : stripDiscountSuffix(row.dataset.normalDiscount || "");
  row.querySelector(".product-commission").value = row.dataset.normalCommission || "";
}

function applyPriceTypeToRow(row, priceType, clearValues = true) {
  const type = normalizePriceType(priceType);
  row.dataset.priceType = type;
  setupProductPriceControls(row, type);
  if (!clearValues) return;
  row.dataset.normalDiscount = "";
  row.dataset.breakthroughDiscount = "";
  row.querySelector(".product-discount").value = "";
  row.querySelector(".product-price-unit").value = "";
  row.querySelector(".product-price-mode").value = "manual";
  generateEmail();
}

function setMatchTag(row, text, kind) {
  const tag = row.querySelector(".match-tag");
  if (!tag) return;
  tag.textContent = text || "";
  tag.dataset.kind = kind || "";
}

function applyMatchedRule(row, matched) {
  row.dataset.suggesting = "0";
  if (!matched) {
    row.dataset.matched = "0";
    row.dataset.productId = "";
    row.dataset.normalDiscount = "";
    row.dataset.normalCommission = "";
    row.dataset.breakthroughDiscount = "";
    row.dataset.breakthroughCommission = "";
    row.dataset.priceUnit = "";
    row.dataset.priceType = "discount";
    setupProductPriceControls(row, "discount");
    row.querySelector(".product-price-unit").value = "";
    setupBillingModeSelect(row, ["prepaid", "postpaid"], row.querySelector(".product-billing-mode").value);
    row.dataset.noCommission = "0";
    row.classList.add("unmatched");
    setMatchTag(row, "未匹配商务库", "warn");
    return;
  }
  row.dataset.matched = "1";
  row.dataset.productId = matched.id;
  row.dataset.normalDiscount = matched.normal_discount || "";
  row.dataset.normalCommission = matched.normal_commission || "";
  row.dataset.breakthroughDiscount = matched.breakthrough_discount || "";
  row.dataset.breakthroughCommission = matched.breakthrough_commission || "";
  row.dataset.priceUnit = matched.price_unit || "";
  row.dataset.priceType = normalizePriceType(matched.price_type, matched.name);
  setupProductPriceControls(row, row.dataset.priceType);
  row.querySelector(".product-price-unit").value = row.dataset.priceUnit;
  setupBillingModeSelect(row, matched.billing_modes, row.querySelector(".product-billing-mode").value);
  row.dataset.noCommission = matched.no_commission ? "1" : "0";
  row.classList.remove("unmatched");
  const conf = matched.confidence ? ` · ${(matched.confidence * 100).toFixed(0)}%` : "";
  setMatchTag(row, `已匹配${conf}`, "ok");
  if (!row.querySelector(".product-discount").value.trim()) {
    applyModeToRow(row, row.querySelector(".product-price-mode").value || "default");
  }
}

function normalizeSearchText(text) {
  return String(text || "").toLowerCase().replace(/[\s\-_/（）()，,、；;：:]+/g, "");
}

function findProductSuggestions(keyword, limit = 8) {
  const q = normalizeSearchText(keyword);
  if (!q) return [];
  const scored = [];
  catalog.products.forEach((p) => {
    const name = p.name || "";
    const norm = normalizeSearchText(name);
    const scenario = catalog.scenarioById[p.scenario_id]?.label || "";
    let score = 0;
    if (norm.includes(q)) score += 50;
    if (name.includes(keyword)) score += 20;
    if (normalizeSearchText(scenario).includes(q)) score += 8;
    if (!score) return;
    if (norm.startsWith(q)) score += 10;
    scored.push({score, product: p});
  });
  return scored
    .sort((a, b) => b.score - a.score || a.product.name.length - b.product.name.length)
    .slice(0, limit)
    .map((x) => x.product);
}

function setupProductSuggest(row) {
  const combo = row.querySelector(".product-combo");
  const input = row.querySelector(".product-name");
  const panel = row.querySelector(".product-suggest-panel");
  let activeIdx = -1;
  let currentList = [];
  let pickingSuggestion = false;

  function render(list) {
    currentList = list;
    if (!list.length) {
      panel.innerHTML = input.value.trim()
        ? `<li class="empty">无匹配产品，按回车保留输入</li>`
        : "";
      panel.hidden = !input.value.trim();
      return;
    }
    panel.innerHTML = list.map((p, i) => {
      const scenario = catalog.scenarioById[p.scenario_id]?.label || "未分类";
      const isFixedPrice = normalizePriceType(p.price_type, p.name) === "fixed_price";
      const discount = isFixedPrice
        ? (formatFixedPrice(p.normal_discount, p.price_unit) || "未维护一口价")
        : (p.normal_discount || "未维护折扣");
      const commission = p.no_commission ? "无返佣" : (p.normal_commission || "未维护返佣");
      return `<li role="option" data-id="${p.id}" class="${i === activeIdx ? "active" : ""}">
        <strong>${escapeHtml(p.name)}</strong>
        <span>${escapeHtml(scenario)} · ${escapeHtml(discount)} / ${escapeHtml(commission)}</span>
      </li>`;
    }).join("");
    panel.hidden = false;
  }

  function open() {
    activeIdx = -1;
    render(findProductSuggestions(input.value));
  }

  function close() {
    panel.hidden = true;
    activeIdx = -1;
  }

  function pick(product) {
    if (!product) return;
    input.value = product.name;
    applyMatchedRule(row, product);
    row.querySelector(".product-price-mode").value = "default";
    applyModeToRow(row, "default");
    close();
    generateEmail();
  }

  input.addEventListener("focus", () => {
    if (input.value.trim()) open();
  });
  input.addEventListener("input", () => {
    row.dataset.productId = "";
    row.dataset.suggesting = input.value.trim() ? "1" : "0";
    row.classList.remove("unmatched");
    setMatchTag(row, "", "");
    open();
  });
  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (pickingSuggestion) return;
      close();
      matchProductName(row);
    }, 120);
  });
  input.addEventListener("keydown", (event) => {
    const items = currentList;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIdx = Math.min(items.length - 1, activeIdx + 1);
      render(items);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIdx = Math.max(0, activeIdx - 1);
      render(items);
    } else if (event.key === "Enter") {
      if (activeIdx >= 0 && items[activeIdx]) {
        event.preventDefault();
        pick(items[activeIdx]);
      } else {
        close();
      }
    } else if (event.key === "Escape") {
      close();
    }
  });
  panel.addEventListener("pointerdown", (event) => {
    const li = event.target.closest("li[data-id]");
    if (!li) return;
    event.preventDefault();
    event.stopPropagation();
    pickingSuggestion = true;
    const product = catalog.productById.get(Number(li.dataset.id));
    pick(product);
    setTimeout(() => { pickingSuggestion = false; }, 0);
  });
  document.addEventListener("mousedown", (event) => {
    if (!combo.contains(event.target)) close();
  });
}

async function matchProductName(row) {
  const name = row.querySelector(".product-name").value.trim();
  row.dataset.suggesting = "0";
  if (!name) {
    applyMatchedRule(row, null);
    return;
  }
  try {
    const resp = await fetch("/api/match", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({names: [name]}),
    }).then((r) => r.json());
    const result = (resp.data || [])[0];
    if (result && result.matched) {
      applyMatchedRule(row, result.matched);
    } else {
      applyMatchedRule(row, null);
      fetch("/api/match/missing", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name}),
      });
    }
  } catch (err) {
    /* 离线兜底 */
  }
  generateEmail();
}

function buildThresholdWarnings(products) {
  return products.flatMap((product, index) => {
    const warnings = [];
    if (!product.matched && product.name && !product.suggesting) {
      warnings.push(`产品${index + 1} ${product.name}：商务库未登记，已通知商务补登。`);
    }
    if (product.noCommission && parseCommissionPercent(product.commission) > 0) {
      warnings.push(`产品${index + 1} ${product.name}：该产品不支持返佣。`);
    }
    if (product.matched && product.priceType !== "fixed_price") {
      const discount = parseDiscount(product.discount);
      const breakFloor = parseDiscount(product.breakthroughDiscount);
      if (discount != null && breakFloor != null && discount < breakFloor - 0.001) {
        warnings.push(`产品${index + 1} ${product.name}：当前 ${product.discount} 低于商务突破政策 ${product.breakthroughDiscount}，建议先确认。`);
      }
      if (discount == null && product.discount) {
        warnings.push(`产品${index + 1} ${product.name}：折扣格式没识别到，建议写成 9折、95折、6折。`);
      }
    }
    return warnings;
  });
}

function getDuplicateProductGroups() {
  const groups = new Map();
  Array.from(productList.querySelectorAll(".product-row")).forEach((row, index) => {
    const name = row.querySelector(".product-name").value.trim();
    if (!name) return;
    const productId = row.dataset.productId || "";
    const normalizedName = normalizeSearchText(name);
    if (!productId && !normalizedName) return;
    const key = normalizedName ? `name:${normalizedName}` : `id:${productId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({row, index, name});
  });
  return Array.from(groups.values()).filter((group) => (
    group.length > 1 && group.some(({row}) => row.dataset.source !== "industry")
  ));
}

function markDuplicateProducts() {
  productList.querySelectorAll(".product-row").forEach((row) => {
    row.classList.remove("duplicate");
    row.title = "";
  });
  const groups = getDuplicateProductGroups();
  groups.forEach((group) => {
    group.forEach(({row}) => {
      row.classList.add("duplicate");
      row.title = "可能存在重复产品，请检查后再发送邮件";
    });
  });
  return groups;
}

function renderThresholdWarnings(products) {
  const warnings = buildThresholdWarnings(products);
  const duplicateGroups = markDuplicateProducts();
  thresholdList.innerHTML = "";
  thresholdBox.classList.toggle("has-warning", warnings.length > 0 || duplicateGroups.length > 0);
  thresholdBox.classList.toggle("has-duplicate", duplicateGroups.length > 0);
  duplicateGroups.forEach((group) => {
    const item = document.createElement("li");
    item.className = "duplicate-warning";
    const positions = group.map(({index}) => `产品${index + 1}`).join("、");
    item.innerHTML = `<strong><span aria-hidden="true">!</span> 可能有重复的产品，请检查后再发送邮件：</strong>${escapeHtml(positions)} · ${escapeHtml(group[0].name)}`;
    thresholdList.appendChild(item);
  });
  if (warnings.length === 0 && duplicateGroups.length === 0) {
    const item = document.createElement("li");
    item.textContent = "已按报价规则校验，无明显异常。";
    thresholdList.appendChild(item);
    return;
  }
  warnings.forEach((warning) => {
    const item = document.createElement("li");
    item.textContent = warning;
    thresholdList.appendChild(item);
  });
}

function renderProductNumbers() {
  productList.querySelectorAll(".product-row").forEach((row, index) => {
    const indexEl = row.querySelector(".product-index");
    const tag = indexEl.querySelector(".match-tag");
    indexEl.textContent = `产品${index + 1}`;
    if (tag) indexEl.appendChild(tag);
  });
}

function findScenarioKeyForText(text) {
  const input = String(text || "").toLowerCase();
  for (const [key, keywords] of Object.entries(SCENARIO_KEYWORDS)) {
    if (keywords.some((kw) => input.includes(kw.toLowerCase()))) return key;
  }
  return null;
}

function findScenarioBundleForIndustry(industry) {
  if (!industry) return [];
  const customIds = catalog.industryProducts[industry];
  if (customIds && customIds.length) return ["__custom__"];
  const lower = industry.toLowerCase();
  for (const [pattern, keys] of Object.entries(INDUSTRY_SCENARIO_BUNDLES)) {
    if (pattern.toLowerCase().split("|").some((t) => lower.includes(t))) return keys;
  }
  const single = findScenarioKeyForText(industry);
  return single ? [single] : [];
}

function normalizeSentence(text) {
  return (text || "").trim().replace(/[，,。；;\s]+$/, "");
}

function pickRandomItems(items) {
  const count = Math.random() > 0.5 ? 2 : 1;
  return [...items].sort(() => Math.random() - 0.5).slice(0, count);
}

function formatCompetitorQuote(competitors) {
  const text = competitors.join("、");
  return competitors.length > 1 ? `${text}都给客户报过价` : `${text}给客户报过价`;
}

function getCompetitorPool() {
  const industryText = Array.from(selectedIndustryTags).join(" ");
  const input = `${industryText} ${industryInput.value} ${fields.customerName.value} ${fields.currentProject.value}`.toLowerCase();
  if (/语音|聊天|社交|rtc|即时通讯/.test(input)) return competitorPools.voiceSocial;
  return competitorPools.cloud;
}

function buildReasonText() {
  const customerName = fields.customerName.value.trim() || "客户";
  const foundedYear = normalizeSentence(fields.foundedYear.value);
  const companyScale = normalizeSentence(fields.companyScale.value);
  const currentProject = normalizeSentence(fields.currentProject.value);
  const parts = [customerName];
  if (foundedYear) parts.push(`成立于${foundedYear}年`);
  if (companyScale) parts.push(`公司规模${companyScale}`);
  if (currentProject) parts.push(`目前${currentProject}`);
  fields.customerBackground.value = `${parts.join("，")}。`;
  fields.projectBackground.value = currentProject
    ? `客户当前项目已进入测试、选型和成本测算阶段，当前项目情况为${currentProject}，需要更有竞争力的商务条件，支撑后续规模化使用。`
    : "客户当前项目已进入测试、选型和成本测算阶段，需要通过折扣返佣支持后续规模化使用。";
  fields.competition.value = formatCompetitorQuote(pickRandomItems(getCompetitorPool()));
  fields.agentContribution.value = fixedApplicationInfo.agentContribution;
  generateEmail();
}

function generateEmail() {
  const products = getProducts();
  renderThresholdWarnings(products);
  const hasFixedPrice = products.some((product) => product.priceType === "fixed_price");
  const applicationLabel = hasFixedPrice ? "价格返佣申请" : "折扣返佣申请";
  const bodyApplicationLabel = hasFixedPrice ? "价格返佣申请" : "折扣返佣申请";
  // 标记缺折扣/返佣的行
  let missingFields = 0;
  document.querySelectorAll(".product-row").forEach((row) => {
    const d = row.querySelector(".product-discount").value.trim();
    const u = row.querySelector(".product-price-unit")?.value.trim() || "";
    const c = row.querySelector(".product-commission").value.trim();
    const needsUnit = row.dataset.priceType === "fixed_price";
    if (!d || !c || (needsUnit && !u)) {
      row.classList.add("incomplete");
      missingFields++;
    } else {
      row.classList.remove("incomplete");
    }
  });
  const productLines = products.map((product, index) => {
    const commission = product.commission || "待填写返佣";
    const billing = billingModeLabel(product.billingMode);
    const priceValue = product.priceType === "fixed_price"
      ? (product.discount ? (product.priceUnit ? formatFixedPrice(product.discount, product.priceUnit) : `${product.discount}（待填写单位）`) : "待填写价格")
      : (formatDiscountValue(product.discount) || "待填写折扣");
    return `【申请产品${index + 1}】产品名称/折扣/返佣：${product.name || "待填写产品名称"}，${billing}  ${priceValue}/${commission}`;
  });

  // 复制按钮根据缺失情况禁用
  const copyBodyBtn = document.getElementById("copyBodyButton");
  if (copyBodyBtn) {
    copyBodyBtn.disabled = missingFields > 0;
    copyBodyBtn.title = missingFields > 0 ? `还有 ${missingFields} 行价格、单位或返佣未填` : "";
  }

  emailSubject.value = `${fields.customerName.value.trim() || "客户"}${applicationLabel}--广州西骋`;
  emailBody.value = `尊敬的${fields.managerTitle.value.trim() || "腾讯云渠道经理"}：

       您好!  ${fields.customerName.value.trim() || "客户公司"}${bodyApplicationLabel}如下，请帮忙处理，

代理名称：${fields.agentName.value.trim() || "待填写"}，代理腾讯云帐号ID: ${fields.agentAccount.value.trim() || "待填写"}；

客户名称：${fields.customerName.value.trim() || "待填写"}，客户腾讯云帐号ID: ${fields.customerAccount.value.trim() || "待填写"}
商机编号：${fields.projectName.value.trim() || "待填写"}

${productLines.join("\n")}

【申请有效期】： ${formatDate(fields.startDate.value)} 至 ${formatDate(fields.endDate.value)}
【申请理由】：
1、客户背景：${fields.customerBackground.value.trim()}
2、项目背景：${fields.projectBackground.value.trim()}
3、竞争对手情况：${fields.competition.value.trim()}
4、代理商贡献说明：${fields.agentContribution.value.trim()}`;
}

function ensureMatchTag(row) {
  let tag = row.querySelector(".match-tag");
  if (!tag) {
    tag = document.createElement("span");
    tag.className = "match-tag";
    row.querySelector(".product-index").appendChild(tag);
  }
  return tag;
}

function addProduct(product = {}) {
  const fragment = productRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".product-row");
  ensureMatchTag(row);
  row.dataset.source = product.source || "manual";

  row.dataset.normalDiscount = product.normal_discount || "";
  row.dataset.normalCommission = product.normal_commission || "";
  row.dataset.breakthroughDiscount = product.breakthrough_discount || "";
  row.dataset.breakthroughCommission = product.breakthrough_commission || "";
  row.dataset.priceUnit = product.price_unit || "";
  row.dataset.priceType = normalizePriceType(product.price_type, product.name || "");
  setupProductPriceControls(row, row.dataset.priceType);
  setupBillingModeSelect(row, product.billing_modes, product.billingMode || "prepaid");
  row.dataset.noCommission = product.no_commission ? "1" : "0";
  row.dataset.matched = product.id ? "1" : "0";
  if (product.id) row.dataset.productId = product.id;

  row.querySelector(".product-name").value = product.name || "";
  row.querySelector(".product-price-type").value = row.dataset.priceType;
  row.querySelector(".product-price-mode").value = product.priceMode || "default";
  row.querySelector(".product-discount").value = product.discount ?? (row.dataset.priceType === "fixed_price" ? product.normal_discount || "" : stripDiscountSuffix(product.normal_discount || ""));
  row.querySelector(".product-price-unit").value = product.priceUnit ?? (product.price_unit || "");
  row.querySelector(".product-commission").value = product.commission ?? (product.normal_commission || "");

  if (product.id) {
    setMatchTag(row, "已匹配", "ok");
  } else if (product.name) {
    setMatchTag(row, "未匹配", "warn");
    row.classList.add("unmatched");
  } else {
    setMatchTag(row, "", "");
  }

  row.querySelector(".product-price-mode").addEventListener("change", (event) => {
    applyModeToRow(row, event.target.value);
    generateEmail();
  });
  row.querySelector(".product-billing-mode").addEventListener("change", generateEmail);
  row.querySelector(".product-price-type").addEventListener("change", (event) => applyPriceTypeToRow(row, event.target.value));
  row.querySelector(".product-discount").addEventListener("input", () => {
    row.querySelector(".product-price-mode").value = "manual";
    generateEmail();
  });
  setupProductSuggest(row);
  row.addEventListener("input", (event) => {
    if (!event.target.classList.contains("product-discount")) generateEmail();
  });
  row.querySelector(".remove-product").addEventListener("click", () => {
    row.remove();
    renderProductNumbers();
    generateEmail();
  });

  productList.appendChild(fragment);
  renderProductNumbers();
  generateEmail();
}

// 出海变体 → 真实 scenario key（产品库里只有 edge_cdn / cvm_db）
const SCENARIO_ALIAS = {
  edge_cdn_overseas: "edge_cdn",
  cvm_db_overseas: "cvm_db",
};

function resolveIndustryProducts(industry) {
  const customIds = catalog.industryProducts[industry];
  if (customIds && customIds.length) {
    return customIds.map((pid) => catalog.productById.get(pid)).filter(Boolean);
  }
  const keys = findScenarioBundleForIndustry(industry);
  const products = [];
  keys.forEach((key) => {
    if (key === "__custom__") return;
    const realKey = SCENARIO_ALIAS[key] || key;
    const scenario = catalog.scenarioByKey[realKey];
    if (!scenario) return;
    const tokens = SCENARIO_PRESET_TOKENS[key] || [];
    const all = catalog.productsByScenarioId.get(scenario.id) || [];
    const filtered = tokens.length
      ? all.filter((p) => tokens.some((t) => p.name.includes(t)))
      : all.slice(0, 5);
    filtered.forEach((p) => products.push(p));
  });
  return products;
}

function getProductsForSelectedIndustries() {
  const products = [];
  const seen = new Set();
  selectedIndustryTags.forEach((industry) => {
    resolveIndustryProducts(industry).forEach((product) => {
      const normalizedName = normalizeSearchText(product.name);
      const key = normalizedName ? `name:${normalizedName}` : `id:${product.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      products.push({...product, source: "industry"});
    });
  });
  return products;
}

function renderIndustryTags() {
  if (!industryTagsEl) return;
  const industries = catalog.industries || [];
  if (!industries.length) {
    industryTagsEl.innerHTML = `<span class="industry-tags-empty">暂无行业标签，可在后台行业匹配维护。</span>`;
    return;
  }
  industryTagsEl.innerHTML = industries.map((industry) => {
    const tag = industry.label || industry.key;
    const selected = selectedIndustryTags.has(tag);
    const count = Number(industry.count || 0);
    return `<button type="button" class="industry-tag ${selected ? "selected" : ""}" data-tag="${escapeHtml(tag)}" aria-pressed="${selected ? "true" : "false"}">
      <span>${escapeHtml(tag)}</span>${count ? `<b>${count}</b>` : ""}
    </button>`;
  }).join("");
}

function updateIndustryStatus() {
  const tags = Array.from(selectedIndustryTags);
  if (!tags.length) {
    matchStatus.textContent = "选择下方行业标签，系统会实时生成推荐产品。";
    return;
  }
  const count = getProductsForSelectedIndustries().length;
  matchStatus.textContent = `已选：${tags.join("、")} · 已匹配 ${count} 个产品，行业重复项已自动去重。`;
}

function addIndustryTag(value) {
  const tag = (value || "").trim();
  if (!tag) return false;
  selectedIndustryTags.add(tag);
  industryInput.value = "";
  renderIndustryTags();
  updateIndustryStatus();
  return true;
}

function toggleIndustryTag(value) {
  const tag = (value || "").trim();
  if (!tag) return false;
  if (selectedIndustryTags.has(tag)) selectedIndustryTags.delete(tag);
  else selectedIndustryTags.add(tag);
  industryInput.value = "";
  renderIndustryTags();
  updateIndustryStatus();
  applyIndustryTags({preserveManual: true});
  return true;
}

function removeIndustryTag(value) {
  selectedIndustryTags.delete(value);
  renderIndustryTags();
  updateIndustryStatus();
  applyIndustryTags({preserveManual: true});
}

function getManualProductSnapshots() {
  return Array.from(productList.querySelectorAll(".product-row"))
    .filter((row) => row.dataset.source !== "industry")
    .map((row) => ({
      id: row.dataset.productId ? Number(row.dataset.productId) : undefined,
      name: row.querySelector(".product-name").value.trim(),
      billingMode: row.querySelector(".product-billing-mode").value,
      price_type: row.querySelector(".product-price-type")?.value || row.dataset.priceType || "discount",
      priceMode: row.querySelector(".product-price-mode").value,
      discount: row.querySelector(".product-discount").value.trim(),
      priceUnit: row.querySelector(".product-price-unit")?.value.trim() || "",
      commission: row.querySelector(".product-commission").value.trim(),
      normal_discount: row.dataset.normalDiscount || "",
      normal_commission: row.dataset.normalCommission || "",
      breakthrough_discount: row.dataset.breakthroughDiscount || "",
      breakthrough_commission: row.dataset.breakthroughCommission || "",
      price_unit: row.dataset.priceUnit || "",
      billing_modes: JSON.parse(row.dataset.billingModes || "[\"prepaid\",\"postpaid\"]"),
      no_commission: row.dataset.noCommission === "1",
      source: "manual",
    }))
    .filter((product) => product.name || product.discount || product.priceUnit || product.commission);
}

function applyIndustryTags(options = {}) {
  addIndustryTag(industryInput.value);
  const manualProducts = options.preserveManual ? getManualProductSnapshots() : [];
  if (!selectedIndustryTags.size) {
    productList.innerHTML = "";
    manualProducts.forEach((product) => addProduct(product));
    if (!manualProducts.length) addProduct();
    updateIndustryStatus();
    return;
  }
  const recommended = getProductsForSelectedIndustries();
  productList.innerHTML = "";
  if (!recommended.length) {
    manualProducts.forEach((product) => addProduct(product));
    if (!manualProducts.length) addProduct();
    matchStatus.textContent = "这些行业标签暂未匹配到产品；可在产品名称里手动搜索补全。";
    return;
  }
  recommended.forEach((product) => addProduct(product));
  manualProducts.forEach((product) => addProduct(product));
  updateIndustryStatus();
}

function matchProducts() {
  applyIndustryTags({preserveManual: true});
}

async function copyText(text, label) {
  await navigator.clipboard.writeText(text);
  copyStatus.textContent = `${label}已复制`;
  setTimeout(() => { copyStatus.textContent = ""; }, 1800);
}

fieldIds.forEach((id) => {
  fields[id].addEventListener("input", generateEmail);
});

document.getElementById("addProductButton").addEventListener("click", () => addProduct());
document.getElementById("restoreReasonsButton").addEventListener("click", buildReasonText);
document.getElementById("matchProductsButton").addEventListener("click", matchProducts);
industryInput.addEventListener("change", updateIndustryStatus);
industryInput.addEventListener("input", updateIndustryStatus);
if (industryTagsEl) {
  industryTagsEl.addEventListener("click", (event) => {
    const btn = event.target.closest(".industry-tag[data-tag]");
    if (!btn) return;
    toggleIndustryTag(btn.dataset.tag);
    generateEmail();
  });
}

// 自定义下拉：解决原生 datalist 选中后再点只显示当前匹配项的问题
(function setupCombo() {
  const combo = document.getElementById("industryCombo");
  if (!combo) return;
  const panel = combo.querySelector(".combo-panel");
  const toggle = combo.querySelector(".combo-toggle");
  let activeIdx = -1;
  function getOpts() {
    return (catalog.industries || []).map((i) => i.label || i.key);
  }

  function render(filter) {
    const f = (filter || "").trim().toLowerCase();
    const opts = getOpts();
    const list = f ? opts.filter((o) => o.toLowerCase().includes(f)) : opts;
    panel.innerHTML = list.map((o, i) => {
      const selected = selectedIndustryTags.has(o);
      return `<li role="option" data-v="${escapeHtml(o)}" class="${i === activeIdx ? "active" : ""} ${selected ? "selected" : ""}" aria-selected="${selected ? "true" : "false"}"><span class="combo-check" aria-hidden="true"></span><span>${escapeHtml(o)}</span></li>`;
    }).join("") || `<li class="empty">无匹配，按回车保留输入</li>`;
  }
  function open(showAll) {
    activeIdx = -1;
    render(showAll ? "" : industryInput.value);
    panel.hidden = false;
    combo.classList.add("open");
  }
  function close() {
    panel.hidden = true;
    combo.classList.remove("open");
  }
  function pick(val) {
    toggleIndustryTag(val);
    render(industryInput.value);
    industryInput.focus();
  }

  toggle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (combo.classList.contains("open")) close();
    else { open(true); industryInput.focus(); }
  });
  industryInput.addEventListener("focus", () => open(true));
  industryInput.addEventListener("input", () => open(false));
  industryInput.addEventListener("keydown", (e) => {
    const items = panel.querySelectorAll("li[data-v]");
    if (e.key === "ArrowDown") { e.preventDefault(); if (panel.hidden) open(true); activeIdx = Math.min(items.length - 1, activeIdx + 1); render(industryInput.value); }
    else if (e.key === "ArrowUp") { e.preventDefault(); activeIdx = Math.max(0, activeIdx - 1); render(industryInput.value); }
    else if (e.key === "Enter") { e.preventDefault(); if (activeIdx >= 0 && items[activeIdx]) pick(items[activeIdx].dataset.v); else toggleIndustryTag(industryInput.value); }
    else if (e.key === "Escape") close();
  });
  panel.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li[data-v]");
    if (!li) return;
    e.preventDefault();
    pick(li.dataset.v);
  });
  document.addEventListener("mousedown", (e) => {
    if (!combo.contains(e.target)) close();
  });
})();
fields.foundedYear.addEventListener("input", buildReasonText);
fields.companyScale.addEventListener("input", buildReasonText);
fields.currentProject.addEventListener("input", buildReasonText);
document.getElementById("resetButton").addEventListener("click", () => {
  if (hasFilledProductRows() && !confirm("重置会清空所有已填字段和产品行，确定？")) return;
  document.querySelectorAll('input[type="text"], input:not([type]), textarea').forEach((el) => {
    if (el.id === "agentName" || el.id === "agentAccount" || el.id === "managerTitle") return;
    if (el.readOnly) return;
    el.value = "";
  });
  selectedIndustryTags = new Set();
  renderIndustryTags();
  productList.innerHTML = "";
  addProduct();
  updateIndustryStatus();
});
document.getElementById("copySubjectButton").addEventListener("click", () => copyText(emailSubject.value, "标题"));
document.getElementById("copyBodyButton").addEventListener("click", () => copyText(emailBody.value, "正文"));

(async () => {
  initializeFixedFields();
  initializeDefaultDates();
  await loadCatalog();
  renderIndustryTags();
  updateIndustryStatus();
  if (productList.children.length === 0) {
    addProduct();
  }
})();
