// Mock local da controladora EZBrew / K60 — só para teste.
// Implementa o mínimo: CORS, GET /status, GET /receita/count e POST /receita,
// e LOGA o corpo de cada POST /receita no terminal para a gente ver a chamada
// exatamente como ela sai da ferramenta.
//
//   node brewfather-k60/scripts/mock-k60.js [porta]
//
// Depois aponte a ferramenta para http://localhost:<porta>.

const http = require("node:http");
const PORTA = Number(process.argv[2]) || 8099;
let contador = 0;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-requested-with");
}

const servidor = http.createServer((req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  const url = req.url.split("?")[0];

  if (req.method === "GET" && url === "/status") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({
      nomeReceita: "", tipoEtapaReceita: "", nomeEtapaReceita: "",
      temperaturaMosto: 24.5, setpointEtapa: 0, tempoRestante: 0,
      paused: false, serialNumber: "EZB-MOCK0000", versaoFW: "9.0",
    }));
  }

  if (req.method === "GET" && url === "/receita/count") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(String(contador));
  }

  if (req.method === "POST" && url === "/receita") {
    let corpo = "";
    req.on("data", (c) => { corpo += c; });
    req.on("end", () => {
      contador++;
      console.log("\n=== POST /receita (#" + contador + ") " + new Date().toISOString() + " ===");
      try {
        const r = JSON.parse(corpo);
        const adicoes = r.adicoes || [];
        console.log("nomeReceita:", r.nome, "| etapas:", (r.etapas || []).length, "| adicoes:", adicoes.length);
        (r.etapas || []).forEach((e, i) => {
          console.log(
            `  [${String(i).padStart(2, "0")}] ${e.tipo} / ${e.nome}` +
            ` T=${e.iTemperatura}°C t=${e.iTempo}min rampa=${e.iRampa} dos=${e.iDosagem}` +
            ` pump=${e.bPump} beep=${e.bBeep} ativa=${e.bActive}`);
          adicoes.filter((a) => a.id_etapa === i).forEach((a) => console.log(`         + ${a.nome} @ ${a.tempo}min`));
        });
        console.log("--- corpo cru ---");
        console.log(JSON.stringify(r));
      } catch (e) {
        console.log("corpo não-JSON:", corpo);
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ retVal: 0, sucesso: true, message: "Sucesso." }));
    });
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ retVal: 1, message: "Rota não encontrada no mock." }));
});

servidor.listen(PORTA, () => {
  console.log(`Mock K60 ouvindo em http://localhost:${PORTA}`);
  console.log("Aponte a ferramenta para essa URL e envie uma receita; o POST aparece aqui.");
});
