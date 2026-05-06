const scenarioRules = {
  aigcDrama: {
    label: "漫剧 / 短剧 / AIGC 内容制作",
    keywords: ["漫剧", "短剧", "真人剧", "aigc", "AIGC", "内容制作", "生图", "生视频", "文生图", "文生视频", "影视"],
    products: [
      { name: "媒资处理MPS-AIGC-大模型文本处理-谷歌（全版本）", defaultDiscount: "95折", breakthroughDiscount: "9折", originalPrice: "原价", commission: "5%返佣", floorDiscount: 9, maxCommissionPercent: 5 },
      { name: "媒资处理MPS-AIGC-大模型文本处理-GPT（全版本）", defaultDiscount: "95折", breakthroughDiscount: "9折", originalPrice: "原价", commission: "5%返佣", floorDiscount: 9, maxCommissionPercent: 5 },
      { name: "媒资处理MPS-AIGC-生图模型-（全版本）-", defaultDiscount: "9折", breakthroughDiscount: "8折", originalPrice: "原价", commission: "5%返佣", floorDiscount: 8, maxCommissionPercent: 5 },
      { name: "媒资处理MPS-AIGC-生图模型-千问（0925）-", defaultDiscount: "9折", breakthroughDiscount: "8折", originalPrice: "原价", commission: "5%返佣", floorDiscount: 8, maxCommissionPercent: 5 },
      { name: "媒资处理MPS-AIGC-生图模型-生数q2-", defaultDiscount: "8折", breakthroughDiscount: "7折", originalPrice: "原价", commission: "5%返佣", floorDiscount: 7, maxCommissionPercent: 5 },
      { name: "媒资处理MPS-AIGC-生图模型-可灵（全版本）", defaultDiscount: "8折", breakthroughDiscount: "7折", originalPrice: "原价", commission: "5%返佣", floorDiscount: 7, maxCommissionPercent: 5 },
      { name: "媒资处理MPS-AIGC-生图模型-SI（全版本）", defaultDiscount: "95折", breakthroughDiscount: "9折", originalPrice: "原价", commission: "5%返佣", floorDiscount: 9, maxCommissionPercent: 5 },
      { name: "媒资处理MPS-AIGC-生图模型-JI（全版本）", defaultDiscount: "95折", breakthroughDiscount: "9折", originalPrice: "原价", commission: "5%返佣", floorDiscount: 9, maxCommissionPercent: 5 },
      { name: "媒资处理MPS-AIGC-生视频模型-OS（全版本）", defaultDiscount: "9折", breakthroughDiscount: "8折", originalPrice: "原价", commission: "无返佣", floorDiscount: 8, maxCommissionPercent: 0 },
      { name: "媒资处理MPS-AIGC-生视频模型-SV（全版本）", defaultDiscount: "9折", breakthroughDiscount: "8折", originalPrice: "原价", commission: "无返佣", floorDiscount: 8, maxCommissionPercent: 0 },
      { name: "媒资处理MPS-AIGC-生视频模型-JV（全版本）", defaultDiscount: "9折", breakthroughDiscount: "8折", originalPrice: "原价", commission: "无返佣", floorDiscount: 8, maxCommissionPercent: 0 },
      { name: "媒资处理MPS-AIGC-生视频模型-GV（全版本）", defaultDiscount: "9折", breakthroughDiscount: "8折", originalPrice: "原价", commission: "无返佣", floorDiscount: 8, maxCommissionPercent: 0 },
      { name: "媒资处理MPS-AIGC-生视频模型-vidu（全版本）", defaultDiscount: "6折", breakthroughDiscount: "5折", originalPrice: "原价", commission: "无返佣", floorDiscount: 5, maxCommissionPercent: 0 },
      { name: "媒资处理MPS-AIGC-生视频模型-kling（全版本）", defaultDiscount: "6折", breakthroughDiscount: "5折", originalPrice: "原价", commission: "无返佣", floorDiscount: 5, maxCommissionPercent: 0 },
      { name: "媒资处理MPS-AIGC-生视频模型-hailuo（全版本）", defaultDiscount: "6折", breakthroughDiscount: "5折", originalPrice: "原价", commission: "无返佣", floorDiscount: 5, maxCommissionPercent: 0 },
      { name: "媒资处理MPS-AIGC-生视频模型-Hunyuan（全版本）", defaultDiscount: "6折", breakthroughDiscount: "5折", originalPrice: "原价", commission: "无返佣", floorDiscount: 5, maxCommissionPercent: 0 },
      { name: "媒资处理MPS-AIGC-生视频模型-Pixverse（全版本）", defaultDiscount: "7折", breakthroughDiscount: "6折", originalPrice: "原价", commission: "无返佣", floorDiscount: 6, maxCommissionPercent: 0 },
    ],
    reasons: {
      foundedYear: "",
      companyScale: "约300人，多地设有业务团队",
      currentProject: "正在推进AIGC内容制作项目，已进入测试和选型阶段",
      customerBackground: "广州xx网络科技有限公司，公司规模约300人，多地设有业务团队，目前正在推进AIGC内容制作项目。",
      projectBackground: "客户当前项目已进入测试、选型和成本测算阶段，需要更有竞争力的商务条件，支撑后续规模化使用。",
      competition: "其他友商都有给客户报价",
      agentContribution: "代理商能提供本地化服务，帮助客户提供测试、选型，以及在产品上问题的解答和服务的跟进，同时代理商在引导客户新项目更多的转向腾讯云等起了关键作用，比如客情攻关及技术服务。",
    },
  },
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
const matchStatus = document.getElementById("matchStatus");
const thresholdBox = document.getElementById("thresholdBox");
const thresholdList = document.getElementById("thresholdList");
let activeScenarioKey = "aigcDrama";

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
    if (textElement) {
      textElement.textContent = value;
    }
  });
}

function initializeDefaultDates() {
  const today = new Date();
  fields.startDate.value = toDateInputValue(today);
  fields.endDate.value = toDateInputValue(getDefaultEndDate(today));
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "";
  }

  const [year, month, day] = dateValue.split("-");
  return `${Number(year)}年${Number(month)}月${Number(day)}日`;
}

function normalizeCommission(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "无返佣";
  }

  return trimmed;
}

function parseDiscount(value) {
  if (value.trim() === "原价") {
    return 10;
  }

  const match = value.trim().match(/(\d+(?:\.\d+)?)\s*折/);
  if (!match) {
    return null;
  }

  const discount = Number(match[1]);
  return discount > 10 ? discount / 10 : discount;
}

function parseCommissionPercent(value) {
  if (/无|0/.test(value.trim())) {
    return 0;
  }

  const match = value.trim().match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : null;
}

function getProducts() {
  return Array.from(productList.querySelectorAll(".product-row"))
    .map((row) => ({
      name: row.querySelector(".product-name").value.trim(),
      priceMode: row.querySelector(".product-price-mode").value,
      discount: row.querySelector(".product-discount").value.trim(),
      commission: normalizeCommission(row.querySelector(".product-commission").value),
      floorDiscount: row.dataset.floorDiscount === "" ? null : Number(row.dataset.floorDiscount),
      maxCommissionPercent: row.dataset.maxCommissionPercent === "" ? null : Number(row.dataset.maxCommissionPercent),
    }))
    .filter((product) => product.name || product.discount || product.commission);
}

function getDiscountByMode(product, mode) {
  if (mode === "breakthrough") {
    return product.breakthroughDiscount || product.defaultDiscount || product.discount || "";
  }

  if (mode === "original") {
    return product.originalPrice || "原价";
  }

  return product.defaultDiscount || product.discount || "";
}

function buildThresholdWarnings(products) {
  return products.flatMap((product, index) => {
    const warnings = [];
    const discount = parseDiscount(product.discount);
    const commissionPercent = parseCommissionPercent(product.commission);
    const hasDiscountRule = Number.isFinite(product.floorDiscount);
    const hasCommissionRule = Number.isFinite(product.maxCommissionPercent);

    if (hasDiscountRule && discount !== null && discount < product.floorDiscount) {
      warnings.push(`产品${index + 1} ${product.name}：当前 ${product.discount} 低于经验阈值 ${product.floorDiscount}折，建议先确认能否审批。`);
    }

    if (hasDiscountRule && discount === null) {
      warnings.push(`产品${index + 1} ${product.name || "未填写产品"}：折扣格式没识别到，建议写成 95折、9折、6折。`);
    }

    if (hasCommissionRule && commissionPercent !== null && commissionPercent > product.maxCommissionPercent) {
      const limit = product.maxCommissionPercent === 0 ? "无返佣" : `${product.maxCommissionPercent}%返佣`;
      warnings.push(`产品${index + 1} ${product.name}：当前返佣 ${product.commission} 超过经验阈值 ${limit}。`);
    }

    if (hasCommissionRule && commissionPercent === null) {
      warnings.push(`产品${index + 1} ${product.name || "未填写产品"}：返佣格式没识别到，建议写成 5%返佣 或 无返佣。`);
    }

    return warnings;
  });
}

function renderThresholdWarnings(products) {
  const warnings = buildThresholdWarnings(products);
  thresholdList.innerHTML = "";
  thresholdBox.classList.toggle("has-warning", warnings.length > 0);

  if (warnings.length === 0) {
    const item = document.createElement("li");
    item.textContent = "当前折扣和返佣在已沉淀经验阈值内。";
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
    row.querySelector(".product-index").textContent = `产品${index + 1}`;
  });
}

function findScenarioKey() {
  const input = `${industryInput.value} ${fields.customerName.value}`.toLowerCase();
  return Object.entries(scenarioRules).find(([, scenario]) => {
    return scenario.keywords.some((keyword) => input.includes(keyword.toLowerCase()));
  })?.[0] || null;
}

function normalizeSentence(text) {
  return text.trim().replace(/[，,。；;\s]+$/, "");
}

function pickRandomItems(items) {
  const count = Math.random() > 0.5 ? 2 : 1;
  const shuffledItems = [...items].sort(() => Math.random() - 0.5);
  return shuffledItems.slice(0, count);
}

function formatCompetitorQuote(competitors) {
  const competitorText = competitors.join("、");
  return competitors.length > 1 ? `${competitorText}都给客户报过价` : `${competitorText}给客户报过价`;
}

function getCompetitorPool() {
  const input = `${industryInput.value} ${fields.customerName.value} ${fields.currentProject.value}`.toLowerCase();
  if (/语音|聊天|社交|rtc|即时通讯/.test(input)) {
    return competitorPools.voiceSocial;
  }

  return competitorPools.cloud;
}

function buildReasonText() {
  const customerName = fields.customerName.value.trim() || "客户";
  const foundedYear = normalizeSentence(fields.foundedYear.value);
  const companyScale = normalizeSentence(fields.companyScale.value);
  const currentProject = normalizeSentence(fields.currentProject.value);
  const customerParts = [customerName];

  if (foundedYear) {
    customerParts.push(`成立于${foundedYear}年`);
  }

  if (companyScale) {
    customerParts.push(`公司规模${companyScale}`);
  }

  if (currentProject) {
    customerParts.push(`目前${currentProject}`);
  }

  fields.customerBackground.value = `${customerParts.join("，")}。`;
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
  const productLines = products.map((product, index) => {
    const discount = product.discount || "待填写折扣";
    return `【申请产品${index + 1}】：产品名称/折扣/返佣：${product.name || "待填写产品名称"}：${discount}/${product.commission}`;
  });

  emailSubject.value = `${fields.customerName.value.trim() || "客户"}折扣返佣申请--广州西骋`;

  emailBody.value = `尊敬的${fields.managerTitle.value.trim() || "腾讯云渠道经理"}：
    您好！以下是${fields.customerName.value.trim() || "客户公司"}的折扣与返佣申请，请处理，项目编号：${fields.projectName.value.trim() || "待填写"}
    代理商全称：  ${fields.agentName.value.trim() || "待填写"}，腾讯云账号ID:  ${fields.agentAccount.value.trim() || "待填写"}；
    客户公司全称：${fields.customerName.value.trim() || "待填写"}，腾讯云账号ID：${fields.customerAccount.value.trim() || "待填写"}

${productLines.join("\n")}

【申请有效期】： ${formatDate(fields.startDate.value)} 至 ${formatDate(fields.endDate.value)}
【申请理由】：
1、客户背景：${fields.customerBackground.value.trim()}
2、项目背景：${fields.projectBackground.value.trim()}
3、竞争对手情况：${fields.competition.value.trim()}
4、代理商贡献说明：${fields.agentContribution.value.trim()}`;
}

function normalizeProduct(product = {}) {
  if (Array.isArray(product)) {
    return {
      name: product[0] || "",
      discount: product[1] || "",
      commission: product[2] || "",
    };
  }

  return product;
}

function addProduct(product = {}) {
  const normalizedProduct = normalizeProduct(product);
  const fragment = productRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".product-row");
  row.dataset.floorDiscount = normalizedProduct.floorDiscount ?? "";
  row.dataset.maxCommissionPercent = normalizedProduct.maxCommissionPercent ?? "";
  row.dataset.defaultDiscount = normalizedProduct.defaultDiscount || normalizedProduct.discount || "";
  row.dataset.breakthroughDiscount = normalizedProduct.breakthroughDiscount || normalizedProduct.discount || "";
  row.dataset.originalPrice = normalizedProduct.originalPrice || "原价";
  row.querySelector(".product-name").value = normalizedProduct.name || "";
  row.querySelector(".product-discount").value = getDiscountByMode(normalizedProduct, "default");
  row.querySelector(".product-commission").value = normalizedProduct.commission || "";
  row.querySelector(".product-price-mode").value = normalizedProduct.priceMode || "default";
  row.querySelector(".product-price-mode").addEventListener("change", (event) => {
    const mode = event.target.value;
    if (mode !== "manual") {
      const productForMode = {
        defaultDiscount: row.dataset.defaultDiscount,
        breakthroughDiscount: row.dataset.breakthroughDiscount,
        originalPrice: row.dataset.originalPrice,
      };
      row.querySelector(".product-discount").value = getDiscountByMode(productForMode, mode);
    }
    generateEmail();
  });
  row.querySelector(".product-discount").addEventListener("input", () => {
    row.querySelector(".product-price-mode").value = "manual";
    generateEmail();
  });
  row.addEventListener("input", (event) => {
    if (!event.target.classList.contains("product-discount")) {
      generateEmail();
    }
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

function resetProducts() {
  productList.innerHTML = "";
  scenarioRules[activeScenarioKey].products.forEach(addProduct);
}

function restoreReasons() {
  const scenario = scenarioRules[activeScenarioKey];
  Object.entries(scenario.reasons).forEach(([id, value]) => {
    fields[id].value = value;
  });
  buildReasonText();
}

function applyScenario(scenarioKey = activeScenarioKey) {
  activeScenarioKey = scenarioKey;
  matchStatus.textContent = `已匹配：${scenarioRules[activeScenarioKey].label}`;
  restoreReasons();
  resetProducts();
}

function matchProducts() {
  const matchedScenarioKey = findScenarioKey();
  if (!matchedScenarioKey) {
    matchStatus.textContent = "暂未匹配到经验产品，可先手动新增产品，后续把案例补进规则库。";
    return;
  }

  applyScenario(matchedScenarioKey);
}

async function copyText(text, label) {
  await navigator.clipboard.writeText(text);
  copyStatus.textContent = `${label}已复制`;
  window.setTimeout(() => {
    copyStatus.textContent = "";
  }, 1800);
}

fieldIds.forEach((id) => {
  fields[id].addEventListener("input", generateEmail);
});

document.getElementById("addProductButton").addEventListener("click", () => addProduct());
document.getElementById("restoreReasonsButton").addEventListener("click", buildReasonText);
document.getElementById("matchProductsButton").addEventListener("click", matchProducts);
industryInput.addEventListener("change", matchProducts);
fields.customerName.addEventListener("change", matchProducts);
fields.foundedYear.addEventListener("input", buildReasonText);
fields.companyScale.addEventListener("input", buildReasonText);
fields.currentProject.addEventListener("input", buildReasonText);
document.getElementById("resetButton").addEventListener("click", () => {
  applyScenario();
});
document.getElementById("copySubjectButton").addEventListener("click", () => copyText(emailSubject.value, "标题"));
document.getElementById("copyBodyButton").addEventListener("click", () => copyText(emailBody.value, "正文"));

initializeFixedFields();
initializeDefaultDates();
applyScenario();