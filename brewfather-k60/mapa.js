// Mapeamento de uma receita do Brewfather para o payload de criação de
// receita da controladora EZBrew / K60 (POST /receita, firmware v9.0).
//
// Modelo da controladora (confirmado por engenharia reversa do firmware v9.0
// + telas do app oficial):
//
// CHAVES CONFIRMADAS na .rodata do firmware (grupo de PARSE do POST /receita,
// distinto do grupo de SAÍDA do /status que usa tipoEtapaReceita/
// nomeEtapaReceita/nomeAdicao):
//
//   Receita = { nome, etapas: [Etapa, ...] }
//   Etapa   = {
//     tipo,               // o tipo da etapa (dropdown "Nome da Etapa" no app)
//     nome,               // Mostura -> sub-tipo de enzima; senão == tipo
//     iTemperatura,       // °C         (Mostura, Dosagem, Resfriamento, FWH, Hop Stand, Kettle Souring)
//     iRampa,             // min         (não há campo no app -> 0)
//     iTempo,             // min         (Mostura, Fervura, Whirlpool, Descanso, Hop Stand; horas p/ Kettle Souring)
//     bPump,              // recirculação
//     bBeep,              // emitir alerta
//     bActive,            // ativar etapa
//     iDosagem,           // litros      (só Dosagem d'agua)
//     adicoes: [ { nome, iTempo } ]   // adições da etapa (nome fixo + min restantes)
//   }
//
// Regras de validação do firmware que o payload precisa respeitar:
//   - pelo menos uma etapa;
//   - tipo válido (um dos TIPOS);
//   - se tipo == "Mostura", nome ∈ sub-tipos de mostura;
//   - se tipo != "Mostura", nome == tipo;
//   - nome nunca "Mostura".
//
// O que NÃO fazemos: nada de decocção na panela. Quando a receita do
// Brewfather tem passo de decocção, mantemos a mostura base no patamar e
// emitimos um AVISO para o cervejeiro puxar o volume para a outra panela.

const TIPOS = [
  "Dosagem d'agua", "Mostura", "Fervura", "Whirlpool lento", "Whirlpool rapido",
  "Descanso", "Resfriamento", "Kettle Souring", "First Wort Hop", "Hop Stand",
];

// sub-tipos do dropdown "Tipo de Mostura", na ordem do app
const MOSTURA_SUBTIPOS = [
  "Infusao", "Beta-Glucanase", "Protease", "Beta-Amilase",
  "Beta&Alfa Amilase", "Alfa-Amilase", "Mash Out",
];

// recirculação (bPump) desligada nestes tipos (confirmado nas receitas reais
// da controladora: Fervura/Whirlpool/Descanso/Resfriamento vêm com bPump:false)
const SEM_RECIRC = new Set(["Fervura", "Whirlpool lento", "Whirlpool rapido", "Descanso", "Resfriamento"]);

// temperatura de fervura no dispositivo (receitas reais usam 100 °C)
const TEMP_FERVURA = 100;

// nomes de adição aceitos (dropdown fixo do app; firmware v9.1). Todos <= 18 ch.
const ADICAO_NOMES = [
  "Add. Acido", "Add. Adjuntos", "Add. Clarificante", "Add. Enzimas",
  "Add. Especiarias", "Add. Malte Torrado", "Add. Nutriente", "Add. Sais",
  "Derrubar Malte", "Hidratar Levedura", "Lplo Amargor", "Lplo Amargor/Sabor",
  "Lupulo Aroma", "Lupulo Sabor", "Medir Densidade", "Medir pH",
  "Mexer Cama Malte", "Outros", "Pesar Ingrediente", "Preparar Chiller",
  "Preparar Fermtdor", "Teste Iodo",
];

// teto do nome da receita, CONFIRMADO no device real: 18 aceita, 19 rejeita
// com retVal:5 "Nome da receita estrapolou o tamanho."
const MAX_NOME_RECEITA = 18;

function arred(n) { return Math.round(n); }

// abrevia um nome para caber em `max` chars de forma legível (não corte cru):
// 1) normaliza espaços; 2) se couber, mantém; 3) tira vogais internas das
// palavras mais longas (mantém 1ª letra), da maior pra menor, até caber;
// 4) se ainda estourar, corta. Serve de SUGESTÃO editável na UI.
function abreviarNome(nome, max) {
  max = max || MAX_NOME_RECEITA;
  let s = String(nome == null ? "" : nome).replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const VOGAIS = /[aeiouáàâãäéèêëíìîïóòôõöúùûü]/gi;
  const devowel = (w) => (w.length <= 3 ? w : w[0] + w.slice(1).replace(VOGAIS, ""));
  const palavras = s.split(" ");
  const ordem = palavras.map((_, i) => i).sort((a, b) => palavras[b].length - palavras[a].length);
  for (const i of ordem) {
    if (palavras.join(" ").length <= max) break;
    palavras[i] = devowel(palavras[i]);
  }
  s = palavras.join(" ");
  return s.length <= max ? s : s.slice(0, max).trim();
}

// sub-tipo de mostura pela temperatura do patamar (faixas de enzima).
// É só o rótulo mostrado; quem controla é a temperatura.
function subtipoMosturaPorTemp(t) {
  if (t >= 76) return "Mash Out";
  if (t >= 70) return "Alfa-Amilase";
  if (t >= 66) return "Beta&Alfa Amilase";
  if (t >= 60) return "Beta-Amilase";
  if (t >= 50) return "Protease";
  if (t >= 40) return "Beta-Glucanase";
  return "Infusao";
}

function semAcento(s) {
  return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// escolhe o sub-tipo de mostura a partir do NOME do passo no Brewfather;
// se o nome não bater com nenhum sub-tipo, cai para a faixa de temperatura.
// A K60 não guarda texto livre, então o nome do Brewfather só pode virar um
// dos sub-tipos fixos — este é o "mesmo nome" possível.
function subtipoMostura(nomePasso, temp) {
  const n = semAcento(nomePasso);
  if (n) {
    // match direto com um sub-tipo (ignorando acento/caixa)
    for (const sub of MOSTURA_SUBTIPOS) {
      if (semAcento(sub) === n) return sub;
    }
    // apelidos comuns do Brewfather / BeerSmith
    if (/\bmash\s*out\b/.test(n)) return "Mash Out";
    if (/glucan/.test(n)) return "Beta-Glucanase";
    if (/prote/.test(n)) return "Protease"; // protease / protein rest
    if (/ferulic/.test(n)) return "Protease";
    if (/beta.?&?.?alfa|beta.?&?.?alpha|dupla|combined|sacarifica|sacchar|conversion/.test(n)) return "Beta&Alfa Amilase";
    if (/beta.?(amila|amyla)/.test(n)) return "Beta-Amilase";
    if (/(alfa|alpha).?(amila|amyla)/.test(n)) return "Alfa-Amilase";
    if (/infus|mash\s*in|dough/.test(n)) return "Infusao";
  }
  return subtipoMosturaPorTemp(Number(temp));
}

// uma adição (confirmado por round-trip na controladora): array TOP-LEVEL da
// receita, cada item aponta a etapa pelo índice 0-based `id_etapa`. `tempo` em
// MINUTOS RESTANTES do patamar. `id_receita` a controladora atribui sozinha.
function adicao(idEtapa, nome, tempo) {
  return { nome, id_etapa: idEtapa, tempo: arred(tempo), bActive: true, executed: false };
}

// monta uma etapa completa com defaults; nome default = tipo (regra do firmware).
// Chaves do parser do firmware (POST /receita): tipo, nome, iTemperatura,
// iRampa, iTempo, bPump, bBeep, bActive, iDosagem. As adições NÃO ficam dentro
// da etapa — vão no array top-level `adicoes` apontando por id_etapa.
function etapa(tipo, campos = {}) {
  const nome = campos.nome != null ? campos.nome : tipo;
  return {
    tipo,
    nome,
    iTemperatura: campos.iTemperatura != null ? arred(campos.iTemperatura) : 0,
    iRampa: campos.iRampa != null ? arred(campos.iRampa) : 1,
    iTempo: campos.iTempo != null ? arred(campos.iTempo) : 0,
    bPump: campos.bPump != null ? campos.bPump : !SEM_RECIRC.has(tipo),
    bBeep: campos.bBeep != null ? campos.bBeep : true,
    bActive: campos.bActive != null ? campos.bActive : true,
    iDosagem: campos.iDosagem != null ? campos.iDosagem : 0,
  };
}

// nome de adição (lista fixa) para um lúpulo, pelo uso e tempo
function nomeAdicaoLupulo(use, time) {
  const u = String(use || "").toLowerCase();
  if (["aroma", "whirlpool", "hopstand", "hop stand"].includes(u)) return "Lupulo Aroma";
  if (u === "first wort") return "Lplo Amargor";
  const t = Number(time) || 0;
  if (t >= 30) return "Lplo Amargor";
  if (t >= 10) return "Lplo Amargor/Sabor";
  return "Lupulo Sabor";
}

// nome de adição (lista fixa) para um "misc" do Brewfather, pelo nome/tipo
function nomeAdicaoMisc(m) {
  const n = semAcento(m.name) + " " + String(m.type || "").toLowerCase();
  if (/whirlfloc|irish|clarif|protafloc|gelatin|isinglass|carrage/.test(n)) return "Add. Clarificante";
  if (/nutr|fermaid|yeast\s*nutrient/.test(n)) return "Add. Nutriente";
  if (/enzim|enzyme|amylase|amiloglu/.test(n)) return "Add. Enzimas";
  if (/acid|acido|lactic|phosph|ph\b/.test(n)) return "Add. Acido";
  if (/gypsum|cloreto|chloride|calcium|caso4|cacl|epsom|sulfate|sulfato|sal|salt|bicarb|baking/.test(n)) return "Add. Sais";
  if (/spice|especiar|coriander|orange|pepper|cardamom|canela|cinnamon/.test(n)) return "Add. Especiarias";
  return "Add. Adjuntos";
}

// ---------- normalização dos lúpulos do Brewfather ----------

function usoLupulo(h) { return String(h.use || "").toLowerCase(); }

function nomeCurto(s, n) {
  s = String(s == null ? "" : s).trim();
  return s.length > n ? s.slice(0, n) : s;
}

// ---------- mapeamento principal ----------

// recipe: objeto de receita do Brewfather (GET /recipes/:id).
// opts.tempPitch: temperatura alvo do resfriamento (°C); default = 1º passo da
//   fermentação da receita, senão 20.
function mapear(recipe, opts = {}) {
  const avisos = [];
  const etapas = [];
  // adições: array TOP-LEVEL da receita (irmão de etapas). Cada item aponta a
  // etapa pelo índice 0-based (id_etapa). Montamos aqui conforme as etapas são
  // empilhadas e anexamos no fim.
  const adicoes = [];
  const idxMostura = []; // índices das etapas de mostura (na ordem)
  let idxFervura = -1, idxHopStand = -1;

  const r = recipe || {};
  // nome: se a UI passar opts.nome (campo editável), respeita (só garante o
  // teto). Senão, abrevia o nome do Brewfather pra caber nos 18 chars.
  let nomeReceita;
  if (opts.nome != null) {
    nomeReceita = nomeCurto(String(opts.nome).replace(/\s+/g, " ").trim(), MAX_NOME_RECEITA);
  } else {
    nomeReceita = abreviarNome(r.name || "Receita", MAX_NOME_RECEITA);
    const orig = String(r.name || "").replace(/\s+/g, " ").trim();
    if (orig && orig !== nomeReceita) {
      avisos.push(`Nome "${orig}" passa de ${MAX_NOME_RECEITA} caracteres (limite da K60); sugerido "${nomeReceita}". Edite no campo "Nome na K60" se quiser.`);
    }
  }

  // alerta opcional de decocção dentro da mostura (nome da lista fixa) — só
  // apita; a panela não tem nome "Decocção", então usa "Outros" ou
  // "Mexer Cama Malte". "" = sem alerta (só aviso).
  const alertaDec = ["Outros", "Mexer Cama Malte"].includes(opts.decoccaoAlerta) ? opts.decoccaoAlerta : "";

  // 1) Mostura
  const mashSteps = (r.mash && Array.isArray(r.mash.steps)) ? r.mash.steps : [];
  let ultimaTempMostura = null;
  for (const s of mashSteps) {
    const temp = Number(s.stepTemp);
    if (!Number.isFinite(temp)) continue;
    ultimaTempMostura = temp;
    const tempo = Number(s.stepTime) || 0;
    const sub = subtipoMostura(s.name, temp);
    const ehDecoccao = String(s.type || "").toLowerCase() === "decoction";
    const idx = etapas.push(etapa("Mostura", { nome: sub, iTemperatura: temp, iTempo: tempo })) - 1;
    idxMostura.push(idx);
    if (ehDecoccao && alertaDec) adicoes.push(adicao(idx, alertaDec, tempo)); // apita no início do patamar
    if (ehDecoccao) {
      avisos.push(
        `Passo de mostura "${s.name || sub}" a ${arred(temp)} °C é DECOCÇÃO no Brewfather. ` +
        `A K60 mantém só a mostura base — puxe o volume da decocção para a outra panela, ferva e devolva manualmente.` +
        (alertaDec ? ` (Alerta "${alertaDec}" cravado no início do patamar.)` : ""),
      );
    }
    if (Number(s.rampTime) > 0) {
      avisos.push(`O passo "${s.name || sub}" tem rampa de ${arred(s.rampTime)} min no Brewfather; o app da K60 não tem campo de rampa, então ela não foi enviada.`);
    }
  }
  if (!mashSteps.length) avisos.push("A receita não tem passos de mostura no Brewfather.");

  const hops = Array.isArray(r.hops) ? r.hops : [];
  const miscs = Array.isArray(r.miscs) ? r.miscs : [];

  // 2) First Wort Hop
  const fwh = hops.filter((h) => usoLupulo(h) === "first wort");
  if (fwh.length) {
    const tempFwh = ultimaTempMostura != null ? ultimaTempMostura : 75;
    etapas.push(etapa("First Wort Hop", { iTemperatura: tempFwh }));
    avisos.push(`First Wort Hop: adicione no início da coleta do mosto — ${fwh.map((h) => nomeCurto(h.name, 24)).join(", ")}.`);
  }

  // 3) Fervura: UMA etapa; as adições (lúpulo + miscs) entram no array
  //    top-level apontando essa etapa, cada uma com tempo = min restantes.
  const boilTime = Number(r.boilTime) || 60;
  idxFervura = etapas.push(etapa("Fervura", { iTemperatura: TEMP_FERVURA, iTempo: boilTime })) - 1;
  const adFervura = [];
  hops.filter((h) => usoLupulo(h) === "boil").forEach((h) => {
    const t = Math.max(0, Math.min(boilTime, Number(h.time) || 0));
    adFervura.push(adicao(idxFervura, nomeAdicaoLupulo(h.use, h.time), t));
  });
  // sais e ácidos NÃO entram na fervura: vão para a primeira etapa (química
  // da água, no mash-in). Tudo que não for sal/ácido segue o uso normal.
  const ehSalOuAcido = (m) => ["Add. Sais", "Add. Acido"].includes(nomeAdicaoMisc(m));
  miscs.filter((m) => String(m.use || "").toLowerCase() === "boil" && !ehSalOuAcido(m)).forEach((m) => {
    const t = Math.max(0, Math.min(boilTime, Number(m.time) || 0));
    adFervura.push(adicao(idxFervura, nomeAdicaoMisc(m), t));
  });
  adFervura.sort((a, b) => b.tempo - a.tempo);
  adicoes.push(...adFervura);

  // 4) Hop Stand / Whirlpool (aroma): etapa Hop Stand com as adições de aroma
  const aroma = hops.filter((h) => ["aroma", "whirlpool", "hopstand", "hop stand"].includes(usoLupulo(h)));
  if (aroma.length) {
    const temp = aroma.reduce((min, h) => {
      const t = Number(h.temp);
      return Number.isFinite(t) && t < min ? t : min;
    }, 85);
    const tempo = aroma.reduce((mx, h) => Math.max(mx, Number(h.time) || 0), 0) || 15;
    idxHopStand = etapas.push(etapa("Hop Stand", { iTemperatura: temp, iTempo: tempo })) - 1;
    aroma.forEach((h) => adicoes.push(adicao(idxHopStand, "Lupulo Aroma", Math.min(tempo, Number(h.time) || tempo))));
  }

  // 5) Resfriamento
  let tempPitch = opts.tempPitch;
  if (tempPitch == null) {
    const fs = r.fermentation && Array.isArray(r.fermentation.steps) ? r.fermentation.steps : [];
    tempPitch = fs.length && Number.isFinite(Number(fs[0].stepTemp)) ? Number(fs[0].stepTemp) : 20;
  }
  etapas.push(etapa("Resfriamento", { iTemperatura: tempPitch }));

  // avisos: itens que a K60 não representa
  const dry = hops.filter((h) => usoLupulo(h) === "dry hop");
  if (dry.length) avisos.push(`Dry hop não entra na panela (é na fermentação): ${dry.map((h) => nomeCurto(h.name, 24)).join(", ")}.`);
  // miscs de mostura/sparge (fora sal/ácido): adição na última etapa de mostura
  const miscsMostura = miscs.filter((m) => ["mash", "sparge"].includes(String(m.use || "").toLowerCase()) && !ehSalOuAcido(m));
  if (miscsMostura.length) {
    const idxUlt = idxMostura.length ? idxMostura[idxMostura.length - 1] : -1;
    if (idxUlt >= 0) {
      const tMostura = etapas[idxUlt].iTempo;
      miscsMostura.forEach((m) => adicoes.push(adicao(idxUlt, nomeAdicaoMisc(m), Math.min(tMostura, Number(m.time) || 0))));
    } else {
      avisos.push(`Aditivos de mostura sem etapa de mostura para anexar: ${miscsMostura.map((m) => nomeCurto(m.name, 24)).join(", ")}.`);
    }
  }

  // sais e ácidos → primeira etapa. Vários sais viram UMA única adição.
  if (etapas.length) {
    const tPrimeira = etapas[0].iTempo;
    const adQuimica = [];
    const acidos = miscs.filter((m) => nomeAdicaoMisc(m) === "Add. Acido");
    if (acidos.length) adQuimica.push(adicao(0, "Add. Acido", tPrimeira));
    const temSal = miscs.some((m) => nomeAdicaoMisc(m) === "Add. Sais");
    if (temSal) adQuimica.push(adicao(0, "Add. Sais", tPrimeira));
    adicoes.unshift(...adQuimica);
  }

  return { receita: { nome: nomeReceita, etapas, adicoes }, avisos };
}

// monta a requisição HTTP de criação (POST /receita)
function requisicao(baseUrl, receita) {
  const url = String(baseUrl || "").replace(/\/+$/, "") + "/receita";
  return {
    method: "POST",
    url,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(receita),
  };
}

function comandoCurl(baseUrl, receita) {
  const req = requisicao(baseUrl, receita);
  const corpo = JSON.stringify(receita, null, 2).replace(/'/g, "'\\''");
  return `curl -X POST '${req.url}' \\\n  -H 'content-type: application/json' \\\n  -d '${corpo}'`;
}

const K60Mapa = {
  TIPOS, MOSTURA_SUBTIPOS, ADICAO_NOMES, subtipoMosturaPorTemp, subtipoMostura,
  nomeAdicaoLupulo, nomeAdicaoMisc, adicao, etapa, mapear, requisicao, comandoCurl,
  abreviarNome, MAX_NOME_RECEITA,
};
if (typeof window !== "undefined") window.K60Mapa = K60Mapa;
if (typeof module !== "undefined" && module.exports) module.exports = K60Mapa;
