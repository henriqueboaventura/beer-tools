// Lógica pura extraída de app.js — sem DOM, sem localStorage, sem module-
// level closures (`timer`/`state`). Cada função recebe tudo que precisa
// como argumento e devolve um resultado, sem ler nem escrever nada por
// fora — é o que permite testar em Node sem simular um navegador inteiro
// (ver tests/app-core.test.js).
//
// app.js continua com funções de mesmo nome (fmtNum, effectiveRows etc.)
// — a maioria delas agora é só um alias direto pra cá; timerStarted,
// activeStepIndex, isTimerFinished, effectiveRows e maybeAlarm viram
// wrappers finos que só repassam `timer`/`state` (que só existem lá) pras
// versões puras daqui.
//
// Por que isso existe: P1, P3, P5, P6, P7, N1, N3, N4, N9 e Q13 — a
// maioria dos achados graves/críticos de cinco rodadas de auditoria —
// eram bugs nessa mesma família de lógica (deslocamento por atraso,
// repetição de alarme, faixas de severidade, exibição de fervura). Até
// aqui, nada disso tinha teste automatizado; só métodos.js tinha.

// A etapa 0 (Mash In/Empastar) sempre tem duração zero — sem essa guarda,
// o alarme disparava no instante exato de apertar "Iniciar" (achado Q13).
const ALARM_MAX_REPEATS = 4;
const ALARM_REPEAT_EVERY_MIN = 2;

function fmtNum(n, digits = 1) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

function splitHM(totalMin) {
  let h = Math.floor(totalMin / 60);
  let m = Math.round(totalMin - h * 60);
  if (m === 60) { m = 0; h += 1; }
  return { h, m };
}

function fmtHM(totalMin) {
  const { h, m } = splitHM(totalMin);
  if (h <= 0) return `${m}min`;
  return `${h}h${String(m).padStart(2, "0")}min`;
}

function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function defaultAlarmState() {
  return { index: -1, count: 0, lastAtMin: -Infinity };
}

// 3 faixas, não 2 (achado N3, 2ª leitura): até 50% não precisa de aviso;
// 50-60% o texto tranquiliza (é o teto que a literatura de fato usa);
// acima de 60% ALARMA — nenhum programa publicado vai tão longe.
function volumeSeverity(fraction) {
  if (fraction >= 0.6) return "alarm";
  if (fraction >= 0.5) return "big";
  return "normal";
}

// Espessura da 1ª parcela da pseudo-decocção — piso publicado de 2,5 L/kg
// (Brücklmeier), 3,0 mais confortável (achado V1 da especificação).
function pseudoEspessuraSeverity(esp) {
  if (esp < 2.5) return "alarm";
  if (esp < 3.0) return "warn";
  return "normal";
}

// sanitizeParams vive em methods.js (v1.11.1) — pura, mesmo padrão que as
// funções daqui, mas fica lá porque também é usada por defaultParams/
// computeSchedule dentro do próprio motor. Nada a fazer aqui.

// Decide se a panela de fervura tem algo pra mostrar nesta linha da
// escada/gráfico — "vazia" (null) fora de qualquer puxada; durante uma
// puxada com mais de um retorno (Dupla Aprimorada), mostra a temperatura
// de fervura enquanto o resto ainda está esperando a próxima adição
// (achado N4, 2ª leitura — antes "descia" pra temperatura da mostura
// assim que a 1ª de várias adições retornava, como se a panela tivesse
// esvaziado). Muda `rows` no lugar (mesmo padrão de annotateRealPlateauTimes
// em methods.js) e devolve pra encadear.
function annotateDisplayBoil(rows, fervuraTemp) {
  let kettleActive = false;
  let waiting = false;
  for (const r of rows) {
    if (r.pullsDecoction) { kettleActive = true; waiting = false; }
    if (kettleActive) {
      if (r.isFinalReturn) {
        r.displayBoil = r.boil;
      } else if (waiting || (r.returnsDecoction && !r.isFinalReturn)) {
        r.displayBoil = fervuraTemp;
      } else if (r.boil !== null && r.boil !== undefined) {
        r.displayBoil = r.boil;
      } else {
        r.displayBoil = null;
      }
      if (r.returnsDecoction && !r.isFinalReturn) waiting = true;
    } else {
      r.displayBoil = null;
    }
    if (r.isFinalReturn) { kettleActive = false; waiting = false; }
  }
  return rows;
}

// undefined = ainda não começou (nenhum "Iniciar" apertado nesta sessão de
// brassagem); um número = índice da etapa ativa agora. Nunca aponta pra
// além de rows.length (aí o programa está concluído).
function isTimerStarted(timer) {
  return timer.running || timer.accumulatedMs > 0 || timer.actualStepEndMin.length > 0;
}

function computeActiveStepIndex(timer, rowsLength) {
  if (!isTimerStarted(timer)) return -1;
  return Math.min(timer.actualStepEndMin.length, rowsLength);
}

function computeIsTimerFinished(rowsLength, actualStepEndMinLength) {
  return rowsLength > 0 && actualStepEndMinLength >= rowsLength;
}

// Desloca o plano estático (rows) pelo atraso/adiantamento acumulado até
// agora: etapas já confirmadas ganham o horário REAL em que terminaram; as
// que faltam mantêm a duração planejada, só que a partir do último
// checkpoint real (em vez de acumular a partir do zero). Sem isso, se uma
// etapa demorar mais que o previsto, todo o resto do cronograma mostrado
// continuaria com os horários originais, como se o atraso não tivesse
// acontecido — o cabeçalho e a escada discordavam entre si (achado P1, 3ª
// leitura).
function computeEffectiveRows(rows, actualStepEndMin) {
  const activeIndex = actualStepEndMin.length;
  if (!rows.length || activeIndex === 0) return rows;
  const baseReal = actualStepEndMin[Math.min(activeIndex, rows.length) - 1];
  const basePlanned = rows[Math.min(activeIndex, rows.length) - 1].totalMin;
  const drift = baseReal - basePlanned;
  let prevTotal = 0;
  return rows.map((r, i) => {
    const effTotalMin = i < activeIndex ? actualStepEndMin[i] : r.totalMin + drift;
    const effRow = { ...r, totalMin: effTotalMin, duration: Math.max(0, effTotalMin - prevTotal) };
    prevTotal = effTotalMin;
    return effRow;
  });
}

// Decide se o alarme deve disparar agora, e qual o próximo estado
// persistido (timer.alarm) — separado do EFEITO (som/vibração, gravar no
// localStorage), que continua em app.js, porque esses efeitos não fazem
// sentido fora de um navegador de verdade. É aqui que morava o achado N1
// (4ª leitura): `nowMin` chegando já limitado ao fim do cronograma fazia
// `nowMin - lastAtMin` zerar pra sempre na última etapa, e o alarme
// parava de repetir bem na hora em que mais fazia falta.
function nextAlarmState(alarmState, opts) {
  const { running, finished, activeIndex, rowsLength, targetTotalMin, activeDuration, nowMin, maxRepeats, repeatEveryMin } = opts;
  if (!running || finished || activeIndex < 0 || activeIndex >= rowsLength || nowMin === null) {
    return { fire: false, alarmState };
  }
  if (targetTotalMin === null || targetTotalMin === undefined || targetTotalMin <= 0) {
    return { fire: false, alarmState };
  }
  // Achado Q13 (guarda acima) só protege a etapa 0 — mas QUALQUER etapa de
  // 0 minuto no meio do programa (uma rampa zerada, um Mash Out sem
  // repouso) herda o mesmo horário-alvo da etapa anterior: no instante em
  // que ela vira ativa, `nowMin >= targetTotalMin` já é verdade, e o
  // alarme dispara na hora — três dos oito métodos vêm assim de fábrica
  // (achado Y8, grave, décima primeira leitura). Uma etapa sem duração
  // não tem o que esperar; não tocar por ela.
  if (activeDuration !== null && activeDuration !== undefined && activeDuration <= 1e-9) {
    return { fire: false, alarmState };
  }
  if (nowMin < targetTotalMin - 1e-9) return { fire: false, alarmState };
  const current = alarmState.index !== activeIndex ? { index: activeIndex, count: 0, lastAtMin: -Infinity } : alarmState;
  if (current.count >= maxRepeats) return { fire: false, alarmState: current };
  if (nowMin - current.lastAtMin < repeatEveryMin) return { fire: false, alarmState: current };
  return { fire: true, alarmState: { index: activeIndex, count: current.count + 1, lastAtMin: nowMin } };
}

// Passo a passo em texto puro, para colar na receita. Usa o plano (não o
// cronograma deslocado pelo cronômetro): é o programa, não o registro de
// uma brassagem. Organizado por tina — o que fazer em cada uma e por
// quanto tempo; o horário em que cada etapa termina fica de fora (é o que
// o cronômetro resolve, não o que se anota na receita).
//   Tina de mostura: temperatura (e o tempo, quando a etapa é dela)
//   Tina de fervura: volume, temperatura e tempo, enquanto há decocção nela
function scheduleText(rows, { methodName, totalMin, mashVolumeL, fervuraTemp }) {
  const linhas = annotateDisplayBoil(rows.map((r) => ({ ...r })), fervuraTemp);
  const graus = (t) => `${fmtNum(t)} °C`;
  const litros = (l) => `${fmtNum(l)} L`;
  const minutos = (r) => (r.duration > 1e-9 ? [`${fmtNum(r.duration)} min`] : []);
  const aquece = (r) => /aquecimento/i.test(r.label);
  const out = [`Programa de mostura — ${methodName}`];
  const resumo = [`Tempo total: ${fmtHM(totalMin)}`];
  if (mashVolumeL !== undefined && mashVolumeL !== null) resumo.push(`Volume da mostura: ${litros(mashVolumeL)}`);
  out.push(resumo.join(" · "));
  let naFervura = 0; // litros de decocção na tina de fervura agora
  linhas.forEach((r, i) => {
    const mostura = [];
    const fervura = [];
    const temFervura = r.displayBoil !== null && r.displayBoil !== undefined;
    if (r.decoctionVolumeL !== undefined) {
      naFervura = r.decoctionVolumeL;
      fervura.push(`puxar ${litros(r.decoctionVolumeL)} da mostura (${fmtNum(r.decoctionFraction * 100, 0)}% do volume)`, ...minutos(r));
    } else if (r.returnsDecoction) {
      const volta = r.returnVolumeL !== undefined ? r.returnVolumeL : naFervura - (linhas[r.pullIndex].evaporatedL || 0);
      fervura.push(`devolver ${litros(volta)} para a mostura`, ...minutos(r));
      naFervura = r.isFinalReturn ? 0 : naFervura - volta;
    } else if (temFervura && r.boil !== r.displayBoil) {
      // decocção parada fervendo enquanto a mostura descansa (devolução em
      // partes, Dupla Aprimorada): a etapa é da mostura
      fervura.push(litros(naFervura), `manter ${graus(r.displayBoil)}`);
    } else if (temFervura) {
      fervura.push(litros(naFervura), (aquece(r) ? "aquecer até " : "") + graus(r.displayBoil), ...minutos(r));
    }
    const tempoNaFervura = fervura.length && !/^manter/.test(fervura[fervura.length - 1]);
    if (r.mash !== null && r.mash !== undefined) {
      const t = graus(r.mash);
      if (r.pseudoParcelaW1 !== undefined) mostura.push(`empastar ${fmtNum(r.pseudoParcelaG1)} kg de malte em ${litros(r.pseudoParcelaW1)} de água a ${t}`);
      else if (r.pseudoWaterAddL !== undefined) mostura.push(`adicionar ${litros(r.pseudoWaterAddL)} de água a ${graus(r.pseudoWaterAddTemp)}`, `fica em ${t}`);
      else if (r.pseudoMaltAddKg !== undefined) mostura.push(`adicionar ${fmtNum(r.pseudoMaltAddKg)} kg de malte seco`, `fica em ${t}`);
      else if (i === 0) mostura.push(`empastar a ${t}`);
      else if (r.returnsDecoction) mostura.push(`chega a ${t}`);
      else mostura.push((aquece(r) && !fervura.length ? "aquecer até " : "") + t);
      // o tempo fica com a tina onde a etapa acontece
      if (!tempoNaFervura) mostura.push(...minutos(r));
    }
    out.push("", `${i + 1}. ${r.label}`);
    if (mostura.length) out.push(`   Tina de mostura: ${mostura.join(" · ")}`);
    if (fervura.length) out.push(`   Tina de fervura: ${fervura.join(" · ")}`);
  });
  return out.join("\n");
}

const DecoccaoCoreExports = {
  ALARM_MAX_REPEATS,
  ALARM_REPEAT_EVERY_MIN,
  fmtNum,
  splitHM,
  fmtHM,
  fmtClock,
  defaultAlarmState,
  volumeSeverity,
  pseudoEspessuraSeverity,
  annotateDisplayBoil,
  isTimerStarted,
  computeActiveStepIndex,
  computeIsTimerFinished,
  computeEffectiveRows,
  nextAlarmState,
  scheduleText,
};
if (typeof window !== "undefined") window.DecoccaoCore = DecoccaoCoreExports;
if (typeof module !== "undefined" && module.exports) module.exports = DecoccaoCoreExports;
