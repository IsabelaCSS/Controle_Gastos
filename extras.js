/* =====================================================================
   EXTRAS — carregue DEPOIS do app.js (não altera o app.js).
   1) Salvamento automático em arquivo .json (Chrome/Edge no computador)
   2) Painel lateral direito com gráfico de rosca e próximos vencimentos
   3) Resumo "Sobra do mês" fixo na barra lateral
   ===================================================================== */
(function () {
  if (typeof S === "undefined" || typeof save !== "function") return;

  /* ---------------- 1) SALVAMENTO EM ARQUIVO ---------------- */
  const FS = "showSaveFilePicker" in window && "showOpenFilePicker" in window;
  const AT = KEY + "_at";
  const TYPES = [
    { description: "Dados do Meus Gastos", accept: { "application/json": [".json"] } },
  ];
  const chip = document.createElement("button");
  chip.id = "autosave";
  chip.type = "button";
  document.body.appendChild(chip);

  let handle = null,
    timer = null,
    lastOk = "";

  function setState(s) {
    chip.dataset.s = s;
    if (!FS) chip.textContent = "⬇️ Baixar backup (.json)";
    else if (s === "ok") chip.textContent = "✓ Salvo em " + handle.name + (lastOk ? " · " + lastOk : "");
    else if (s === "perm") chip.textContent = "⚠️ Reconectar arquivo";
    else chip.textContent = "💾 Salvar em arquivo";
    chip.title = FS
      ? s === "ok"
        ? "Toda alteração é gravada neste arquivo. Clique para desconectar."
        : "Escolha um arquivo .json para salvar tudo automaticamente."
      : "Este navegador não grava arquivos sozinho. Use o Chrome ou Edge no computador.";
  }

  const idb = () =>
    new Promise((res, rej) => {
      const r = indexedDB.open("gastos_fs", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("h");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  const hget = async () => {
    try {
      const d = await idb();
      return await new Promise((res) => {
        const q = d.transaction("h").objectStore("h").get("file");
        q.onsuccess = () => res(q.result || null);
        q.onerror = () => res(null);
      });
    } catch (e) {
      return null;
    }
  };
  const hset = async (h) => {
    const d = await idb();
    return new Promise((res) => {
      const t = d.transaction("h", "readwrite");
      if (h) t.objectStore("h").put(h, "file");
      else t.objectStore("h").delete("file");
      t.oncomplete = () => res();
    });
  };

  async function writeNow() {
    if (!handle) return;
    const ts = Date.now();
    try {
      const w = await handle.createWritable();
      await w.write(JSON.stringify(Object.assign({}, S, { _savedAt: ts }), null, 1));
      await w.close();
      localStorage.setItem(AT, String(ts));
      lastOk = new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      setState("ok");
    } catch (e) {
      setState("perm");
    }
  }

  function loadText(txt, fa) {
    localStorage.setItem(KEY, txt);
    localStorage.setItem(AT, String(fa || Date.now()));
    location.reload();
  }

  async function afterConnect() {
    try {
      const txt = await (await handle.getFile()).text();
      if (txt.trim()) {
        const d = JSON.parse(txt);
        const fa = +d._savedAt || 0,
          la = +localStorage.getItem(AT) || 0,
          hasData = d.m && Object.keys(d.m).length;
        if (d && d.m && (fa > la + 2000 || (la === 0 && hasData))) {
          if (
            confirm(
              'O arquivo "' + handle.name + '" tem dados mais novos do que este navegador.\n\n' +
                "OK = carregar os dados do arquivo\n" +
                "Cancelar = manter os daqui (o arquivo será sobrescrito)"
            )
          ) {
            loadText(txt, fa);
            return;
          }
        }
      }
    } catch (e) {}
    await writeNow();
  }

  function queueWrite() {
    if (!handle) return;
    clearTimeout(timer);
    timer = setTimeout(writeNow, 500);
  }

  /* toda vez que o app chamar save(), grava também no arquivo */
  const _save = save;
  save = function () {
    _save();
    try {
      localStorage.setItem(AT, String(Date.now()));
    } catch (e) {}
    queueWrite();
  };

  chip.onclick = async function () {
    if (!FS) {
      if (typeof exportData === "function") exportData();
      return;
    }
    try {
      if (handle && chip.dataset.s === "ok") {
        if (confirm('Parar de salvar em "' + handle.name + '"?\n(Os dados continuam salvos no navegador.)')) {
          handle = null;
          await hset(null);
          setState("off");
        }
        return;
      }
      if (handle) {
        if ((await handle.requestPermission({ mode: "readwrite" })) === "granted") {
          await afterConnect();
          return;
        }
      }
      const existing = confirm(
        "Salvar automaticamente em um arquivo .json\n\n" +
          "OK = já tenho um arquivo (escolher e carregar os dados dele)\n" +
          "Cancelar = criar um arquivo novo com os dados atuais"
      );
      if (existing) {
        const [h] = await showOpenFilePicker({ types: TYPES, excludeAcceptAllOption: true });
        if ((await h.requestPermission({ mode: "readwrite" })) !== "granted") return;
        handle = h;
        await hset(h);
        const txt = await (await h.getFile()).text();
        let d;
        try {
          d = JSON.parse(txt);
        } catch (e) {}
        if (!d || !d.m) {
          alert("Este arquivo não parece ser um backup do Meus Gastos.");
          handle = null;
          await hset(null);
          return;
        }
        if (confirm("Substituir os dados deste navegador pelos do arquivo?")) loadText(txt, +d._savedAt);
        else await writeNow();
      } else {
        handle = await showSaveFilePicker({ suggestedName: "meus-gastos.json", types: TYPES });
        await hset(handle);
        await writeNow();
        if (typeof toast === "function") toast("Arquivo conectado ✔");
      }
    } catch (e) {
      /* escolha cancelada */
    }
  };

  setState("off");
  if (FS)
    hget().then(async (h) => {
      if (!h) return;
      handle = h;
      try {
        if ((await h.queryPermission({ mode: "readwrite" })) === "granted") await afterConnect();
        else setState("perm");
      } catch (e) {
        setState("perm");
      }
    });

  /* ---------------- 2) PAINEL LATERAL + 3) RESUMO ---------------- */
  const rail = document.createElement("aside"),
    side = document.createElement("div");
  rail.id = "rail";
  side.id = "sidesum";
  document.body.appendChild(rail);
  document.body.appendChild(side);

  function drawRail() {
    const c = calc(cur);
    side.innerHTML = `<small>Sobra de ${mname(cur)}</small><b class="${c.left >= 0 ? "ok" : "no"}">${fmt(c.left)}</b>`;

    const parts = [
      ["Contas fixas", c.fx, "#0f766e"],
      ["Cartão", c.cd, "#3b82f6"],
      ["Gastos avulsos", c.av, "#f59e0b"],
      ["Dívidas que pago", c.dv, "#ef4444"],
      ["Pedidos da empresa", c.op, "#a855f7"],
      ["Guardado", c.sv, "#64748b"],
      ["Não identificado", Math.max(0, c.ug || 0), "#94a3b8"],
      ["Sobra", Math.max(0, c.left || 0), "#22c55e"],
    ]
      .map((p) => [p[0], +p[1] || 0, p[2]])
      .filter((p) => p[1] > 0.005);
    const tot = parts.reduce((s, p) => s + p[1], 0),
      R = 56,
      C = 2 * Math.PI * R;
    let off = 0;
    const arcs = parts
      .map((p) => {
        const len = (p[1] / tot) * C,
          s = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${p[2]}" stroke-width="18" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"/>`;
        off += len;
        return s;
      })
      .join("");
    const donut = `<svg class="donut" viewBox="0 0 140 140" role="img" aria-label="Para onde vai o dinheiro"><circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--in)" stroke-width="18"/>${arcs}<text x="70" y="65" text-anchor="middle" font-size="11" style="fill:var(--mu)">Sobra</text><text x="70" y="84" text-anchor="middle" font-size="15" font-weight="800" style="fill:var(--tx)">${fmt(c.left)}</text></svg>`;
    const legend = parts
      .map(
        (p) =>
          `<div class="rw"><div class="g1"><i class="dot" style="background:${p[2]}"></i>${p[0]}</div><div class="rt"><b>${fmt(p[1])}</b> <span class="mu" style="font-size:12px">${Math.round((p[1] / tot) * 100)}%</span></div></div>`
      )
      .join("");

    /* próximos vencimentos */
    const t0 = new Date(),
      today = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate()),
      pf = mg(now).pf || {},
      it = [];
    S.fixed.forEach((x) => {
      if (!x.day || pf[x.id]) return;
      const n = x.day - t0.getDate();
      if (n < -7) return;
      it.push({ n, t: x.desc, v: x.val, c: "no" });
    });
    S.debts.forEach((x) => {
      if (!x.due || x.paid) return;
      const n = daysTo(x.due);
      if (n < -7 || n > 45) return;
      it.push({
        n,
        t: (x.type === "owe" ? "Pagar " : "Receber de ") + x.name,
        v: x.val / (+x.parcels || 1),
        c: x.type === "owe" ? "no" : "ok",
      });
    });
    it.sort((a, b) => a.n - b.n);
    const up = it
      .slice(0, 6)
      .map((x) => {
        const d = new Date(today.getTime() + x.n * 864e5);
        return `<div class="rw"><div class="dt${x.n < 0 ? " late" : ""}"><b>${d.getDate()}</b><small>${shortM(ymOf(d))}</small></div><div class="g1"><b>${esc(x.t)}</b><small>${when(x.n)}</small></div><b class="${x.c}">${fmt(x.v)}</b></div>`;
      })
      .join("");

    rail.innerHTML =
      `<div class="card"><h3>🍩 Para onde vai o dinheiro</h3><small class="hint" style="text-transform:capitalize">${lab(cur)}</small>${donut}${legend || '<div class="empty">Sem movimentos neste mês.</div>'}</div>` +
      `<div class="card"><h3>⏰ Próximos vencimentos</h3>${up || '<div class="empty">Nada para os próximos dias 🎉</div>'}</div>` +
      `<div class="card"><h3>🐷 Guardado</h3><div class="rw tot" style="border:0"><span>Caixinha + Tesouro</span><b class="ok">${fmt(bal("cx") + bal("td"))}</b></div></div>`;
  }

  const _render = render;
  render = function () {
    _render();
    try {
      drawRail();
    } catch (e) {}
  };
  try {
    drawRail();
  } catch (e) {}
})();