const KEY = "gastos_v1";
const uid = () => Math.random().toString(36).slice(2, 9);
const pad = (n) => String(n).padStart(2, "0");
const ymOf = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1);
const ymd = (d) => ymOf(d) + "-" + pad(d.getDate());
const $ = (s) => document.querySelector(s);
const fmt = (n) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const num = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
};
const fdate = (s) => {
  const p = s.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
};

/* ---------- dados ---------- */
let S = {};
try {
  const r = localStorage.getItem(KEY);
  if (r) S = JSON.parse(r) || {};
} catch (e) {}
if (typeof S.salary !== "number") S.salary = 664.95;
["fixed", "card", "debts", "sv", "wish"].forEach((k) => {
  if (!Array.isArray(S[k])) S[k] = [];
});
if (!S.m || typeof S.m !== "object") S.m = {};
if (!Array.isArray(S.t13)) S.t13 = [332.48, 332.48];
S.theme = S.theme || "auto";
const now = ymOf(new Date());
let cur = now,
  tab = "home",
  form = null;
const sub = { contas: "fixed", metas: "cofres", debt: "mes", kind: "todas" };
S.fixed.forEach((x) => {
  x.id = x.id || uid();
});
S.debts.forEach((x) => {
  x.start = x.start || now;
  x.parcels = +x.parcels || 1;
  x.src = x.src || "debito";
});
S.wish.forEach((w) => {
  w.src = w.src || "sal";
});
Object.values(S.m).forEach((m) =>
  (m.exp || []).forEach((x) => {
    x.pay = x.pay || "debito";
  }),
);
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch (e) {}
}

/* ---------- datas ---------- */
function sh(ym, n) {
  const p = ym.split("-"),
    d = new Date(+p[0], +p[1] - 1 + n, 1);
  return ymOf(d);
}
function diff(a, b) {
  const x = a.split("-"),
    y = b.split("-");
  return (+y[0] - +x[0]) * 12 + (+y[1] - +x[1]);
}
function lab(ym) {
  const p = ym.split("-");
  return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}
function mname(ym) {
  const p = ym.split("-");
  return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
  });
}
function shortM(ym) {
  const p = ym.split("-");
  return new Date(+p[0], +p[1] - 1, 1)
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "");
}
function daysTo(d) {
  return Math.round(
    (new Date(d + "T00:00") - new Date(ymd(new Date()) + "T00:00")) / 864e5,
  );
}
function when(n) {
  return n < 0
    ? "atrasado " + -n + (n === -1 ? " dia" : " dias")
    : n === 0
      ? "é HOJE"
      : n === 1
        ? "é amanhã"
        : "em " + n + " dias";
}

/* ---------- cálculos ---------- */
const mg = (ym) => S.m[ym] || { inc: [], exp: [], ord: [] };
function mw(ym) {
  if (!S.m[ym]) S.m[ym] = { inc: [], exp: [], ord: [] };
  const m = S.m[ym];
  ["inc", "exp", "ord"].forEach((k) => {
    if (!m[k]) m[k] = [];
  });
  return m;
}
const sum = (a) => (a || []).reduce((t, x) => t + (+x.val || 0), 0);
const isC = (ym) => !!mg(ym).closed;
function inst(ym) {
  let t = 0;
  S.card.forEach((c) => {
    const i = diff(c.start, ym),
      p = +c.parcels || 1;
    if (i >= 0 && i < p) t += c.total / p;
  });
  return t;
}
const hasInst = (x, ym) => {
  const i = diff(x.start, ym),
    p = +x.parcels || 1;
  return i >= 0 && i < p;
};
const fxm = (ym) => S.fixed;
const ok = (x, ym) => !(x.paid && diff(now, ym) > 0);
const dvm = (ym, t) =>
  S.debts
    .filter((x) => x.type === t && ok(x, ym) && hasInst(x, ym))
    .reduce((s, x) => s + x.val / (+x.parcels || 1), 0);
const linked = (ym, src) =>
  S.debts.filter(
    (x) =>
      x.type === "owed" &&
      (x.src || "debito") === src &&
      ok(x, ym) &&
      hasInst(x, ym),
  );
const dvs = (ym, src) =>
  linked(ym, src).reduce((s, x) => s + x.val / (+x.parcels || 1), 0);
function dleft(x) {
  const p = +x.parcels || 1;
  if (x.paid) return 0;
  let n = 0;
  for (let k = Math.max(0, diff(x.start, now)); k < p; k++)
    if (!(x.pm && x.pm[sh(x.start, k)])) n++;
  return (x.val / p) * n;
}
const dtot = (t) =>
  S.debts.filter((x) => x.type === t).reduce((s, x) => s + dleft(x), 0);
const bal = (pot) =>
  S.sv
    .filter((x) => x.pot === pot)
    .reduce((t, x) => t + (x.kind === "ret" ? -x.val : x.val), 0);
/* sobra do mês anterior que entra no mês (só se for positiva) */
function firstYm() {
  const k = Object.keys(S.m)
    .concat(S.sv.map((x) => x.ym))
    .filter(Boolean)
    .sort();
  return k[0] || now;
}
function carryIn(ym) {
  const p = sh(ym, -1);
  if (diff(firstYm(), p) < 0) return 0;
  return Math.max(0, calc(p).left);
}
function calc(ym, fat) {
  const m = mg(ym);
  if (fat == null && m.closed) {
    const r = Object.assign(
      { ug: 0, dv: 0, rc: 0, sv: 0, t3: 0, est: 0, avc: 0, carry: 0 },
      m.closed.snap,
    );
    if (r.own == null) r.own = r.left - r.carry;
    return r;
  }
  const sal = m.sal != null ? m.sal : S.salary,
    ex = sum(m.inc),
    fx = sum(fxm(ym));
  const est =
    inst(ym) +
    dvs(ym, "cartao") +
    sum((m.exp || []).filter((x) => x.pay === "credito"));
  const cd = fat != null ? fat : m.fat != null ? m.fat : est;
  const op = sum(mg(sh(ym, -1)).ord) + dvs(sh(ym, -1), "empresa");
  const av = sum((m.exp || []).filter((x) => x.pay !== "credito")),
    avc = sum((m.exp || []).filter((x) => x.pay === "credito")),
    dv = dvm(ym, "owe"),
    rc = dvm(ym, "owed");
  const mm = +ym.split("-")[1],
    t3 = mm === 11 ? S.t13[0] : mm === 12 ? S.t13[1] : 0;
  const sv = sum(S.sv.filter((x) => x.kind === "dep" && x.ym === ym));
  const cr = carryIn(ym),
    inc = sal + ex + t3;
  let out = fx + cd + op + av + dv + sv,
    ug = 0;
  if (m.real != null) {
    ug = inc + cr - out - m.real;
    out += ug;
  }
  return {
    sal,
    ex,
    t3,
    fx,
    cd,
    est,
    op,
    av,
    avc,
    dv,
    rc,
    sv,
    ug,
    inc,
    out,
    carry: cr,
    own: inc - out,
    left: inc + cr - out,
  };
}

/* ---------- categorias ---------- */
const CATS = [
  ["mercado", "🛒", "Mercado", "#0f766e"],
  ["comida", "🍔", "Comida fora", "#f59e0b"],
  ["transporte", "🚌", "Transporte", "#3b82f6"],
  ["lazer", "🎉", "Lazer", "#a855f7"],
  ["saude", "💊", "Saúde", "#ef4444"],
  ["casa", "🏠", "Casa", "#14b8a6"],
  ["roupas", "👕", "Roupas", "#ec4899"],
  ["outros", "📦", "Outros", "#64748b"],
];
const cat = (id) => CATS.find((c) => c[0] === id) || CATS[7];
const PAYN = { credito: "Crédito", debito: "Débito", pix: "Pix" };

/* ---------- formulários ---------- */
const SEC = {
  fixed: {
    t: "conta fixa",
    f: [
      ["desc", "Nome da conta", "text", 1],
      ["val", "Valor R$", "num", 1],
      ["day", "Vence no dia (opcional)", "day"],
    ],
  },
  card: {
    t: "compra no cartão",
    f: [
      ["desc", "O que comprou", "text", 1],
      ["total", "Valor total R$", "num", 1],
      ["parcels", "Parcelas", "int", 1],
      ["start", "1ª parcela em", "month", 1],
    ],
  },
  debts: {
    t: "dívida",
    f: [
      [
        "type",
        "Tipo",
        "sel",
        1,
        [
          ["owed", "Alguém me deve"],
          ["owe", "Eu devo"],
        ],
      ],
      ["name", "Nome da pessoa", "text", 1],
      [
        "src",
        "Como foi?",
        "sel",
        1,
        [
          ["debito", "Paguei no débito/dinheiro"],
          ["cartao", "Paguei no cartão de crédito (entra na minha fatura)"],
          [
            "empresa",
            "Produto da empresa (desconta do meu salário no mês seguinte)",
          ],
        ],
      ],
      ["why", "Por quê (opcional)", "text"],
      ["val", "Valor total R$", "num", 1],
      ["parcels", "Parcelas (1 = paga em um mês só)", "int", 1],
      ["start", "1ª parcela em", "month", 1],
      ["due", "Data combinada (opcional)", "date"],
    ],
  },
  exp: {
    t: "gasto avulso",
    f: [
      ["desc", "Descrição", "text", 1],
      ["val", "Valor R$", "num", 1],
      [
        "pay",
        "Como pagou",
        "sel",
        1,
        [
          ["credito", "💳 Crédito"],
          ["debito", "Débito"],
          ["pix", "Pix"],
        ],
      ],
      ["cat", "Categoria", "cat"],
    ],
  },
  inc: {
    t: "renda extra",
    f: [
      ["desc", "Descrição", "text", 1],
      ["val", "Valor R$", "num", 1],
    ],
  },
  ord: {
    t: "pedido da empresa",
    f: [
      ["desc", "Produto", "text", 1],
      ["val", "Valor R$", "num", 1],
    ],
  },
  wish: {
    t: "coisa que quero",
    f: [
      ["desc", "O que quero comprar", "text", 1],
      ["val", "Valor R$", "num", 1],
      ["date", "Data em que quero comprar (opcional)", "date"],
      [
        "src",
        "Vou usar",
        "sel",
        1,
        [
          ["sal", "Sobra do mês"],
          ["cx", "Caixinha Nubank"],
          ["t13", "13º salário"],
        ],
      ],
    ],
  },
};
const MONTHLY = { exp: 1, inc: 1, ord: 1 };
const getArr = (k) => (MONTHLY[k] ? mw(cur)[k] : S[k]);
function fld(k, f, it) {
  const key = f[0],
    lb = f[1],
    ty = f[2],
    opts = f[4];
  let v = it[key],
    inp,
    hide = "";
  const id = "fi_" + key;
  if (ty === "sel") {
    v = v == null ? opts[0][0] : v;
    inp = `<select id="${id}"${k === "debts" && key === "type" ? ' onchange="togSrc()"' : ""}>${opts.map((o) => `<option value="${o[0]}"${o[0] === v ? " selected" : ""}>${o[1]}</option>`).join("")}</select>`;
  } else if (ty === "cat") {
    v = v || "outros";
    inp = `<select id="${id}">${CATS.map((c) => `<option value="${c[0]}"${c[0] === v ? " selected" : ""}>${c[1]} ${c[2]}</option>`).join("")}</select>`;
  } else if (ty === "month")
    inp = `<input id="${id}" type="month" value="${v || cur}">`;
  else if (ty === "date")
    inp = `<input id="${id}" type="date" value="${v || ""}">`;
  else if (ty === "num")
    inp = `<input id="${id}" type="number" step="any" inputmode="decimal" value="${v == null ? "" : v}">`;
  else if (ty === "int")
    inp = `<input id="${id}" type="number" step="1" min="1" inputmode="numeric" value="${v || 1}">`;
  else if (ty === "day")
    inp = `<input id="${id}" type="number" step="1" min="1" max="31" inputmode="numeric" value="${v || ""}">`;
  else inp = `<input id="${id}" type="text" value="${esc(v || "")}">`;
  if (k === "debts" && key === "src" && (it.type || "owed") !== "owed")
    hide = ' style="display:none"';
  return `<div class="fg" id="w_${key}"${hide}><label for="${id}">${lb}</label>${inp}</div>`;
}
function openForm(k, i) {
  if (MONTHLY[k] && isC(cur)) {
    toast("Mês fechado. Reabra para editar.");
    return;
  }
  const def = SEC[k],
    it = i != null ? getArr(k)[i] : {};
  form = { k, i };
  $("#sheet").innerHTML =
    `<div class="ov" onclick="if(event.target===this)closeSheet()"><div class="sh"><div class="shh"><b>${i != null ? "Editar" : "Novo"}: ${def.t}${MONTHLY[k] ? " · " + lab(cur) : ""}</b><button class="ic" onclick="closeSheet()">✕</button></div>${def.f.map((f) => fld(k, f, it)).join("")}<button style="width:100%" onclick="saveForm()">Salvar</button></div></div>`;
  $("#fab").style.display = "none";
}
function closeSheet() {
  $("#sheet").innerHTML = "";
  form = null;
  render();
}
function togSrc() {
  const t = $("#fi_type"),
    w = $("#w_src");
  if (t && w) w.style.display = t.value === "owed" ? "" : "none";
}
function saveForm() {
  if (!form) return;
  const k = form.k,
    i = form.i,
    def = SEC[k],
    o = {};
  for (const f of def.f) {
    const key = f[0],
      ty = f[2],
      req = f[3],
      el = $("#fi_" + key);
    if (!el) continue;
    let v = el.value;
    if (ty === "num") {
      v = num(v);
      if (v === null || v <= 0) {
        toast('Digite um valor maior que zero em "' + f[1] + '"');
        return;
      }
    } else if (ty === "int") {
      v = Math.max(1, parseInt(v, 10) || 1);
    } else if (ty === "day") {
      v = v === "" ? "" : Math.min(31, Math.max(1, parseInt(v, 10) || 1));
    } else {
      v = String(v).trim();
      if (req && !v) {
        toast('Preencha "' + f[1] + '"');
        return;
      }
      if (ty === "month" && !/^\d{4}-\d{2}$/.test(v)) {
        toast("Mês inválido (use AAAA-MM)");
        return;
      }
    }
    o[key] = v;
  }
  if (k === "debts" && o.type === "owe") o.src = "debito";
  const arr = getArr(k);
  let t;
  if (i != null) t = arr[i];
  else {
    t = {};
    arr.push(t);
  }
  Object.keys(o).forEach((key) => {
    if (o[key] === "" || o[key] == null) delete t[key];
    else t[key] = o[key];
  });
  if (k === "fixed" && !t.id) t.id = uid();
  save();
  const was = i != null;
  closeSheet();
  toast(was ? "Alterado ✔" : "Adicionado ✔");
}
function del(k, i) {
  if (MONTHLY[k] && isC(cur)) {
    toast("Mês fechado.");
    return;
  }
  if (confirm("Excluir este item?")) {
    getArr(k).splice(i, 1);
    save();
    render();
  }
}
function quick() {
  if (isC(cur)) {
    toast("Mês fechado. Reabra na aba Início.");
    return;
  }
  openForm("exp");
}

/* ---------- ações ---------- */
let tt;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show";
  clearTimeout(tt);
  tt = setTimeout(() => {
    t.className = "";
  }, 2600);
}
function mv(n) {
  cur = sh(cur, n);
  render();
}
function go(t) {
  tab = t;
  render();
  window.scrollTo(0, 0);
}
function setSub(g, v) {
  sub[g] = v;
  render();
}
function payDebtM(i) {
  const x = S.debts[i];
  x.pm = x.pm || {};
  if (x.pm[cur]) delete x.pm[cur];
  else x.pm[cur] = true;
  save();
  render();
  toast(x.pm[cur] ? "Paga em " + mname(cur) + " ✔" : "Desmarcada");
}
function payDebt(i) {
  S.debts[i].paid = !S.debts[i].paid;
  save();
  render();
  toast(S.debts[i].paid ? "Movida para Pagas ✔" : "Dívida reaberta");
}
function togFix(id) {
  if (isC(cur)) {
    toast("Mês fechado.");
    return;
  }
  const m = mw(cur);
  m.pf = m.pf || {};
  m.pf[id] = !m.pf[id];
  save();
  render();
}
function setM(k, v) {
  if (isC(cur)) return;
  const n = num(v),
    m = mw(cur);
  if (v === "" || n === null) delete m[k];
  else m[k] = n;
  save();
  render();
}
function setBase(v) {
  const n = num(v);
  if (n !== null) {
    S.salary = n;
    save();
    render();
  }
}
function set13(i, v) {
  const n = num(v);
  if (n !== null) {
    S.t13[i] = n;
    save();
    render();
  }
}
function setTheme(v) {
  S.theme = v;
  save();
  applyTheme();
}
function applyTheme() {
  if (S.theme === "auto")
    document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", S.theme);
}
function closeM() {
  const m = mg(cur),
    c = calc(cur),
    v = m.fat != null ? m.fat : c.est,
    sn = calc(cur, v);
  if (
    !confirm(
      "Fechar " +
        lab(cur) +
        "?\n\nFatura do cartão: " +
        fmt(v) +
        "\nSobrou: " +
        fmt(sn.left) +
        "\n\nVocê pode reabrir depois, se precisar.",
    )
  )
    return;
  mw(cur).closed = { fat: v, snap: sn, at: new Date().toISOString() };
  save();
  render();
}
function reopen() {
  if (confirm("Reabrir este mês para edição?")) {
    delete mw(cur).closed;
    save();
    render();
  }
}
function svAdd() {
  if (isC(cur)) {
    toast("Mês fechado.");
    return;
  }
  const pot = $("#sv_pot").value,
    kind = $("#sv_kind").value,
    v = num($("#sv_val").value);
  if (v === null || v <= 0) {
    toast("Digite um valor válido");
    return;
  }
  if (pot === "td" && kind === "ret") {
    toast("Tesouro Direto bloqueado até 2032: sem retirada");
    return;
  }
  if (pot === "td" && v < 5) {
    toast("Tesouro Direto: mínimo R$ 5");
    return;
  }
  if (kind === "ret" && v > bal(pot)) {
    toast("Saldo insuficiente");
    return;
  }
  S.sv.push({ pot, kind, val: v, note: $("#sv_note").value, ym: cur });
  save();
  render();
  toast("Registrado ✔");
}
function svDel(i) {
  if (isC(S.sv[i].ym)) {
    toast("Mês fechado.");
    return;
  }
  if (confirm("Excluir este movimento?")) {
    S.sv.splice(i, 1);
    save();
    render();
  }
}
function wDone(i) {
  S.wish[i].done = !S.wish[i].done;
  save();
  render();
}
function exportData() {
  const b = new Blob([JSON.stringify(S, null, 1)], {
      type: "application/json",
    }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = "meus-gastos-backup-" + ymd(new Date()) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast("Backup gerado ✔");
}
function importData(inp) {
  const f = inp.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    let d;
    try {
      d = JSON.parse(r.result);
      if (!d || typeof d !== "object" || !d.m) throw 0;
    } catch (e) {
      toast("Arquivo inválido");
      return;
    }
    if (!confirm("Substituir TODOS os dados atuais pelos do backup?")) return;
    localStorage.setItem(KEY, JSON.stringify(d));
    location.reload();
  };
  r.readAsText(f);
  inp.value = "";
}

/* ---------- componentes ---------- */
const row = (l, v, c) =>
  `<div class="rw"><span>${l}</span><b class="${c || ""}">${fmt(v)}</b></div>`;
const tile = (i, l, v, c) =>
  `<div class="tile"><small>${i} ${l}</small><b class="${c || ""}">${fmt(v)}</b></div>`;
const seg = (g, o) =>
  `<div class="seg">${o.map((x) => `<button class="${sub[g] === x[0] ? "on" : ""}" onclick="setSub('${g}','${x[0]}')">${x[1]}</button>`).join("")}</div>`;
const acts = (k, i) =>
  `<div class="ac"><button class="ic" aria-label="Editar" onclick="openForm('${k}',${i})">✏️</button><button class="ic" aria-label="Excluir" onclick="del('${k}',${i})">🗑️</button></div>`;
function alerts() {
  const t = new Date(),
    L = [];
  S.debts.forEach((x) => {
    if (!x.due || x.paid) return;
    const n = daysTo(x.due);
    if (n > 3) return;
    L.push([
      n,
      `<b>${x.type === "owe" ? "Pagar " + esc(x.name) : esc(x.name) + " vai te pagar"} · ${fmt(x.val / (+x.parcels || 1))}</b><small>Data combinada ${fdate(x.due)} — ${when(n)}${x.why ? " (" + esc(x.why) + ")" : ""}</small>`,
    ]);
  });
  const pf = mg(now).pf || {};
  fxm(now).forEach((x) => {
    if (!x.day || pf[x.id]) return;
    const n = x.day - t.getDate();
    if (n > 3 || n < -7) return;
    L.push([
      n,
      `<b>Conta ${esc(x.desc)} · ${fmt(x.val)}</b><small>Vence dia ${x.day} — ${when(n)}</small>`,
    ]);
  });
  return L.sort((a, b) => a[0] - b[0])
    .map(
      (p) =>
        `<div class="card al${p[0] > 0 ? " w" : ""}">${p[0] <= 0 ? "🚨 " : "⏰ "}${p[1]}</div>`,
    )
    .join("");
}
function list(k, title, hint, extra, extraTot) {
  const a0 = getArr(k),
    a = k === "exp" ? a0.filter((x) => x.pay !== "credito") : a0,
    cl = isC(cur);
  let h = `<div class="card"><div class="ch"><h3>${title}</h3>${cl ? "" : `<button class="sm" onclick="openForm('${k}')">＋ Novo</button>`}</div>${hint ? `<small class="hint">${hint}</small>` : ""}`;
  if (!a.length && !extra) h += '<div class="empty">Nada por aqui ainda.</div>';
  a0.map((x, i) => [x, i])
    .filter((p) => a.includes(p[0]))
    .reverse()
    .forEach((p) => {
      const x = p[0],
        i = p[1];
      h += `<div class="rw"><div class="g1"><b>${k === "exp" ? cat(x.cat)[1] + " " : ""}${esc(x.desc)}</b>${k === "exp" ? `<small>${cat(x.cat)[2]} · ${PAYN[x.pay] || "Débito"}</small>` : k === "ord" ? `<small>desconta em ${lab(sh(cur, 1))}</small>` : ""}</div><div class="rt"><b class="${k === "inc" ? "ok" : "no"}">${fmt(x.val)}</b>${cl ? "" : acts(k, i)}</div></div>`;
    });
  if (extra) h += extra;
  return (
    h +
    `<div class="rw tot"><span>Total</span><b>${fmt(sum(a) + (extraTot || 0))}</b></div></div>`
  );
}

/* ---------- telas ---------- */
function home() {
  const c = calc(cur),
    m = mg(cur),
    cl = m.closed,
    nx = sh(cur, 1),
    n = calc(nx),
    neg = c.left < 0;
  const base = c.inc + (c.carry || 0),
    pct =
      base > 0
        ? Math.min(100, Math.max(0, (c.out / base) * 100))
        : c.out > 0
          ? 100
          : 0;
  const pv = sh(cur, -1),
    cc =
      c.carry > 0.005
        ? `<div class="chip">↪️ Sobraram <b>${fmt(c.carry)}</b> de ${mname(pv)} e foram somados a este mês</div>`
        : "";
  let daily = "";
  if (cur === now && !cl) {
    const t = new Date(),
      dl =
        new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate() -
        t.getDate() +
        1;
    daily =
      c.left > 0
        ? `<div class="chip">☀️ Pode gastar ≈ <b>${fmt(c.left / dl)}</b> por dia · ${dl} ${dl === 1 ? "dia" : "dias"} restantes</div>`
        : `<div class="chip">⚠️ Sem folga para gastos avulsos este mês</div>`;
  }
  let h =
    alerts() +
    `<div class="hero${neg ? " neg" : ""}"><div class="hl">${cl ? "🔒 " : ""}Total de gastos fixos + fatura do cartão</div><div class="hv">${fmt(c.fx + c.cd)}</div><div class="hb"><i style="width:${pct}%"></i></div><div class="hr"><span>Contas fixas <b>${fmt(c.fx)}</b></span><span>Fatura do cartão <b>${fmt(c.cd)}</b></span></div><div class="hr"><span>Sobra do mês <b>${fmt(c.left)}</b></span><span>Saiu no total <b>${fmt(c.out)}</b></span></div>${cc}${daily}</div>`;
  h += `<div class="tiles">${tile("🏠", "Contas fixas", c.fx)}${tile("💳", "Fatura do cartão", c.cd)}${tile("🛒", "Gastos avulsos", c.av + c.avc)}${tile("🤝", "Dívidas que pago", c.dv)}</div>`;
  const dis = cl ? " disabled" : "";
  h += `<div class="card"><h3>🔎 Conferir o mês</h3><small class="hint">Já pagou tudo? Informe a fatura real do cartão e quanto sobrou de verdade na conta. O que não bater vira “gastos não identificados”.</small>
<div class="fg"><label>Fatura do cartão que paguei neste mês <span class="mu">(estimativa: ${fmt(c.est)})</span></label><input type="number" step="any" inputmode="decimal" placeholder="Ex.: 255,73" value="${m.fat != null ? m.fat : ""}" onchange="setM('fat',this.value)"${dis}></div>
<div class="fg"><label>Quanto sobrou de verdade na conta? <span class="mu">(contando o que veio do mês anterior)</span></label><input type="number" step="any" inputmode="decimal" placeholder="Ex.: 0" value="${m.real != null ? m.real : ""}" onchange="setM('real',this.value)"${dis}></div>
${m.real != null && c.ug > 0.005 ? `<div class="note warn">⚠️ <b>${fmt(c.ug)}</b> saíram sem você lembrar. Lance o que lembrar em Mês → Gastos avulsos e esse valor diminui.</div>` : ""}
${m.real != null && c.ug < -0.005 ? `<div class="note good">Sobrou <b>${fmt(-c.ug)}</b> a mais que o previsto. Talvez falte lançar alguma entrada.</div>` : ""}</div>`;
  const ct = {};
  (m.exp || []).forEach((x) => {
    const id = cat(x.cat)[0];
    ct[id] = (ct[id] || 0) + (+x.val || 0);
  });
  const ctot = Object.keys(ct).reduce((s, k) => s + ct[k], 0);
  if (ctot > 0) {
    const ks = Object.keys(ct).sort((a, b) => ct[b] - ct[a]),
      top = cat(ks[0]);
    h += `<div class="card"><h3>📊 Gastos avulsos por categoria</h3>${ks
      .map((id) => {
        const cc = cat(id),
          p = (ct[id] / ctot) * 100;
        return `<div style="padding:7px 0"><div style="display:flex;justify-content:space-between"><span>${cc[1]} ${cc[2]}</span><b>${fmt(ct[id])} <span class="mu" style="font-weight:400;font-size:12px">${Math.round(p)}%</span></b></div><div class="bar"><i style="width:${p}%;background:${cc[3]}"></i></div></div>`;
      })
      .join(
        "",
      )}<small class="hint">Maior gasto: ${top[1]} ${top[2]} (${Math.round((ct[ks[0]] / ctot) * 100)}% dos avulsos).</small></div>`;
  }
  if (cl)
    h += `<div class="card lk"><span>🔒 ${lab(cur)} fechado em ${new Date(cl.at).toLocaleDateString("pt-BR")}</span><button class="s sm" onclick="reopen()">Reabrir</button></div>`;
  else if (cur <= now)
    h += `<div class="card lk"><span>Terminou o mês? Feche para travar os valores.</span><button class="sm" onclick="closeM()">🔒 Fechar mês</button></div>`;
  const h0 = h.length;
  h += `<div class="card"><h3>Detalhes de ${lab(cur)}</h3>${row("Salário líquido", c.sal, "ok")}${c.carry > 0.005 ? row("Sobra de " + mname(pv) + " (somada)", c.carry, "ok") : ""}${c.ex ? row("Renda extra", c.ex, "ok") : ""}${c.t3 ? row("13º salário", c.t3, "ok") : ""}${row("Contas fixas", -c.fx, "no")}${row(cl || m.fat != null ? "Fatura do cartão (real)" : "Fatura do cartão (estimada)", -c.cd, "no")}${c.op ? row("Desconto de pedidos da empresa", -c.op, "no") : ""}${c.dv ? row("Parcelas de dívidas que devo", -c.dv, "no") : ""}${c.av ? row("Gastos avulsos (débito/pix)", -c.av, "no") : ""}${c.sv ? row("Guardado nos cofres", -c.sv, "no") : ""}${Math.abs(c.ug) > 0.005 ? row(c.ug > 0 ? "Gastos não identificados" : "Diferença a favor", -c.ug, c.ug > 0 ? "no" : "ok") : ""}</div>`;
  h += `<div class="card"><h3>🤝 Dívidas em aberto</h3>${row("Me devem (falta receber)", dtot("owed"), "ok")}${row("Eu devo (falta pagar)", -dtot("owe"), "no")}${row("Sobra do mês + o que vão me pagar nele", c.left + c.rc, c.left + c.rc >= 0 ? "ok" : "no")}</div>`;
  h += `<div class="card"><h3>🔮 Previsão de ${lab(nx)}</h3>${row("Salário previsto", n.sal, "ok")}${n.carry > 0.005 ? row("Sobra de " + mname(cur) + " (somada)", n.carry, "ok") : ""}${n.t3 ? row("13º salário", n.t3, "ok") : ""}${row("Contas fixas", -n.fx, "no")}${row("Fatura do cartão", -n.cd, "no")}${n.op ? row("Desconto de pedidos da empresa", -n.op, "no") : ""}${n.dv ? row("Parcelas de dívidas que devo", -n.dv, "no") : ""}<div class="rw tot"><span>Deve sobrar (sem avulsos)</span><b class="${n.left >= 0 ? "ok" : "no"}">${fmt(n.left)}</b></div></div>`;
  const tl = h.slice(h0);
  h = h.slice(0, h0);
  return h + `<div class="car">${tl}</div>`;
}

function monthTab() {
  const m = mg(cur),
    cl = !!m.closed,
    c = calc(cur);
  let h = "";
  if (cl)
    h += `<div class="card lk"><span>🔒 ${lab(cur)} está fechado.</span><button class="s sm" onclick="reopen()">Reabrir</button></div>`;
  h += `<div class="card"><h3>💵 Salário de ${lab(cur)}</h3><div class="fg" style="margin-top:8px"><label>Salário líquido deste mês</label><input type="number" step="any" inputmode="decimal" value="${c.sal}" onchange="setM('sal',this.value)"${cl ? " disabled" : ""}></div>${c.carry > 0.005 ? row("Sobra de " + mname(sh(cur, -1)) + " (somada ao mês)", c.carry, "ok") : ""}${c.t3 ? row("13º salário (Ajustes em Mais)", c.t3, "ok") : ""}</div>`;
  h += list(
    "exp",
    "🛒 Gastos avulsos",
    "Aqui aparece só o que foi no débito ou pix. Gastos no crédito aparecem em Contas → Cartão → Compras no cartão.",
  );
  h += list("inc", "💰 Renda extra");
  const lk = linked(cur, "empresa");
  const ex = lk.length
    ? lk
        .map(
          (x) =>
            `<div class="rw"><div class="g1"><b>${esc(x.name)}</b><small>vindo de Dívidas · desconta em ${lab(sh(cur, 1))}</small></div><b class="no">${fmt(x.val / (+x.parcels || 1))}</b></div>`,
        )
        .join("")
    : "";
  h += list(
    "ord",
    "🏭 Pedido da empresa",
    "Descontado do salário do mês seguinte.",
    ex,
    dvs(cur, "empresa"),
  );
  return h;
}

function fixedView() {
  const m = mg(cur),
    pf = m.pf || {},
    it = S.fixed
      .map((x, i) => [x, i])
      .sort((a, b) => (a[0].day || 99) - (b[0].day || 99));
  const np = it.filter((p) => pf[p[0].id]).length,
    vp = it.filter((p) => pf[p[0].id]).reduce((s, p) => s + p[0].val, 0),
    tot = sum(fxm(cur));
  let h = `<div class="card"><div class="ch"><h3>🏠 Contas fixas</h3><button class="sm" onclick="openForm('fixed')">＋ Nova</button></div>`;
  if (it.length)
    h += `<small class="hint">${np} de ${it.length} pagas em ${mname(cur)} · ${fmt(vp)} de ${fmt(tot)}</small><div class="bar" style="margin-bottom:6px"><i style="width:${tot > 0 ? (vp / tot) * 100 : 0}%"></i></div>`;
  else h += '<div class="empty">Nenhuma conta fixa ainda.</div>';
  it.forEach((p) => {
    const x = p[0],
      i = p[1],
      on = !!pf[x.id];
    h += `<div class="rw"><button class="cb${on ? " on" : ""}" onclick="togFix('${x.id}')" aria-label="Marcar como paga">${on ? "✓" : ""}</button><div class="g1"><b${on ? ' style="opacity:.5;text-decoration:line-through"' : ""}>${esc(x.desc)}</b>${x.day ? `<small>vence dia ${x.day}</small>` : ""}</div><div class="rt"><b>${fmt(x.val)}</b>${acts("fixed", i)}</div></div>`;
  });
  return (
    h +
    `<div class="rw tot"><span>Total por mês</span><b>${fmt(tot)}</b></div></div>`
  );
}

function cardView() {
  const m = mg(cur),
    est = inst(cur),
    ac = sum((m.exp || []).filter((x) => x.pay === "credito")),
    lk = linked(cur, "cartao"),
    lt = lk.reduce((s, x) => s + x.val / (+x.parcels || 1), 0);
  let h = `<div class="card"><h3>💳 Fatura de ${lab(cur)}</h3><div class="rw tot"><span>Total da fatura (estimativa)</span><b>${fmt(est + lt + ac)}</b></div><small class="hint" style="margin-top:8px">Separando de quem é:</small>${row("Minhas compras parceladas", est)}${row("Meus gastos avulsos no crédito", ac)}<div class="rw tot"><span>Minha parte</span><b>${fmt(est + ac)}</b></div><div class="rw tot"><span>🤝 De quem me deve</span><b class="ok">${fmt(lt)}</b></div>${m.fat != null ? `<small class="hint">Fatura real informada: ${fmt(m.fat)} (Início → Conferir o mês).</small>` : '<small class="hint">Se a fatura que você paga neste mês é a do mês passado, informe o valor real em Início → Conferir o mês.</small>'}</div>`;
  h += `<div class="card"><div class="ch"><h3>Compras no cartão</h3><button class="sm" onclick="openForm('card')">＋ Nova</button></div>`;
  const ce = (m.exp || [])
    .map((x, i) => [x, i])
    .filter((p) => p[0].pay === "credito");
  if (!S.card.length && !ce.length)
    h += '<div class="empty">Nenhuma compra cadastrada.</div>';
  S.card.forEach((x, i) => {
    const p = +x.parcels || 1,
      k = diff(x.start, cur) + 1,
      st =
        k < 1
          ? "começa em " + lab(x.start)
          : k > p
            ? "quitada"
            : "parcela " + k + "/" + p;
    h += `<div class="rw"><div class="g1"><b>${esc(x.desc)}</b><small>${st} · total ${fmt(x.total)}</small></div><div class="rt"><b>${fmt(x.total / p)}</b>${acts("card", i)}</div></div>`;
  });
  ce.forEach((p) => {
    const x = p[0];
    h += `<div class="rw"><div class="g1"><b>${cat(x.cat)[1]} ${esc(x.desc)}</b><small>gasto avulso · ${cat(x.cat)[2]} · só em ${mname(cur)}</small></div><div class="rt"><b>${fmt(x.val)}</b>${isC(cur) ? "" : acts("exp", p[1])}</div></div>`;
  });
  h += "</div>";
  if (lk.length)
    h += `<div class="card"><h3>🤝 De quem me deve (já dentro do total da fatura)</h3>${lk.map((x) => `<div class="rw"><div class="g1"><b>${esc(x.name)}</b><small>${esc(x.why || "")}</small></div><b>${fmt(x.val / (+x.parcels || 1))}</b></div>`).join("")}</div>`;
  return h;
}

function debtsView() {
  const rc = dvm(cur, "owed"),
    dv = dvm(cur, "owe");
  let a = S.debts.map((x, i) => [x, i]);
  if (sub.debt === "mes") a = a.filter((p) => !p[0].paid && hasInst(p[0], cur));
  else if (sub.debt === "aberto") a = a.filter((p) => !p[0].paid);
  else a = a.filter((p) => p[0].paid);
    const nOwed = a.filter((p) => p[0].type === "owed").length,
    nOwe = a.filter((p) => p[0].type === "owe").length;
  if (sub.kind === "owe" || sub.kind === "owed")
    a = a.filter((p) => p[0].type === sub.kind);
  a.sort(
    (p, q) =>
      String(p[0].due || "9999").localeCompare(String(q[0].due || "9999")) ||
      String(p[0].start).localeCompare(String(q[0].start)),
  );
  let h = `<div class="tiles">${tile("📥", "Vou receber em " + mname(cur), rc, "ok")}${tile("📤", "Vou pagar em " + mname(cur), dv, "no")}</div>`;
  h += seg("debt", [
    ["mes", "Deste mês"],
    ["aberto", "Em aberto"],
    ["pagas", "Pagas"],
  ]);
    h += seg("kind", [
    ["todas", "Todas"],
    ["owed", "📥 Me devem (" + nOwed + ")"],
    ["owe", "📤 Eu devo (" + nOwe + ")"],
  ]);
  h += `<div class="card"><div class="ch"><h3>${sub.debt === "pagas" ? "Dívidas pagas" : sub.debt === "mes" ? "Dívidas de " + lab(cur) : "Todas em aberto"}</h3><button class="sm" onclick="openForm('debts')">＋ Nova</button></div>`;
  if (!a.length)
    h += `<div class="empty">${sub.debt === "pagas" ? "Nenhuma dívida paga ainda." : sub.debt === "mes" ? "Nenhuma parcela de dívida neste mês." : "Nenhuma dívida em aberto."}</div>`;
  a.forEach((p) => {
    const x = p[0],
      i = p[1],
      pr = +x.parcels || 1,
      owed = x.type === "owed",
      pd = !!(x.pm && x.pm[cur]),
      expired = !x.paid && diff(sh(x.start, pr - 1), now) > 0;
    const tg = owed
      ? x.src === "cartao"
        ? "na minha fatura"
        : x.src === "empresa"
          ? "desconta do salário"
          : "débito"
      : "";
    h += `<div class="dc"><div class="top"><div class="g1"><b>${esc(x.name)}</b> <span class="tag">${owed ? "me deve" : "eu devo"}</span>${pd && !x.paid ? ' <span class="tag">✓ paga em ' + mname(cur) + "</span>" : ""}${tg ? ` <span class="tag">${tg}</span>` : ""}
<small>${x.why ? esc(x.why) + " · " : ""}${pr > 1 ? pr + "x de " + fmt(x.val / pr) + " · de " + lab(x.start) + " até " + lab(sh(x.start, pr - 1)) : "1 parcela · só em " + lab(x.start)}${x.due && !x.paid ? " · combinado p/ " + fdate(x.due) : ""}</small>
${expired ? '<small class="no">⚠️ O prazo já passou. Marque como quitado se já foi resolvido.</small>' : ""}</div><b class="${owed ? "ok" : "no"}">${fmt(x.val)}</b></div>
<div class="bt">${!x.paid && hasInst(x, cur) ? `<button class="${pd ? "s " : ""}sm" onclick="payDebtM(${i})">${pd ? "↩ Desmarcar" : "✓ Paga em " + mname(cur)}</button>` : ""}<button class="${x.paid ? "s " : ""}sm" onclick="payDebt(${i})">${x.paid ? "↩ Reabrir" : "✓ Quitado"}</button><button class="ic" onclick="openForm('debts',${i})">✏️</button><button class="ic" onclick="del('debts',${i})">🗑️</button></div></div>`;
  });
    if (sub.kind !== "todas" && a.length) {
    const tv = a.reduce(
      (s, p) =>
        s +
        (sub.debt === "mes"
          ? p[0].val / (+p[0].parcels || 1)
          : sub.debt === "aberto"
            ? dleft(p[0])
            : p[0].val),
      0,
    );
    h += `<div class="rw tot"><span>${sub.kind === "owe" ? "Total que devo" : "Total que me devem"}</span><b class="${sub.kind === "owe" ? "no" : "ok"}">${fmt(tv)}</b></div>`;
  }
  h += "</div>";
  h += `<div class="card">${row("Me devem (falta receber)", dtot("owed"), "ok")}${row("Eu devo (falta pagar)", -dtot("owe"), "no")}</div>`;
  return h;
}

function contasTab() {
  return (
    seg("contas", [
      ["fixed", "🏠 Fixas"],
      ["card", "💳 Cartão"],
      ["debts", "🤝 Dívidas"],
    ]) +
    (sub.contas === "fixed"
      ? fixedView()
      : sub.contas === "card"
        ? cardView()
        : debtsView())
  );
}

const PN = { cx: "Caixinha Nubank", td: "Tesouro Direto" },
  KN = {
    dep: "Guardei (sai da sobra do mês)",
    ini: "Saldo que já tinha",
    ret: "Retirei",
  };
function cofres() {
  const cx = bal("cx"),
    td = bal("td"),
    c = calc(cur),
    s = Math.max(0, c.left),
    t3 = S.t13[0] + S.t13[1];
  let h = `<div class="card"><h3>🐷 Total guardado</h3><div class="hv ok" style="color:var(--ok);font-size:32px">${fmt(cx + td)}</div><div class="tiles" style="margin:0"><div class="tile"><small>Caixinha Nubank</small><b>${fmt(cx)}</b><small>saque quando quiser</small></div><div class="tile"><small>Tesouro Direto</small><b>${fmt(td)}</b><small>bloqueado até 2032 · mín. R$ 5</small></div></div></div>`;
  h += `<div class="card"><h3>💡 Sugestão</h3><div style="margin-top:6px">${s >= 5 ? `Sobrando ${fmt(s)} este mês: guarde <b>${fmt(Math.max(5, s * 0.3))}</b> no Tesouro, <b>${fmt(s * 0.4)}</b> na Caixinha e deixe o resto livre.` : "Este mês não está sobrando. Priorize as dívidas e, quando der, guarde pelo menos R$ 5 no Tesouro."}</div><small class="hint">No 13º (≈ ${fmt(t3)}): depois de quitar as dívidas, metade no Tesouro e metade na Caixinha.</small></div>`;
  h += `<div class="card"><h3>Novo movimento</h3><div style="margin-top:8px"><div class="fg"><select id="sv_pot"><option value="cx">Caixinha Nubank</option><option value="td">Tesouro Direto</option></select></div><div class="fg"><select id="sv_kind"><option value="dep">${KN.dep}</option><option value="ini">${KN.ini}</option><option value="ret">${KN.ret}</option></select></div><div class="fg"><input id="sv_val" type="number" step="any" inputmode="decimal" placeholder="Valor R$" aria-label="Valor"></div><div class="fg"><input id="sv_note" placeholder="Observação (opcional)" aria-label="Observação"></div><button style="width:100%" onclick="svAdd()">+ Registrar</button></div></div>`;
  h += '<div class="card"><h3>Movimentos</h3>';
  if (!S.sv.length)
    h +=
      '<div class="empty">Nenhum movimento. Registre o saldo atual com “Saldo que já tinha”.</div>';
  S.sv
    .map((x, i) => [x, i])
    .reverse()
    .slice(0, 30)
    .forEach((p) => {
      const x = p[0];
      h += `<div class="rw"><div class="g1">${PN[x.pot]} · ${KN[x.kind]}<small>${lab(x.ym)}${x.note ? " · " + esc(x.note) : ""}</small></div><div class="rt"><b class="${x.kind === "ret" ? "no" : "ok"}">${x.kind === "ret" ? "-" : "+"}${fmt(x.val)}</b><div class="ac"><button class="ic" onclick="svDel(${p[1]})">🗑️</button></div></div></div>`;
    });
  return h + "</div>";
}
function quero() {
  const c = calc(cur),
    dv = dtot("owe"),
    A = {
      sal: Math.max(0, c.left),
      cx: bal("cx"),
      t13: Math.max(0, S.t13[0] + S.t13[1] - dv),
    },
    N = { sal: "Sobra do mês", cx: "Caixinha Nubank", t13: "13º salário" },
    u = { sal: 0, cx: 0, t13: 0 };
  const all = S.wish.map((w, i) => [w, i]);
  const act = all
    .filter((p) => !p[0].done)
    .sort((a, b) =>
      String(a[0].date || "9999").localeCompare(String(b[0].date || "9999")),
    );
  const dn = all.filter((p) => p[0].done);
  let h = `<div class="card"><h3>💸 Quanto posso usar (depois do que devo)</h3>${row("Parcelas que ainda devo", -dv, "no")}${row("Sobra do mês", A.sal)}${row("Caixinha Nubank", A.cx)}${row("13º salário menos as dívidas", A.t13)}</div>`;
  h += `<div class="card"><div class="ch"><h3>🛍️ Coisas que quero</h3><button class="sm" onclick="openForm('wish')">＋ Novo</button></div>`;
  if (!act.length) h += '<div class="empty">Nada na lista ainda.</div>';
  act.forEach((p) => {
    const w = p[0],
      i = p[1];
    u[w.src] += w.val;
    const r = A[w.src] - u[w.src];
    let dt = "";
    if (w.date) {
      const n = daysTo(w.date);
      dt = `<small>📅 ${fdate(w.date)} · ${n < 0 ? "data já passou" : n === 0 ? "é hoje" : "em " + n + " dias"}${n > 0 ? " · guardando ≈ " + fmt(w.val / Math.max(1, Math.ceil(n / 30))) + "/mês você chega lá" : ""}</small>`;
    }
    h += `<div class="dc"><div class="top"><div class="g1"><b>${esc(w.desc)}</b>${dt}<small>Usando: ${N[w.src]}</small>${r >= 0 ? `<small class="ok">Cabe ✔ sobra ${fmt(r)}</small>` : `<small class="no">Faltam ${fmt(-r)}</small>`}</div><b>${fmt(w.val)}</b></div><div class="bt"><button class="sm" onclick="wDone(${i})">🛒 Comprei</button><button class="ic" onclick="openForm('wish',${i})">✏️</button><button class="ic" onclick="del('wish',${i})">🗑️</button></div></div>`;
  });
  h += "</div>";
  if (dn.length)
    h += `<div class="card"><h3>✅ Já comprei</h3>${dn.map((p) => `<div class="rw"><div class="g1"><b style="opacity:.55;text-decoration:line-through">${esc(p[0].desc)}</b></div><div class="rt"><b>${fmt(p[0].val)}</b><div class="ac"><button class="ic" onclick="wDone(${p[1]})">↩</button><button class="ic" onclick="del('wish',${p[1]})">🗑️</button></div></div></div>`).join("")}</div>`;
  return h;
}
function metasTab() {
  return (
    seg("metas", [
      ["cofres", "🐷 Cofres"],
      ["quero", "🛍️ Quero comprar"],
    ]) + (sub.metas === "cofres" ? cofres() : quero())
  );
}

function chart() {
  const ms = [];
  for (let i = 5; i >= 0; i--) ms.push(sh(cur, -i));
  const cs = ms.map((m) => calc(m)),
    mx = Math.max(1, ...cs.map((c) => Math.max(c.inc, c.out)));
  return `<div class="chart">${ms.map((m, i) => `<div class="col"><div class="bars"><i class="b1" style="height:${(Math.max(0, cs[i].inc) / mx) * 100}%"></i><i class="b2" style="height:${(Math.max(0, cs[i].out) / mx) * 100}%"></i></div><small>${shortM(m)}</small></div>`).join("")}</div><div class="lg"><span><i class="b1"></i>Entrou</span><span><i class="b2"></i>Saiu</span></div>`;
}
function histTab() {
  const ks = Object.keys(S.m)
      .concat(
        [cur],
        S.sv.map((x) => x.ym),
      )
      .sort(),
    rows = [];
  let m = ks[0];
  while (diff(m, cur) >= 0) {
    rows.push(m);
    m = sh(m, 1);
  }
  rows.reverse();
  const mx = Math.max(1, ...rows.map((r) => calc(r).inc)),
    tl = rows.reduce((t, r) => t + calc(r).own, 0);
  let h = `<div class="card"><h3>📈 Últimos 6 meses</h3><div style="margin-top:10px">${chart()}</div></div>`;
  h += '<div class="card"><h3>📅 Histórico de meses</h3>';
  rows.forEach((r) => {
    const c = calc(r);
    h += `<div class="rw" style="display:block;cursor:pointer" onclick="cur='${r}';tab='home';render();window.scrollTo(0,0)"><div style="display:flex;justify-content:space-between"><b style="text-transform:capitalize">${isC(r) ? "🔒 " : ""}${lab(r)}</b><b class="${c.left >= 0 ? "ok" : "no"}">${fmt(c.left)}</b></div><small>Entrou ${fmt(c.inc)}${c.carry > 0.005 ? " · Veio " + fmt(c.carry) + " do mês anterior" : ""} · Saiu ${fmt(c.out)}</small><div class="bar"><i style="width:${Math.min(100, (Math.max(0, c.out) / mx) * 100)}%"></i></div></div>`;
  });
  h += `<div class="rw tot"><span>Total acumulado de sobras</span><b class="${tl >= 0 ? "ok" : "no"}">${fmt(tl)}</b></div><small class="hint">Toque num mês para abrir. Meses abertos usam os valores atuais de contas fixas e cartão.</small></div>`;
  h += `<div class="card"><h3>⚙️ Ajustes</h3><div style="margin-top:10px"><div class="fg"><label>Tema</label><select onchange="setTheme(this.value)"><option value="auto"${S.theme === "auto" ? " selected" : ""}>Automático</option><option value="light"${S.theme === "light" ? " selected" : ""}>Claro</option><option value="dark"${S.theme === "dark" ? " selected" : ""}>Escuro</option></select></div>
<div class="fg"><label>Salário líquido padrão</label><input type="number" step="any" inputmode="decimal" value="${S.salary}" onchange="setBase(this.value)"></div>
<div class="fg"><label>13º salário · parcela de novembro</label><input type="number" step="any" inputmode="decimal" value="${S.t13[0]}" onchange="set13(0,this.value)"></div>
<div class="fg"><label>13º salário · parcela de dezembro</label><input type="number" step="any" inputmode="decimal" value="${S.t13[1]}" onchange="set13(1,this.value)"></div></div></div>`;
  h += `<div class="card"><h3>💾 Backup</h3><small class="hint">Seus dados ficam só neste aparelho/navegador. Guarde uma cópia de vez em quando.</small><div style="display:flex;gap:8px;margin-top:6px"><button style="flex:1" onclick="exportData()">⬇️ Exportar</button><button class="s" style="flex:1" onclick="$('#imp').click()">⬆️ Importar</button></div><input id="imp" type="file" accept=".json,application/json" style="display:none" onchange="importData(this)"></div>`;
  return h;
}

const TABS = [
  ["home", "🏠", "Início"],
  ["mes", "📝", "Mês"],
  ["contas", "🧾", "Contas"],
  ["metas", "🎯", "Metas"],
  ["hist", "📈", "Mais"],
];
function render() {
  $("#mlabel").textContent = lab(cur);
  $("#nav").innerHTML = TABS.map(
    (t) =>
      `<button class="${t[0] === tab ? "on" : ""}" onclick="go('${t[0]}')"><span>${t[1]}</span>${t[2]}</button>`,
  ).join("");
  $("#app").innerHTML =
    tab === "home"
      ? home()
      : tab === "mes"
        ? monthTab()
        : tab === "contas"
          ? contasTab()
          : tab === "metas"
            ? metasTab()
            : histTab();
  $("#fab").style.display = tab === "hist" || form ? "none" : "flex";
}
applyTheme();
render();

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && form) { closeSheet(); return; }
  const t = e.target.tagName;
  if (form || ["INPUT", "SELECT", "TEXTAREA"].includes(t) || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === "ArrowLeft") mv(-1);
  else if (e.key === "ArrowRight") mv(1);
  else if (e.key === "n" || e.key === "N") quick();
  else if (e.key >= "1" && e.key <= "5") go(TABS[e.key - 1][0]);
});

/* =====================================================================
   DÍVIDAS — novo visual da aba Contas → Dívidas.
   Carregue DEPOIS do app.js e do extras.js. Não altera nenhum outro arquivo.
   Já inclui o filtro Todas / Me devem / Eu devo.
   ===================================================================== */
(function () {
  if (typeof debtsView !== "function" || typeof S === "undefined") return;
  sub.kind = sub.kind || "todas";

  /* ---------- estilos (injetados, usam as cores do tema) ---------- */
  const st = document.createElement("style");
  st.textContent = `
/* resumo */
.dv-sum{padding:18px}
.dv-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.dv-cols small{font-size:12.5px}
.dv-cols b{display:block;margin-top:3px;font-size:clamp(15px,4.4vw,21px);letter-spacing:-.02em}
.dv-split{display:flex;gap:2px;height:8px;margin:14px 0 8px;border-radius:99px;overflow:hidden;background:var(--in)}
.dv-split i{display:block;height:100%}
.dv-split .sp-ok{background:var(--ok)}
.dv-split .sp-no{background:var(--no)}
.dv-sum .hint{margin:0}

/* barra de filtros */
.dv-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:12px}
.dv-bar .seg{margin:0;flex:1 1 300px;max-width:420px}
.dv-fl{display:flex;flex-wrap:wrap;gap:6px}
.fl{background:var(--card);color:var(--mu);border:1px solid var(--bd);border-radius:99px;padding:8px 14px;font-size:13.5px;font-weight:600}
.fl.k-todas{--c:var(--ac)}
.fl.k-owed{--c:var(--ok)}
.fl.k-owe{--c:var(--no)}
.fl.on{background:color-mix(in srgb,var(--c) 14%,var(--card));color:var(--c);border-color:var(--c)}
.fl .n{display:inline-block;min-width:20px;margin-left:6px;padding:0 6px;border-radius:99px;background:var(--in);color:var(--mu);font-size:12px;text-align:center}
.fl.on .n{background:color-mix(in srgb,var(--c) 22%,transparent);color:var(--c)}

/* itens */
.dv{display:grid;grid-template-columns:44px 1fr;gap:4px 12px;margin-top:10px;padding:14px;border-radius:16px;border-left:4px solid var(--c);background:color-mix(in srgb,var(--in) 60%,transparent)}
.dv.ow{--c:var(--ok)}
.dv.oe{--c:var(--no)}
.dv.done{opacity:.72}
.dv-av{grid-row:1;width:44px;height:44px;display:grid;place-items:center;border-radius:50%;font-size:18px;font-weight:800;color:var(--c);background:color-mix(in srgb,var(--c) 16%,transparent)}
.dv-mn{grid-column:2;min-width:0}
.dv-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.dv-nm{font-size:16px;word-break:break-word}
.dv-val{font-size:18px;letter-spacing:-.02em;white-space:nowrap}
.dv-tags{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0 2px}
.tag.t-ok{background:color-mix(in srgb,var(--ok) 15%,transparent);color:var(--ok)}
.tag.t-no{background:color-mix(in srgb,var(--no) 15%,transparent);color:var(--no)}
.dv-due{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:99px;background:var(--in);color:var(--mu);font-size:12px;font-weight:600}
.dv-due.soon{background:color-mix(in srgb,#d97706 18%,transparent);color:#d97706}
.dv-due.late{background:color-mix(in srgb,var(--no) 16%,transparent);color:var(--no)}
.dv-pr{height:6px;margin:8px 0 4px;border-radius:99px;overflow:hidden;background:color-mix(in srgb,var(--bd) 80%,transparent)}
.dv-pr i{display:block;height:100%;border-radius:99px;background:var(--c)}
.dv-act{grid-column:1/-1;display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:6px;margin-top:6px;padding-top:10px;border-top:1px dashed var(--bd)}

/* vazio */
.dv-empty{padding:28px 10px 18px;text-align:center}
.dv-empty .em{font-size:40px;line-height:1}
.dv-empty b{display:block;margin-top:8px;font-size:16px}
.dv-empty button{margin-top:14px}

@media(hover:hover){
  .dv{transition:background .15s}
  .dv:hover{background:var(--in)}
  .fl:hover{border-color:var(--c)}
}
@media(min-width:700px){
  #app>.dv-sum,#app>.dv-bar{column-span:all}
}
@media(min-width:1180px){
  #app>.dv-sum{grid-column:1/-1;max-width:780px;padding:22px 24px}
  #app>.dv-bar{grid-column:1/-1}
  #app>.card.dv-list{grid-column:span 2}
}
`;
  document.head.appendChild(st);

  /* parcelas já resolvidas (meses passados ou marcados como pagos) */
  const doneN = (x) => {
    const p = +x.parcels || 1;
    if (x.paid) return p;
    let n = 0;
    for (let k = 0; k < p; k++) {
      const ym = sh(x.start, k);
      if (diff(ym, now) > 0 || (x.pm && x.pm[ym])) n++;
    }
    return n;
  };

  function item(x, i) {
    const pr = +x.parcels || 1,
      owed = x.type === "owed",
      pd = !!(x.pm && x.pm[cur]),
      expired = !x.paid && diff(sh(x.start, pr - 1), now) > 0,
      tg = owed
        ? x.src === "cartao"
          ? "na minha fatura"
          : x.src === "empresa"
            ? "desconta do salário"
            : "débito"
        : "";
    let due = "";
    if (x.due && !x.paid) {
      const n = daysTo(x.due);
      due = `<span class="dv-due${n < 0 ? " late" : n <= 3 ? " soon" : ""}">📅 ${fdate(x.due)} · ${when(n)}</span>`;
    }
    let prog;
    if (pr > 1) {
      const d = doneN(x);
      prog = `<div class="dv-pr"><i style="width:${(d / pr) * 100}%"></i></div><small>${d} de ${pr} pagas · ${lab(x.start)} até ${lab(sh(x.start, pr - 1))}</small>`;
    } else prog = `<small>1 parcela · só em ${lab(x.start)}</small>`;

    return `<div class="dv ${owed ? "ow" : "oe"}${x.paid ? " done" : ""}">
<div class="dv-av">${esc((x.name || "?").trim().charAt(0).toUpperCase())}</div>
<div class="dv-mn">
<div class="dv-top"><div class="g1"><b class="dv-nm">${esc(x.name)}</b>${x.why ? `<small>${esc(x.why)}</small>` : ""}</div>
<div class="rt"><b class="dv-val ${owed ? "ok" : "no"}">${fmt(x.val / pr)}</b>${pr > 1 ? `<small>total ${fmt(x.val)}</small>` : ""}</div></div>
<div class="dv-tags"><span class="tag ${owed ? "t-ok" : "t-no"}">${owed ? "me deve" : "eu devo"}</span>${tg ? `<span class="tag">${tg}</span>` : ""}${pd && !x.paid ? `<span class="tag t-ok">✓ paga em ${mname(cur)}</span>` : ""}${x.paid ? '<span class="tag">quitada</span>' : ""}${due}</div>
${prog}
${expired ? '<small class="no">⚠️ O prazo já passou. Marque como quitado se já foi resolvido.</small>' : ""}
</div>
<div class="dv-act">${!x.paid && hasInst(x, cur) ? `<button class="${pd ? "s " : ""}sm" onclick="payDebtM(${i})">${pd ? "↩ Desmarcar" : "✓ Paga em " + mname(cur)}</button>` : ""}<button class="${x.paid ? "s " : ""}sm" onclick="payDebt(${i})">${x.paid ? "↩ Reabrir" : "✓ Quitado"}</button><button class="ic" aria-label="Editar" onclick="openForm('debts',${i})">✏️</button><button class="ic" aria-label="Excluir" onclick="del('debts',${i})">🗑️</button></div>
</div>`;
  }

  debtsView = function () {
    const rc = dvm(cur, "owed"),
      dv = dvm(cur, "owe"),
      net = rc - dv,
      tt = rc + dv;
    let a = S.debts.map((x, i) => [x, i]);
    if (sub.debt === "mes") a = a.filter((p) => !p[0].paid && hasInst(p[0], cur));
    else if (sub.debt === "aberto") a = a.filter((p) => !p[0].paid);
    else a = a.filter((p) => p[0].paid);
    const nOwed = a.filter((p) => p[0].type === "owed").length,
      nOwe = a.filter((p) => p[0].type === "owe").length;
    if (sub.kind === "owe" || sub.kind === "owed")
      a = a.filter((p) => p[0].type === sub.kind);
    a.sort(
      (p, q) =>
        String(p[0].due || "9999").localeCompare(String(q[0].due || "9999")) ||
        String(p[0].start).localeCompare(String(q[0].start)),
    );

    /* resumo */
    let h = `<div class="card dv-sum"><div class="dv-cols">
<div><small>📥 Vou receber em ${mname(cur)}</small><b class="ok">${fmt(rc)}</b></div>
<div><small>📤 Vou pagar em ${mname(cur)}</small><b class="no">${fmt(dv)}</b></div>
<div><small>Saldo do mês</small><b class="${net >= 0 ? "ok" : "no"}">${fmt(net)}</b></div></div>
<div class="dv-split">${tt > 0 ? `<i class="sp-ok" style="width:${(rc / tt) * 100}%"></i><i class="sp-no" style="width:${(dv / tt) * 100}%"></i>` : ""}</div>
<small class="hint">Em aberto no total: receber <b class="ok">${fmt(dtot("owed"))}</b> · pagar <b class="no">${fmt(dtot("owe"))}</b></small></div>`;

    /* filtros: período + tipo na mesma linha */
    const KS = [
      ["todas", "Todas", nOwed + nOwe],
      ["owed", "📥 Me devem", nOwed],
      ["owe", "📤 Eu devo", nOwe],
    ];
    h += `<div class="dv-bar">${seg("debt", [
      ["mes", "Deste mês"],
      ["aberto", "Em aberto"],
      ["pagas", "Pagas"],
    ])}<div class="dv-fl">${KS.map((k) => `<button class="fl k-${k[0]}${sub.kind === k[0] ? " on" : ""}" onclick="setSub('kind','${k[0]}')">${k[1]}<span class="n">${k[2]}</span></button>`).join("")}</div></div>`;

    /* lista */
    h += `<div class="card dv-list"><div class="ch"><h3>${sub.debt === "pagas" ? "Dívidas pagas" : sub.debt === "mes" ? "Dívidas de " + lab(cur) : "Todas em aberto"}</h3><button class="sm" onclick="openForm('debts')">＋ Nova</button></div>`;
    if (!a.length) {
      const msg =
        sub.kind === "owed"
          ? "Ninguém te deve neste filtro"
          : sub.kind === "owe"
            ? "Você não deve nada neste filtro"
            : sub.debt === "pagas"
              ? "Nenhuma dívida paga ainda"
              : sub.debt === "mes"
                ? "Nenhuma parcela neste mês"
                : "Nenhuma dívida em aberto";
      h += `<div class="dv-empty"><div class="em">🎉</div><b>${msg}</b><button class="sm" onclick="openForm('debts')">＋ Nova dívida</button></div>`;
    } else a.forEach((p) => (h += item(p[0], p[1])));

    if (sub.kind !== "todas" && a.length) {
      const tv = a.reduce(
        (s, p) =>
          s +
          (sub.debt === "mes"
            ? p[0].val / (+p[0].parcels || 1)
            : sub.debt === "aberto"
              ? dleft(p[0])
              : p[0].val),
        0,
      );
      h += `<div class="rw tot"><span>${sub.kind === "owe" ? "Total que devo" : "Total que me devem"}</span><b class="${sub.kind === "owe" ? "no" : "ok"}">${fmt(tv)}</b></div>`;
    }
    return h + "</div>";
  };
  try {
    render();
  } catch (e) {}
})();