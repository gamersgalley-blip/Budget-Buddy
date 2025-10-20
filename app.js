/* ───────────────────────────────
   ⚙️ CONSTANTS & GLOBAL STATE
─────────────────────────────── */
const PRESETS = [
  { name: "Food & Dining", color: "#6EE7B7" },
  { name: "Rent / Mortgage", color: "#60A5FA" },
  { name: "Transportation", color: "#FBBF24" },
  { name: "Utilities", color: "#F87171" },
  { name: "Subscriptions", color: "#C084FC" },
  { name: "Health & Fitness", color: "#34D399" },
  { name: "Work / Education", color: "#A78BFA" },
  { name: "Entertainment", color: "#F472B6" },
  { name: "Shopping", color: "#FACC15" },
  { name: "Savings", color: "#4ADE80" },
];

const STORAGE = {
  cats: "saavr_v3_4_categories",
  income: "saavr_v3_4_income",
  login: "saavr_v3_4_login",
  tx: "saavr_v3_4_transactions",
  month: "saavr_v3_4_month",
};

const INCOME_COLOR = "#50C3A3"; // Mint green for deposits

let categories = [];
let transactions = [];
let incomes = [];
let editingId = null;
let selectedMonth = "";
let xp = 350, level = 1, xpForNext = 500;

/* ───────────────────────────────
   🧰 UTILITY FUNCTIONS
─────────────────────────────── */
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const pad2 = n => String(n).padStart(2, "0");

function mixMuted(hex, alpha) {
  const bg = { r: 42, g: 50, b: 55 };
  const c = parseInt(hex.replace("#", ""), 16);
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const rr = Math.round(r * alpha + bg.r * (1 - alpha));
  const gg = Math.round(g * alpha + bg.g * (1 - alpha));
  const bb = Math.round(b * alpha + bg.b * (1 - alpha));
  return `rgb(${rr}, ${gg}, ${bb})`;
}

function income() { return Number(localStorage.getItem(STORAGE.income) || 0); }
function ymFromDateStr(d) { return d ? d.slice(0, 7) : ""; }
function getCurrentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/* ───────────────────────────────
   📅 MONTH NAVIGATION
─────────────────────────────── */
function changeMonth(offset) {
  const [y, m] = selectedMonth.split("-").map(Number);
  const newDate = new Date(y, m - 1 + offset, 1);
  const newYM = `${newDate.getFullYear()}-${pad2(newDate.getMonth() + 1)}`;

  if (newYM > getMaxAllowedMonth()) return;
  selectedMonth = newYM;
  localStorage.setItem(STORAGE.month, selectedMonth);

  updateMonthDisplay();
  drawDonuts();
  renderDashboardProgress();
  renderBudgetProgress();
  renderCategoryList();
  renderIncomeProgress();
}

function updateMonthDisplay() {
  const md = $("#month-display");
  if (md) md.textContent = monthLabel(selectedMonth);
  const nextBtn = $("#next-month");
  if (nextBtn) nextBtn.disabled = selectedMonth >= getMaxAllowedMonth();
}

function getMaxAllowedMonth() {
  const today = new Date();
  const year = today.getFullYear(), month = today.getMonth();
  const nextMonth = new Date(year, month + 1, 1);
  if (today < nextMonth)
    return `${year}-${pad2(month + 1)}`;
  else
    return `${month === 11 ? year + 1 : year}-${pad2((month + 2) % 12 || 12)}`;
}

function monthLabel(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}
function formatLongDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/* ───────────────────────────────
   💾 LOAD & SAVE
─────────────────────────────── */
function load() {
  try { categories = JSON.parse(localStorage.getItem(STORAGE.cats) || "[]"); } catch { categories = []; }
  try { transactions = JSON.parse(localStorage.getItem(STORAGE.tx) || "[]"); } catch { transactions = []; }
  selectedMonth = getCurrentYM();
  localStorage.setItem(STORAGE.month, selectedMonth);
}
function save() {
  localStorage.setItem(STORAGE.cats, JSON.stringify(categories));
  localStorage.setItem(STORAGE.tx, JSON.stringify(transactions));
  renderAll();
}

/* ───────────────────────────────
   💲 INCOME MANAGEMENT
─────────────────────────────── */
function openIncomeModal() {
  $("#income-name").value = "";
  $("#income-amount").value = "";
  $("#income-modal").classList.remove("hidden");
}
function closeIncomeModal() { $("#income-modal").classList.add("hidden"); }

function saveIncome() {
  const name = $("#income-name").value.trim();
  const amt = Number($("#income-amount").value);
  if (!name || !(amt > 0)) return alert("Enter a name and positive amount.");
  incomes.push({ id: uid(), name, amount: amt });
  localStorage.setItem("saavr_v3_4_incomes", JSON.stringify(incomes));
  closeIncomeModal();
  renderTotalIncome();
  renderIncomeProgress();
}
function renderTotalIncome() {
  const total = incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  $("#income-total").textContent = `$${total.toLocaleString()}`;
  localStorage.setItem(STORAGE.income, total);
  drawDonuts();
  renderDashboardProgress();
  renderBudgetProgress();
}
function loadIncomes() {
  try { incomes = JSON.parse(localStorage.getItem("saavr_v3_4_incomes") || "[]"); } catch { incomes = []; }
  renderTotalIncome();
  renderIncomeProgress();
}
function openEditIncomeModal() {
  const modal = $("#edit-income-modal");
  const list = $("#income-list");
  list.innerHTML = incomes.length
    ? incomes.map(inc => `
      <div class="cat-item">
        <div>
          <div class="cat-name">${inc.name}</div>
          <div style="color:var(--muted);font-size:12px;">$${Number(inc.amount).toLocaleString()}</div>
        </div>
        <div class="cat-actions">
          <button class="btn ghost small" onclick="editIncomeSource('${inc.id}')">✏️ Edit</button>
          <button class="btn ghost small" onclick="deleteIncomeSource('${inc.id}')">🗑️ Delete</button>
        </div>
      </div>`).join("")
    : `<p style="color:var(--muted);text-align:center;">No income sources yet.</p>`;
  modal.classList.remove("hidden");
}
function closeEditIncomeModal() { $("#edit-income-modal").classList.add("hidden"); }
function editIncomeSource(id) {
  const inc = incomes.find(i => i.id === id);
  if (!inc) return;
  const newName = prompt("Edit income name:", inc.name);
  if (newName === null) return;
  const newAmt = Number(prompt("Edit income amount ($):", inc.amount));
  if (!(newAmt > 0)) return alert("Amount must be positive.");
  inc.name = newName.trim(); inc.amount = newAmt;
  localStorage.setItem("saavr_v3_4_incomes", JSON.stringify(incomes));
  renderTotalIncome(); renderIncomeProgress(); openEditIncomeModal();
}
function deleteIncomeSource(id) {
  if (!confirm("Delete this income source?")) return;
  incomes = incomes.filter(i => i.id !== id);
  localStorage.setItem("saavr_v3_4_incomes", JSON.stringify(incomes));
  renderTotalIncome(); renderIncomeProgress(); openEditIncomeModal();
}

/* ───────────────────────────────
   📂 CATEGORY MANAGEMENT
─────────────────────────────── */
function presetFor(name) { return PRESETS.find(p => p.name === name) || PRESETS[0]; }
function addCategory() {
  const msg = $("#add-error");
  msg.textContent = "";
  msg.classList.add("hidden"); // reset visibility

  const name = $("#cat-select").value;
  const budget = Number($("#cat-amount").value);
  const inc = Number(localStorage.getItem(STORAGE.income) || 0);

  if (!name || !(budget > 0)) {
    msg.textContent = "Choose a category and enter a positive budget.";
    msg.classList.remove("hidden");
    return;
  }

  if (!(inc > 0)) {
    msg.textContent = "Please set your monthly income first.";
    msg.classList.remove("hidden");
    return;
  }

  const totalBudget = categories.reduce((s, c) => s + (Number(c.budget) || 0), 0);
  if (totalBudget + budget > inc) {
    msg.textContent = `Total budget exceeds income of $${inc.toLocaleString()}.`;
    msg.classList.remove("hidden");
    return;
  }

  // Proceed if all validations pass
  const p = presetFor(name);
  const existing = categories.find(c => c.name === name);
  if (existing) {
    existing.budget = budget;
    existing.color = p.color;
  } else {
    categories.push({ id: uid(), name, budget, color: p.color });
  }

  $("#cat-amount").value = "";
  msg.classList.add("hidden");
  save();
}
function renderCategoryList() {
  const list = $("#cat-list");
  const empty = $("#no-cats");
  if (!list) return;
  list.innerHTML = "";
  if (!categories.length) return empty?.classList.remove("hidden");

  empty?.classList.add("hidden");
  categories.forEach(c => {
const actual = transactions
  .filter(t => (ymFromDateStr(t.date) === selectedMonth || !t.date) && t.categoryId === c.id)
  .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const item = document.createElement("div");
    item.className = "cat-item";
    if (actual > (Number(c.budget) || 0)) item.classList.add("overspent");

    const sw = document.createElement("div");
    sw.className = "swatch";
    sw.style.background = c.color;

    const mid = document.createElement("div");
    mid.innerHTML = `<div class="cat-name">${c.name}</div>
                     <div style="color:var(--muted);font-size:12px;">
                       Budget: $${(c.budget||0).toLocaleString()} · Actual (${monthLabel(selectedMonth)}): $${(actual||0).toLocaleString()}
                     </div>`;

    const right = document.createElement("div");
    right.className = "cat-actions";
    right.innerHTML = `
      <div class="cat-amount">$${(c.budget||0).toLocaleString()}</div>
      <div>
        <button class="btn ghost small" onclick="openEdit('${c.id}')">✏️ Edit</button>
        <button class="btn ghost small" onclick="delCategory('${c.id}')">🗑️ Delete</button>
      </div>`;

    item.append(sw, mid, right);
    list.appendChild(item);
  });
}
function clearAll() {
  if (!confirm("Remove all categories and transactions?")) return;
  categories = []; transactions = []; save();
}

/* ───────────────────────────────
   💸 TRANSACTIONS (Accounts)
─────────────────────────────── */
function openTxModal() {
  $("#tx-name").value = "";
  $("#tx-amount").value = "";
  const today = new Date();
  $("#tx-date").value = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  populateTxCategoryDropdown();
  $("#tx-modal").classList.remove("hidden");
}
function closeTxModal() { $("#tx-modal").classList.add("hidden"); }

function renderTxList() {
  const list = $("#tx-list");
  const empty = $("#no-tx");
  if (!list) return;
  list.innerHTML = "";
  if (!transactions.length) return empty?.classList.remove("hidden");
  empty?.classList.add("hidden");

  transactions.forEach(t => {
    const row = document.createElement("div");
    row.className = "cat-item";

    let catLabel = "Uncategorized", color = "#3c464c";
    if (t.categoryId === "income") { catLabel = "Income (Deposit)"; color = INCOME_COLOR; }
    else {
      const cat = categories.find(c => c.id === t.categoryId);
      if (cat) { catLabel = `Category: ${cat.name}`; color = cat.color; }
    }

    const sw = document.createElement("div");
    sw.className = "swatch"; sw.style.background = color;

    const mid = document.createElement("div");
    mid.innerHTML = `<div class="cat-name">${t.name}</div>
                     <div style="color:var(--muted);font-size:12px;">${catLabel} • ${formatLongDate(t.date)}</div>`;

    const right = document.createElement("div");
    const amt = document.createElement("div");
    amt.className = "cat-amount";
    amt.textContent = `$${(t.amount || 0).toLocaleString()}`;

    const sel = document.createElement("select");
    const optNone = new Option("Uncategorized", "");
    const optIncome = new Option("Income (Deposit)", "income");
    sel.append(optNone, optIncome);
    categories.forEach(c => sel.append(new Option(c.name, c.id)));
    sel.value = t.categoryId || "";
    sel.onchange = e => setTxCategory(t.id, e.target.value || null);

    const del = document.createElement("button");
    del.className = "btn ghost small";
    del.textContent = "🗑️ Delete";
    del.onclick = () => deleteTx(t.id);

    const actions = document.createElement("div");
    actions.className = "cat-actions";
    actions.append(sel, del);

    right.append(amt, actions);
    row.append(sw, mid, right);
    list.append(row);
  });
}
/* ───────────────────────────────
   💾 SAVE TRANSACTION
─────────────────────────────── */
function saveTx() {
  const name = $("#tx-name").value.trim();
  const amount = Number($("#tx-amount").value);
  const date = $("#tx-date").value;
  const cat = $("#tx-category").value || null;

  if (!name || !(amount > 0) || !date) {
    alert("Please enter a valid name, amount, and date.");
    return;
  }

  transactions.push({
    id: uid(),
    name,
    amount,
    date,
    categoryId: cat
  });

  localStorage.setItem(STORAGE.tx, JSON.stringify(transactions));
  closeTxModal();
  renderTxList();
  renderCategoryList();
  drawDonuts();
  renderBudgetProgress();
  renderDashboardProgress();
}
/* ───────────────────────────────
   🧩 RESTORED CORE FUNCTIONS
─────────────────────────────── */

/************ LOGIN & PAGE NAV ************/
function initLogin() {
  if (sessionStorage.getItem(STORAGE.login) === "1") {
    $("#login").classList.add("hidden");
    $("#dashboard").classList.remove("hidden");
  }

  const btn = $("#login-btn");
  if (btn) {
    btn.addEventListener("click", () => {
      const u = $("#u").value.trim();
      const p = $("#p").value.trim();

      if (u === "admin" && p === "1234") {
        sessionStorage.setItem(STORAGE.login, "1");
        showPage("dashboard");
        $("#login-err").classList.add("hidden");
      } else {
        $("#login-err").classList.remove("hidden");
      }
    });
  }
}

function showPage(id) {
  ["login", "dashboard", "budget", "accounts"].forEach(pid => {
    const s = document.getElementById(pid);
    if (!s) return;
    s.classList.toggle("hidden", pid !== id);
  });

  // Highlight active nav button
  document.querySelectorAll("nav button").forEach(btn => {
    if (btn.getAttribute("onclick")?.includes(id)) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Update dashboard month label
  const dm = $("#dash-month");
  if (dm) dm.textContent = " — " + monthLabel(selectedMonth);

  // Reset to current month when returning to budget
  if (id === "budget") {
    selectedMonth = getCurrentYM();
    localStorage.setItem(STORAGE.month, selectedMonth);
    updateMonthDisplay();
    renderIncomeProgress();
  }

  drawDonuts();
  renderDashboardProgress();
  renderBudgetProgress();
  renderTxList();
}

/************ TOTALS & CALCULATIONS ************/
function txForMonth(ym) {
  return transactions.filter(t => ymFromDateStr(t.date) === ym);
}

function actualByCategory(catId, ym) {
  return txForMonth(ym)
    .filter(t => t.categoryId === catId)
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
}

function totalActual(ym) {
  return categories.reduce((s, c) => s + actualByCategory(c.id, ym), 0);
}

function totalReceivedIncome(ym) {
  return txForMonth(ym)
    .filter(t => t.categoryId === "income")
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);
}

/************ TRANSACTION HELPERS ************/
function setTxCategory(txId, catId) {
  transactions = transactions.map(t =>
    t.id === txId ? { ...t, categoryId: catId || null } : t
  );
  save();
}

function deleteTx(txId) {
  transactions = transactions.filter(t => t.id !== txId);
  save();
}

/************ CATEGORY EDIT MODAL ************/
function openEdit(id) {
  editingId = id;
  const c = categories.find(x => x.id === id);
  if (!c) return;

  const nameSel = $("#edit-name");
  nameSel.innerHTML = "";
  PRESETS.forEach(p => {
    const o = document.createElement("option");
    o.value = p.name;
    o.textContent = p.name;
    nameSel.appendChild(o);
  });
  nameSel.value = c.name;

  $("#edit-budget").value = c.budget;

  const colorSel = $("#edit-color");
  colorSel.innerHTML = "";
  PRESETS.forEach(p => {
    const o = document.createElement("option");
    o.value = p.color;
    o.textContent = `${p.name} (${p.color})`;
    colorSel.appendChild(o);
  });
  colorSel.value = c.color;

  $("#edit-modal").classList.remove("hidden");
}

function closeEdit() {
  $("#edit-modal").classList.add("hidden");
  editingId = null;
}

function saveEdit() {
  const c = categories.find(x => x.id === editingId);
  if (!c) return;

  const newName = $("#edit-name").value;
  const newBudget = Number($("#edit-budget").value);
  const newColor = $("#edit-color").value;

  if (!(newBudget > 0)) {
    alert("Budget must be positive.");
    return;
  }

  c.name = newName;
  c.budget = newBudget;
  c.color = newColor;
  closeEdit();
  save();
}

function delCategory(id) {
  if (!confirm("Delete this category and uncategorize related transactions?")) return;
  categories = categories.filter(c => c.id !== id);
  transactions = transactions.map(t => t.categoryId === id ? { ...t, categoryId: null } : t);
  save();
}

/* ───────────────────────────────
   🪙 DONUT CHARTS & PROGRESS BARS
─────────────────────────────── */

// Convert polar coordinates to XY for SVG arc drawing
function polarToXY(cx, cy, r, angle) {
  const a = (angle - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

// Generate SVG arc path string
function arcPath(cx, cy, r, start, end) {
  const p1 = polarToXY(cx, cy, r, end);
  const p2 = polarToXY(cx, cy, r, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 0 ${p2.x} ${p2.y}`;
}

// Draw a single donut for a given month
function drawDonutForMonth(svgId, centerId, ym) {
  const svg = document.getElementById(svgId);
  const centerEl = document.getElementById(centerId);
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const cx = 130, cy = 130, r = 100, stroke = 30;
  const inc = income();
  const safeInc = inc > 0 ? inc : 1; // prevent division by 0
  const spent = totalActual(ym);
  const rem = inc - spent;

  // Center number (remaining)
  centerEl.textContent = `$${Math.round(rem).toLocaleString()}`;
  centerEl.classList.toggle("center-positive", rem >= 0);
  centerEl.classList.toggle("center-negative", rem < 0);

  // Base ring background
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  bg.setAttribute("cx", cx);
  bg.setAttribute("cy", cy);
  bg.setAttribute("r", r);
  bg.setAttribute("fill", "none");
  bg.setAttribute("stroke", "var(--ringbg)");
  bg.setAttribute("stroke-width", stroke);
  svg.appendChild(bg);

  let angle = 0;
  const arcMeta = [];

  // Draw each category slice
  categories.forEach(c => {
    const share = (Number(c.budget) || 0) / safeInc;
    if (share <= 0) return;

    const start = angle * 360;
    const end = (angle + share) * 360;
    arcMeta.push({ id: c.id, start, end, color: c.color, name: c.name, budget: c.budget });
    angle += share;

    const baseArc = document.createElementNS("http://www.w3.org/2000/svg", "path");
    baseArc.setAttribute("d", arcPath(cx, cy, r, start, end));
    baseArc.setAttribute("stroke", mixMuted(c.color, 0.4));
    baseArc.setAttribute("stroke-width", stroke);
    baseArc.setAttribute("fill", "none");
    baseArc.style.cursor = "pointer";
    baseArc.addEventListener("mousemove", e => showSliceTooltip(e, c, inc, ym));
    baseArc.addEventListener("mouseleave", hideTooltip);
    svg.appendChild(baseArc);
  });

  // Fill remaining unallocated space if not 100%
  if (angle < 1) {
    const start = angle * 360;
    const end = 360;
    const remPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    remPath.setAttribute("d", arcPath(cx, cy, r, start, end));
    remPath.setAttribute("stroke", "#2F3940");
    remPath.setAttribute("stroke-width", stroke);
    remPath.setAttribute("fill", "none");
    svg.appendChild(remPath);
  }

  // Draw actual spending arcs
  arcMeta.forEach(meta => {
    const catBudget = Number(meta.budget) || 0;
    const catActual = Math.min(actualByCategory(meta.id, ym), catBudget);
    const frac = catBudget ? (catActual / catBudget) : 0;
    if (frac <= 0) return;

    const bright = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const brightEnd = meta.start + (meta.end - meta.start) * frac;
    bright.setAttribute("d", arcPath(cx, cy, r, meta.start, brightEnd));
    bright.setAttribute("stroke", meta.color);
    bright.setAttribute("stroke-width", stroke);
    bright.setAttribute("fill", "none");
    bright.style.cursor = "pointer";
    const cat = categories.find(c => c.id === meta.id);
    bright.addEventListener("mousemove", e => showSliceTooltip(e, cat, inc, ym));
    bright.addEventListener("mouseleave", hideTooltip);
    svg.appendChild(bright);
  });
}

// Draw both donuts (Dashboard + Budget)
function drawDonuts() {
  const currentYM = getCurrentYM();
  drawDonutForMonth("dash-donut", "dash-center", currentYM);
  const dm = document.getElementById("dash-month");
  if (dm) dm.textContent = " — " + monthLabel(currentYM);
  drawDonutForMonth("budget-donut", "budget-center", selectedMonth);
}

/* ───────────────────────────────
   📈 PROGRESS BARS
─────────────────────────────── */
function renderDashboardProgress() {
  const inc = income();
  const spent = totalActual(selectedMonth);
  const pct = inc > 0 ? Math.min(100, Math.round((spent / inc) * 100)) : 0;
  const bar = document.getElementById("dash-progress");
  const lbl = document.getElementById("dash-progress-label");

  if (bar) {
    bar.style.width = pct + "%";
    bar.classList.toggle("danger", spent > inc);
  }
  if (lbl) lbl.textContent = `$${spent.toLocaleString()} / $${inc.toLocaleString()} spent`;
}

function renderBudgetProgress() {
  const inc = income();
  const spent = totalActual(selectedMonth);
  const pct = inc > 0 ? Math.min(100, Math.round((spent / inc) * 100)) : 0;
  const bar = document.getElementById("budget-progress");
  const lbl = document.getElementById("budget-progress-label");

  if (bar) {
    bar.style.width = pct + "%";
    bar.classList.toggle("danger", spent > inc);
  }
  if (lbl) lbl.textContent = `$${spent.toLocaleString()} / $${inc.toLocaleString()} spent`;
}

function renderIncomeProgress() {
  const target = income();
  const received = totalReceivedIncome(selectedMonth);
  const bar = document.getElementById("income-progress");
  const lbl = document.getElementById("income-progress-label");

  if (target <= 0) {
    if (bar) {
      bar.style.width = "0%";
      bar.style.background = "var(--mint)";
      bar.style.opacity = "0.35";
    }
    if (lbl) lbl.textContent = "Set your monthly income to track progress";
    return;
  }

  const pct = Math.min(100, Math.round((received / target) * 100));
  if (bar) {
    bar.style.width = pct + "%";
    bar.style.background = "var(--mint)";
    bar.style.opacity = "1";
  }
  if (lbl) lbl.textContent = `${pct}% of income received ($${received.toLocaleString()} / $${target.toLocaleString()})`;
}

/* ───────────────────────────────
   💬 TOOLTIP (Donut Hover Info)
─────────────────────────────── */
function showSliceTooltip(evt, cat, inc, ym) {
  const tip = document.getElementById("tooltip");
  if (!tip || !cat) return;

  const actual = actualByCategory(cat.id, ym);
  const budget = Number(cat.budget) || 0;
  const diff = actual - budget;

  const spentLine = `<div class="row"><span style="color:var(--muted)">Spent</span><b>$${actual.toLocaleString()}</b></div>`;
  const budgetLine = `<div class="row"><span style="color:var(--muted)">Budget</span><b>$${budget.toLocaleString()}</b></div>`;
  let diffLine = "";

  if (diff > 0) {
    diffLine = `<div class="row"><span style="color:var(--muted)">Over by</span><b style="color:var(--danger)">+$${diff.toLocaleString()}</b></div>`;
    // 🔥 Red glow for overspent
    tip.style.boxShadow = "0 0 20px rgba(255, 107, 107, 0.7)";
    tip.style.borderColor = "rgba(255,107,107,0.9)";
  } else {
    const left = Math.abs(diff);
    diffLine = `<div class="row"><span style="color:var(--muted)">Left</span><b style="color:var(--mint)">$${left.toLocaleString()}</b></div>`;
    // 🧊 Default mint glow for normal
    tip.style.boxShadow = "0 0 16px rgba(80,195,163,0.45)";
    tip.style.borderColor = "#3A454C";
  }

  // Tooltip content
  tip.innerHTML = `
    <div class="title" style="font-weight:700;margin-bottom:4px;">${cat.name}</div>
    ${spentLine}
    ${budgetLine}
    ${diffLine}
  `;

  // Position tooltip
  tip.style.left = evt.clientX + 14 + "px";
  tip.style.top = evt.clientY + 14 + "px";
  tip.classList.add("visible");
}

function hideTooltip() {
  const tip = document.getElementById("tooltip");
  if (tip) tip.classList.remove("visible");
}

/* ───────────────────────────────
   ⚡ XP SYSTEM
─────────────────────────────── */
function renderXP() {
  const xpBar = $("#xp-bar"), xpLabel = $("#xp-label"), levelSpan = $("#user-level");
  if (!xpBar || !xpLabel || !levelSpan) return;
  const pct = Math.min(100, Math.round((xp / xpForNext) * 100));
  xpBar.style.width = pct + "%";
  xpLabel.textContent = `${xp.toLocaleString()} / ${xpForNext.toLocaleString()} XP`;
  levelSpan.textContent = level;
}

/* ───────────────────────────────
   ⚙️ SETTINGS / APPEARANCE
─────────────────────────────── */
function initSettingsDropdown() {
  const btn = $("#settings-btn");
  const menu = $("#settings-dropdown");
  if (!btn || !menu) return;
  btn.addEventListener("click", e => { e.stopPropagation(); menu.classList.toggle("hidden"); });
  document.addEventListener("click", e => { if (!menu.contains(e.target) && e.target !== btn) menu.classList.add("hidden"); });
}
function initAppearancePanel() {
  const openBtn = $("#open-appearance");
  const backBtn = $("#back-to-main");
  const mainPanel = $("#main-settings");
  const appearancePanel = $("#appearance-panel");
  const choices = document.querySelectorAll(".theme-choice");

  if (!openBtn || !backBtn || !mainPanel || !appearancePanel) return;

  openBtn.addEventListener("click", () => {
    mainPanel.classList.add("hidden");
    appearancePanel.classList.remove("hidden");
  });
  backBtn.addEventListener("click", () => {
    appearancePanel.classList.add("hidden");
    mainPanel.classList.remove("hidden");
  });
  choices.forEach(choice => {
    choice.addEventListener("click", () => {
      const theme = choice.dataset.theme;
      applyTheme(theme);
      localStorage.setItem("saavr_theme", theme);
      updateThemeCheckmark(theme);
    });
  });

  const saved = localStorage.getItem("saavr_theme") || "dark";
  applyTheme(saved);
  updateThemeCheckmark(saved);
}
function updateThemeCheckmark(theme) {
  document.querySelectorAll(".theme-choice .checkmark").forEach(c => c.classList.add("hidden"));
  document.querySelector(`.theme-choice[data-theme="${theme}"] .checkmark`)?.classList.remove("hidden");
}
function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "light") {
    root.style.setProperty("--dark", "#F2F4F6");
    root.style.setProperty("--card", "#FFFFFF");
    root.style.setProperty("--line", "#D7DEE4");
    root.style.setProperty("--muted", "#4B555C");
    root.style.setProperty("--ringbg", "#E8ECEF");
    root.style.setProperty("--shadow", "rgba(0,0,0,0.1)");
    root.style.setProperty("--mint", "#2AA382");
    document.body.style.color = "#1B2328";
    document.body.classList.add("light-mode");
  } else {
    root.style.setProperty("--dark", "#1E2428");
    root.style.setProperty("--card", "#252C31");
    root.style.setProperty("--line", "#2F3940");
    root.style.setProperty("--muted", "#9BA6AD");
    root.style.setProperty("--ringbg", "#2A3237");
    root.style.setProperty("--shadow", "rgba(0,0,0,0.35)");
    root.style.setProperty("--mint", "#50C3A3");
    document.body.style.color = "#E9F2F0";
    document.body.classList.remove("light-mode");
  }
}

/* ───────────────────────────────
   💳 TRANSACTION CATEGORY DROPDOWN
─────────────────────────────── */
function populateTxCategoryDropdown() {
  const sel = document.getElementById("tx-category");
  if (!sel) return;
  sel.innerHTML = "";

  // Default Uncategorized option
  const optNone = document.createElement("option");
  optNone.value = "";
  optNone.textContent = "Uncategorized";
  sel.appendChild(optNone);

  // Built-in Income (Deposit)
  const optIncome = document.createElement("option");
  optIncome.value = "income";
  optIncome.textContent = "Income (Deposit)";
  sel.appendChild(optIncome);

  // User-created categories
  categories.forEach(c => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.name;
    sel.appendChild(o);
  });
}

/* ───────────────────────────────
   🔁 RENDER ALL (Global Refresh)
─────────────────────────────── */
function renderAll() {
  // Populate category selector
  const addSel = document.getElementById("cat-select");
  if (addSel) {
    addSel.innerHTML = "";
    PRESETS.forEach(p => {
      const o = document.createElement("option");
      o.value = p.name;
      o.textContent = p.name;
      addSel.appendChild(o);
    });
  }

  // Refresh UI sections
  renderCategoryList();
  renderTxList();
  populateTxCategoryDropdown();
  drawDonuts();
  renderDashboardProgress();
  renderBudgetProgress();
  renderIncomeProgress();
  renderXP();
}

/* ───────────────────────────────
   🚀 INIT
─────────────────────────────── */
window.addEventListener("DOMContentLoaded", () => {
  load();
  initLogin();
  initSettingsDropdown();
  initAppearancePanel();
  $("#add-income-btn").addEventListener("click", openIncomeModal);
  $("#add-cat").addEventListener("click", addCategory);
  loadIncomes();
  const prev = $("#prev-month"), next = $("#next-month");
  if (prev && next) { prev.addEventListener("click", () => changeMonth(-1)); next.addEventListener("click", () => changeMonth(1)); }
  updateMonthDisplay();
  sessionStorage.getItem(STORAGE.login) === "1" ? showPage("dashboard") : showPage("login");
  renderAll();
});










