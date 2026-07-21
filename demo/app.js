/* =========================================================
   CT SOLUTION — mock data & interazioni (solo frontend)
   ========================================================= */

/* ---------- MOCK DATA ---------- */

const MANDANTI = ["FarmaDistrib SpA","Jigsaw Moda","ModaExpress","TechImport Srl","Chiapparino Logistica","Vinted Reselling","NordFood","EditoriaOggi"];

const VETTORI = ["DHL","SDA","GLS","Padroncino Rossi","Padroncino Bianchi","Padroncino Verdi","(non assegnato)"];

const STATI_SPEDIZIONE = ["In revisione","In staging","In sospeso","Parcheggio","Pronta per etichettatura"];

const SERVIZI_ACCESSORI = ["SMS preavviso","Consegna al piano","Assicurazione","Contrassegno"];

// quali servizi sono supportati da ciascun vettore
const COMPATIBILITA_VETTORE = {
  "DHL": ["SMS preavviso","Assicurazione"],
  "SDA": ["SMS preavviso","Assicurazione","Contrassegno"],
  "GLS": ["SMS preavviso","Consegna al piano","Assicurazione","Contrassegno"],
  "Padroncino Rossi": ["Consegna al piano","SMS preavviso"],
  "Padroncino Bianchi": ["Consegna al piano"],
  "Padroncino Verdi": ["SMS preavviso","Consegna al piano","Contrassegno"],
  "(non assegnato)": []
};

const CITTA = [
  {loc:"Modena", prov:"MO", cap:"41121"},
  {loc:"Bologna", prov:"BO", cap:"40121"},
  {loc:"Reggio Emilia", prov:"RE", cap:"42121"},
  {loc:"Carpi", prov:"MO", cap:"41012"},
  {loc:"Sassuolo", prov:"MO", cap:"41049"},
  {loc:"Parma", prov:"PR", cap:"43121"},
  {loc:"Ferrara", prov:"FE", cap:"44121"},
];

function randFrom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function pad(n,len){ return String(n).padStart(len,"0"); }

let shipmentSeq = 4800;
function makeShipment(overrides={}){
  shipmentSeq++;
  const city = randFrom(CITTA);
  const capValid = Math.random() > 0.25;
  const phoneValid = Math.random() > 0.3;
  const base = {
    id: `CT-2026-${pad(shipmentSeq,6)}`,
    mandante: randFrom(MANDANTI),
    destinatario: randFrom(["M. Bianchi","L. Ferrari","G. Colombo","S. Ricci","A. Romano","P. Marino","E. Greco","D. Conti"]),
    cap: capValid ? city.cap : String(10000+Math.floor(Math.random()*89999)),
    localita: city.loc,
    provincia: city.prov,
    capValida: capValid,
    telefono: phoneValid ? "+39 333 " + pad(Math.floor(Math.random()*10000000),7) : "nel campo note",
    telefonoValida: phoneValid,
    vettore: "(non assegnato)",
    stato: "In revisione",
    servizi: [],
  };
  return Object.assign(base, overrides);
}

let SHIPMENTS = [
  ...Array.from({length:6}, () => makeShipment({stato:"In revisione"})),
  ...Array.from({length:5}, () => makeShipment({stato:"In staging", vettore: randFrom(VETTORI.slice(0,6))})),
  ...Array.from({length:4}, () => makeShipment({stato:"Parcheggio", vettore: randFrom(VETTORI.slice(0,6)), capValida:true, telefonoValida:true})),
  ...Array.from({length:4}, () => makeShipment({stato:"Pronta per etichettatura", vettore: randFrom(VETTORI.slice(0,6)), capValida:true, telefonoValida:true})),
];

let selectedShipments = new Set();

// FLUSSI IN INGRESSO
const FLUSSI_CLIENTI = [
  {cliente:"Chiapparino Logistica", tipo:"CSV", stato:"ok", micro:"Istanza dedicata", regole:"Spedizioni per Modena → consegna al piano."},
  {cliente:"Jigsaw Moda", tipo:"TXT", stato:"ok", micro:"Istanza dedicata", regole:"Tutte le spedizioni → SMS di preavviso obbligatorio."},
  {cliente:"FarmaDistrib SpA", tipo:"CSV", stato:"errore", micro:"Configurazione condivisa", regole:"Controllo lotto/scadenza; blocco se temperatura non tracciata."},
  {cliente:"Vinted Reselling", tipo:"CSV", stato:"in coda", micro:"Configurazione condivisa", regole:"Colli singoli, nessun servizio accessorio di default."},
  {cliente:"ModaExpress", tipo:"TXT", stato:"ok", micro:"Istanza dedicata", regole:"Reso gratuito entro 14gg, etichetta pre-generata."},
  {cliente:"TechImport Srl", tipo:"CSV", stato:"ok", micro:"Configurazione condivisa", regole:"Assicurazione automatica sopra 500€ di valore dichiarato."},
  {cliente:"NordFood", tipo:"CSV", stato:"errore", micro:"Istanza dedicata", regole:"Catena del freddo: priorità massima in smistamento."},
  {cliente:"EditoriaOggi", tipo:"TXT", stato:"in coda", micro:"Configurazione condivisa", regole:"Consegna standard, nessuna regola custom."},
  {cliente:"Chiapparino Logistica – Farma", tipo:"CSV", stato:"ok", micro:"Istanza dedicata", regole:"Sottocontratto farmaceutico: firma obbligatoria alla consegna."},
  {cliente:"Jigsaw Moda – Outlet", tipo:"CSV", stato:"ok", micro:"Configurazione condivisa", regole:"Spedizioni outlet → nessuna assicurazione."},
  {cliente:"Vinted Reselling – Pro", tipo:"TXT", stato:"in coda", micro:"Istanza dedicata", regole:"Venditori Pro: borderò giornaliero automatico."},
  {cliente:"TechImport Srl – B2B", tipo:"CSV", stato:"ok", micro:"Istanza dedicata", regole:"Consegna solo giorni feriali, preavviso telefonico."},
];

// LISTINI
const LISTINI = [
  {id:"L-COST-001", nome:"Costo Nazionale Standard", tipo:"Costo", cliente:"—", inizio:"2025-01-01", fine:"2025-12-31",
    scaglioni:[
      {peso:"0–3 kg", volumetrico:"3 kg", base:4.20, fuel:0.35, tasse:0.10, magg:"—", agente:"—"},
      {peso:"3–10 kg", volumetrico:"10 kg", base:6.80, fuel:0.55, tasse:0.15, magg:"Isole +2,00€", agente:"—"},
      {peso:"10–30 kg", volumetrico:"30 kg", base:11.90, fuel:0.90, tasse:0.25, magg:"Isole +3,50€", agente:"—"},
    ]},
  {id:"L-VEND-001", nome:"Vendita Chiapparino Logistica", tipo:"Vendita", cliente:"Chiapparino Logistica", inizio:"2025-01-01", fine:"2025-12-31",
    scaglioni:[
      {peso:"0–3 kg", volumetrico:"3 kg", base:5.20, fuel:0.35, tasse:0.10, magg:"—", agente:"8%"},
      {peso:"3–10 kg", volumetrico:"10 kg", base:7.90, fuel:0.55, tasse:0.15, magg:"Isole +2,00€", agente:"8%"},
      {peso:"10–30 kg", volumetrico:"30 kg", base:10.50, fuel:0.90, tasse:0.25, magg:"Isole +3,50€", agente:"8%", perdita:true},
    ]},
  {id:"L-VEND-002", nome:"Vendita Jigsaw Moda", tipo:"Vendita", cliente:"Jigsaw Moda", inizio:"2025-03-01", fine:"2026-02-28",
    scaglioni:[
      {peso:"0–3 kg", volumetrico:"3 kg", base:5.80, fuel:0.35, tasse:0.10, magg:"—", agente:"6%"},
      {peso:"3–10 kg", volumetrico:"10 kg", base:8.60, fuel:0.55, tasse:0.15, magg:"Isole +2,00€", agente:"6%"},
    ]},
  {id:"L-VEND-002F", nome:"Vendita Jigsaw Moda (futuro)", tipo:"Vendita", cliente:"Jigsaw Moda", inizio:"2026-03-01", fine:"2027-02-28",
    scaglioni:[
      {peso:"0–3 kg", volumetrico:"3 kg", base:6.10, fuel:0.35, tasse:0.10, magg:"—", agente:"6%"},
      {peso:"3–10 kg", volumetrico:"10 kg", base:9.00, fuel:0.55, tasse:0.15, magg:"Isole +2,00€", agente:"6%"},
    ]},
  {id:"L-COST-002", nome:"Costo Extra-UE", tipo:"Costo", cliente:"—", inizio:"2025-01-01", fine:"2025-12-31",
    scaglioni:[
      {peso:"0–5 kg", volumetrico:"5 kg", base:14.00, fuel:1.20, tasse:0.40, magg:"Dogana +5,00€", agente:"—"},
    ]},
];

// LISTINO VETTORI / CARRIER RATE CARD
// Nota: struttura dati pensata per il carico di dati reali dal sistema di
// integrazione vettori (contratti, zone, scaglioni peso/volumetrico, resa);
// qui popolata con dati rappresentativi in attesa del feed reale.
const ZONE_VETTORE = ["Zona 1 (locale)","Zona 2 (nazionale)","Zona 3 (isole/disagiate)","Extra-UE"];
const RESE = ["DAP","DDP","EXW","Franco magazzino"];

let rateCardSeq = 0;
function makeRateCard(overrides={}){
  rateCardSeq++;
  return Object.assign({
    id: `RC-${pad(rateCardSeq,4)}`,
    vettore: "DHL",
    zona: "Zona 2 (nazionale)",
    pesoDa: 0,
    pesoA: 3,
    pesoVolumetrico: "3 kg",
    resa: "DAP",
    prezzo: 4.20,
  }, overrides);
}

let CARRIER_RATE_CARDS = [
  makeRateCard({vettore:"DHL", zona:"Zona 1 (locale)", pesoDa:0, pesoA:3, pesoVolumetrico:"3 kg", resa:"DAP", prezzo:3.80}),
  makeRateCard({vettore:"DHL", zona:"Zona 2 (nazionale)", pesoDa:0, pesoA:3, pesoVolumetrico:"3 kg", resa:"DAP", prezzo:4.20}),
  makeRateCard({vettore:"DHL", zona:"Zona 2 (nazionale)", pesoDa:3, pesoA:10, pesoVolumetrico:"10 kg", resa:"DAP", prezzo:6.80}),
  makeRateCard({vettore:"DHL", zona:"Zona 3 (isole/disagiate)", pesoDa:0, pesoA:3, pesoVolumetrico:"3 kg", resa:"DDP", prezzo:6.10}),
  makeRateCard({vettore:"SDA", zona:"Zona 2 (nazionale)", pesoDa:0, pesoA:3, pesoVolumetrico:"3 kg", resa:"DAP", prezzo:4.00}),
  makeRateCard({vettore:"SDA", zona:"Zona 2 (nazionale)", pesoDa:3, pesoA:10, pesoVolumetrico:"10 kg", resa:"DAP", prezzo:6.50}),
  makeRateCard({vettore:"GLS", zona:"Zona 2 (nazionale)", pesoDa:0, pesoA:3, pesoVolumetrico:"3 kg", resa:"DDP", prezzo:4.50}),
  makeRateCard({vettore:"GLS", zona:"Extra-UE", pesoDa:0, pesoA:5, pesoVolumetrico:"5 kg", resa:"EXW", prezzo:14.00}),
  makeRateCard({vettore:"Padroncino Rossi", zona:"Zona 1 (locale)", pesoDa:0, pesoA:30, pesoVolumetrico:"30 kg", resa:"Franco magazzino", prezzo:11.90}),
];

const rateCardGrid = { sort:[] };

// UTENTI
const UTENTI = [
  {nome:"Marco Guidetti", ruolo:"Admin piattaforma", livello:1, permessi:["Spedizioni","Listini","Giacenze","Qapla","Utenti","Configurazioni","Flussi"]},
  {nome:"Elena Sartori", ruolo:"Operatore CT Solution", livello:2, permessi:["Spedizioni","Giacenze","Flussi"]},
  {nome:"Chiapparino Logistica (mandante)", ruolo:"Cliente mandante", livello:3, permessi:["Spedizioni (sola consultazione)","Giacenze"]},
  {nome:"Jigsaw Moda (mandante)", ruolo:"Cliente mandante", livello:3, permessi:["Spedizioni (sola consultazione)"]},
  {nome:"Cliente finale — S. Ricci", ruolo:"Cliente finale", livello:4, permessi:["Tracking pubblico"]},
  {nome:"Ilaria Conte", ruolo:"Customer care", livello:2, permessi:["Giacenze","Spedizioni (sola consultazione)"]},
];
const MODULI_PERMESSO = ["Spedizioni","Listini","Giacenze","Qapla","Flussi","Utenti","Configurazioni"];

// GIACENZE
const GIACENZE = [
  {id:"CT-2026-004711", dest:"L. Ferrari", motivo:"Destinatario assente (2° tentativo)", da:"3 giorni", stato:"aperta"},
  {id:"CT-2026-004698", dest:"G. Colombo", motivo:"Indirizzo incompleto", da:"1 giorno", stato:"aperta"},
  {id:"CT-2026-004650", dest:"P. Marino", motivo:"Rifiutato dal destinatario", da:"5 giorni", stato:"aperta"},
];

// QAPLA
const QAPLA_ORDINI = [
  {marketplace:"Amazon", ordine:"AMZ-77213", cliente:"S. Ricci", flusso:"Notifica da Amazon (push)", stato:"Spedizione generata"},
  {marketplace:"Shopify", ordine:"SHP-10042", cliente:"D. Conti", flusso:"Richiesta spedizione", stato:"In attesa"},
  {marketplace:"eBay", ordine:"EBY-99871", cliente:"A. Romano", flusso:"Richiesta spedizione", stato:"Errore"},
  {marketplace:"Vinted", ordine:"VNT-33110", cliente:"E. Greco", flusso:"Richiesta spedizione", stato:"Spedizione generata"},
  {marketplace:"Amazon", ordine:"AMZ-77298", cliente:"M. Bianchi", flusso:"Notifica da Amazon (push)", stato:"In attesa"},
];

// COLLI MADRE
const COLLI_MADRE = [
  {id:"BANC-3301", peso:"420 kg", dim:"120×80×140 cm", sotto:[
    {id:"CT-2026-004811", stato:"Consegnato"},
    {id:"CT-2026-004812", stato:"Consegnato"},
    {id:"CT-2026-004813", stato:"Non consegnato"},
  ]},
  {id:"BANC-3302", peso:"180 kg", dim:"100×80×90 cm", sotto:[
    {id:"CT-2026-004820", stato:"Consegnato"},
    {id:"CT-2026-004821", stato:"Consegnato"},
  ]},
  {id:"BANC-3303", peso:"305 kg", dim:"120×100×110 cm", sotto:[
    {id:"CT-2026-004830", stato:"Non consegnato"},
    {id:"CT-2026-004831", stato:"Non consegnato"},
    {id:"CT-2026-004832", stato:"Consegnato"},
    {id:"CT-2026-004833", stato:"Non consegnato"},
  ]},
];

// DIFFERENZIALI PESO/MISURE
const DIFFERENZIALI = [
  {id:"CT-2026-004650", pd:"5,0 kg", pr:"7,4 kg", dd:"30×20×20", dr:"34×24×22", diff:"+2,4 kg", impatto:"+2,50 €"},
  {id:"CT-2026-004698", pd:"2,0 kg", pr:"2,1 kg", dd:"20×15×10", dr:"20×15×10", diff:"+0,1 kg", impatto:"+0,00 €"},
  {id:"CT-2026-004711", pd:"12,0 kg", pr:"15,8 kg", dd:"40×30×30", dr:"45×35×34", diff:"+3,8 kg", impatto:"+6,10 €"},
  {id:"CT-2026-004821", pd:"1,5 kg", pr:"1,4 kg", dd:"15×15×10", dr:"15×15×10", diff:"−0,1 kg", impatto:"+0,00 €"},
];

// TRACKING mock
function mockTrackingResult(code){
  const stati = ["In transito","Consegnata","In giacenza"];
  const stato = randFrom(stati);
  return {
    code, stato,
    eventi: [
      {t:"Lun 20/07 · 08:12", label:"Presa in carico presso il mittente"},
      {t:"Lun 20/07 · 14:40", label:"Arrivo al centro di smistamento CT Solution"},
      {t:"Mar 21/07 · 07:05", label:"Assegnata al vettore per la consegna"},
      {t:"Mar 21/07 · 11:20", label: stato === "Consegnata" ? "Consegnata al destinatario" : (stato === "In giacenza" ? "Tentativo di consegna non riuscito — in giacenza" : "In transito verso il destinatario")},
    ]
  };
}

// OPERATIVITÀ
const VETTORI_OP = [
  {nome:"DHL", tipo:"Corriere esterno", bordero:false, app:false},
  {nome:"SDA", tipo:"Corriere esterno", bordero:false, app:false},
  {nome:"GLS", tipo:"Corriere esterno", bordero:false, app:false},
  {nome:"Padroncino Rossi", tipo:"Linea propria", bordero:true, app:true},
  {nome:"Padroncino Bianchi", tipo:"Linea propria", bordero:true, app:true},
  {nome:"Padroncino Verdi", tipo:"Linea propria", bordero:true, app:true},
];

// ARCHITETTURA TECNICA
let BROKER_STATE = {
  coda: 128,
  consumer: 6,
  servizi: [
    {nome:"Servizio Normalizzazione CAP", online:true},
    {nome:"Servizio Notifiche SMS", online:true},
    {nome:"Servizio Import Flussi Clienti", online:false},
    {nome:"Servizio Generazione Lettera di Vettura", online:true},
  ]
};
const RATE_LIMITS = [
  {vettore:"DHL", limite:60, volumeMin:38, nodi:["Nodo 1","Nodo 2"]},
  {vettore:"SDA", limite:40, volumeMin:41, nodi:["Nodo 1","Nodo 2","Nodo 3"]},
  {vettore:"GLS", limite:50, volumeMin:22, nodi:["Nodo 1"]},
];

/* ---------- UTILITY UI ---------- */

function showToast(msg, type=""){
  const stack = document.getElementById("toast-stack");
  const el = document.createElement("div");
  el.className = "toast" + (type ? ` toast-${type}` : "");
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transition="opacity .3s"; setTimeout(()=>el.remove(),300); }, 3200);
}

function openModal(titleHTML, bodyHTML, footHTML){
  const overlay = document.getElementById("modal-overlay");
  const container = document.getElementById("modal-container");
  container.innerHTML = `
    <div class="modal-head"><h2>${titleHTML}</h2><button class="modal-close" id="modal-close-btn">✕</button></div>
    <div class="modal-body">${bodyHTML}</div>
    ${footHTML ? `<div class="modal-foot">${footHTML}</div>` : ""}
  `;
  overlay.classList.add("is-open");
  document.getElementById("modal-close-btn").addEventListener("click", closeModal);
}
function closeModal(){
  const overlay = document.getElementById("modal-overlay");
  overlay.classList.remove("is-open");
  overlay.classList.remove("is-drawer");
  document.getElementById("modal-container").classList.remove("modal-drawer");
}
document.addEventListener("click", (e)=>{
  if(e.target.id === "modal-overlay") closeDrawerRoute();
});

// Drawer: variante "docked a destra" del modal, usata per la vista di dettaglio
// entità (es. spedizione), navigabile via routing dinamico #/shipment/:id
function openDrawer(titleHTML, bodyHTML){
  const overlay = document.getElementById("modal-overlay");
  const container = document.getElementById("modal-container");
  container.classList.add("modal-drawer");
  container.innerHTML = `
    <div class="modal-head"><h2>${titleHTML}</h2><button class="modal-close" id="modal-close-btn">✕</button></div>
    <div class="modal-body">${bodyHTML}</div>
  `;
  overlay.classList.add("is-open");
  overlay.classList.add("is-drawer");
  document.getElementById("modal-close-btn").addEventListener("click", closeDrawerRoute);
}
function closeDrawerRoute(){
  if(location.hash.startsWith("#/shipment/")) history.pushState("", document.title, location.pathname + location.search);
  closeModal();
}

function badgeForCapState(valid){
  return valid ? `<span class="badge badge-success">CAP valido</span>` : `<span class="badge badge-warning">CAP da correggere</span>`;
}
function badgeForStato(stato){
  const map = {
    "In revisione":"badge-neutral","In staging":"badge-blue","In sospeso":"badge-warning",
    "Parcheggio":"badge-blue","Pronta per etichettatura":"badge-success"
  };
  return `<span class="badge ${map[stato]||'badge-neutral'}"><span class="badge-dot"></span>${stato}</span>`;
}

/* ---------- NAVIGATION ---------- */

function setupNav(){
  document.querySelectorAll(".nav-item").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const view = btn.dataset.view;
      document.querySelectorAll(".view").forEach(v=>v.classList.remove("is-active"));
      document.getElementById(`view-${view}`).classList.add("is-active");
    });
  });

  document.querySelectorAll(".subtabs").forEach(group=>{
    group.querySelectorAll(".subtab").forEach(tab=>{
      tab.addEventListener("click", ()=>{
        group.querySelectorAll(".subtab").forEach(t=>t.classList.remove("is-active"));
        tab.classList.add("is-active");
        const parent = group.parentElement;
        const target = tab.dataset.subview;
        parent.querySelectorAll(":scope > .subview").forEach(p=>p.classList.remove("is-active"));
        parent.querySelector(`:scope > .subview[data-subview-panel="${target}"]`).classList.add("is-active");
      });
    });
  });
}

/* ---------- DASHBOARD ---------- */

function renderDashboard(){
  const kpis = [
    {label:"Spedizioni oggi", value: SHIPMENTS.length, cls:""},
    {label:"In staging", value: SHIPMENTS.filter(s=>s.stato==="In staging").length, cls:"kpi-warning"},
    {label:"In giacenza", value: GIACENZE.length, cls:"kpi-danger"},
    {label:"Flussi con errore", value: FLUSSI_CLIENTI.filter(f=>f.stato==="errore").length, cls:"kpi-warning"},
  ];
  document.getElementById("kpi-grid").innerHTML = kpis.map(k=>`
    <div class="kpi-card ${k.cls}">
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-label">${k.label}</div>
    </div>`).join("");

  const counts = {
    "In revisione": SHIPMENTS.filter(s=>s.stato==="In revisione").length,
    "In staging": SHIPMENTS.filter(s=>s.stato==="In staging").length,
    "Parcheggio": SHIPMENTS.filter(s=>s.stato==="Parcheggio").length,
    "Pronta per etichettatura": SHIPMENTS.filter(s=>s.stato==="Pronta per etichettatura").length,
  };
  const max = Math.max(...Object.values(counts), 1);
  document.getElementById("dash-queue-mini").innerHTML = Object.entries(counts).map(([label,count])=>`
    <div class="funnel-row">
      <div class="funnel-label">${label}</div>
      <div class="funnel-bar-wrap"><div class="funnel-bar" style="width:${(count/max*100)}%"></div></div>
      <div class="funnel-count">${count}</div>
    </div>`).join("");

  document.getElementById("dash-broker-mini").innerHTML = `
    <div class="mini-broker-stat"><div class="num">${BROKER_STATE.coda}</div><div class="lbl">Messaggi in coda</div></div>
    <div class="mini-broker-stat"><div class="num">${BROKER_STATE.consumer}</div><div class="lbl">Consumer attivi</div></div>
    <div class="mini-broker-stat"><div class="num">${BROKER_STATE.servizi.filter(s=>s.online).length}/${BROKER_STATE.servizi.length}</div><div class="lbl">Servizi online</div></div>
  `;

  const activity = [
    {t:"08:12", msg:"Import flusso Chiapparino Logistica completato (CSV, 214 righe)."},
    {t:"08:40", msg:"3 spedizioni passate automaticamente da In revisione a In staging."},
    {t:"09:05", msg:"Errore import flusso FarmaDistrib SpA — verifica campo lotto."},
    {t:"09:20", msg:"Listino Vendita Jigsaw Moda duplicato con ricarico +6%."},
    {t:"09:47", msg:"Nuova notifica push da Amazon per ordine AMZ-77213."},
  ];
  document.getElementById("activity-feed").innerHTML = activity.map(a=>`
    <li><span class="activity-time">${a.t}</span><span>${a.msg}</span></li>`).join("");
}

/* ---------- SPEDIZIONI: ELENCO ----------
   Data-grid pattern di riferimento: stesso approccio (search "contains" +
   select "equals" + range numerico, sort multicolonna con shift-click,
   paginazione simulata server-side) va replicato su ogni altra data-table
   del gestionale (Listini, Flussi, Qapla, Rate Card...) man mano che
   vengono estese. Vedi anche renderRateCardTable() più sotto, che riusa
   lo stesso motore di sort. */

const spedizioniGrid = {
  sort: [],              // es. [{key:"stato", dir:"asc"}, {key:"id", dir:"desc"}]
  page: 1,
  pageSize: 10,
};

function populateSpedizioniFilters(){
  const statoSel = document.getElementById("filter-stato-spedizione");
  const vettoreSel = document.getElementById("filter-vettore-spedizione");
  const mandanteSel = document.getElementById("filter-mandante-spedizione");
  STATI_SPEDIZIONE.forEach(s=> statoSel.insertAdjacentHTML("beforeend", `<option value="${s}">${s}</option>`));
  VETTORI.forEach(v=> vettoreSel.insertAdjacentHTML("beforeend", `<option value="${v}">${v}</option>`));
  MANDANTI.forEach(m=> mandanteSel.insertAdjacentHTML("beforeend", `<option value="${m}">${m}</option>`));
  [statoSel,vettoreSel,mandanteSel].forEach(sel=> sel.addEventListener("change", ()=>{ spedizioniGrid.page = 1; renderSpedizioniTable(); }));

  document.getElementById("filter-search-spedizione").addEventListener("input", ()=>{ spedizioniGrid.page = 1; renderSpedizioniTable(); });
  ["filter-servizi-min","filter-servizi-max"].forEach(id=>{
    document.getElementById(id).addEventListener("input", ()=>{ spedizioniGrid.page = 1; renderSpedizioniTable(); });
  });

  // header di ordinamento multicolonna: click = colonna singola, shift+click = aggiunge come criterio secondario
  document.querySelectorAll('#table-spedizioni th.sortable').forEach(th=>{
    th.addEventListener("click", (e)=>{
      const key = th.dataset.sortKey;
      const existing = spedizioniGrid.sort.find(s=>s.key===key);
      if(e.shiftKey){
        if(existing) existing.dir = existing.dir==="asc" ? "desc" : "asc";
        else spedizioniGrid.sort.push({key, dir:"asc"});
      } else {
        const dir = existing && spedizioniGrid.sort.length===1 && existing.dir==="asc" ? "desc" : "asc";
        spedizioniGrid.sort = [{key, dir}];
      }
      renderSpedizioniTable();
    });
  });

  // popola le select delle azioni massive
  const bulkStato = document.getElementById("bulk-stato-select");
  const bulkVettore = document.getElementById("bulk-vettore-select");
  STATI_SPEDIZIONE.forEach(s=> bulkStato.insertAdjacentHTML("beforeend", `<option value="${s}">${s}</option>`));
  VETTORI.forEach(v=> bulkVettore.insertAdjacentHTML("beforeend", `<option value="${v}">${v}</option>`));
}

// operatori supportati: equals (select), contains (ricerca testuale), range (min/max numerico)
function getFilteredShipments(){
  const stato = document.getElementById("filter-stato-spedizione").value;
  const vettore = document.getElementById("filter-vettore-spedizione").value;
  const mandante = document.getElementById("filter-mandante-spedizione").value;
  const search = document.getElementById("filter-search-spedizione").value.trim().toLowerCase();
  const serviziMin = document.getElementById("filter-servizi-min").value;
  const serviziMax = document.getElementById("filter-servizi-max").value;

  return SHIPMENTS.filter(s =>
    (!stato || s.stato===stato) &&                                   // equals
    (!vettore || s.vettore===vettore) &&                             // equals
    (!mandante || s.mandante===mandante) &&                          // equals
    (!search || `${s.id} ${s.destinatario} ${s.localita}`.toLowerCase().includes(search)) && // contains
    (serviziMin==="" || s.servizi.length >= Number(serviziMin)) &&   // range
    (serviziMax==="" || s.servizi.length <= Number(serviziMax))      // range
  );
}

function sortShipments(list){
  if(!spedizioniGrid.sort.length) return list;
  const sorted = [...list];
  sorted.sort((a,b)=>{
    for(const {key,dir} of spedizioniGrid.sort){
      let av = a[key], bv = b[key];
      if(typeof av === "boolean") { av = av?1:0; bv = bv?1:0; }
      else if(typeof av === "string") { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if(av < bv) return dir==="asc" ? -1 : 1;
      if(av > bv) return dir==="asc" ? 1 : -1;
    }
    return 0;
  });
  return sorted;
}

function updateSortIndicators(){
  document.querySelectorAll('#table-spedizioni th.sortable').forEach(th=>{
    const found = spedizioniGrid.sort.find(s=>s.key===th.dataset.sortKey);
    th.classList.toggle("sort-active", !!found);
    th.classList.toggle("sort-asc", !!found && found.dir==="asc");
    th.classList.toggle("sort-desc", !!found && found.dir==="desc");
  });
}

// simula una chiamata server-side paginata (latenza + risposta con slice+totale)
function fetchShipmentsPage(){
  const filtered = sortShipments(getFilteredShipments());
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / spedizioniGrid.pageSize));
  spedizioniGrid.page = Math.min(spedizioniGrid.page, totalPages);
  const start = (spedizioniGrid.page - 1) * spedizioniGrid.pageSize;
  const pageItems = filtered.slice(start, start + spedizioniGrid.pageSize);
  return new Promise(resolve=>{
    setTimeout(()=> resolve({ items: pageItems, total, totalPages, page: spedizioniGrid.page }), 180);
  });
}

async function renderSpedizioniTable(){
  updateSortIndicators();
  const wrap = document.getElementById("spedizioni-table-wrap");
  wrap.classList.add("is-loading");
  const { items, total, totalPages, page } = await fetchShipmentsPage();
  wrap.classList.remove("is-loading");

  const tbody = document.getElementById("tbody-spedizioni");
  tbody.innerHTML = items.map(s=>{
    return `
    <tr data-id="${s.id}" class="row-clickable ${selectedShipments.has(s.id) ? 'row-selected':''} ${!s.capValida ? 'row-warning':''}">
      <td class="col-check"><input type="checkbox" class="row-check" data-id="${s.id}" ${selectedShipments.has(s.id)?'checked':''}></td>
      <td class="id-cell">${s.id}</td>
      <td>${s.mandante}</td>
      <td>${s.destinatario}</td>
      <td>${s.cap}</td>
      <td>${s.localita} (${s.provincia})</td>
      <td>${badgeForCapState(s.capValida)}</td>
      <td>${s.telefonoValida ? `<span class="mono">${s.telefono}</span>` : `<span class="badge badge-warning">Nel campo note</span>`}</td>
      <td>
        <select class="cell-select vettore-select" data-id="${s.id}">
          ${VETTORI.map(v=>`<option value="${v}" ${v===s.vettore?'selected':''}>${v}</option>`).join("")}
        </select>
      </td>
      <td>
        <select class="cell-select stato-select" data-id="${s.id}">
          ${STATI_SPEDIZIONE.map(st=>`<option value="${st}" ${st===s.stato?'selected':''}>${st}</option>`).join("")}
        </select>
      </td>
    </tr>`;
  }).join("");

  document.getElementById("tbl-count-note").textContent =
    `${items.length} spedizioni mostrate (pagina ${page}/${totalPages}) su ${total} filtrate · ${SHIPMENTS.length} totali · ${selectedShipments.size} selezionate.`;

  renderSpedizioniPagination(total, totalPages, page);
  updateBulkBar();

  tbody.querySelectorAll(".row-check").forEach(chk=>{
    chk.addEventListener("change", (e)=>{
      e.stopPropagation();
      if(chk.checked) selectedShipments.add(chk.dataset.id); else selectedShipments.delete(chk.dataset.id);
      renderSpedizioniTable();
    });
    chk.addEventListener("click", e=> e.stopPropagation());
  });
  tbody.querySelectorAll(".vettore-select").forEach(sel=>{
    sel.addEventListener("click", e=> e.stopPropagation());
    sel.addEventListener("change", ()=>{
      const ship = SHIPMENTS.find(s=>s.id===sel.dataset.id);
      ship.vettore = sel.value;
      const compat = COMPATIBILITA_VETTORE[sel.value] || [];
      const incompat = ship.servizi.filter(sv=>!compat.includes(sv));
      if(incompat.length){
        showToast(`${ship.id}: "${incompat.join(', ')}" non supportato da ${sel.value}.`, "danger");
      }
      renderSpedizioniTable();
    });
  });
  tbody.querySelectorAll(".stato-select").forEach(sel=>{
    sel.addEventListener("click", e=> e.stopPropagation());
    sel.addEventListener("change", ()=>{
      const ship = SHIPMENTS.find(s=>s.id===sel.dataset.id);
      ship.stato = sel.value;
      renderSpedizioniTable();
      renderKanban();
    });
  });
  tbody.querySelectorAll("tr[data-id]").forEach(tr=>{
    tr.addEventListener("click", ()=>{ location.hash = `#/shipment/${tr.dataset.id}`; });
  });
}

function renderSpedizioniPagination(total, totalPages, page){
  const el = document.getElementById("spedizioni-pagination");
  el.innerHTML = `
    <label>Righe per pagina
      <select id="spedizioni-pagesize">
        ${[10,25,50,100].map(n=>`<option value="${n}" ${n===spedizioniGrid.pageSize?'selected':''}>${n}</option>`).join("")}
      </select>
    </label>
    <button id="spedizioni-prev" ${page<=1?'disabled':''}>← Precedente</button>
    <span class="pagination-pages">Pagina ${page} di ${totalPages}</span>
    <button id="spedizioni-next" ${page>=totalPages?'disabled':''}>Successiva →</button>
  `;
  document.getElementById("spedizioni-pagesize").addEventListener("change", (e)=>{
    spedizioniGrid.pageSize = Number(e.target.value);
    spedizioniGrid.page = 1;
    renderSpedizioniTable();
  });
  document.getElementById("spedizioni-prev").addEventListener("click", ()=>{
    spedizioniGrid.page = Math.max(1, spedizioniGrid.page - 1);
    renderSpedizioniTable();
  });
  document.getElementById("spedizioni-next").addEventListener("click", ()=>{
    spedizioniGrid.page = Math.min(totalPages, spedizioniGrid.page + 1);
    renderSpedizioniTable();
  });
}

function updateBulkBar(){
  const bar = document.getElementById("bulk-bar");
  const count = selectedShipments.size;
  bar.classList.toggle("is-visible", count > 0);
  document.getElementById("bulk-bar-count").textContent = `${count} selezionate`;
}

function setupSpedizioniToolbar(){
  document.getElementById("check-all-head").addEventListener("change",(e)=>{
    const list = getFilteredShipments();
    if(e.target.checked) list.forEach(s=>selectedShipments.add(s.id));
    else list.forEach(s=>selectedShipments.delete(s.id));
    renderSpedizioniTable();
  });

  document.getElementById("btn-select-all").addEventListener("click", ()=>{
    getFilteredShipments().forEach(s=>selectedShipments.add(s.id));
    renderSpedizioniTable();
    showToast("Tutte le spedizioni filtrate sono state selezionate.");
  });

  // BULK ACTIONS: aggiornamento massivo di stato / vettore sulla selezione corrente
  document.getElementById("bulk-apply-stato").addEventListener("click", ()=>{
    const val = document.getElementById("bulk-stato-select").value;
    if(!val){ showToast("Seleziona uno stato da applicare.", "danger"); return; }
    if(selectedShipments.size===0){ showToast("Nessuna spedizione selezionata.", "danger"); return; }
    selectedShipments.forEach(id=>{
      const ship = SHIPMENTS.find(s=>s.id===id);
      if(ship) ship.stato = val;
    });
    showToast(`Stato "${val}" applicato a ${selectedShipments.size} spedizioni.`, "success");
    renderSpedizioniTable();
    renderKanban();
  });

  document.getElementById("bulk-apply-vettore").addEventListener("click", ()=>{
    const val = document.getElementById("bulk-vettore-select").value;
    if(!val){ showToast("Seleziona un vettore da applicare.", "danger"); return; }
    if(selectedShipments.size===0){ showToast("Nessuna spedizione selezionata.", "danger"); return; }
    const compat = COMPATIBILITA_VETTORE[val] || [];
    let incompatCount = 0;
    selectedShipments.forEach(id=>{
      const ship = SHIPMENTS.find(s=>s.id===id);
      if(!ship) return;
      ship.vettore = val;
      if(ship.servizi.some(sv=>!compat.includes(sv))) incompatCount++;
    });
    showToast(
      `Vettore "${val}" applicato a ${selectedShipments.size} spedizioni.` +
      (incompatCount ? ` Attenzione: ${incompatCount} hanno servizi accessori non supportati.` : ""),
      incompatCount ? "danger" : "success"
    );
    renderSpedizioniTable();
  });

  document.getElementById("btn-fix-cap").addEventListener("click", ()=>{
    let count = 0;
    SHIPMENTS.forEach(s=>{
      if(!s.capValida){
        const city = randFrom(CITTA);
        s.cap = city.cap; s.localita = city.loc; s.provincia = city.prov; s.capValida = true;
        count++;
      }
    });
    renderSpedizioniTable();
    showToast(`Operazione massiva completata: ${count} CAP corretti.`, "success");
  });

  document.getElementById("btn-normalize-phone").addEventListener("click", ()=>{
    let count = 0;
    SHIPMENTS.forEach(s=>{
      if(!s.telefonoValida){
        s.telefono = "+39 333 " + pad(Math.floor(Math.random()*10000000),7);
        s.telefonoValida = true;
        count++;
      }
    });
    renderSpedizioniTable();
    showToast(`Numeri normalizzati per ${count} spedizioni: spostati dal campo note e formattati con +39.`, "success");
  });

  document.getElementById("btn-apply-service").addEventListener("click", openApplyServiceModal);
  document.getElementById("btn-generate-waybill").addEventListener("click", openWaybillModal);
}

function openApplyServiceModal(){
  if(selectedShipments.size === 0){
    showToast("Seleziona almeno una spedizione prima di applicare un servizio.", "danger");
    return;
  }
  const body = `
    <p class="hint" style="margin-bottom:12px">Servizio da applicare a ${selectedShipments.size} spedizioni selezionate. I servizi non supportati dal vettore assegnato sono disabilitati.</p>
    ${SERVIZI_ACCESSORI.map(sv=>{
      // il servizio è considerato "incompatibile" se TUTTE le spedizioni selezionate hanno un vettore che non lo supporta
      const ships = [...selectedShipments].map(id=>SHIPMENTS.find(s=>s.id===id));
      const anyIncompatible = ships.some(s => !(COMPATIBILITA_VETTORE[s.vettore]||[]).includes(sv));
      return `
      <label class="checkbox-row ${anyIncompatible ? 'is-disabled':''}">
        <input type="checkbox" value="${sv}" class="apply-service-check" ${anyIncompatible ? 'disabled':''}>
        ${sv}
        ${anyIncompatible ? `<span class="service-flag"><span class="warn-icon">⚠</span><span class="tooltip">Servizio non supportato da questo vettore</span></span>` : ""}
      </label>`;
    }).join("")}
  `;
  const foot = `<button class="btn btn-ghost" id="modal-cancel">Annulla</button><button class="btn btn-primary" id="modal-apply">Applica</button>`;
  openModal("Applica servizio accessorio", body, foot);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-apply").addEventListener("click", ()=>{
    const checked = [...document.querySelectorAll(".apply-service-check:checked")].map(c=>c.value);
    if(checked.length===0){ showToast("Nessun servizio selezionato.", "danger"); return; }
    selectedShipments.forEach(id=>{
      const ship = SHIPMENTS.find(s=>s.id===id);
      checked.forEach(sv=>{ if(!ship.servizi.includes(sv)) ship.servizi.push(sv); });
    });
    closeModal();
    showToast(`Servizi applicati a ${selectedShipments.size} spedizioni.`, "success");
  });
}

function openWaybillModal(){
  const ready = [...selectedShipments].map(id=>SHIPMENTS.find(s=>s.id===id)).filter(s=>s && s.stato==="Pronta per etichettatura");
  if(ready.length===0){
    showToast('Seleziona almeno una spedizione in stato "Pronta per etichettatura".', "danger");
    return;
  }
  const s = ready[0];
  const body = `
    <div class="waybill">
      <div class="stamp">AIR<br>ENTERPRISE<br>${s.id.split('-').pop()}</div>
      <div class="eyebrow">Lettera di vettura (anteprima simulata)</div>
      <div class="waybill-grid">
        <div class="waybill-field"><b>Mittente</b>CT Solution — Centro di smistamento</div>
        <div class="waybill-field"><b>Destinatario</b>${s.destinatario}, ${s.localita} (${s.provincia}) ${s.cap}</div>
        <div class="waybill-field"><b>Codice spedizione</b><span class="mono">${s.id}</span></div>
        <div class="waybill-field"><b>Vettore</b>${s.vettore}</div>
        <div class="waybill-field"><b>Mandante</b>${s.mandante}</div>
        <div class="waybill-field"><b>Servizi accessori</b>${s.servizi.length ? s.servizi.join(", ") : "Nessuno"}</div>
      </div>
    </div>
    ${ready.length>1 ? `<p class="hint" style="margin-top:12px">Verranno generate ${ready.length} lettere di vettura per le spedizioni selezionate pronte per l'etichettatura.</p>`:""}
  `;
  const foot = `<button class="btn btn-ghost" id="modal-cancel">Chiudi</button><button class="btn btn-primary" id="modal-confirm-print">Genera etichetta${ready.length>1?'e':''}</button>`;
  openModal("Genera lettera di vettura", body, foot);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-confirm-print").addEventListener("click", ()=>{
    closeModal();
    showToast(`${ready.length} lettera/e di vettura generata/e (simulazione).`, "success");
  });
}

/* ---------- SPEDIZIONI: VISTA DI DETTAGLIO (drawer + dynamic routing) ---------- */
// Routing dinamico via hash: #/shipment/:id — coerente con un futuro routing
// reale (es. /shipment/[id]) se il frontend evolvesse verso un router SPA.

const SHIPMENT_NOTES = {}; // note operative in-memory per id spedizione

function buildStatusHistory(ship){
  const order = ["In revisione","In staging","In sospeso","Parcheggio","Pronta per etichettatura"];
  const currentIdx = Math.max(0, order.indexOf(ship.stato));
  const relevant = ship.stato === "In sospeso" ? ["In revisione","In sospeso"] : order.slice(0, currentIdx+1).filter(s=>s!=="In sospeso");
  const now = new Date();
  return relevant.map((stato, i)=>{
    const d = new Date(now.getTime() - (relevant.length - i) * 3600 * 1000 * 5);
    const stamp = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    return {stato, stamp};
  });
}

function renderShipmentDrawer(id){
  const ship = SHIPMENTS.find(s=>s.id===id);
  if(!ship){
    openDrawer("Spedizione non trovata", `<p class="hint">Nessuna spedizione con id <span class="mono">${id}</span>.</p>`);
    return;
  }
  const tracking = mockTrackingResult(ship.id);
  const history = buildStatusHistory(ship);
  const note = SHIPMENT_NOTES[ship.id] || "";

  const body = `
    <div class="drawer-subtabs" id="drawer-subtabs">
      <button class="is-active" data-panel="overview">Panoramica</button>
      <button data-panel="events">Log eventi</button>
      <button data-panel="notes">Note operative</button>
      <button data-panel="history">Storico stati</button>
      <button data-panel="payload">Payload</button>
    </div>
    <div style="padding:20px">
      <div class="drawer-panel is-active" data-drawer-panel="overview">
        <div class="detail-grid">
          <div class="detail-field"><b>ID spedizione</b><span class="mono">${ship.id}</span></div>
          <div class="detail-field"><b>Stato</b>${badgeForStato(ship.stato)}</div>
          <div class="detail-field"><b>Mandante</b>${ship.mandante}</div>
          <div class="detail-field"><b>Vettore</b>${ship.vettore}</div>
          <div class="detail-field"><b>Destinatario</b>${ship.destinatario}</div>
          <div class="detail-field"><b>Telefono</b>${ship.telefonoValida ? ship.telefono : 'nel campo note'}</div>
          <div class="detail-field"><b>CAP</b>${ship.cap} ${badgeForCapState(ship.capValida)}</div>
          <div class="detail-field"><b>Località</b>${ship.localita} (${ship.provincia})</div>
          <div class="detail-field" style="grid-column:1/-1"><b>Servizi accessori</b>${ship.servizi.length ? ship.servizi.join(", ") : "Nessuno"}</div>
        </div>
      </div>
      <div class="drawer-panel" data-drawer-panel="events">
        <ul class="tracking-events">
          ${tracking.eventi.map(e=>`<li><b>${e.label}</b><span>${e.t}</span></li>`).join("")}
        </ul>
      </div>
      <div class="drawer-panel" data-drawer-panel="notes">
        <p class="hint" style="margin-bottom:8px">Note operative visibili al team logistico, non al mandante.</p>
        <textarea class="notes-textarea" id="drawer-notes-input" placeholder="Aggiungi una nota operativa…">${note}</textarea>
        <button class="btn btn-secondary btn-sm" id="drawer-notes-save" style="margin-top:8px">Salva nota</button>
      </div>
      <div class="drawer-panel" data-drawer-panel="history">
        <ul class="status-history">
          ${history.map(h=>`<li><span>${badgeForStato(h.stato)}</span><span class="mono">${h.stamp}</span></li>`).join("")}
        </ul>
      </div>
      <div class="drawer-panel" data-drawer-panel="payload">
        <pre class="payload-pre">${JSON.stringify(ship, null, 2)}</pre>
      </div>
    </div>
  `;
  openDrawer(`Spedizione ${ship.id}`, body);

  document.querySelectorAll("#drawer-subtabs button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll("#drawer-subtabs button").forEach(b=>b.classList.remove("is-active"));
      btn.classList.add("is-active");
      document.querySelectorAll(".drawer-panel").forEach(p=>p.classList.remove("is-active"));
      document.querySelector(`.drawer-panel[data-drawer-panel="${btn.dataset.panel}"]`).classList.add("is-active");
    });
  });
  const saveBtn = document.getElementById("drawer-notes-save");
  if(saveBtn){
    saveBtn.addEventListener("click", ()=>{
      SHIPMENT_NOTES[ship.id] = document.getElementById("drawer-notes-input").value;
      showToast(`Nota salvata per ${ship.id}.`, "success");
    });
  }
}

function handleShipmentRoute(){
  const match = location.hash.match(/^#\/shipment\/(.+)$/);
  if(match) renderShipmentDrawer(decodeURIComponent(match[1]));
  else closeModal();
}
window.addEventListener("hashchange", handleShipmentRoute);

/* ---------- SPEDIZIONI: CODA (KANBAN) ---------- */

function renderKanban(){
  const cols = {revisione:"In revisione", staging:"In staging", parcheggio:"Parcheggio"};
  // per semplicità includiamo anche "In sospeso" dentro "In revisione" e "Pronta per etichettatura" dentro "parcheggio"
  const buckets = {revisione:[], staging:[], parcheggio:[]};
  SHIPMENTS.forEach(s=>{
    if(s.stato==="In revisione" || s.stato==="In sospeso") buckets.revisione.push(s);
    else if(s.stato==="In staging") buckets.staging.push(s);
    else buckets.parcheggio.push(s);
  });

  Object.entries(buckets).forEach(([key, items])=>{
    document.getElementById(`count-${key}`).textContent = items.length;
    const nextStatus = key==="revisione" ? "In staging" : key==="staging" ? "Parcheggio" : "Pronta per etichettatura";
    document.getElementById(`list-${key}`).innerHTML = items.map(s=>`
      <div class="kanban-card">
        <div class="kanban-card-top"><span class="kanban-card-id">${s.id}</span>${badgeForStato(s.stato)}</div>
        <div class="kanban-card-meta">${s.mandante} · ${s.vettore}</div>
        <button class="btn btn-secondary btn-sm advance-btn" data-id="${s.id}" data-next="${nextStatus}">Avanza a "${nextStatus}" →</button>
      </div>
    `).join("") || `<p class="hint">Nessuna spedizione in questa fase.</p>`;
  });

  document.querySelectorAll(".advance-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const ship = SHIPMENTS.find(s=>s.id===btn.dataset.id);
      ship.stato = btn.dataset.next;
      renderKanban();
      renderSpedizioniTable();
      showToast(`${ship.id} spostata in "${btn.dataset.next}".`, "success");
    });
  });
}

/* ---------- SPEDIZIONI: COLLI MADRE ---------- */

function renderColliMadre(){
  const wrap = document.getElementById("tree-colli");
  wrap.innerHTML = COLLI_MADRE.map((c,idx)=>{
    const consegnati = c.sotto.filter(s=>s.stato==="Consegnato").length;
    const stato = consegnati === c.sotto.length ? "Consegnato" : consegnati===0 ? "Non consegnato" : "Consegnato parzialmente";
    const badgeCls = stato==="Consegnato" ? "badge-success" : stato==="Non consegnato" ? "badge-warning":"badge-blue";
    return `
    <div class="tree-node" data-idx="${idx}">
      <div class="tree-node-head">
        <div class="tree-node-head-left">
          <span class="tree-toggle">▶</span>
          <span class="id-cell">${c.id}</span>
          <span class="hint">${c.peso} · ${c.dim}</span>
        </div>
        <span class="badge ${badgeCls}">${stato}</span>
      </div>
      <div class="tree-children">
        ${c.sotto.map(s=>`
          <div class="sub-collo-row">
            <span class="mono">${s.id}</span>
            <span class="badge ${s.stato==='Consegnato'?'badge-success':'badge-warning'}">${s.stato}</span>
          </div>`).join("")}
        <p class="hint" style="margin-top:8px">I sotto-colli non consegnati possono essere rispediti singolarmente con mezzo e data differenti.</p>
      </div>
    </div>`;
  }).join("");

  wrap.querySelectorAll(".tree-node-head").forEach(head=>{
    head.addEventListener("click", ()=> head.parentElement.classList.toggle("open"));
  });
}

/* ---------- SPEDIZIONI: DIFFERENZIALI ---------- */

function renderDifferenziali(){
  document.getElementById("tbody-differenziali").innerHTML = DIFFERENZIALI.map(d=>`
    <tr class="${d.impatto!=='+0,00 €' ? 'row-warning':''}">
      <td class="id-cell">${d.id}</td>
      <td>${d.pd}</td><td>${d.pr}</td>
      <td>${d.dd}</td><td>${d.dr}</td>
      <td class="mono">${d.diff}</td>
      <td class="mono">${d.impatto}</td>
    </tr>`).join("");
}

/* ---------- LISTINI ---------- */

let LISTINO_SELEZIONATO = null;

function renderListiniTable(){
  document.getElementById("tbody-listini").innerHTML = LISTINI.map(l=>`
    <tr data-id="${l.id}" class="listino-row ${LISTINO_SELEZIONATO===l.id?'row-selected':''}">
      <td>${l.nome}</td>
      <td><span class="badge ${l.tipo==='Costo'?'badge-neutral':'badge-blue'}">${l.tipo}</span></td>
      <td>${l.cliente}</td>
      <td class="mono">${l.inizio} → ${l.fine}</td>
      <td><button class="btn btn-ghost btn-sm select-listino" data-id="${l.id}">Apri scaglioni</button></td>
    </tr>`).join("");

  document.querySelectorAll(".select-listino").forEach(btn=>{
    btn.addEventListener("click", ()=>{ LISTINO_SELEZIONATO = btn.dataset.id; renderListiniTable(); renderScaglioni(); });
  });
}

function renderScaglioni(){
  const l = LISTINI.find(x=>x.id===LISTINO_SELEZIONATO);
  const title = document.getElementById("scaglioni-title");
  const tbody = document.getElementById("tbody-scaglioni");
  if(!l){ title.textContent = "Scaglioni — seleziona un listino"; tbody.innerHTML=""; return; }
  title.textContent = `Scaglioni — ${l.nome}`;
  tbody.innerHTML = l.scaglioni.map(s=>`
    <tr class="${s.perdita ? 'row-danger':''}">
      <td>${s.peso}</td>
      <td>${s.volumetrico}</td>
      <td class="mono">${s.base.toFixed(2)} €${s.perdita ? ' <span class="badge badge-danger">Sotto costo</span>':''}</td>
      <td class="mono">${s.fuel.toFixed(2)} €</td>
      <td class="mono">${s.tasse.toFixed(2)} €</td>
      <td>${s.magg}</td>
      <td>${s.agente}</td>
    </tr>`).join("");
}

function setupDuplicaListino(){
  document.getElementById("btn-duplica-listino").addEventListener("click", ()=>{
    const costi = LISTINI.filter(l=>l.tipo==="Costo");
    const body = `
      <div class="field-row">
        <label>Listino di costo di partenza</label>
        <select id="dup-source">${costi.map(c=>`<option value="${c.id}">${c.nome}</option>`).join("")}</select>
      </div>
      <div class="field-row">
        <label>Cliente / mandante destinatario</label>
        <select id="dup-cliente">${MANDANTI.map(m=>`<option value="${m}">${m}</option>`).join("")}</select>
      </div>
      <div class="field-row">
        <label>Modalità</label>
        <div class="radio-row">
          <label><input type="radio" name="dup-mode" value="ricarico" checked> Ricarico percentuale</label>
          <label><input type="radio" name="dup-mode" value="assoluto"> Sovrascrittura assoluta (+1,00€ su ogni voce)</label>
        </div>
      </div>
      <div class="field-row" id="dup-percent-row">
        <label>Percentuale di ricarico</label>
        <input type="number" id="dup-percent" value="10" min="0" max="200" style="width:100%">
      </div>
    `;
    const foot = `<button class="btn btn-ghost" id="modal-cancel">Annulla</button><button class="btn btn-primary" id="modal-confirm-dup">Crea listino di vendita</button>`;
    openModal("Duplica listino", body, foot);
    document.getElementById("modal-cancel").addEventListener("click", closeModal);
    document.getElementById("modal-confirm-dup").addEventListener("click", ()=>{
      const sourceId = document.getElementById("dup-source").value;
      const cliente = document.getElementById("dup-cliente").value;
      const mode = document.querySelector('input[name="dup-mode"]:checked').value;
      const pct = parseFloat(document.getElementById("dup-percent").value)||0;
      const source = LISTINI.find(l=>l.id===sourceId);
      const newId = `L-VEND-${pad(LISTINI.length+1,3)}`;
      const newScaglioni = source.scaglioni.map(s=>{
        const newBase = mode==="ricarico" ? s.base * (1+pct/100) : s.base + 1.0;
        return {...s, base: Math.round(newBase*100)/100, perdita: newBase < s.base + 0.001 ? false : false};
      });
      // marca in perdita se per errore l'utente avesse messo ricarico 0 o negativo
      newScaglioni.forEach((s,i)=>{ s.perdita = s.base < source.scaglioni[i].base; });
      LISTINI.push({
        id:newId, nome:`Vendita ${cliente} (da ${source.nome})`, tipo:"Vendita", cliente,
        inizio:"2026-08-01", fine:"2027-07-31", scaglioni:newScaglioni
      });
      closeModal();
      renderListiniTable();
      showToast(`Listino "${newId}" creato con ${mode==="ricarico" ? `ricarico +${pct}%` : "sovrascrittura assoluta"}.`, "success");
    });
  });
}

function renderStoricita(){
  const select = document.getElementById("select-storicita-cliente");
  select.innerHTML = MANDANTI.map(m=>`<option value="${m}">${m}</option>`).join("");
  select.addEventListener("change", ()=> drawTimeline(select.value));
  drawTimeline(select.value);
}
function drawTimeline(cliente){
  const rows = LISTINI.filter(l=>l.cliente===cliente && l.tipo==="Vendita");
  const wrap = document.getElementById("timeline-listini");
  if(rows.length===0){ wrap.innerHTML = `<p class="hint">Nessun listino di vendita storicizzato per questo cliente nella demo.</p>`; return; }
  const today = new Date("2026-07-21");
  wrap.innerHTML = rows.map(r=>{
    const isFuture = new Date(r.inizio) > today;
    return `<div class="timeline-item ${isFuture?'is-future':''}">
      <div class="timeline-dates">${r.inizio}<br>→ ${r.fine}</div>
      <div>${r.nome}</div>
      <span class="badge ${isFuture?'badge-blue':'badge-success'}">${isFuture?'Futuro (negoziato)':'Attuale'}</span>
    </div>`;
  }).join("");
}

/* ---------- LISTINO VETTORI / RATE CARD ---------- */
// Riusa lo stesso pattern di sort di renderSpedizioniTable applicato alla
// tabella rate card: filtro equals per vettore/zona + sort per colonna.

function setupRateCardView(){
  const vettoreSel = document.getElementById("filter-vettore-ratecard");
  const zonaSel = document.getElementById("filter-zona-ratecard");
  VETTORI.filter(v=>v!=="(non assegnato)").forEach(v=> vettoreSel.insertAdjacentHTML("beforeend", `<option value="${v}">${v}</option>`));
  ZONE_VETTORE.forEach(z=> zonaSel.insertAdjacentHTML("beforeend", `<option value="${z}">${z}</option>`));
  [vettoreSel, zonaSel].forEach(sel=> sel.addEventListener("change", renderRateCardTable));

  document.querySelectorAll('#table-ratecard th.sortable').forEach(th=>{
    th.addEventListener("click", ()=>{
      const key = th.dataset.sortKey;
      const existing = rateCardGrid.sort[0];
      const dir = existing && existing.key===key && existing.dir==="asc" ? "desc" : "asc";
      rateCardGrid.sort = [{key, dir}];
      renderRateCardTable();
    });
  });

  document.getElementById("btn-add-ratecard").addEventListener("click", openAddRateCardModal);
  renderRateCardTable();
}

function getFilteredRateCards(){
  const vettore = document.getElementById("filter-vettore-ratecard").value;
  const zona = document.getElementById("filter-zona-ratecard").value;
  let list = CARRIER_RATE_CARDS.filter(r =>
    (!vettore || r.vettore===vettore) &&
    (!zona || r.zona===zona)
  );
  if(rateCardGrid.sort.length){
    const {key, dir} = rateCardGrid.sort[0];
    list = [...list].sort((a,b)=>{
      let av=a[key], bv=b[key];
      if(typeof av === "string"){ av=av.toLowerCase(); bv=bv.toLowerCase(); }
      if(av<bv) return dir==="asc"?-1:1;
      if(av>bv) return dir==="asc"?1:-1;
      return 0;
    });
  }
  return list;
}

function renderRateCardTable(){
  document.querySelectorAll('#table-ratecard th.sortable').forEach(th=>{
    const active = rateCardGrid.sort[0]?.key === th.dataset.sortKey;
    th.classList.toggle("sort-active", active);
    th.classList.toggle("sort-asc", active && rateCardGrid.sort[0].dir==="asc");
    th.classList.toggle("sort-desc", active && rateCardGrid.sort[0].dir==="desc");
  });
  const list = getFilteredRateCards();
  document.getElementById("tbody-ratecard").innerHTML = list.map(r=>`
    <tr>
      <td>${r.vettore}</td>
      <td>${r.zona}</td>
      <td class="mono">${r.pesoDa}–${r.pesoA} kg</td>
      <td>${r.pesoVolumetrico}</td>
      <td><span class="badge badge-neutral">${r.resa}</span></td>
      <td class="mono">${r.prezzo.toFixed(2)} €</td>
    </tr>`).join("") || `<tr><td colspan="6"><p class="hint">Nessuna rate card per questo filtro.</p></td></tr>`;
  document.getElementById("ratecard-count-note").textContent = `${list.length} rate card su ${CARRIER_RATE_CARDS.length} totali.`;
}

function openAddRateCardModal(){
  const body = `
    <div class="field-row"><label>Vettore</label>
      <select id="rc-vettore">${VETTORI.filter(v=>v!=="(non assegnato)").map(v=>`<option value="${v}">${v}</option>`).join("")}</select>
    </div>
    <div class="field-row"><label>Zona</label>
      <select id="rc-zona">${ZONE_VETTORE.map(z=>`<option value="${z}">${z}</option>`).join("")}</select>
    </div>
    <div class="field-row"><label>Peso da (kg)</label><input type="number" id="rc-peso-da" value="0" min="0"></div>
    <div class="field-row"><label>Peso a (kg)</label><input type="number" id="rc-peso-a" value="3" min="0"></div>
    <div class="field-row"><label>Peso volumetrico</label><input type="text" id="rc-peso-vol" value="3 kg"></div>
    <div class="field-row"><label>Resa</label>
      <select id="rc-resa">${RESE.map(r=>`<option value="${r}">${r}</option>`).join("")}</select>
    </div>
    <div class="field-row"><label>Prezzo (€)</label><input type="number" id="rc-prezzo" value="0.00" step="0.01" min="0"></div>
  `;
  const foot = `<button class="btn btn-ghost" id="modal-cancel">Annulla</button><button class="btn btn-primary" id="modal-save-ratecard">Salva rate card</button>`;
  openModal("Nuova rate card vettore", body, foot);
  document.getElementById("modal-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-save-ratecard").addEventListener("click", ()=>{
    const pesoDa = Number(document.getElementById("rc-peso-da").value);
    const pesoA = Number(document.getElementById("rc-peso-a").value);
    const prezzo = Number(document.getElementById("rc-prezzo").value);
    if(pesoA <= pesoDa || prezzo <= 0){
      showToast("Controlla lo scaglione di peso e il prezzo inseriti.", "danger");
      return;
    }
    CARRIER_RATE_CARDS.push(makeRateCard({
      vettore: document.getElementById("rc-vettore").value,
      zona: document.getElementById("rc-zona").value,
      pesoDa, pesoA,
      pesoVolumetrico: document.getElementById("rc-peso-vol").value,
      resa: document.getElementById("rc-resa").value,
      prezzo,
    }));
    closeModal();
    renderRateCardTable();
    showToast("Rate card aggiunta.", "success");
  });
}

/* ---------- FLUSSI ---------- */

function renderFlussiKpi(){
  const ok = FLUSSI_CLIENTI.filter(f=>f.stato==="ok").length;
  const err = FLUSSI_CLIENTI.filter(f=>f.stato==="errore").length;
  const coda = FLUSSI_CLIENTI.filter(f=>f.stato==="coda").length;
  const kpis = [
    {v:34, l:"Flussi configurati", cls:""},
    {v:ok, l:"Import OK (campione)", cls:"kpi-success"},
    {v:err, l:"Import in errore", cls:"kpi-danger"},
    {v:coda, l:"Import in coda", cls:"kpi-warning"},
  ];
  document.getElementById("flussi-kpi").innerHTML = kpis.map(k=>`
    <div class="kpi-card ${k.cls}"><div class="kpi-value">${k.v}</div><div class="kpi-label">${k.l}</div></div>`).join("");
}

function badgeForFlusso(stato){
  if(stato==="ok") return `<span class="badge badge-success">OK</span>`;
  if(stato==="errore") return `<span class="badge badge-danger">Errore</span>`;
  return `<span class="badge badge-warning">In coda</span>`;
}

function renderFlussiTable(){
  const filtro = document.getElementById("filter-stato-flusso").value;
  const list = FLUSSI_CLIENTI.filter(f=> !filtro || f.stato===filtro);
  document.getElementById("tbody-flussi").innerHTML = list.map((f,idx)=>`
    <tr data-idx="${FLUSSI_CLIENTI.indexOf(f)}">
      <td>${f.cliente}</td>
      <td><span class="mono">${f.tipo}</span></td>
      <td class="flusso-stato">${badgeForFlusso(f.stato)}</td>
      <td class="mono flusso-data">${f.lastImport || "21/07/2026 " + (7+idx) + ":15"}</td>
      <td><span class="badge badge-neutral">${f.micro}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm flusso-details" data-idx="${FLUSSI_CLIENTI.indexOf(f)}">Dettagli</button>
        <button class="btn btn-secondary btn-sm flusso-sim" data-idx="${FLUSSI_CLIENTI.indexOf(f)}">Simula import</button>
      </td>
    </tr>`).join("");

  document.querySelectorAll(".flusso-details").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const f = FLUSSI_CLIENTI[btn.dataset.idx];
      openModal(f.cliente, `
        <div class="field-row"><label>Tipo di flusso</label>${f.tipo}</div>
        <div class="field-row"><label>Tipo microservizio</label>${f.micro}</div>
        <div class="field-row"><label>Regole custom applicate</label>${f.regole}</div>
      `, `<button class="btn btn-ghost" id="modal-cancel">Chiudi</button>`);
      document.getElementById("modal-cancel").addEventListener("click", closeModal);
    });
  });
  document.querySelectorAll(".flusso-sim").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const f = FLUSSI_CLIENTI[btn.dataset.idx];
      const outcomes = ["ok","ok","ok","errore"]; // più probabile OK
      f.stato = randFrom(outcomes);
      f.lastImport = "21/07/2026 " + String(9+Math.floor(Math.random()*4)).padStart(2,"0") + ":" + pad(Math.floor(Math.random()*60),2);
      renderFlussiTable();
      renderFlussiKpi();
      showToast(`Import simulato per ${f.cliente}: esito ${f.stato.toUpperCase()}.`, f.stato==="errore"?"danger":"success");
    });
  });
}

/* ---------- GIACENZE / TRACKING ---------- */

function renderGiacenzeTable(){
  document.getElementById("tbody-giacenze").innerHTML = GIACENZE.map((g,idx)=>{
    if(g.stato!=="aperta"){
      return `<tr><td class="id-cell">${g.id}</td><td>${g.dest}</td><td>${g.motivo}</td><td>${g.da}</td><td><span class="badge badge-success">${g.stato}</span></td></tr>`;
    }
    return `
    <tr>
      <td class="id-cell">${g.id}</td>
      <td>${g.dest}</td>
      <td>${g.motivo}</td>
      <td>${g.da}</td>
      <td>
        <button class="btn btn-secondary btn-sm giac-action" data-idx="${idx}" data-action="Nuovo tentativo di consegna">Nuovo tentativo</button>
        <button class="btn btn-ghost btn-sm giac-action" data-idx="${idx}" data-action="Reso al mittente">Reso al mittente</button>
        <button class="btn btn-ghost btn-sm giac-action" data-idx="${idx}" data-action="Smaltimento">Smaltimento</button>
      </td>
    </tr>`;
  }).join("");

  document.querySelectorAll(".giac-action").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const g = GIACENZE[btn.dataset.idx];
      g.stato = btn.dataset.action;
      renderGiacenzeTable();
      showToast(`${g.id}: scelta cliente registrata → "${btn.dataset.action}".`, "success");
    });
  });
}

function setupTracking(){
  document.getElementById("btn-tracking-search").addEventListener("click", ()=>{
    const code = document.getElementById("tracking-input").value.trim() || "CT-2026-004821";
    const r = mockTrackingResult(code);
    const badgeCls = r.stato==="Consegnata" ? "badge-success" : r.stato==="In giacenza" ? "badge-warning":"badge-blue";
    document.getElementById("tracking-result").innerHTML = `
      <div class="tracking-result-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="id-cell">${r.code}</span>
          <span class="badge ${badgeCls}">${r.stato}</span>
        </div>
        <ul class="tracking-events">
          ${r.eventi.map(e=>`<li><b>${e.label}</b><span>${e.t}</span></li>`).join("")}
        </ul>
      </div>`;
  });
}

/* ---------- OPERATIVITÀ ---------- */

function setupOperativita(){
  document.getElementById("btn-op-scan").addEventListener("click", ()=>{
    const input = document.getElementById("op-scan-input");
    const code = input.value.trim();
    if(!code){ showToast("Inserisci o scansiona un codice collo.", "danger"); return; }
    const log = document.getElementById("scan-log");
    const time = new Date().toLocaleTimeString("it-IT",{hour:'2-digit',minute:'2-digit'});
    const li = document.createElement("li");
    li.textContent = `${time} — Presa in carico: ${code}`;
    log.prepend(li);
    input.value = "";
    showToast(`Collo ${code} preso in carico.`, "success");
  });

  document.getElementById("photo-upload").addEventListener("click", ()=>{
    const el = document.getElementById("photo-upload");
    el.classList.add("is-done");
    document.getElementById("photo-upload-label").textContent = "✓ Foto acquisita (simulata)";
  });

  document.getElementById("btn-op-confirm").addEventListener("click", ()=>{
    const code = document.getElementById("op-delivery-code").value.trim();
    const photoDone = document.getElementById("photo-upload").classList.contains("is-done");
    const hint = document.getElementById("delivery-hint");
    if(!code){ hint.textContent = "Inserisci il codice collo."; hint.style.color = "var(--danger)"; return; }
    if(!photoDone){ hint.textContent = "La foto di prova di consegna è obbligatoria."; hint.style.color = "var(--danger)"; return; }
    hint.textContent = `Consegna di ${code} confermata con prova fotografica.`;
    hint.style.color = "var(--success)";
    document.getElementById("op-delivery-code").value = "";
    document.getElementById("photo-upload").classList.remove("is-done");
    document.getElementById("photo-upload-label").textContent = "📷 Foto prova di consegna (obbligatoria)";
    showToast(`Consegna confermata per ${code}.`, "success");
  });

  document.getElementById("tbody-vettori-op").innerHTML = VETTORI_OP.map(v=>`
    <tr>
      <td>${v.nome}</td>
      <td><span class="badge ${v.tipo==='Linea propria'?'badge-blue':'badge-neutral'}">${v.tipo}</span></td>
      <td>${v.bordero ? '<span class="badge badge-success">Attivo</span>' : '<span class="badge badge-neutral">Non previsto</span>'}</td>
      <td>${v.app ? '<span class="badge badge-success">Sì</span>' : '<span class="badge badge-neutral">No</span>'}</td>
    </tr>`).join("");
}

/* ---------- QAPLA ---------- */

function renderQapla(){
  function rowsFor(filtered){
    return filtered.map(o=>{
      const badge = o.stato==="Spedizione generata" ? "badge-success" : o.stato==="Errore" ? "badge-danger" : "badge-warning";
      const flussoBadge = o.marketplace==="Amazon" ? `<span class="badge badge-blue">${o.flusso}</span>` : o.flusso;
      return `<tr>
        <td>${o.marketplace}</td><td class="mono">${o.ordine}</td><td>${o.cliente}</td>
        <td>${flussoBadge}</td><td><span class="badge ${badge}">${o.stato}</span></td>
      </tr>`;
    }).join("");
  }
  function renderOrdini(){
    const mk = document.getElementById("filter-marketplace").value;
    const filtered = QAPLA_ORDINI.filter(o=> !mk || o.marketplace===mk);
    document.getElementById("tbody-qapla-ordini").innerHTML = rowsFor(filtered);
  }
  document.getElementById("filter-marketplace").addEventListener("change", renderOrdini);
  renderOrdini();

  document.getElementById("tbody-qapla-giacenze").innerHTML = GIACENZE.map(g=>`
    <tr><td class="id-cell">${g.id}</td><td>Shopify</td><td><span class="badge badge-warning">In giacenza</span></td></tr>`).join("");

  document.getElementById("tbody-qapla-consultazione").innerHTML = QAPLA_ORDINI.map(o=>`
    <tr><td class="mono">${o.ordine}</td><td>${o.marketplace}</td><td><span class="badge badge-blue">${o.stato}</span></td></tr>`).join("");
}

/* ---------- UTENTI ---------- */

function renderUtenti(){
  document.getElementById("tbody-utenti").innerHTML = UTENTI.map((u,idx)=>`
    <tr>
      <td>${u.nome}</td>
      <td>${u.ruolo}</td>
      <td><span class="level-badge level-${u.livello}">${u.livello}</span></td>
      <td><button class="btn btn-ghost btn-sm show-perm" data-idx="${idx}">Vedi permessi</button></td>
    </tr>`).join("");

  document.querySelectorAll(".show-perm").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const u = UTENTI[btn.dataset.idx];
      document.getElementById("perm-panel-title").textContent = `Permessi — ${u.nome}`;
      document.getElementById("perm-panel").innerHTML = MODULI_PERMESSO.map(m=>{
        const has = u.permessi.some(p=>p.startsWith(m));
        const soloConsult = u.permessi.some(p=>p.startsWith(m) && p.includes("sola consultazione"));
        return `<label class="checkbox-row">
          <input type="checkbox" ${has?'checked':''} ${u.livello===1?'':''}>
          ${m} ${soloConsult ? '<span class="badge badge-neutral" style="margin-left:6px">sola consultazione</span>' : ''}
        </label>`;
      }).join("");
    });
  });
}

/* ---------- CONFIGURAZIONI / ARCHITETTURA ---------- */

function renderConfig(){
  function draw(){
    document.getElementById("broker-stats").innerHTML = `
      <div class="broker-stat"><div class="num">${BROKER_STATE.coda}</div><div class="lbl">Messaggi in coda</div></div>
      <div class="broker-stat"><div class="num">${BROKER_STATE.consumer}</div><div class="lbl">Consumer attivi</div></div>
    `;
    document.getElementById("service-list").innerHTML = BROKER_STATE.servizi.map((s,idx)=>`
      <div class="service-row">
        <span>${s.nome}</span>
        <button class="btn btn-sm ${s.online?'btn-secondary':'btn-danger'} toggle-service" data-idx="${idx}">
          ${s.online ? 'Online' : 'Offline — riavvia'}
        </button>
      </div>`).join("");

    document.querySelectorAll(".toggle-service").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const s = BROKER_STATE.servizi[btn.dataset.idx];
        s.online = !s.online;
        BROKER_STATE.coda = s.online ? Math.max(20, BROKER_STATE.coda - 40) : BROKER_STATE.coda + 60;
        draw();
        showToast(`${s.nome} → ${s.online ? "tornato online, la coda si sta svuotando" : "andato offline, i messaggi restano in coda"}.`, s.online ? "success":"danger");
      });
    });
  }
  draw();

  document.getElementById("rate-limits").innerHTML = RATE_LIMITS.map(r=>{
    const pct = Math.min(100, Math.round((r.volumeMin / r.limite) * 100));
    const cls = pct >= 100 ? "is-over" : pct >= 75 ? "is-hot" : "";
    return `
    <div class="ratelimit-row">
      <div class="ratelimit-head">
        <span><b>${r.vettore}</b> — limite ${r.limite} richieste/min</span>
        <span class="mono">${r.volumeMin} richieste/min (${pct}%)</span>
      </div>
      <div class="ratelimit-bar-wrap"><div class="ratelimit-bar ${cls}" style="width:${pct}%"></div></div>
      <div class="node-dist">${r.nodi.map(n=>`<span class="node-tag">${n}</span>`).join("")}</div>
    </div>`;
  }).join("");
}

/* ---------- INIT ---------- */

document.addEventListener("DOMContentLoaded", ()=>{
  setupNav();

  renderDashboard();

  populateSpedizioniFilters();
  renderSpedizioniTable();
  setupSpedizioniToolbar();
  renderKanban();
  renderColliMadre();
  renderDifferenziali();

  renderListiniTable();
  setupDuplicaListino();
  renderStoricita();
  setupRateCardView();

  renderFlussiKpi();
  renderFlussiTable();
  document.getElementById("filter-stato-flusso").addEventListener("change", renderFlussiTable);

  renderGiacenzeTable();
  setupTracking();

  setupOperativita();

  renderQapla();

  renderUtenti();

  renderConfig();

  handleShipmentRoute(); // apre subito il drawer se si arriva già su #/shipment/:id
});