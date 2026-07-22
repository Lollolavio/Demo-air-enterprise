/* ============================================================
   CT Solution — Demo gestionale spedizioni (v2)
   app.js — mock data, componente tabella riutilizzabile,
   logica di interazione lato client (nessun backend)
   ============================================================ */
'use strict';

/* ---------------------------------------------------------- *
 * 0. Helper generici
 * ---------------------------------------------------------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const el = (tag, attrs = {}, html = '') => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  });
  if (html) n.innerHTML = html;
  return n;
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtEur = n => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const fmtDT  = iso => iso ? iso.replace('T', ' ').slice(0, 16) : '—';
const nowStr = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

// PRNG deterministico: la demo mostra sempre gli stessi dati
let _seed = 20260721;
const rnd = () => (_seed = (_seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = arr => arr[Math.floor(rnd() * arr.length)];

function toast(msg, kind = '') {
  const t = el('div', { class: `toast ${kind}` }, msg);
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3800);
  logAzione(msg, kind);
}

/* ---------------------------------------------------------- *
 * 0b. Log delle azioni — ogni toast viene anche registrato qui,
 *     così la pagina "Log azioni" mostra lo storico della sessione
 *     (data/ora, utente, modulo ed esito) senza duplicare logica.
 * ---------------------------------------------------------- */
const LOG_AZIONI = [];
let logSeq = 1;
let dtLog = null;
const KIND_LABEL = { ok: 'Riuscita', err: 'Errore', warn: 'Attenzione', info: 'Informazione', '': 'Notifica' };
const KIND_CLS   = { ok: 'ok', err: 'err', warn: 'warn', info: 'info', '': 'brand' };

function currentAreaLabel() {
  const activeView = $('.view.active');
  const name = activeView ? activeView.id.replace('view-', '') : null;
  return VIEW_LABEL[name] || '—';
}

function logAzione(msg, kind = '') {
  LOG_AZIONI.unshift({
    id: logSeq++,
    ts: nowStr(),
    utente: currentUser ? currentUser.nome : 'Sistema',
    livello: currentUser ? currentUser.livello : '—',
    area: currentAreaLabel(),
    messaggio: msg,
    kind
  });
  if (LOG_AZIONI.length > 500) LOG_AZIONI.length = 500; // limite in memoria, solo per la demo
  if (dtLog) dtLog.refresh();
  const counter = $('#log-counter');
  if (counter) counter.textContent = `${LOG_AZIONI.length} azion${LOG_AZIONI.length === 1 ? 'e registrata' : 'i registrate'} in questa sessione`;
}

/* ---------------------------------------------------------- *
 * 1. Anagrafiche di base
 * ---------------------------------------------------------- */
const MANDANTI = [
  'Pharma Ligure S.p.A.', 'ElettroHouse S.r.l.', 'Vinello & Co.',
  'ModaExpress S.r.l.', 'TechnoParts S.p.A.', 'Cosmetici Riviera'
];

const VETTORI = [
  { id: 'CA', nome: 'Corriere A', tipo: 'terzo' },
  { id: 'CB', nome: 'Corriere B', tipo: 'terzo' },
  { id: 'CC', nome: 'Corriere C', tipo: 'terzo' },
  { id: 'P1', nome: 'Padroncino Nord-Ovest', tipo: 'proprio' },
  { id: 'P2', nome: 'Padroncino Riviera',    tipo: 'proprio' },
  { id: 'P3', nome: 'Padroncino Val Padana', tipo: 'proprio' }
];
const vettoreByNome = nome => VETTORI.find(v => v.nome === nome);

const SERVIZI = ['Consegna al piano', 'SMS di preavviso', 'Consegna su appuntamento', 'Contrassegno', 'Reso documenti'];
// Matrice di compatibilità servizio → vettori che lo supportano
const COMPAT = {
  'Consegna al piano':        ['Corriere A', 'Padroncino Nord-Ovest', 'Padroncino Riviera', 'Padroncino Val Padana'],
  'SMS di preavviso':         ['Corriere A', 'Corriere B', 'Corriere C', 'Padroncino Nord-Ovest', 'Padroncino Riviera', 'Padroncino Val Padana'],
  'Consegna su appuntamento': ['Corriere B', 'Padroncino Nord-Ovest', 'Padroncino Riviera'],
  'Contrassegno':             ['Corriere A', 'Corriere B'],
  'Reso documenti':           ['Corriere A', 'Corriere C', 'Padroncino Val Padana']
};
const servizioCompatibile = (servizio, vettoreNome) => !vettoreNome || (COMPAT[servizio] || []).includes(vettoreNome);

const STATI_SPED = ['In revisione', 'In staging', 'In sospeso', 'Pronta per etichettatura', 'Pronto per la spedizione', 'In transito', 'Consegnata', 'In giacenza'];
// Priorità logica per l'ordinamento dei badge di stato ("In sospeso" prima di "Consegnata")
const STATO_PRIORITA = ['In sospeso', 'In revisione', 'In staging', 'Pronta per etichettatura', 'Pronto per la spedizione', 'In giacenza', 'In transito', 'Consegnata'];
const statoBadgeCls = s => ({
  'In sospeso': 'err', 'In revisione': 'warn', 'In staging': 'info',
  'Pronta per etichettatura': 'accent', 'Pronto per la spedizione': 'brand', 'In transito': 'info', 'Consegnata': 'ok', 'In giacenza': 'err'
}[s] || '');

const LOCALITA = [
  ['Genova','GE','16121'], ['Genova','GE','16145'], ['Savona','SV','17100'], ['Imperia','IM','18100'],
  ['La Spezia','SP','19121'], ['Torino','TO','10121'], ['Alessandria','AL','15121'], ['Milano','MI','20121'],
  ['Milano','MI','20154'], ['Pavia','PV','27100'], ['Cuneo','CN','12100'], ['Novara','NO','28100'],
  ['Sanremo','IM','18038'], ['Rapallo','GE','16035'], ['Chiavari','GE','16043'], ['Asti','AT','14100']
];
const NOMI = ['Rossi Maria','Bianchi Luca','Ferraro Anna','Parodi Giulio','Costa Elena','Repetto Sara','Oliveri Marco','Traverso Paola','Canepa Dario','Schiaffino Rita','Bruno Andrea','Gallo Chiara','Ricci Fabio','Moretti Silvia','Grasso Pietro','De Luca Irene','Ferrari Nadia','Villa Stefano','Romano Carla','Testa Enrico'];
const OPERATORI = ['M. Bruzzone', 'A. Vitali', 'S. Piaggio', 'L. Ratto'];

/* ---------------------------------------------------------- *
 * 2. Spedizioni (dataset principale, ~64 righe)
 * ---------------------------------------------------------- */
function makeSpedizioni() {
  const out = [];
  for (let i = 1; i <= 64; i++) {
    const [localita, provincia, capOk] = pick(LOCALITA);
    const capValido = rnd() > 0.22;
    const cap = capValido ? capOk : pick([capOk.slice(0, 4), capOk.slice(0, 3) + 'X0', '00000', capOk.slice(1)]);
    const telOk = rnd() > 0.28;
    const telefono = telOk ? '+39 3' + rint(20, 89) + ' ' + rint(1000000, 9999999) : pick(['3' + rint(200000000, 899999999), '010-' + rint(100000, 999999), '39' + rint(3200000000, 3899999999)]);
    const stato = pick(STATI_SPED);
    const haVettore = !['In revisione', 'In staging', 'In sospeso'].includes(stato) || rnd() > 0.6;
    const vettore = haVettore ? pick(VETTORI).nome : null;
    const nServ = rint(0, 2);
    const servizi = [...new Set(Array.from({ length: nServ }, () => pick(SERVIZI)))];
    const pesoDich = +(rnd() * 28 + 0.5).toFixed(1);
    const haDiff = rnd() > 0.68;
    const pesoReale = haDiff ? +(pesoDich * (1 + (rnd() * 0.5 - 0.1))).toFixed(1) : pesoDich;
    const giorno = rint(1, 21), ora = rint(7, 19);
    const dataIn = `2026-07-${String(giorno).padStart(2, '0')} ${String(ora).padStart(2, '0')}:${String(rint(0, 59)).padStart(2, '0')}`;
    const ldv = ['Pronto per la spedizione', 'In transito', 'Consegnata', 'In giacenza'].includes(stato) ? `LDV-2026-0${1100 + i}` : null;

    // Storico stati coerente con lo stato corrente
    const flowIdx = { 'In revisione': 0, 'In staging': 1, 'In sospeso': 1, 'Pronta per etichettatura': 2, 'Pronto per la spedizione': 3, 'In transito': 4, 'Consegnata': 5, 'In giacenza': 5 };
    const flow = ['In revisione', 'In staging', 'Pronta per etichettatura', 'Pronto per la spedizione', 'In transito', stato === 'In giacenza' ? 'In giacenza' : 'Consegnata'];
    const storico = flow.slice(0, flowIdx[stato] + 1).map((s, ix) => ({
      stato: ix === flowIdx[stato] ? stato : s,
      data: `2026-07-${String(Math.min(giorno + ix, 21)).padStart(2, '0')} ${String(Math.min(ora + ix, 23)).padStart(2, '0')}:${String(rint(0, 59)).padStart(2, '0')}`,
      operatore: pick(OPERATORI)
    }));

    const note = rnd() > 0.7 ? [{ testo: pick(['Il destinatario chiede consegna dopo le 17.', 'Citofono guasto: chiamare al telefono.', 'Merce fragile, già segnalato al vettore.', 'Verificare CAP con il mandante.']), data: dataIn, autore: pick(OPERATORI) }] : [];

    const tracking = storico.map(h => ({
      data: h.data,
      evento: { 'In revisione': 'Spedizione acquisita dal flusso cliente', 'In staging': 'Dati validati — in attesa di assegnazione vettore', 'Pronta per etichettatura': 'Etichetta pronta per la stampa', 'Pronto per la spedizione': 'LDV generata e stampata — spedizione pronta per il ritiro/affidamento al vettore', 'In transito': 'Affidata al vettore — in transito', 'Consegnata': 'Consegnata al destinatario', 'In giacenza': 'Tentativo di consegna non riuscito — in giacenza', 'In sospeso': 'Lavorazione sospesa: dati da verificare' }[h.stato] || h.stato,
      luogo: ['In transito', 'Consegnata', 'In giacenza'].includes(h.stato) ? localita : 'Centro di smistamento — Genova Bolzaneto',
      interno: false, operatore: h.operatore
    }));
    if (rnd() > 0.5) tracking.splice(1, 0, { data: storico[0].data, evento: 'Verifica interna anagrafica destinatario', luogo: 'Back office', interno: true, operatore: pick(OPERATORI), notaInterna: 'Controllo qualità dati su flusso mandante' });

    out.push({
      id: `SPD-2026-${String(100 + i).padStart(5, '0')}`,
      mandante: pick(MANDANTI),
      destinatario: pick(NOMI),
      indirizzo: `Via ${pick(['Roma', 'Garibaldi', 'XX Settembre', 'Colombo', 'Mazzini', 'Cavour'])} ${rint(1, 120)}`,
      cap, capValido, localita, provincia,
      telefono, telOk,
      vettore, stato, servizi,
      pesoDich, pesoReale, dims: `${rint(20, 60)}×${rint(20, 50)}×${rint(10, 40)} cm`,
      dataIn, ldv, colloMadre: null,
      storico, note, tracking
    });
  }
  return out;
}
const SPEDIZIONI = makeSpedizioni();
const spedById = id => SPEDIZIONI.find(s => s.id === id);

/* ---- Colli madre: 3 bancali che raggruppano alcune spedizioni ---- */
const COLLI_MADRE = [
  { id: 'CM-2026-0041', descr: 'Bancale Pharma Ligure — lotto 07/26', figli: [] },
  { id: 'CM-2026-0042', descr: 'Bancale ElettroHouse — elettrodomestici', figli: [] },
  { id: 'CM-2026-0043', descr: 'Bancale ModaExpress — resi stagionali', figli: [] }
];
SPEDIZIONI.slice(0, 11).forEach((s, i) => {
  const cm = COLLI_MADRE[i % 3];
  cm.figli.push(s.id); s.colloMadre = cm.id;
});
function statoAggregato(cm) {
  const stati = cm.figli.map(id => spedById(id).stato);
  const cons = stati.filter(s => s === 'Consegnata').length;
  if (cons === stati.length) return ['Consegnato', 'ok'];
  if (cons === 0) return ['Non consegnato', 'err'];
  return [`Consegnato parzialmente (${cons}/${stati.length})`, 'warn'];
}

/* ---------------------------------------------------------- *
 * 3. Flussi in ingresso
 * ---------------------------------------------------------- */
const REGOLE_POOL = [
  ['Tutte le spedizioni del mandante', 'SMS di preavviso automatico'],
  ['Destinazione = Milano', 'Consegna al piano attivata'],
  ['Peso > 20 kg', 'Instradamento su linea propria'],
  ['CAP in zona 191xx', 'Etichetta Corriere B'],
  ['Campo "note" contiene FRAGILE', 'Flag merce fragile su etichetta'],
  ['Contrassegno presente', 'Blocco in revisione manuale']
];
const FLUSSI = Array.from({ length: 15 }, (_, i) => {
  const stato = pick(['OK', 'OK', 'OK', 'Errore', 'In coda']);
  return {
    cliente: ['Spedizioniere Alfa', 'Logistica Beta', 'Gamma Trasporti', 'Delta Cargo', 'Epsilon Express', 'Zeta Freight', 'Eta Logistics', 'Theta Spedizioni', 'Iota Trans', 'Kappa Line', 'Lambda Cargo', 'My Shipping', 'Ni Express', 'Xi Logistica', 'Omicron Srl'][i],
    tipo: pick(['CSV', 'CSV', 'TXT']),
    stato,
    ultimo: `2026-07-${String(rint(18, 21)).padStart(2, '0')} ${String(rint(5, 18)).padStart(2, '0')}:${String(rint(0, 59)).padStart(2, '0')}`,
    micro: pick(['Istanza dedicata', 'Configurazione condivisa', 'Configurazione condivisa']),
    regole: [...new Set(Array.from({ length: rint(1, 3) }, () => pick(REGOLE_POOL)))]
  };
});
const FLUSSI_TOTALI = 34;

/* ---------------------------------------------------------- *
 * 4. Listini — tre livelli
 * ---------------------------------------------------------- */
const SCAGLIONI = ['0–2 kg', '2–5 kg', '5–10 kg', '10–20 kg', '20–30 kg', '30–50 kg'];
const ZONE = ['Nazionale', 'UE', 'Extra-UE'];

// 4a. Listini dei vettori terzi (base costo esterna, non negoziabile)
const LISTINI_VETTORE = {};
VETTORI.filter(v => v.tipo === 'terzo').forEach((v, vi) => {
  const rows = [];
  SCAGLIONI.forEach((sc, si) => ZONE.forEach((z, zi) => {
    rows.push({
      vettore: v.nome, scaglione: sc, zona: z,
      prezzo: +(3.2 + si * 1.9 + zi * 4.5 + vi * 0.45 + rnd() * 0.8).toFixed(2),
      fuel: +(4 + vi * 1.5 + rnd() * 2).toFixed(1),
      validita: vi === 1 ? '01/07/2026 – 31/12/2026' : '01/03/2026 – 31/12/2026'
    });
  }));
  LISTINI_VETTORE[v.nome] = {
    rows,
    aggiornato: ['03/03/2026', '28/06/2026', '15/05/2026'][vi],
    versione: ['03/2026', '07/2026', '05/2026'][vi],
    nota: `Listino ${v.nome} aggiornato dal fornitore il ${['03/03/2026', '28/06/2026', '15/05/2026'][vi]} — dati di esempio`
  };
});

// 4b. Listini di costo interni (derivati dai listini vettore, o calcolati per le linee proprie)
const LISTINI_COSTO = [];
VETTORI.forEach(v => {
  SCAGLIONI.forEach((sc, si) => {
    const base = v.tipo === 'terzo'
      ? LISTINI_VETTORE[v.nome].rows.find(r => r.scaglione === sc && r.zona === 'Nazionale').prezzo
      : +(2.4 + si * 1.55 + rnd() * 0.6).toFixed(2); // costo calcolato linea propria
    LISTINI_COSTO.push({
      vettore: v.nome, tipo: v.tipo === 'terzo' ? 'Derivato da vettore' : 'Calcolato (linea propria)',
      scaglione: sc, zona: 'Nazionale',
      costo: v.tipo === 'terzo' ? +(base * 1.03).toFixed(2) : base, // 3% oneri interni sul listino vettore
      costoVettore: v.tipo === 'terzo' ? base : null,
      origine: v.tipo === 'terzo' ? `Importato da: Listino ${v.nome} — versione ${LISTINI_VETTORE[v.nome].versione}` : 'Calcolo interno km/tempo padroncino'
    });
  });
});

// 4c. Listini di vendita per mandante (derivati dal costo, alcune righe in perdita)
const LISTINI_VENDITA = [];
MANDANTI.forEach((m, mi) => {
  const vetRef = VETTORI[mi % VETTORI.length].nome;
  SCAGLIONI.forEach((sc, si) => {
    const costoRow = LISTINI_COSTO.find(r => r.vettore === vetRef && r.scaglione === sc);
    let vendita = +(costoRow.costo * (1.18 + rnd() * 0.22)).toFixed(2);
    // righe in perdita: alcune sotto il costo interno, almeno una sotto il listino vettore
    if (mi === 1 && si === 3) vendita = +(costoRow.costo * 0.93).toFixed(2);                 // sotto costo interno
    if (mi === 2 && si === 4 && costoRow.costoVettore) vendita = +(costoRow.costoVettore * 0.9).toFixed(2); // sotto listino VETTORE
    if (mi === 4 && si === 5) vendita = +(costoRow.costo * 0.96).toFixed(2);
    LISTINI_VENDITA.push({
      mandante: m, vettoreRif: vetRef, scaglione: sc, zona: 'Nazionale',
      costo: costoRow.costo, costoVettore: costoRow.costoVettore, vendita,
      margine: +(vendita - costoRow.costo).toFixed(2)
    });
  });
});

const STORICO_LISTINI = {};
MANDANTI.forEach(m => {
  STORICO_LISTINI[m] = [
    { periodo: '01/01/2025 → 31/12/2025', label: 'Listino 2025 (archiviato)', stato: 'archiviato' },
    { periodo: '01/01/2026 → 31/12/2026', label: 'Listino 2026 — attivo', stato: 'attivo' },
    { periodo: '01/01/2027 → 31/12/2027', label: 'Listino 2027 — già negoziato, in attesa di decorrenza', stato: 'futuro' }
  ];
});

/* ---------------------------------------------------------- *
 * 5. Giacenze, e-commerce, utenti, differenziali
 * ---------------------------------------------------------- */
const GIACENZE = SPEDIZIONI.filter(s => s.stato === 'In giacenza').map(s => ({
  id: s.id, ref: s, mandante: s.mandante, destinatario: s.destinatario, localita: s.localita,
  motivo: pick(['Destinatario assente', 'Indirizzo errato', 'Rifiuto merce', 'Chiuso per ferie']),
  giorni: rint(1, 12), esito: 'Aperta'
}));
// integriamo con giacenze extra per avere volume
for (let i = 0; i < 10; i++) {
  const s = pick(SPEDIZIONI.filter(x => x.stato === 'Consegnata'));
  GIACENZE.push({ id: `${s.id}-G${i + 1}`, ref: s, mandante: s.mandante, destinatario: s.destinatario, localita: s.localita, motivo: pick(['Destinatario assente', 'Indirizzo errato', 'Rifiuto merce']), giorni: rint(1, 14), esito: 'Aperta' });
}

const MARKETPLACES = ['Amazon', 'Shopify', 'eBay', 'Vinted'];
const ORDINI_ECOM = Array.from({ length: 28 }, (_, i) => {
  const mp = pick(MARKETPLACES);
  return {
    ordine: `ORD-${mp.slice(0, 2).toUpperCase()}-${7000 + i}`,
    marketplace: mp,
    cliente: pick(NOMI),
    data: `2026-07-${String(rint(14, 21)).padStart(2, '0')} ${String(rint(8, 22)).padStart(2, '0')}:${String(rint(0, 59)).padStart(2, '0')}`,
    valore: +(rnd() * 240 + 12).toFixed(2),
    statoInt: mp === 'Vinted' ? pick(['Ricevuto (push)', 'Ricevuto (push)', 'Errore push']) : pick(['Sincronizzato', 'Sincronizzato', 'In coda', 'Errore API']),
    spedizione: rnd() > 0.35 ? pick(SPEDIZIONI).id : null,
    giacenza: rnd() > 0.85
  };
});

const LIVELLI_UTENTE = ['Piattaforma', 'Back office', 'Mandante/Sottocontratto', 'Cliente finale'];
const MODULI = ['Spedizioni', 'Listini', 'Flussi', 'Giacenze', 'E-commerce', 'Utenti', 'Configurazioni'];

// Vista di partenza dopo il login, per livello (i mandanti e i clienti finali
// non hanno una "dashboard operativa" da consultare)
const HOME_VIEW = {
  'Piattaforma': 'dashboard',
  'Back office': 'dashboard',
  'Mandante/Sottocontratto': 'dashboard',
  'Cliente finale': 'tracking'
};

/**
 * Moduli ammessi per livello — guida sia la navbar sia il router
 * (showView rifiuta le viste non in questa lista).
 * 'tracking' è gestito a parte perché non è in MODULI.
 */
const VIEW_AMMESSE = {
  'Piattaforma':              ['dashboard', 'spedizioni', 'listini', 'flussi', 'giacenze', 'ecommerce', 'tracking', 'appop', 'utenti', 'log', 'config'],
  'Back office':              ['dashboard', 'spedizioni', 'listini', 'flussi', 'giacenze', 'ecommerce', 'tracking', 'appop', 'utenti', 'log', 'config'],
  'Mandante/Sottocontratto':  ['dashboard', 'spedizioni', 'listini', 'giacenze', 'tracking'],
  'Cliente finale':           ['tracking', 'giacenze']
};
const NAV_LABELS = {  // etichette mostrate nella navbar quando un modulo è disabilitato per livello
  'Piattaforma':              ['Dashboard', 'Spedizioni', 'Listini e tariffe', 'Flussi in ingresso', 'Giacenze', 'Connettore e-commerce', 'Tracking', 'App operativa', 'Utenti e ruoli', 'Log azioni', 'Configurazioni'],
  'Back office':              ['Dashboard', 'Spedizioni', 'Listini e tariffe', 'Flussi in ingresso', 'Giacenze', 'Connettore e-commerce', 'Tracking', 'App operativa', 'Utenti e ruoli', 'Log azioni', 'Configurazioni'],
  'Mandante/Sottocontratto':  ['Dashboard', 'Spedizioni', 'Listini e tariffe', 'Giacenze', 'Tracking'],
  'Cliente finale':           ['Tracking', 'Giacenze']
};
// Etichette leggibili per vista, usate dal log delle azioni per indicare il modulo
const VIEW_LABEL = {
  dashboard: 'Dashboard', spedizioni: 'Spedizioni', listini: 'Listini e tariffe',
  flussi: 'Flussi in ingresso', giacenze: 'Giacenze', ecommerce: 'Connettore e-commerce',
  tracking: 'Tracking', appop: 'App operativa', utenti: 'Utenti e ruoli',
  log: 'Log azioni', config: 'Configurazioni'
};

/**
 * Matrice di permessi "documentata" nella sezione Utenti: deve riflettere
 * esattamente ciò che l'app effettivamente fa (vedi filtri in doTrack, initGiacenze,
 * initSpedTable, initListini).
 */
const PRESET_PERM = {
  'Piattaforma':              { lettura: MODULI,                                                                  scrittura: MODULI,                                                            massive: MODULI,                                                config: MODULI },
  'Back office':              { lettura: MODULI,                                                                  scrittura: ['Spedizioni', 'Giacenze', 'Flussi', 'E-commerce'],              massive: ['Spedizioni', 'Giacenze'],                             config: [] },
  'Mandante/Sottocontratto':  { lettura: ['Spedizioni', 'Listini', 'Giacenze', 'Tracking'],                       scrittura: ['Spedizioni', 'Giacenze'],                                       massive: ['Spedizioni', 'Giacenze'],                             config: [] },
  'Cliente finale':           { lettura: ['Tracking', 'Giacenze'],                                                 scrittura: [],                                                                massive: [],                                                     config: [] }
};

/* ---- Account demo fissi (login simulato senza backend) ---- */
// user1@gmail.com è il cliente finale richiesto dal task: vede SOLO Tracking
// e Giacenze (sola lettura) delle spedizioni del proprio mandante.
const ACCOUNT_DEMO = {
  'user1@gmail.com': {
    nome: 'Utente 1',
    email: 'user1@gmail.com',
    livello: 'Cliente finale',
    mandante: 'Pharma Ligure S.p.A.',
    telefono: '+39 333 1110001',
    ultimoAccesso: nowStr(),
    stato: 'Attivo'
  },
  'mandante@pharmaligure.it': {
    nome: 'Resp. Pharma Ligure',
    email: 'mandante@pharmaligure.it',
    livello: 'Mandante/Sottocontratto',
    mandante: 'Pharma Ligure S.p.A.',
    telefono: '+39 010 5551100',
    ultimoAccesso: nowStr(),
    stato: 'Attivo'
  },
  'm.bruzzone@ctsolution.demo': {
    nome: 'M. Bruzzone',
    email: 'm.bruzzone@ctsolution.demo',
    livello: 'Back office',
    mandante: '—',
    telefono: '+39 335 6402187',
    ultimoAccesso: nowStr(),
    stato: 'Attivo'
  }
};

// anagrafica estesa (i 19 record random restano per popolare la sezione Utenti)
const UTENTI = Array.from({ length: 19 }, (_, i) => {
  const livello = pick(LIVELLI_UTENTE);
  return {
    nome: NOMI[i % NOMI.length],
    email: NOMI[i % NOMI.length].toLowerCase().replace(' ', '.') + '@' + (livello === 'Cliente finale' ? 'mail.it' : livello.startsWith('Mandante') ? 'mandante.it' : 'ctsolution.demo'),
    livello,
    mandante: livello === 'Mandante/Sottocontratto' ? pick(MANDANTI) : (livello === 'Cliente finale' ? pick(MANDANTI) : '—'),
    ultimoAccesso: `2026-07-${String(rint(10, 21)).padStart(2, '0')} ${String(rint(7, 22)).padStart(2, '0')}:${String(rint(0, 59)).padStart(2, '0')}`,
    stato: pick(['Attivo', 'Attivo', 'Attivo', 'Sospeso'])
  };
});
// assicuro che user1 compaia anche nella tabella Utenti con il mandante giusto
UTENTI.push({ ...ACCOUNT_DEMO['user1@gmail.com'] });
UTENTI.push({ ...ACCOUNT_DEMO['mandante@pharmaligure.it'] });

const DIFFERENZIALI = SPEDIZIONI.filter(s => s.pesoReale !== s.pesoDich).map(s => {
  const diff = +(s.pesoReale - s.pesoDich).toFixed(1);
  return {
    id: s.id, mandante: s.mandante, vettore: s.vettore || '—',
    pesoDich: s.pesoDich, pesoReale: s.pesoReale, diff,
    impatto: +(Math.max(0, diff) * (1.15 + rnd() * 0.8)).toFixed(2)
  };
});

/* ---------------------------------------------------------- *
 * 6. Modale, conferme, form helper
 * ---------------------------------------------------------- */
function openModal({ title, body, actions = [], size = '' , onClose }) {
  const back = el('div', { class: 'modal-backdrop', onclick: e => { if (e.target === back) close(); } });
  const modal = el('div', { class: `modal ${size}` });
  const head = el('div', { class: 'modal-head' });
  head.appendChild(el('h3', {}, esc(title)));
  head.appendChild(el('button', { class: 'modal-close', 'aria-label': 'Chiudi', onclick: () => close() }, '×'));
  const bodyEl = el('div', { class: 'modal-body' });
  if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);
  modal.appendChild(head); modal.appendChild(bodyEl);
  if (actions.length) {
    const foot = el('div', { class: 'modal-foot' });
    actions.forEach(a => foot.appendChild(el('button', { class: `btn ${a.cls || ''}`, onclick: () => { const r = a.onClick ? a.onClick(bodyEl, close) : null; if (r !== false && !a.keepOpen) close(); } }, a.label)));
    modal.appendChild(foot);
  }
  back.appendChild(modal);
  $('#modal-root').appendChild(back);
  function close() { back.remove(); onClose && onClose(); }
  document.addEventListener('keydown', function escH(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escH); } });
  return { close, bodyEl };
}

/**
 * Riepilogo di conferma per azioni massive (obbligatorio prima
 * di eseguire un'azione "sull'intero filtro").
 */
function confirmBulk({ azione, count, mode, dettagli = '', warnings = [], onConfirm }) {
  let html = `<dl class="confirm-summary">
    <dt>Azione</dt><dd>${esc(azione)}</dd>
    <dt>Righe coinvolte</dt><dd><strong>${count}</strong> ${mode === 'filter' ? 'righe — <em>intero risultato del filtro corrente</em> (anche oltre la pagina visibile)' : 'righe selezionate con checkbox'}</dd>
    ${dettagli ? `<dt>Dettaglio</dt><dd>${dettagli}</dd>` : ''}
  </dl>`;
  warnings.forEach(w => html += `<div class="warn-box">⚠️ ${w}</div>`);
  if (!count) html = `<div class="err-box">Nessuna riga corrisponde alla selezione o al filtro corrente.</div>`;
  openModal({
    title: 'Conferma operazione massiva',
    body: html,
    actions: count ? [
      { label: 'Annulla' },
      { label: `Conferma su ${count} righe`, cls: 'btn-primary', onClick: () => onConfirm() }
    ] : [{ label: 'Chiudi' }]
  });
}

/* ---------------------------------------------------------- *
 * 7. Componente tabella riutilizzabile — renderDataTable(config)
 *    Pattern trasversale obbligatorio per TUTTE le tabelle:
 *    ordinamento per colonna (asc → desc → originale),
 *    filtro per singola colonna (testo / enum / range),
 *    paginazione reale, azioni massive su selezione o filtro.
 * ---------------------------------------------------------- */
function renderDataTable(cfg) {
  /* cfg = {
       mount, title, data: () => rows[], rowKey: r => id,
       columns: [{ key, label, ftype: 'text'|'enum'|'number'|'date'|null,
                   sortable=true, render(r), sortValue(r), filterValue(r),
                   statusOrder: [...], numeric: bool }],
       pageSize, pageSizes, selectable, bulkActions: [{label, cls, run(sel, api)}],
       rowActions(r, api) -> HTMLElement?, onRowClick(r), rowClass(r),
       globalFilter: r => bool, countGlobalActive: () => int, onResetGlobal(),
       noun: 'spedizioni' (per i testi del banner)
  } */
  const mount = typeof cfg.mount === 'string' ? $(cfg.mount) : cfg.mount;
  const noun = cfg.noun || 'righe';
  const state = {
    sortKey: null, sortDir: null,           // null | 'asc' | 'desc'
    colFilters: {},                          // key -> string | {min,max}
    page: 1, pageSize: cfg.pageSize || 10,
    selected: new Set(), allFilter: false
  };

  const colByKey = k => cfg.columns.find(c => c.key === k);

  function rawValue(col, r) {
    return col.filterValue ? col.filterValue(r) : (col.sortValue ? col.sortValue(r) : r[col.key]);
  }

  function filteredRows() {
    let rows = cfg.data();
    if (cfg.globalFilter) rows = rows.filter(cfg.globalFilter);
    for (const [key, f] of Object.entries(state.colFilters)) {
      const col = colByKey(key); if (!col) continue;
      rows = rows.filter(r => {
        const v = rawValue(col, r);
        if (col.ftype === 'text')  return f === '' || String(v ?? '').toLowerCase().includes(f.toLowerCase());
        if (col.ftype === 'enum')  return f === '' || String(v) === f;
        if (col.ftype === 'number') {
          const n = Number(v);
          if (f.min !== '' && f.min != null && n < Number(f.min)) return false;
          if (f.max !== '' && f.max != null && n > Number(f.max)) return false;
          return true;
        }
        if (col.ftype === 'date') {
          const d = String(v ?? '');
          if (f.min && d.slice(0, 10) < f.min) return false;
          if (f.max && d.slice(0, 10) > f.max) return false;
          return true;
        }
        return true;
      });
    }
    return rows;
  }

  function sortedRows(rows) {
    if (!state.sortKey || !state.sortDir) return rows;      // ordine originale
    const col = colByKey(state.sortKey);
    const dir = state.sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      let va = col.sortValue ? col.sortValue(a) : a[col.key];
      let vb = col.sortValue ? col.sortValue(b) : b[col.key];
      if (col.statusOrder) {                                 // badge di stato: priorità logica
        va = col.statusOrder.indexOf(va); vb = col.statusOrder.indexOf(vb);
      }
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va ?? '').localeCompare(String(vb ?? ''), 'it', { numeric: true }) * dir;
    });
  }

  function activeFilterCount() {
    let n = 0;
    for (const f of Object.values(state.colFilters)) {
      if (typeof f === 'string') { if (f !== '') n++; }
      else if (f && (f.min || f.max)) n++;
    }
    if (cfg.countGlobalActive) n += cfg.countGlobalActive();
    return n;
  }

  function getSelection() {
    const filt = filteredRows();
    if (state.allFilter) return { mode: 'filter', rows: filt };
    const rows = filt.filter(r => state.selected.has(cfg.rowKey(r)));
    return { mode: 'rows', rows };
  }

  function clearSelection() { state.selected.clear(); state.allFilter = false; }

  // Ripristino del focus sui filtri dopo il re-render.
  // NB: deve vivere a livello di istanza (non dentro render()), altrimenti
  // ogni re-render riparte da null e il ripristino è sempre "in ritardo".
  let refocusSel = null;
  function refocus(inp) {
    let pos = null;
    try { pos = inp.selectionStart; } catch (e) { /* alcuni tipi input non lo supportano */ }
    refocusSel = { colkey: inp.dataset.colkey, ph: inp.placeholder, pos };
  }

  const api = {
    refresh: render,
    resetToFirstPage: () => { state.page = 1; },
    getSelection, clearSelection,
    getFilteredRows: filteredRows,
    onFiltersChanged: () => { state.page = 1; clearSelection(); render(); },
    state
  };

  function render() {
    const filt = filteredRows();
    const sorted = sortedRows(filt);
    const totPages = Math.max(1, Math.ceil(sorted.length / state.pageSize));
    if (state.page > totPages) state.page = totPages;
    const start = (state.page - 1) * state.pageSize;
    const pageRows = sorted.slice(start, start + state.pageSize);

    mount.innerHTML = '';
    const wrap = el('div', { class: 'dt-wrap' });

    /* ---- Toolbar: titolo, azioni massive, filtri attivi ---- */
    const tb = el('div', { class: 'dt-toolbar' });
    if (cfg.title) tb.appendChild(el('span', { class: 'dt-title' }, esc(cfg.title)));
    (cfg.bulkActions || []).forEach(a => {
      tb.appendChild(el('button', { class: `btn btn-sm ${a.cls || ''}`, onclick: () => a.run(getSelection(), api) }, a.label));
    });
    tb.appendChild(el('span', { class: 'spacer' }));
    const nf = activeFilterCount();
    if (nf > 0) tb.appendChild(el('span', { class: 'dt-filter-count' }, `${nf} filtr${nf === 1 ? 'o' : 'i'} attiv${nf === 1 ? 'o' : 'i'}`));
    tb.appendChild(el('button', {
      class: 'btn btn-sm', disabled: nf === 0 ? 'disabled' : null,
      onclick: () => { state.colFilters = {}; cfg.onResetGlobal && cfg.onResetGlobal(); api.onFiltersChanged(); }
    }, 'Reset filtri'));
    // rimuovi attributo disabled=null
    if (nf === 0) tb.lastChild.setAttribute('disabled', ''); else tb.lastChild.removeAttribute('disabled');
    wrap.appendChild(tb);

    /* ---- Banner di selezione (pagina → intero filtro) ---- */
    if (cfg.selectable) {
      const selCount = filt.filter(r => state.selected.has(cfg.rowKey(r))).length;
      if (state.allFilter) {
        const b = el('div', { class: 'dt-selection-banner allfilter' });
        b.innerHTML = `✔ Sono selezionate <strong>tutte le ${filt.length} ${esc(noun)}</strong> che rispettano il filtro attivo (anche oltre la pagina visibile). `;
        b.appendChild(el('button', { class: 'btn-link', onclick: () => { clearSelection(); render(); } }, 'Annulla selezione'));
        wrap.appendChild(b);
      } else if (selCount > 0) {
        const b = el('div', { class: 'dt-selection-banner' });
        b.innerHTML = `Hai selezionato <strong>${selCount}</strong> righe${selCount >= pageRows.length ? ' di questa pagina' : ''}. `;
        if (filt.length > selCount) {
          b.appendChild(el('button', { class: 'btn-link', onclick: () => { state.allFilter = true; render(); } },
            `Seleziona tutte le ${filt.length} ${esc(noun)} che rispettano il filtro attivo`));
        }
        wrap.appendChild(b);
      }
    }

    /* ---- Tabella ---- */
    const scroll = el('div', { class: 'dt-scroll' });
    const table = el('table', { class: 'dt' });
    const thead = el('thead');

    // riga 1: intestazioni ordinabili
    const trH = el('tr');
    if (cfg.selectable) {
      const th = el('th', { style: 'width:34px' });
      const all = el('input', { type: 'checkbox', title: 'Seleziona tutto (pagina)' });
      all.checked = pageRows.length > 0 && pageRows.every(r => state.allFilter || state.selected.has(cfg.rowKey(r)));
      all.addEventListener('change', () => {
        state.allFilter = false;
        pageRows.forEach(r => all.checked ? state.selected.add(cfg.rowKey(r)) : state.selected.delete(cfg.rowKey(r)));
        render();
      });
      th.appendChild(all); trH.appendChild(th);
    }
    cfg.columns.forEach(col => {
      const sortable = col.sortable !== false;
      const th = el('th', { class: (sortable ? 'sortable' : '') + (state.sortKey === col.key && state.sortDir ? ' sorted' : '') });
      const ico = state.sortKey === col.key ? (state.sortDir === 'asc' ? '▲' : state.sortDir === 'desc' ? '▼' : '↕') : '↕';
      th.innerHTML = `${esc(col.label)} ${sortable ? `<span class="sort-ico">${ico}</span>` : ''}`;
      if (sortable) th.addEventListener('click', () => {
        if (state.sortKey !== col.key) { state.sortKey = col.key; state.sortDir = 'asc'; }
        else if (state.sortDir === 'asc') state.sortDir = 'desc';
        else if (state.sortDir === 'desc') { state.sortKey = null; state.sortDir = null; }  // ritorno all'ordine originale
        else state.sortDir = 'asc';
        state.page = 1;
        render();
      });
      trH.appendChild(th);
    });
    if (cfg.rowActions) trH.appendChild(el('th', {}, 'Azioni'));
    thead.appendChild(trH);

    // riga 2: filtri per colonna
    const trF = el('tr', { class: 'dt-filter-row' });
    if (cfg.selectable) trF.appendChild(el('th'));
    cfg.columns.forEach(col => {
      const th = el('th');
      if (col.ftype === 'text') {
        const inp = el('input', { class: 'dt-colfilter', 'data-colkey': col.key, placeholder: 'contiene…', value: state.colFilters[col.key] || '' });
        // refocus() PRIMA di onFiltersChanged(): il render deve trovare refocusSel già valorizzato
        inp.addEventListener('input', () => { state.colFilters[col.key] = inp.value; refocus(inp); api.onFiltersChanged(); });
        th.appendChild(inp);
      } else if (col.ftype === 'enum') {
        const sel = el('select', { class: 'dt-colfilter' });
        const vals = [...new Set(cfg.data().map(r => String(rawValue(col, r) ?? '')))].sort((a, b) => a.localeCompare(b, 'it'));
        sel.appendChild(el('option', { value: '' }, 'Tutti'));
        vals.forEach(v => sel.appendChild(el('option', { value: v }, esc(v || '—'))));
        sel.value = state.colFilters[col.key] || '';
        sel.addEventListener('change', () => { state.colFilters[col.key] = sel.value; api.onFiltersChanged(); });
        th.appendChild(sel);
      } else if (col.ftype === 'number' || col.ftype === 'date') {
        const cur = state.colFilters[col.key] || { min: '', max: '' };
        const box = el('div', { class: 'dt-range' });
        const t = col.ftype === 'date' ? 'date' : 'number';
        const mi = el('input', { class: 'dt-colfilter', 'data-colkey': col.key, type: t, placeholder: 'da', value: cur.min });
        const ma = el('input', { class: 'dt-colfilter', 'data-colkey': col.key, type: t, placeholder: 'a', value: cur.max });
        const upd = focusEl => () => { state.colFilters[col.key] = { min: mi.value, max: ma.value }; refocus(focusEl); api.onFiltersChanged(); };
        mi.addEventListener('change', upd(mi)); ma.addEventListener('change', upd(ma));
        box.appendChild(mi); box.appendChild(ma); th.appendChild(box);
      }
      trF.appendChild(th);
    });
    if (cfg.rowActions) trF.appendChild(el('th'));
    thead.appendChild(trF);
    table.appendChild(thead);

    /* ---- Corpo ---- */
    const tbody = el('tbody');
    if (!pageRows.length) {
      const tr = el('tr');
      const td = el('td', { colspan: cfg.columns.length + (cfg.selectable ? 1 : 0) + (cfg.rowActions ? 1 : 0) });
      td.innerHTML = `<div class="dt-empty">Nessun risultato con i filtri attivi.<br><span class="tiny">Usa «Reset filtri» per ripartire dall'elenco completo.</span></div>`;
      tr.appendChild(td); tbody.appendChild(tr);
    }
    pageRows.forEach(r => {
      const key = cfg.rowKey(r);
      const tr = el('tr', { class: [cfg.onRowClick ? 'clickable' : '', (state.allFilter || state.selected.has(key)) ? 'selected' : '', cfg.rowClass ? (cfg.rowClass(r) || '') : ''].join(' ') });
      if (cfg.selectable) {
        const td = el('td');
        const cb = el('input', { type: 'checkbox' });
        cb.checked = state.allFilter || state.selected.has(key);
        cb.addEventListener('click', e => e.stopPropagation());
        cb.addEventListener('change', () => {
          if (state.allFilter) { state.allFilter = false; filt.forEach(x => state.selected.add(cfg.rowKey(x))); }
          cb.checked ? state.selected.add(key) : state.selected.delete(key);
          render();
        });
        td.appendChild(cb); tr.appendChild(td);
      }
      cfg.columns.forEach(col => {
        const td = el('td', { class: col.numeric ? 'num' : '' });
        if (col.render) { const out = col.render(r, api); if (out instanceof HTMLElement) td.appendChild(out); else td.innerHTML = out; }
        else td.textContent = r[col.key] ?? '—';
        tr.appendChild(td);
      });
      if (cfg.rowActions) {
        const td = el('td');
        td.addEventListener('click', e => e.stopPropagation());
        const out = cfg.rowActions(r, api);
        if (out) td.appendChild(out);
        tr.appendChild(td);
      }
      if (cfg.onRowClick) tr.addEventListener('click', () => cfg.onRowClick(r));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);
    wrap.appendChild(scroll);

    /* ---- Paginazione ---- */
    const pager = el('div', { class: 'dt-pager' });
    const from = sorted.length ? start + 1 : 0;
    const to = Math.min(start + state.pageSize, sorted.length);
    pager.appendChild(el('span', {}, `${from}–${to} di <strong>${sorted.length}</strong> risultati (dopo i filtri)` + (sorted.length !== cfg.data().length ? ` <span class="tiny">· ${cfg.data().length} totali</span>` : '')));
    pager.appendChild(el('span', { class: 'spacer' }));
    const psLabel = el('label', {}, 'Righe per pagina ');
    const psSel = el('select');
    (cfg.pageSizes || [10, 25, 50]).forEach(n => psSel.appendChild(el('option', { value: n }, n)));
    psSel.value = state.pageSize;
    psSel.addEventListener('change', () => { state.pageSize = +psSel.value; state.page = 1; render(); });
    psLabel.appendChild(psSel);
    pager.appendChild(psLabel);
    const prev = el('button', { class: 'pg-btn', onclick: () => { state.page--; render(); } }, '‹ Prec');
    const next = el('button', { class: 'pg-btn', onclick: () => { state.page++; render(); } }, 'Succ ›');
    if (state.page <= 1) prev.setAttribute('disabled', '');
    if (state.page >= totPages) next.setAttribute('disabled', '');
    pager.appendChild(prev);
    pager.appendChild(el('span', { class: 'pg-num' }, `Pagina ${state.page} / ${totPages}`));
    pager.appendChild(next);
    wrap.appendChild(pager);

    mount.appendChild(wrap);

    // ripristino focus e posizione cursore sul filtro attivo dopo re-render:
    // matching univoco per colonna (data-colkey) + placeholder (distingue "da"/"a" dei range)
    if (refocusSel) {
      const cand = $$('input.dt-colfilter', wrap).find(i => i.dataset.colkey === refocusSel.colkey && i.placeholder === refocusSel.ph);
      if (cand) {
        cand.focus();
        if (refocusSel.pos != null) {
          try { cand.setSelectionRange(refocusSel.pos, refocusSel.pos); } catch (e) { /* input type non testuale */ }
        }
      }
      refocusSel = null;
    }
  }

  render();
  return api;
}

/* ---------------------------------------------------------- *
 * 8. Helper badge/celle comuni
 * ---------------------------------------------------------- */
const badge = (txt, cls = '') => `<span class="badge ${cls}">${esc(txt)}</span>`;
const badgeStato = s => badge(s, statoBadgeCls(s));
const badgeCap = ok => ok ? badge('CAP valido', 'ok') : badge('CAP da correggere', 'err');
const badgeTel = ok => ok ? badge('Formato E.164', 'ok') : badge('Non standard', 'warn');

/* ============================================================
   9. SEZIONE SPEDIZIONI
   ============================================================ */
let spedTab = ''; // '' = tab "Tutte"; altrimenti stato della sotto-tab attiva
let dtSpedizioni = null;

function initSpedTabs() {
  $$('#sped-tabs .tab-btn').forEach(b => b.addEventListener('click', () => {
    $$('#sped-tabs .tab-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    spedTab = b.dataset.stato;
    // stessa istanza dt-spedizioni: colonne, filtri di colonna, row actions e
    // onRowClick restano identici; il filtro di tab si combina in AND
    dtSpedizioni.onFiltersChanged();
  }));
}

function spedGlobalFilter(r) {
  if (spedTab && r.stato !== spedTab) return false; // sotto-tab attiva (AND con tutto il resto)
  return true;
}

/* ---- Verifica incompatibilità servizi/vettore su un gruppo ---- */
function incompatWarnings(rows, vettoreNome) {
  const bad = rows.filter(r => r.servizi.some(s => !servizioCompatibile(s, vettoreNome)));
  if (!bad.length) return [];
  const esempi = bad.slice(0, 3).map(r => `<span class="mono">${r.id}</span>`).join(', ');
  return [`<strong>${bad.length}</strong> spedizioni del gruppo hanno servizi accessori <strong>non supportati da ${esc(vettoreNome)}</strong> (es. ${esempi}${bad.length > 3 ? ', …' : ''}). Verranno assegnate comunque, ma i servizi incompatibili risulteranno disattivati.`];
}

/* ---- Azioni massive ---- */
function bulkAssegnaVettore(sel, api) {
  const body = el('div');
  body.innerHTML = `<p class="small muted">L'azione verrà applicata a <strong>${sel.rows.length}</strong> spedizioni (${sel.mode === 'filter' ? 'intero risultato del filtro corrente' : 'selezione con checkbox'}).</p>
    <div class="form-row"><label>Vettore da assegnare</label><select id="ba-vet">${VETTORI.map(v => `<option>${v.nome}</option>`).join('')}</select></div>
    <div id="ba-warn"></div>`;
  const refreshWarn = () => {
    const w = incompatWarnings(sel.rows, $('#ba-vet', body).value);
    $('#ba-warn', body).innerHTML = w.map(x => `<div class="warn-box">⚠️ ${x}</div>`).join('');
  };
  openModal({
    title: 'Assegna vettore a selezione/filtro', body,
    actions: [
      { label: 'Annulla' },
      { label: 'Continua', cls: 'btn-primary', onClick: (b, close) => {
          const vet = $('#ba-vet', b).value;
          close();
          confirmBulk({
            azione: `Assegna vettore «${vet}»`, count: sel.rows.length, mode: sel.mode,
            warnings: incompatWarnings(sel.rows, vet).map(x => x),
            onConfirm: () => {
              sel.rows.forEach(r => {
                r.vettore = vet;
                r.storico.push({ stato: r.stato, data: nowStr(), operatore: 'M. Bruzzone', nota: `Vettore assegnato: ${vet} (massivo)` });
              });
              api.clearSelection(); api.refresh();
              toast(`Vettore «${vet}» assegnato a ${sel.rows.length} spedizioni`, 'ok');
            }
          });
        } }
    ]
  });
  setTimeout(refreshWarn, 0);
  $('#ba-vet', body).addEventListener('change', refreshWarn);
}

function validaCambioStato(r, nuovoStato) {
  // Vincoli di transizione di stato: cliente e back office
  if (nuovoStato === 'Pronta per etichettatura' && !r.vettore) {
    return { ok: false, msg: `${r.id}: impossibile passare a «Pronta per etichettatura» senza un vettore assegnato` };
  }
  if (nuovoStato === 'In staging' && (!r.capValido || !r.telOk)) {
    return { ok: false, msg: `${r.id}: CAP e telefono devono essere validi per passare a «In staging» (correggere prima i dati)` };
  }
  // Da "In revisione" si esce solo promuovendo a "In staging" (o "In sospeso" per sospensione manuale)
  if (r.stato === 'In revisione' && nuovoStato !== 'In staging' && nuovoStato !== 'In sospeso') {
    return { ok: false, msg: `${r.id}: da «In revisione» si esce solo con «In staging» (dati validi) o «In sospeso» (sospensione manuale)` };
  }
  return { ok: true };
}

function bulkCambiaStato(sel, api) {
  const body = el('div');
  body.innerHTML = `<p class="small muted">L'azione verrà applicata a <strong>${sel.rows.length}</strong> spedizioni (${sel.mode === 'filter' ? 'intero risultato del filtro corrente' : 'selezione con checkbox'}).</p>
    <div class="form-row"><label>Nuovo stato</label><select id="bs-st">${STATI_SPED.map(s => `<option>${s}</option>`).join('')}</select></div>
    <div id="bs-warn"></div>`;
  const refreshWarn = () => {
    const st = $('#bs-st', body).value;
    const noVet = st === 'Pronta per etichettatura' ? sel.rows.filter(r => !r.vettore).length : 0;
    const noDati = st === 'In staging' ? sel.rows.filter(r => !r.capValido || !r.telOk).length : 0;
    const daRevisione = st !== 'In staging' && st !== 'In sospeso' ? sel.rows.filter(r => r.stato === 'In revisione').length : 0;
    let html = '';
    if (noVet)    html += `<div class="warn-box">⚠ <strong>${noVet}</strong> spedizioni senza vettore: non possono passare a «Pronta per etichettatura».</div>`;
    if (noDati)   html += `<div class="warn-box">⚠ <strong>${noDati}</strong> spedizioni con CAP o telefono non validi: non possono passare a «In staging».</div>`;
    if (daRevisione) html += `<div class="warn-box">⚠ <strong>${daRevisione}</strong> spedizioni sono attualmente in «In revisione»: da questo stato si esce solo con «In staging» o «In sospeso».</div>`;
    if (!html)    html = `<div class="info-box">✔ Nessuna restrizione: tutte le ${sel.rows.length} spedizioni possono passare a «${esc(st)}».</div>`;
    $('#bs-warn', body).innerHTML = html;
  };
  openModal({
    title: 'Cambia stato a selezione/filtro', body,
    actions: [
      { label: 'Annulla' },
      { label: 'Continua', cls: 'btn-primary', onClick: (b, close) => {
          const st = $('#bs-st', b).value;
          close();
          // Quante verranno effettivamente modificate? (filtrate per i vincoli)
          const ok = sel.rows.filter(r => validaCambioStato(r, st).ok);
          const ko = sel.rows.length - ok.length;
          confirmBulk({
            azione: `Cambia stato in «${st}»`, count: ok.length, mode: sel.mode,
            warnings: ko ? [`<strong>${ko}</strong> spedizioni non possono passare a «${st}» per i vincoli (CAP/tel non validi, vettore mancante, o transizione non consentita dallo stato attuale) e verranno <strong>saltate</strong>.`] : [],
            onConfirm: () => {
              ok.forEach(r => { r.stato = st; r.storico.push({ stato: st, data: nowStr(), operatore: 'M. Bruzzone' }); });
              api.clearSelection(); api.refresh();
              toast(`Stato «${st}» applicato a ${ok.length} spedizioni${ko ? ` (${ko} saltate)` : ''}`, 'ok');
            }
          });
        } }
    ]
  });
  setTimeout(refreshWarn, 0);
  $('#bs-st', body).addEventListener('change', refreshWarn);
}

function bulkApplicaServizio(sel, api) {
  const body = el('div');
  body.innerHTML = `<p class="small muted">Applica un servizio accessorio a <strong>${sel.rows.length}</strong> spedizioni.</p>
    <div class="form-row"><label>Servizio accessorio</label><select id="bsv">${SERVIZI.map(s => `<option>${s}</option>`).join('')}</select></div>
    <div id="bsv-warn"></div>`;
  const refreshWarn = () => {
    const sv = $('#bsv', body).value;
    const bad = sel.rows.filter(r => r.vettore && !servizioCompatibile(sv, r.vettore));
    $('#bsv-warn', body).innerHTML = bad.length ? `<div class="warn-box">⚠️ <strong>${bad.length}</strong> spedizioni hanno un vettore che <strong>non supporta «${esc(sv)}»</strong>: per queste il servizio sarà aggiunto come «richiesto, non attivabile».</div>` : `<div class="info-box">✔ Il servizio è compatibile con i vettori di tutte le spedizioni del gruppo.</div>`;
  };
  openModal({
    title: 'Applica servizio accessorio', body,
    actions: [
      { label: 'Annulla' },
      { label: 'Continua', cls: 'btn-primary', onClick: (b, close) => {
          const sv = $('#bsv', b).value; close();
          const bad = sel.rows.filter(r => r.vettore && !servizioCompatibile(sv, r.vettore)).length;
          confirmBulk({
            azione: `Applica servizio «${sv}»`, count: sel.rows.length, mode: sel.mode,
            warnings: bad ? [`${bad} spedizioni hanno vettori incompatibili con il servizio scelto.`] : [],
            onConfirm: () => {
              sel.rows.forEach(r => { if (!r.servizi.includes(sv)) r.servizi.push(sv); });
              api.clearSelection(); api.refresh();
              toast(`Servizio «${sv}» applicato a ${sel.rows.length} spedizioni`, 'ok');
            }
          });
        } }
    ]
  });
  setTimeout(refreshWarn, 0);
  $('#bsv', body).addEventListener('change', refreshWarn);
}

function bulkCorreggiCap(sel, api) {
  // opera SEMPRE sull'intero filtro attivo (come da requisito), non solo sulla selezione
  const target = api.getFilteredRows().filter(r => !r.capValido);
  // Auto-promozione a "In staging" solo per le spedizioni attualmente in revisione
  // (o in sospeso con CAP non valido): CAP appena corretto, se anche il telefono è ok → staging.
  const promoCount = () => target.filter(r => (r.stato === 'In revisione' || r.stato === 'In sospeso') && r.telOk).length;
  confirmBulk({
    azione: 'Correggi CAP non validi (mock)', count: target.length, mode: 'filter',
    dettagli: 'Vengono considerate solo le righe con stato «CAP da correggere» all\'interno del risultato del filtro corrente. Le spedizioni attualmente in «In revisione» (o «In sospeso») con telefono già valido vengono promosse automaticamente a «In staging».',
    onConfirm: () => {
      let promo = 0;
      target.forEach(r => {
        const loc = LOCALITA.find(l => l[0] === r.localita);
        r.cap = loc ? loc[2] : '16121'; r.capValido = true;
        // auto-promozione: CAP appena corretto, tel già ok → passa a staging
        if ((r.stato === 'In revisione' || r.stato === 'In sospeso') && r.telOk) {
          r.stato = 'In staging';
          r.storico.push({ stato: 'In staging', data: nowStr(), operatore: 'M. Bruzzone', nota: 'CAP corretto e validato — promozione automatica a staging' });
          r.tracking.push({ data: nowStr(), evento: 'CAP corretto — dati anagrafici validati, in attesa di assegnazione vettore', luogo: 'Back office', interno: true, operatore: 'M. Bruzzone', notaInterna: 'Auto-promo a staging post-correzione CAP massiva' });
          promo++;
        }
      });
      api.refresh();
      toast(`${target.length} CAP corretti${promo ? ` — ${promo} promozioni automatiche a «In staging»` : ''}`, 'ok');
    }
  });
}

function bulkNormalizzaTel(sel, api) {
  const target = api.getFilteredRows().filter(r => !r.telOk);
  confirmBulk({
    azione: 'Normalizza numeri di telefono (mock)', count: target.length, mode: 'filter',
    dettagli: 'I numeri in formato non standard vengono riportati al formato internazionale +39 per l\'invio SMS. Le spedizioni attualmente in «In revisione» (o «In sospeso») con CAP già valido vengono promosse automaticamente a «In staging».',
    onConfirm: () => {
      let promo = 0;
      target.forEach(r => {
        r.telefono = '+39 3' + rint(20, 89) + ' ' + rint(1000000, 9999999); r.telOk = true;
        if ((r.stato === 'In revisione' || r.stato === 'In sospeso') && r.capValido) {
          r.stato = 'In staging';
          r.storico.push({ stato: 'In staging', data: nowStr(), operatore: 'M. Bruzzone', nota: 'Telefono normalizzato — promozione automatica a staging' });
          r.tracking.push({ data: nowStr(), evento: 'Telefono normalizzato — dati anagrafici validati, in attesa di assegnazione vettore', luogo: 'Back office', interno: true, operatore: 'M. Bruzzone', notaInterna: 'Auto-promo a staging post-normalizzazione telefono massiva' });
          promo++;
        }
      });
      api.refresh();
      toast(`${target.length} numeri normalizzati${promo ? ` — ${promo} promozioni automatiche a «In staging»` : ''}`, 'ok');
    }
  });
}

/* ---- Tabella principale spedizioni ---- */
function initSpedTable() {
  const isMandante = currentUser?.livello === 'Mandante/Sottocontratto';
  const dataSrc = isMandante ? spedizioniVisibili(SPEDIZIONI) : SPEDIZIONI;
  dtSpedizioni = renderDataTable({
    mount: '#dt-spedizioni',
    title: 'Elenco spedizioni',
    noun: 'spedizioni',
    data: () => dataSrc,
    rowKey: r => r.id,
    selectable: true,
    pageSize: 10,
    globalFilter: spedGlobalFilter,
    onRowClick: r => openShipDetail(r.id, 'modal'),
    columns: [
      { key: 'id', label: 'ID spedizione', ftype: 'text', render: r => `<span class="mono" style="color:var(--brand);font-weight:600">${r.id}</span>${r.colloMadre ? ' <span class="tag" title="Fa parte di un collo madre">CM</span>' : ''}` },
      { key: 'mandante', label: 'Mandante', ftype: 'enum' },
      { key: 'destinatario', label: 'Destinatario', ftype: 'text' },
      { key: 'cap', label: 'CAP', ftype: 'text', render: r => `<span class="mono">${esc(r.cap)}</span>` },
      { key: 'localita', label: 'Località', ftype: 'text' },
      { key: 'provincia', label: 'Prov.', ftype: 'enum' },
      { key: 'capValido', label: 'Validazione', ftype: 'enum', filterValue: r => r.capValido ? 'CAP valido' : 'CAP da correggere', sortValue: r => r.capValido ? 1 : 0, render: r => badgeCap(r.capValido) },
      { key: 'telefono', label: 'Telefono', ftype: 'text', render: r => `<span class="mono">${esc(r.telefono)}</span><br>${badgeTel(r.telOk)}` },
      { key: 'vettore', label: 'Vettore', ftype: 'enum', filterValue: r => r.vettore || '— non assegnato —',
        render: (r, api) => {
          const sel = el('select', { class: 'inline-select' });
          sel.appendChild(el('option', { value: '' }, '— assegna —'));
          VETTORI.forEach(v => sel.appendChild(el('option', { value: v.nome }, v.nome)));
          sel.value = r.vettore || '';
          sel.addEventListener('click', e => e.stopPropagation());
          sel.addEventListener('change', () => {
            r.vettore = sel.value || null;
            toast(`Vettore ${sel.value ? 'assegnato' : 'rimosso'}: ${r.id}`);
            api.refresh();
          });
          return sel;
        } },
      { key: 'stato', label: 'Stato', ftype: 'enum', statusOrder: STATO_PRIORITA,
        render: (r, api) => {
          const box = el('div');
          box.innerHTML = badgeStato(r.stato) + '<br>';
          const sel = el('select', { class: 'inline-select', style: 'margin-top:3px' });
          STATI_SPED.forEach(s => sel.appendChild(el('option', {}, s)));
          sel.value = r.stato;
          sel.addEventListener('click', e => e.stopPropagation());
          sel.addEventListener('change', () => {
            const target = sel.value;
            // Validazione: niente cambi di stato che violino i vincoli di flusso
            const check = validaCambioStato(r, target);
            if (!check.ok) {
              toast(check.msg, 'err');
              sel.value = r.stato; // ripristina la selezione precedente
              return;
            }
            r.stato = target;
            r.storico.push({ stato: target, data: nowStr(), operatore: 'M. Bruzzone' });
            r.tracking.push({ data: nowStr(), evento: 'Cambio stato da elenco', luogo: 'Back office', interno: true, operatore: 'M. Bruzzone', notaInterna: `Cambio manuale: ${r.stato} → ${target}` });
            api.refresh();
            toast(`${r.id} → ${target}`, 'ok');
          });
          box.appendChild(sel);
          return box;
        } },
      { key: 'pesoDich', label: 'Peso (kg)', ftype: 'number', numeric: true, render: r => r.pesoDich.toFixed(1) },
      { key: 'dataIn', label: 'Ingresso', ftype: 'date', render: r => `<span class="mono tiny">${r.dataIn}</span>` }
    ],
    rowActions: (r) => {
      const box = el('div', { style: 'display:flex;gap:4px;flex-wrap:wrap' });
      box.appendChild(el('button', { class: 'btn btn-sm', title: 'Apri in tab dedicata', onclick: () => openShipDetail(r.id, 'tab') }, 'Apri ↗'));
      if (r.stato === 'Pronta per etichettatura') box.appendChild(el('button', { class: 'btn btn-sm btn-accent', onclick: () => openLdv(r) }, 'LDV'));
      return box;
    },
    bulkActions: [
      { label: 'Assegna vettore a selezione/filtro', cls: 'btn-primary', run: bulkAssegnaVettore },
      { label: 'Cambia stato a selezione/filtro', cls: 'btn-primary', run: bulkCambiaStato },
      { label: 'Applica servizio accessorio', run: bulkApplicaServizio },
      { label: 'Correggi CAP non validi (filtro)', cls: 'btn-accent', run: bulkCorreggiCap },
      { label: 'Normalizza numeri (filtro)', run: bulkNormalizzaTel }
    ]
  });
  // banner di scope per il profilo Mandante: spiega perché la lista è già filtrata
  if (isMandante) {
    const sub = $('#view-spedizioni #sped-list-wrap .view-header .sub');
    if (sub) sub.textContent = `Mostro solo le spedizioni del mandante ${currentUser.mandante} (le altre sono filtrate lato permesso).`;
  }
}

/* ---- Lettera di vettura (preview simulata) ---- */
const STAMPANTI = ['Stampante Magazzino 1', 'Stampante Ufficio spedizioni', 'Stampante mobile — palmare'];
let ultimaStampante = STAMPANTI[0]; // memorizza la scelta per tutta la sessione

function openLdv(r) {
  if (!r.ldv) r.ldv = `LDV-2026-0${1100 + rint(200, 900)}`;
  const html = `
  <div class="ldv">
    <div class="ldv-head">
      <div><div class="ldv-title">Lettera di vettura</div><div class="mono small">${r.ldv}</div></div>
      <div class="ldv-barcode" aria-label="barcode simulato"></div>
    </div>
    <div class="ldv-grid">
      <div class="ldv-cell"><div class="lbl">Mittente / Mandante</div><strong>${esc(r.mandante)}</strong><br>c/o CT Solution — Centro smistamento<br>Genova Bolzaneto</div>
      <div class="ldv-cell"><div class="lbl">Destinatario</div><strong>${esc(r.destinatario)}</strong><br>${esc(r.indirizzo)}<br><span class="mono">${esc(r.cap)}</span> ${esc(r.localita)} (${esc(r.provincia)})</div>
      <div class="ldv-cell"><div class="lbl">Codice spedizione</div><span class="mono">${r.id}</span></div>
      <div class="ldv-cell"><div class="lbl">Vettore</div>${esc(r.vettore || 'NON ASSEGNATO')}</div>
      <div class="ldv-cell"><div class="lbl">Peso / dimensioni</div>${r.pesoDich.toFixed(1)} kg — ${esc(r.dims)}</div>
      <div class="ldv-cell"><div class="lbl">Servizi accessori</div>${r.servizi.length ? r.servizi.map(s => `<span class="tag">${esc(s)}</span>`).join('') : '<span class="muted">nessuno</span>'}</div>
    </div>
    <div class="ldv-foot">Documento di trasporto simulato — demo CT Solution. La stampa reale avverrà sul formato etichetta del vettore selezionato in base al CAP di destinazione e alle regole del mandante.</div>
  </div>
  <div class="form-row" style="margin-top:14px;max-width:340px">
    <label>Stampante</label>
    <select id="ldv-printer">${STAMPANTI.map(p => `<option${p === ultimaStampante ? ' selected' : ''}>${p}</option>`).join('')}</select>
  </div>
  ${r.stato === 'Pronta per etichettatura' ? '<div class="info-box">Alla conferma di stampa la spedizione avanzerà allo stato «Pronto per la spedizione».</div>' : '<div class="tiny">LDV già stampata in precedenza: la ristampa non modifica lo stato della spedizione.</div>'}`;
  openModal({
    title: 'Genera lettera di vettura — anteprima', body: html, size: 'wide',
    actions: [
      { label: 'Chiudi' },
      { label: 'Stampa (simulata)', cls: 'btn-primary', onClick: (bd) => {
          const stampante = $('#ldv-printer', bd).value;
          ultimaStampante = stampante; // preselezionata alle prossime aperture
          // stampa da "Pronta per etichettatura" → avanzamento a "Pronto per la spedizione"
          if (r.stato === 'Pronta per etichettatura') {
            r.stato = 'Pronto per la spedizione';
            r.storico.push({ stato: 'Pronto per la spedizione', data: nowStr(), operatore: 'M. Bruzzone' });
            r.tracking.push({ data: nowStr(), evento: 'LDV generata e stampata — spedizione pronta per il ritiro/affidamento al vettore', luogo: 'Centro di smistamento — Genova Bolzaneto', interno: false, operatore: 'M. Bruzzone' });
            if (dtSpedizioni) dtSpedizioni.refresh();
            toast(`LDV ${r.ldv} inviata a: ${stampante} — ${r.id} → Pronto per la spedizione`, 'ok');
          } else {
            toast(`LDV ${r.ldv} inviata a: ${stampante}`, 'ok'); // ristampa: nessun cambio di stato
          }
        } }
    ]
  });
}

/* ---- Kanban coda di staging ---- */
function renderKanban() {
  const isMandante = currentUser?.livello === 'Mandante/Sottocontratto';
  const src = isMandante ? spedizioniVisibili(SPEDIZIONI) : SPEDIZIONI;
  const cols = [
    { titolo: 'In revisione', stati: ['In revisione'], next: 'In staging', nextLabel: 'Valida dati → Staging' },
    { titolo: 'In staging', stati: ['In staging'], next: 'Pronta per etichettatura', nextLabel: 'Vettore ok → Pronta per etichettatura', needVettore: true },
    { titolo: 'Pronte per etichettatura', stati: ['Pronta per etichettatura'], next: null, nextLabel: null }
  ];
  const root = $('#staging-kanban'); root.innerHTML = '';
  cols.forEach(c => {
    const rows = src.filter(s => c.stati.includes(s.stato)).slice(0, 6);
    const tot = src.filter(s => c.stati.includes(s.stato)).length;
    const col = el('div', { class: 'kanban-col' });
    col.appendChild(el('h4', {}, `${esc(c.titolo)} <span class="count">${tot}</span>`));
    rows.forEach(r => {
      const card = el('div', { class: 'kcard', onclick: () => openShipDetail(r.id, 'modal') });
      card.innerHTML = `<div class="k-id">${r.id}</div>
        <div class="k-dest">${esc(r.destinatario)} · ${esc(r.localita)}</div>
        <div class="k-meta">${esc(r.mandante)} · ${r.vettore ? esc(r.vettore) : '<span style="color:var(--warn)">vettore da assegnare</span>'} ${r.stato === 'Pronta per etichettatura' ? badge('Pronta', 'accent') : ''}</div>`;
      const act = el('div', { class: 'k-actions' });
      if (c.next && r.stato !== 'Pronta per etichettatura') {
        const btn = el('button', { class: 'btn btn-sm btn-primary', onclick: e => {
          e.stopPropagation();
          if (c.needVettore && !r.vettore) { toast(`⚠ ${r.id}: assegnare prima un vettore`, 'err'); return; }
          r.stato = c.next;
          r.storico.push({ stato: c.next, data: nowStr(), operatore: 'M. Bruzzone' });
          renderKanban(); dtSpedizioni.refresh();
          toast(`${r.id} → ${c.next}`, 'ok');
        } }, 'Avanza di stato ▸');
        act.appendChild(btn);
      } else {
        act.appendChild(el('button', { class: 'btn btn-sm btn-accent', onclick: e => { e.stopPropagation(); openLdv(r); } }, 'Genera LDV'));
      }
      card.appendChild(act);
      col.appendChild(card);
    });
    if (tot > 6) col.appendChild(el('div', { class: 'tiny', style: 'text-align:center;padding:4px' }, `… e altre ${tot - 6} (vedi tabella con filtro stato)`));
    root.appendChild(col);
  });
}
/* ---- Dettaglio spedizione: contenuto condiviso modale/tab ---- */
function buildShipDetail(r, variant) {
  const wrap = el('div');

  const head = el('div', { class: 'ship-head' });
  head.innerHTML = `<div class="barcode" aria-hidden="true"></div>
    <div><div class="ship-id">${r.id}</div><div class="ship-sub">${esc(r.mandante)} → ${esc(r.destinatario)}, ${esc(r.localita)} (${esc(r.provincia)})</div></div>
    <span class="spacer"></span>
    ${badgeStato(r.stato)}`;
  if (variant === 'modal') {
    head.appendChild(el('button', { class: 'btn btn-sm', style: 'background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.3);color:#fff', onclick: () => { $('.modal-backdrop') && $('.modal-backdrop').remove(); openShipDetail(r.id, 'tab'); } }, 'Apri come tab ↗'));
  }
  wrap.appendChild(head);

  const grid = el('div', { class: 'detail-grid' });
  const colA = el('div'); const colB = el('div');

  /* Anagrafica */
  colA.appendChild(el('div', { class: 'detail-block' }, `
    <h4>Anagrafica</h4>
    <dl class="kv">
      <dt>Mandante</dt><dd>${esc(r.mandante)}</dd>
      <dt>Destinatario</dt><dd>${esc(r.destinatario)}</dd>
      <dt>Indirizzo</dt><dd>${esc(r.indirizzo)}, <span class="mono">${esc(r.cap)}</span> ${esc(r.localita)} (${esc(r.provincia)})</dd>
      <dt>Validazione CAP</dt><dd>${badgeCap(r.capValido)}</dd>
      <dt>Telefono</dt><dd><span class="mono">${esc(r.telefono)}</span> ${badgeTel(r.telOk)}</dd>
      <dt>Ingresso flusso</dt><dd><span class="mono">${r.dataIn}</span></dd>
    </dl>`));

  /* Stato e vettore */
  const sv = el('div', { class: 'detail-block' });
  sv.innerHTML = `<h4>Stato e vettore</h4>
    <dl class="kv">
      <dt>Stato corrente</dt><dd id="sv-stato">${badgeStato(r.stato)}</dd>
      <dt>Vettore</dt><dd id="sv-vettore">${r.vettore ? esc(r.vettore) + (vettoreByNome(r.vettore).tipo === 'proprio' ? ' ' + badge('linea propria', 'brand') : ' ' + badge('corriere terzo', 'info')) : badge('non assegnato', 'warn')}</dd>
      <dt>Servizi accessori</dt><dd id="sv-servizi">${r.servizi.length ? r.servizi.map(s => `<span class="tag ${servizioCompatibile(s, r.vettore) ? '' : 'incompat'}" title="${servizioCompatibile(s, r.vettore) ? 'Compatibile con il vettore' : 'NON supportato dal vettore assegnato'}">${esc(s)}${servizioCompatibile(s, r.vettore) ? '' : ' ⚠'}</span>`).join('') : '<span class="muted">nessuno</span>'}</dd>
    </dl>
    <h4 style="margin-top:12px">Storico passaggi di stato</h4>`;
  const ol = el('ul', { class: 'timeline' });
  [...r.storico].reverse().forEach(h => {
    ol.appendChild(el('li', { class: h.stato === 'Consegnata' ? 'done' : '' }, `
      <div class="t-when">${h.data}</div>
      <div class="t-what">${esc(h.stato)}${h.nota ? ` — <span class="muted small">${esc(h.nota)}</span>` : ''}</div>
      <div class="t-where">Operatore: ${esc(h.operatore)}</div>`));
  });
  sv.appendChild(ol);
  colA.appendChild(sv);

  /* Documenti collegati */
  colA.appendChild(el('div', { class: 'detail-block' }, `
    <h4>Documenti collegati</h4>
    <dl class="kv">
      <dt>Lettera di vettura</dt><dd>${r.ldv ? `<button class="btn-link" onclick="openLdv(spedById('${r.id}'))"><span class="mono">${r.ldv}</span> — apri anteprima</button>` : '<span class="muted">non ancora generata</span>'}</dd>
      <dt>Collo madre</dt><dd>${r.colloMadre ? `<span class="mono">${r.colloMadre}</span> — <button class="btn-link" onclick="gotoColli()">vai alla vista ad albero</button>` : '<span class="muted">spedizione singola</span>'}</dd>
    </dl>`));

  /* Differenziale peso */
  if (r.pesoReale !== r.pesoDich) {
    const d = +(r.pesoReale - r.pesoDich).toFixed(1);
    colA.appendChild(el('div', { class: 'detail-block' }, `
      <h4>Differenziale peso/misure</h4>
      <dl class="kv">
        <dt>Peso dichiarato</dt><dd>${r.pesoDich.toFixed(1)} kg</dd>
        <dt>Peso rilevato</dt><dd>${r.pesoReale.toFixed(1)} kg</dd>
        <dt>Differenza</dt><dd><strong style="color:${d > 0 ? 'var(--err)' : 'var(--ok)'}">${d > 0 ? '+' : ''}${d.toFixed(1)} kg</strong></dd>
        <dt>Impatto economico</dt><dd>${d > 0 ? fmtEur(d * 1.4) + ' di extra-costo stimato da riaddebitare' : 'nessun extra-costo'}</dd>
        <dt>Dimensioni</dt><dd>${esc(r.dims)}</dd>
      </dl>`));
  }

  /* Note operative */
  const nb = el('div', { class: 'detail-block' });
  nb.innerHTML = `<h4>Note operative</h4>`;
  const list = el('div');
  const renderNotes = () => {
    list.innerHTML = r.note.length ? '' : '<p class="muted small">Nessuna nota. Aggiungine una qui sotto (salvata solo in memoria per la sessione).</p>';
    [...r.note].reverse().forEach(n => list.appendChild(el('div', { class: 'note-item' }, `<div class="n-meta">${n.data} · ${esc(n.autore)}</div>${esc(n.testo)}`)));
  };
  renderNotes();
  nb.appendChild(list);
  const nf = el('div', { class: 'note-form' });
  const ta = el('textarea', { placeholder: 'Aggiungi una nota operativa…' });
  nf.appendChild(ta);
  nf.appendChild(el('button', { class: 'btn btn-primary', onclick: () => {
    if (!ta.value.trim()) return;
    r.note.push({ testo: ta.value.trim(), data: nowStr(), autore: 'M. Bruzzone' });
    ta.value = ''; renderNotes();
    toast('Nota aggiunta (sessione corrente)', 'ok');
  } }, 'Salva nota'));
  nb.appendChild(nf);
  colB.appendChild(nb);

  /* Cronologia tracking con eventi interni */
  const tk = el('div', { class: 'detail-block' });
  tk.innerHTML = `<h4>Cronologia eventi di tracking</h4>
    <p class="tiny">Gli eventi evidenziati in giallo sono <strong>interni</strong> (operatore, note di magazzino) e non compaiono nel tracking pubblico del cliente finale.</p>`;
  const tl = el('ul', { class: 'timeline' });
  [...r.tracking].reverse().forEach(t => {
    tl.appendChild(el('li', { class: (t.evento.includes('Consegnata') ? 'done ' : '') + (t.interno ? 'internal' : '') }, `
      <div class="t-when">${t.data}</div>
      <div class="t-what">${esc(t.evento)}</div>
      <div class="t-where">${esc(t.luogo)}</div>
      ${t.interno ? `<div class="t-int">🔒 interno · ${esc(t.operatore)}${t.notaInterna ? ' — ' + esc(t.notaInterna) : ''}</div>` : `<div class="tiny">op. ${esc(t.operatore)}</div>`}`));
  });
  tk.appendChild(tl);
  colB.appendChild(tk);

  /* Avanzamento e servizi — presente sia nel modale sia nella tab dedicata.
     Consente di (a) aggiungere/togliere servizi compatibili con il vettore
     e (b) avanzare manualmente di stato quando consentito dai vincoli. */
  const adv = el('div', { class: 'detail-block' });
  adv.innerHTML = `<h4>Avanzamento e servizi</h4>
    <p class="tiny">I servizi accessori sono proposti solo se compatibili con il vettore attualmente assegnato. Il tasto di avanzamento è visibile solo se i vincoli di stato sono soddisfatti (vettore assegnato).</p>
    <div class="detail-row">
      <div><strong>Servizi attivi</strong> <span id="adv-srv-count" class="tiny muted"></span></div>
      <div id="adv-srv-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px"></div>
      <div style="margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <select id="adv-srv-add" class="inline-select" style="max-width:none"></select>
        <button class="btn btn-sm" id="adv-srv-add-btn">+ Aggiungi servizio</button>
        <span class="tiny muted" id="adv-srv-msg"></span>
      </div>
    </div>
    <div class="detail-row" style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div><strong>Prossimo passo</strong></div>
      <div id="adv-next-info" class="tiny muted"></div>
      <span class="spacer" style="flex:1"></span>
      <button class="btn btn-primary" id="adv-next-btn" style="display:none">Avanza di stato ▸</button>
    </div>`;
  colB.appendChild(adv);

  const srvChips = $('#adv-srv-chips', adv);
  const srvCount = $('#adv-srv-count', adv);
  const srvAddSel = $('#adv-srv-add', adv);
  const srvAddBtn = $('#adv-srv-add-btn', adv);
  const srvMsg = $('#adv-srv-msg', adv);
  const nextInfo = $('#adv-next-info', adv);
  const nextBtn = $('#adv-next-btn', adv);

  // helper per sincronizzare la card "Stato e vettore" in colonna A
  const refreshStatoVettore = () => {
    const svStato = wrap.querySelector('#sv-stato');
    if (svStato) svStato.innerHTML = badgeStato(r.stato);
    const svVet = wrap.querySelector('#sv-vettore');
    if (svVet) svVet.innerHTML = r.vettore ? esc(r.vettore) + (vettoreByNome(r.vettore).tipo === 'proprio' ? ' ' + badge('linea propria', 'brand') : ' ' + badge('corriere terzo', 'info')) : badge('non assegnato', 'warn');
    const svServ = wrap.querySelector('#sv-servizi');
    if (svServ) svServ.innerHTML = r.servizi.length ? r.servizi.map(s => `<span class="tag ${servizioCompatibile(s, r.vettore) ? '' : 'incompat'}" title="${servizioCompatibile(s, r.vettore) ? 'Compatibile con il vettore' : 'NON supportato dal vettore assegnato'}">${esc(s)}${servizioCompatibile(s, r.vettore) ? '' : ' ⚠'}</span>`).join('') : '<span class="muted">nessuno</span>';
    // aggiorna anche l'header in alto a destra
    const headBadge = wrap.querySelector('.ship-head .badge');
    if (headBadge) headBadge.outerHTML = badgeStato(r.stato);
  };

  const renderServizi = () => {
    srvChips.innerHTML = '';
    if (!r.servizi.length) {
      srvChips.appendChild(el('span', { class: 'muted small' }, 'Nessun servizio attivo'));
    } else {
      r.servizi.forEach(s => {
        const chip = el('span', { class: 'tag' + (servizioCompatibile(s, r.vettore) ? '' : ' incompat') });
        const title = r.vettore
          ? (servizioCompatibile(s, r.vettore) ? `Servizio compatibile con ${r.vettore}` : `NON supportato da ${r.vettore}`)
          : 'Vettore non assegnato: compatibilità non verificabile';
        chip.title = title;
        chip.appendChild(document.createTextNode(s + ' '));
        chip.appendChild(el('button', { class: 'tag-remove', title: 'Rimuovi servizio', onclick: () => {
          r.servizi = r.servizi.filter(x => x !== s);
          renderServizi();
          refreshStatoVettore();
          toast(`Servizio «${s}» rimosso`, '');
        } }, '×'));
        srvChips.appendChild(chip);
      });
    }
    srvCount.textContent = r.servizi.length ? `(${r.servizi.length})` : '';

    // popola il select "aggiungi servizio" solo con i servizi non ancora attivi
    srvAddSel.innerHTML = '';
    const disponibili = SERVIZI.filter(s => !r.servizi.includes(s));
    if (!disponibili.length) {
      srvAddSel.appendChild(el('option', {}, '— tutti i servizi già attivi —'));
      srvAddBtn.disabled = true;
    } else {
      disponibili.forEach(s => {
        const ok = servizioCompatibile(s, r.vettore);
        const opt = el('option', { value: s }, s + (ok ? '' : '  ⚠ non supportato dal vettore'));
        if (!ok) opt.disabled = true;
        srvAddSel.appendChild(opt);
      });
      srvAddBtn.disabled = false;
    }
  };

  const renderAvanzamento = () => {
    // Definizione dei prossimi passi consentiti dallo stato corrente
    let nextStato = null, nextLabel = null, blocker = null;
    if (r.stato === 'In revisione') {
      nextStato = 'In staging'; nextLabel = 'Valida dati → In staging';
      if (!r.capValido || !r.telOk) blocker = 'CAP e telefono devono essere validi';
    } else if (r.stato === 'In staging') {
      nextStato = 'Pronta per etichettatura'; nextLabel = 'Vettore ok → Pronta per etichettatura';
      if (!r.vettore) blocker = 'assegnare prima un vettore';
    } else if (r.stato === 'Pronta per etichettatura') {
      // Da "Pronta per etichettatura" → "Pronto per la spedizione" resta demandato al flusso LDV
      nextLabel = null;
    }

    if (nextStato && nextLabel) {
      nextInfo.innerHTML = `Da <strong>${esc(r.stato)}</strong> a <strong>${esc(nextStato)}</strong>${blocker ? ` — <span style="color:var(--warn)">blocco: ${esc(blocker)}</span>` : ''}`;
      // Bottone visibile solo se vettore già selezionato (per "In staging" e "Pronta per etichettatura")
      // Nel caso di "In revisione" → "In staging" il vincolo è sui dati, non sul vettore.
      if (r.stato === 'In staging') {
        nextBtn.style.display = r.vettore ? '' : 'none';
      } else {
        nextBtn.style.display = '';
      }
      nextBtn.disabled = !!blocker;
      nextBtn.textContent = nextLabel + ' ▸';
      nextBtn.dataset.next = nextStato;
    } else if (r.stato === 'Pronta per etichettatura') {
      nextInfo.innerHTML = `Stato attuale: <strong>Pronta per etichettatura</strong> — l'avanzamento a «Pronto per la spedizione» avviene alla stampa della LDV`;
      nextBtn.style.display = 'none';
    } else {
      nextInfo.innerHTML = `Stato attuale: <strong>${esc(r.stato)}</strong> — nessun avanzamento automatico disponibile da questo stato`;
      nextBtn.style.display = 'none';
    }
  };

  srvAddBtn.addEventListener('click', () => {
    const s = srvAddSel.value;
    if (!s || srvAddSel.selectedOptions[0]?.disabled) return;
    if (!servizioCompatibile(s, r.vettore)) {
      toast(`⚠ Servizio «${s}» non supportato dal vettore ${r.vettore}`, 'err');
      return;
    }
    if (!r.servizi.includes(s)) r.servizi.push(s);
    renderServizi();
    refreshStatoVettore();
    toast(`Servizio «${s}» aggiunto`, 'ok');
  });

  nextBtn.addEventListener('click', () => {
    const target = nextBtn.dataset.next;
    if (!target) return;
    // Vincoli espliciti, anche se già riflessi nello stato del bottone
    if (r.stato === 'In staging' && !r.vettore) { toast('Assegnare prima un vettore', 'err'); return; }
    if (r.stato === 'In revisione' && (!r.capValido || !r.telOk)) { toast('CAP e telefono devono essere validi', 'err'); return; }
    r.stato = target;
    r.storico.push({ stato: target, data: nowStr(), operatore: 'M. Bruzzone' });
    r.tracking.push({ data: nowStr(), evento: 'Avanzamento manuale di stato', luogo: 'Back office', interno: true, operatore: 'M. Bruzzone', notaInterna: `Avanzamento a «${target}» dal dettaglio` });
    renderServizi();
    renderAvanzamento();
    refreshStatoVettore();
    toast(`${r.id} → ${target}`, 'ok');
  });

  renderServizi();
  renderAvanzamento();

  grid.appendChild(colA); grid.appendChild(colB);
  wrap.appendChild(grid);
  return wrap;
}

function openShipDetail(id, variant = 'modal') {
  const r = spedById(id);
  if (!r) return;
  if (variant === 'modal') {
    openModal({ title: `Dettaglio spedizione — consultazione rapida`, body: buildShipDetail(r, 'modal'), size: 'xwide', actions: [{ label: 'Chiudi' }] });
  } else {
    // vista/tab dedicata: sostituisce temporaneamente l'elenco spedizioni
    showView('spedizioni');
    $('#sped-list-wrap').style.display = 'none';
    $('#colli-wrap').style.display = 'none';
    $('#diff-wrap').style.display = 'none';
    const wrap = $('#sped-detail-wrap');
    wrap.style.display = '';
    wrap.innerHTML = '';
    const bar = el('div', { class: 'view-header' });
    bar.appendChild(el('button', { class: 'btn', onclick: closeShipTab }, '← Torna all\'elenco'));
    bar.appendChild(el('h1', {}, 'Dettaglio spedizione'));
    bar.appendChild(el('span', { class: 'sub' }, 'vista a tab dedicata per lavorazione approfondita'));
    wrap.appendChild(bar);
    wrap.appendChild(buildShipDetail(r, 'tab'));
  }
}
function closeShipTab() {
  $('#sped-detail-wrap').style.display = 'none';
  $('#sped-detail-wrap').innerHTML = '';
  $('#sped-list-wrap').style.display = '';
  dtSpedizioni.refresh();
}

/* ---- Colli madre ---- */
function gotoColli() {
  $('.modal-backdrop') && $('.modal-backdrop').remove();
  showView('spedizioni');
  $('#sped-list-wrap').style.display = 'none';
  $('#sped-detail-wrap').style.display = 'none';
  $('#diff-wrap').style.display = 'none';
  $('#colli-wrap').style.display = '';
  renderColli();
}
function renderColli() {
  const root = $('#colli-tree'); root.innerHTML = '';
  COLLI_MADRE.forEach(cm => {
    const [aggr, cls] = statoAggregato(cm);
    const li = el('li', { class: 'tree-parent open' });
    const head = el('div', { class: 'tp-head', onclick: () => li.classList.toggle('open') });
    head.innerHTML = `<span class="caret">▶</span>
      <span class="mono" style="font-weight:600;color:var(--brand)">${cm.id}</span>
      <strong>${esc(cm.descr)}</strong>
      ${badge(aggr, cls)}
      <span class="tiny">${cm.figli.length} sotto-colli</span>`;
    li.appendChild(head);
    const body = el('div', { class: 'tp-body' });
    cm.figli.forEach(fid => {
      const s = spedById(fid);
      const row = el('div', { class: 'tc-row' });
      row.innerHTML = `<span class="mono" style="color:var(--brand)">${s.id}</span>
        <span>${esc(s.destinatario)} · ${esc(s.localita)}</span>
        ${badgeStato(s.stato)}
        <span class="tiny">${s.vettore ? esc(s.vettore) : 'vettore da assegnare'}</span>
        <span class="grow"></span>`;
      row.appendChild(el('button', { class: 'btn btn-sm', onclick: () => openShipDetail(s.id, 'modal') }, 'Dettaglio'));
      const sep = el('button', { class: 'btn btn-sm', title: 'Spedisci separatamente con mezzo/data diversi', onclick: () => {
        const b = el('div');
        b.innerHTML = `<p class="small">Il sotto-collo <span class="mono">${s.id}</span> verrà scorporato dal bancale e spedito separatamente.</p>
          <div class="form-row"><label>Vettore</label><select id="sep-v">${VETTORI.map(v => `<option>${v.nome}</option>`).join('')}</select></div>
          <div class="form-row"><label>Data di partenza</label><input type="text" id="sep-d" value="2026-07-22"></div>`;
        openModal({ title: 'Spedisci sotto-collo separatamente', body: b, actions: [
          { label: 'Annulla' },
          { label: 'Conferma', cls: 'btn-primary', onClick: bd => {
              s.vettore = $('#sep-v', bd).value; s.stato = 'Pronta per etichettatura';
              s.storico.push({ stato: 'Pronta per etichettatura', data: nowStr(), operatore: 'M. Bruzzone', nota: `Scorporato dal collo madre ${cm.id}, partenza ${$('#sep-d', bd).value}` });
              // scorporo REALE: il sotto-collo esce dal collo madre e torna spedizione indipendente
              cm.figli = cm.figli.filter(id => id !== s.id);
              s.colloMadre = null;
              // caso limite: collo madre rimasto senza sotto-colli → viene rimosso dall'albero
              if (!cm.figli.length) {
                const ix = COLLI_MADRE.indexOf(cm);
                if (ix >= 0) COLLI_MADRE.splice(ix, 1);
                toast(`${cm.id} rimosso: nessun sotto-collo residuo`, '');
              }
              renderColli(); dtSpedizioni.refresh();
              toast(`${s.id} scorporato da ${cm.id} — pronto per spedizione separata con ${s.vettore}`, 'ok');
            } }
        ] });
      } }, 'Spedisci separato');
      row.appendChild(sep);
      body.appendChild(row);
    });
    li.appendChild(body);
    root.appendChild(li);
  });
}

/* ---- Creazione nuovo collo madre ---- */
function nextColloMadreId() {
  const max = COLLI_MADRE.reduce((a, c) => Math.max(a, parseInt(c.id.split('-').pop(), 10) || 0), 40);
  return `CM-2026-${String(max + 1).padStart(4, '0')}`;
}
function openNuovoColloMadre() {
  const disponibili = SPEDIZIONI.filter(s => !s.colloMadre); // solo spedizioni non già in un collo madre
  const body = el('div');
  body.innerHTML = `
    <div class="form-row"><label>Codice / riferimento</label><input type="text" id="cm-id" value="${nextColloMadreId()}"></div>
    <div class="form-row"><label>Descrizione</label><input type="text" id="cm-descr" placeholder="es. Bancale TechnoParts — ricambi urgenti"></div>
    <div class="form-row">
      <label>Sotto-colli da associare (${disponibili.length} spedizioni disponibili, non ancora in un collo madre)</label>
      <input type="text" id="cm-search" placeholder="Cerca per ID, destinatario o località…" style="margin-bottom:6px">
      <div id="cm-list" style="max-height:240px;overflow-y:auto;border:1px solid var(--line);border-radius:var(--radius-sm)"></div>
      <div class="tiny" style="margin-top:4px"><span id="cm-count">0</span> selezionate</div>
    </div>`;
  const scelte = new Set();
  const listEl = $('#cm-list', body);
  const renderList = (q = '') => {
    const ql = q.toLowerCase();
    const rows = disponibili.filter(s => !ql || s.id.toLowerCase().includes(ql) || s.destinatario.toLowerCase().includes(ql) || s.localita.toLowerCase().includes(ql));
    listEl.innerHTML = rows.length ? '' : '<div class="dt-empty" style="padding:14px">Nessuna spedizione corrisponde alla ricerca.</div>';
    rows.slice(0, 60).forEach(s => {
      const row = el('label', { style: 'display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--line);cursor:pointer;font-size:12.5px' });
      const cb = el('input', { type: 'checkbox' });
      cb.checked = scelte.has(s.id);
      cb.addEventListener('change', () => { cb.checked ? scelte.add(s.id) : scelte.delete(s.id); $('#cm-count', body).textContent = scelte.size; });
      row.appendChild(cb);
      row.appendChild(el('span', {}, `<span class="mono" style="color:var(--brand)">${s.id}</span> · ${esc(s.destinatario)} · ${esc(s.localita)} ${badgeStato(s.stato)}`));
      listEl.appendChild(row);
    });
    if (rows.length > 60) listEl.appendChild(el('div', { class: 'tiny', style: 'padding:6px 10px' }, `… e altre ${rows.length - 60}: restringi con la ricerca`));
  };
  renderList();
  $('#cm-search', body).addEventListener('input', e => renderList(e.target.value));
  openModal({
    title: 'Nuovo collo madre', body, size: 'wide',
    actions: [
      { label: 'Annulla' },
      { label: 'Crea collo madre', cls: 'btn-primary', keepOpen: true, onClick: (bd, close) => {
          const id = $('#cm-id', bd).value.trim();
          if (!id) { toast('Inserisci un codice per il collo madre', 'err'); return false; }
          if (COLLI_MADRE.some(c => c.id === id)) { toast(`Il codice ${id} esiste già`, 'err'); return false; }
          if (!scelte.size) { toast('Seleziona almeno un sotto-collo da associare', 'err'); return false; }
          const nuovo = { id, descr: $('#cm-descr', bd).value.trim() || 'Collo madre senza descrizione', figli: [] };
          scelte.forEach(sid => { nuovo.figli.push(sid); spedById(sid).colloMadre = id; });
          COLLI_MADRE.push(nuovo);
          renderColli(); dtSpedizioni.refresh(); // il tag "CM" compare anche in tabella spedizioni
          toast(`${id} creato con ${scelte.size} sotto-colli`, 'ok');
          close();
        } }
    ]
  });
}

/* ---- Differenziale peso/misure (tabella dedicata) ---- */
function gotoDiff() {
  showView('spedizioni');
  $('#sped-list-wrap').style.display = 'none';
  $('#sped-detail-wrap').style.display = 'none';
  $('#colli-wrap').style.display = 'none';
  $('#diff-wrap').style.display = '';
  renderDataTable({
    mount: '#dt-diff', title: 'Confronto dichiarato vs rilevato', noun: 'righe',
    data: () => DIFFERENZIALI, rowKey: r => r.id, selectable: true, pageSize: 10,
    onRowClick: r => openShipDetail(r.id, 'modal'),
    columns: [
      { key: 'id', label: 'ID spedizione', ftype: 'text', render: r => `<span class="mono" style="color:var(--brand)">${r.id}</span>` },
      { key: 'mandante', label: 'Mandante', ftype: 'enum' },
      { key: 'vettore', label: 'Vettore', ftype: 'enum' },
      { key: 'pesoDich', label: 'Peso dich. (kg)', ftype: 'number', numeric: true, render: r => r.pesoDich.toFixed(1) },
      { key: 'pesoReale', label: 'Peso reale (kg)', ftype: 'number', numeric: true, render: r => r.pesoReale.toFixed(1) },
      { key: 'diff', label: 'Differenziale', ftype: 'number', numeric: true, render: r => `<strong style="color:${r.diff > 0 ? 'var(--err)' : 'var(--ok)'}">${r.diff > 0 ? '+' : ''}${r.diff.toFixed(1)}</strong>` },
      { key: 'impatto', label: 'Impatto economico', ftype: 'number', numeric: true, render: r => r.impatto > 0 ? `<strong>${fmtEur(r.impatto)}</strong>` : '—' }
    ],
    bulkActions: [
      { label: 'Riaddebita differenziale al mandante', cls: 'btn-primary', run: (sel, api) => {
          const rows = sel.rows.filter(r => r.impatto > 0);
          confirmBulk({ azione: 'Riaddebito differenziale peso', count: rows.length, mode: sel.mode,
            dettagli: `Totale da riaddebitare: <strong>${fmtEur(rows.reduce((a, r) => a + r.impatto, 0))}</strong>`,
            onConfirm: () => { api.clearSelection(); api.refresh(); toast(`Riaddebito generato per ${rows.length} spedizioni (simulato)`, 'ok'); } });
        } }
    ]
  });
}

/* ============================================================
   10. SEZIONE LISTINI E TARIFFE (tre livelli)
   ============================================================ */
let lvVettoreCorrente = 'Corriere A';

function initListini() {
  // per i Mandanti/Sottocontratti mostro SOLO il tab "Listini di vendita"
  // (i listini vettore e i listini di costo interni sono informazioni di gestione interna)
  const isMandante = currentUser?.livello === 'Mandante/Sottocontratto';
  if (isMandante) {
    $$('#listini-tabs .tab-btn').forEach(b => { if (b.dataset.tab !== 'lvend') b.style.display = 'none'; });
    // nascondi anche i pane non pertinenti
    ['#pane-lv', '#pane-lc', '#pane-lstor'].forEach(sel => { const p = $(sel); if (p) p.style.display = 'none'; });
    // attiva esplicitamente il pane "lvend" e marca il tab come attivo
    const tab = $$('#listini-tabs .tab-btn').find(b => b.dataset.tab === 'lvend');
    if (tab) tab.classList.add('active');
    const pane = $('#pane-lvend'); if (pane) pane.classList.add('active');
  }

  // tab principali
  $$('#listini-tabs .tab-btn').forEach(b => b.addEventListener('click', () => {
    $$('#listini-tabs .tab-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $$('#view-listini .tab-pane').forEach(p => p.classList.remove('active'));
    $('#pane-' + b.dataset.tab).classList.add('active');
  }));

  // sotto-tab per vettore (listini vettori terzi)
  const vt = $('#lv-vettori-tabs');
  Object.keys(LISTINI_VETTORE).forEach((nome, i) => {
    const b = el('button', { class: 'tab-btn' + (i === 0 ? ' active' : ''), onclick: () => {
      $$('.tab-btn', vt).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      lvVettoreCorrente = nome;
      renderListinoVettore();
    } }, esc(nome));
    vt.appendChild(b);
  });
  renderListinoVettore();
  renderListinoCosto();
  renderListinoVendita();
  initStoricita();
}

function renderListinoVettore() {
  const lv = LISTINI_VETTORE[lvVettoreCorrente];
  $('#lv-meta').innerHTML = `
    <span>📄 <strong>${esc(lv.nota)}</strong></span>
    <span>Versione: <span class="mono">${lv.versione}</span></span>
    <span class="tiny">Dato di partenza esterno, non negoziabile da CT Solution: base per i listini di costo interni.</span>`;
  renderDataTable({
    mount: '#dt-listino-vettore', title: `Listino ${lvVettoreCorrente}`, noun: 'righe di listino',
    data: () => lv.rows, rowKey: r => r.scaglione + '|' + r.zona, pageSize: 10,
    columns: [
      { key: 'scaglione', label: 'Scaglione peso', ftype: 'enum' },
      { key: 'zona', label: 'Zona', ftype: 'enum' },
      { key: 'prezzo', label: 'Prezzo', ftype: 'number', numeric: true, render: r => fmtEur(r.prezzo) },
      { key: 'fuel', label: 'Fuel surcharge', ftype: 'number', numeric: true, render: r => r.fuel.toFixed(1) + ' %' },
      { key: 'validita', label: 'Validità', ftype: 'enum', render: r => `<span class="mono tiny">${esc(r.validita)}</span>` }
    ]
  });
}

function renderListinoCosto() {
  $('#lc-meta').innerHTML = `<span class="tiny">I listini di costo derivano dal listino del vettore terzo (con oneri interni) oppure sono <strong>calcolati</strong> per le linee proprie (padroncini). Cliccando una riga derivata si vede l'origine dell'import.</span>`;
  renderDataTable({
    mount: '#dt-listino-costo', title: 'Listini di costo interni CT Solution', noun: 'righe di listino',
    data: () => LISTINI_COSTO, rowKey: r => r.vettore + '|' + r.scaglione, pageSize: 10, selectable: true,
    onRowClick: r => {
      openModal({ title: 'Origine listino di costo', body: `
        <dl class="confirm-summary">
          <dt>Vettore</dt><dd>${esc(r.vettore)}</dd>
          <dt>Scaglione / zona</dt><dd>${esc(r.scaglione)} — ${esc(r.zona)}</dd>
          <dt>Costo interno</dt><dd><strong>${fmtEur(r.costo)}</strong></dd>
          ${r.costoVettore ? `<dt>Listino vettore di origine</dt><dd>${fmtEur(r.costoVettore)} <span class="tiny">(+3% oneri interni)</span></dd>` : ''}
          <dt>Origine</dt><dd>${esc(r.origine)}</dd>
        </dl>`, actions: [{ label: 'Chiudi' }] });
    },
    columns: [
      { key: 'vettore', label: 'Vettore', ftype: 'enum' },
      { key: 'tipo', label: 'Tipo', ftype: 'enum', render: r => badge(r.tipo, r.tipo.startsWith('Derivato') ? 'info' : 'brand') },
      { key: 'scaglione', label: 'Scaglione', ftype: 'enum' },
      { key: 'costo', label: 'Costo interno', ftype: 'number', numeric: true, render: r => fmtEur(r.costo) },
      { key: 'origine', label: 'Origine / import', ftype: 'text', render: r => `<span class="tiny">${esc(r.origine)}</span>` }
    ],
    bulkActions: [
      { label: 'Duplica listino…', cls: 'btn-primary', run: (sel, api) => openDuplicaListino(sel, api) }
    ]
  });
}

function openDuplicaListino(sel, api) {
  const b = el('div');
  b.innerHTML = `<p class="small muted">Crea un nuovo listino a partire dalle <strong>${sel.rows.length || 'righe del filtro corrente (' + api.getFilteredRows().length + ')'}</strong> righe selezionate. Disponibile anche a partire da un listino di costo derivato da vettore terzo.</p>
    <div class="form-row"><label>Metodo</label>
      <select id="dup-m">
        <option value="perc">Ricarico percentuale sul costo</option>
        <option value="abs">Sovrascrittura assoluta (prezzo fisso)</option>
      </select></div>
    <div class="form-row"><label>Valore</label><input type="text" id="dup-v" value="18" placeholder="es. 18 (%) oppure 9.90 (€)"></div>
    <div class="form-row"><label>Destinazione</label><select id="dup-d">${MANDANTI.map(m => `<option>${m}</option>`).join('')}</select></div>`;
  openModal({ title: 'Duplica listino', body: b, actions: [
    { label: 'Annulla' },
    { label: 'Crea listino', cls: 'btn-primary', onClick: bd => {
        const rows = sel.rows.length ? sel.rows : api.getFilteredRows();
        const m = $('#dup-m', bd).value, v = parseFloat($('#dup-v', bd).value) || 0, dest = $('#dup-d', bd).value;
        rows.forEach(r => {
          const vendita = m === 'perc' ? +(r.costo * (1 + v / 100)).toFixed(2) : v;
          LISTINI_VENDITA.push({ mandante: dest, vettoreRif: r.vettore, scaglione: r.scaglione, zona: r.zona, costo: r.costo, costoVettore: r.costoVettore, vendita, margine: +(vendita - r.costo).toFixed(2) });
        });
        renderListinoVendita();
        toast(`Listino duplicato per ${dest}: ${rows.length} righe (${m === 'perc' ? '+' + v + '%' : fmtEur(v) + ' fisso'})`, 'ok');
      } }
  ] });
}

function renderListinoVendita() {
  // il mandante vede solo le proprie righe di vendita
  const isMandante = currentUser?.livello === 'Mandante/Sottocontratto';
  const dataSrc = isMandante ? LISTINI_VENDITA.filter(r => r.mandante === currentUser.mandante) : LISTINI_VENDITA;
  renderDataTable({
    mount: '#dt-listino-vendita', title: 'Listini di vendita per mandante', noun: 'righe di listino',
    data: () => dataSrc, rowKey: r => r.mandante + '|' + r.vettoreRif + '|' + r.scaglione + '|' + r.vendita, pageSize: 10,
    rowClass: r => r.vendita < r.costo ? 'row-danger' : '',
    columns: [
      { key: 'mandante', label: 'Mandante', ftype: 'enum' },
      { key: 'vettoreRif', label: 'Vettore di rif.', ftype: 'enum' },
      { key: 'scaglione', label: 'Scaglione', ftype: 'enum' },
      { key: 'costo', label: 'Costo interno', ftype: 'number', numeric: true, render: r => fmtEur(r.costo) },
      { key: 'vendita', label: 'Prezzo di vendita', ftype: 'number', numeric: true, render: r => `<strong>${fmtEur(r.vendita)}</strong>` },
      { key: 'margine', label: 'Margine', ftype: 'number', numeric: true, render: r => `<span style="color:${r.margine < 0 ? 'var(--err)' : 'var(--ok)'};font-weight:600">${r.margine >= 0 ? '+' : ''}${fmtEur(r.margine)}</span>` },
      { key: 'alert', label: 'Controllo', sortable: false,
        render: r => {
          if (r.costoVettore && r.vendita < r.costoVettore)
            return `<span class="badge err" title="Il prezzo di vendita è inferiore perfino al listino del vettore terzo di origine">⛔ vendita sotto il costo del VETTORE (${fmtEur(r.costoVettore)}), non solo sotto il listino interno</span>`;
          if (r.vendita < r.costo)
            return `<span class="badge warn">vendita sotto il costo interno</span>`;
          return `<span class="badge ok">ok</span>`;
        } }
    ]
  });
}

function initStoricita() {
  const sel = $('#stor-cliente');
  sel.innerHTML = MANDANTI.map(m => `<option>${m}</option>`).join('');
  const render = () => {
    const rows = STORICO_LISTINI[sel.value];
    $('#stor-timeline').innerHTML = rows.map(r => `
      <li>
        <span class="h-when">${esc(r.periodo)}</span>
        <span>
          <strong>${esc(r.label)}</strong><br>
          ${r.stato === 'attivo' ? badge('in vigore', 'ok') : r.stato === 'futuro' ? badge('futuro — coesiste con l\'attuale', 'accent') : badge('archiviato', '')}
        </span>
      </li>`).join('');
  };
  sel.addEventListener('change', render);
  render();
}

/* ============================================================
   11. SEZIONE FLUSSI IN INGRESSO
   ============================================================ */
let dtFlussi = null;
function initFlussi() {
  $('#flussi-counter').textContent = `${FLUSSI_TOTALI} flussi configurati · ${FLUSSI.length} mostrati come esempio`;
  dtFlussi = renderDataTable({
    mount: '#dt-flussi', title: 'Clienti e microservizi di import', noun: 'flussi',
    data: () => FLUSSI, rowKey: r => r.cliente, pageSize: 10, selectable: true,
    onRowClick: r => renderFlussoDetail(r),
    columns: [
      { key: 'cliente', label: 'Nome cliente', ftype: 'text', render: r => `<strong>${esc(r.cliente)}</strong>` },
      { key: 'tipo', label: 'Tipo flusso', ftype: 'enum', render: r => badge(r.tipo, 'brand') },
      { key: 'stato', label: 'Stato ultimo import', ftype: 'enum', statusOrder: ['Errore', 'In coda', 'OK'],
        render: r => badge(r.stato, r.stato === 'OK' ? 'ok' : r.stato === 'Errore' ? 'err' : 'warn') },
      { key: 'ultimo', label: 'Data/ora ultimo import', ftype: 'date', render: r => `<span class="mono tiny">${r.ultimo}</span>` },
      { key: 'micro', label: 'Tipo microservizio', ftype: 'enum', render: r => badge(r.micro, r.micro === 'Istanza dedicata' ? 'accent' : 'info') }
    ],
    rowActions: (r, api) => el('button', { class: 'btn btn-sm btn-primary', onclick: () => {
      r.stato = r.stato === 'In coda' ? (rnd() > 0.3 ? 'OK' : 'Errore') : (rnd() > 0.15 ? 'OK' : 'Errore');
      r.ultimo = nowStr();
      api.refresh(); renderFlussoDetail(r);
      toast(`Import simulato per ${r.cliente}: ${r.stato}`, r.stato === 'OK' ? 'ok' : 'err');
    } }, 'Simula import'),
    bulkActions: [
      { label: 'Rilancia import (selezione/filtro)', cls: 'btn-primary', run: (sel, api) => {
          confirmBulk({ azione: 'Rilancio import massivo', count: sel.rows.length, mode: sel.mode,
            onConfirm: () => { sel.rows.forEach(r => { r.stato = rnd() > 0.2 ? 'OK' : 'Errore'; r.ultimo = nowStr(); }); api.clearSelection(); api.refresh(); toast(`${sel.rows.length} import rilanciati`, 'ok'); } });
        } }
    ]
  });
}
function renderFlussoDetail(r) {
  $('#flusso-detail').innerHTML = `
    <h3>Dettaglio cliente — ${esc(r.cliente)}</h3>
    <dl class="kv" style="grid-template-columns:120px 1fr;margin-bottom:10px">
      <dt>Tipo flusso</dt><dd>${badge(r.tipo, 'brand')}</dd>
      <dt>Microservizio</dt><dd>${badge(r.micro, r.micro === 'Istanza dedicata' ? 'accent' : 'info')}</dd>
      <dt>Ultimo import</dt><dd><span class="mono tiny">${r.ultimo}</span> ${badge(r.stato, r.stato === 'OK' ? 'ok' : r.stato === 'Errore' ? 'err' : 'warn')}</dd>
    </dl>
    <h4 style="font-family:var(--font-display);font-size:12.5px;text-transform:uppercase;color:var(--ink-soft);margin:10px 0 6px">Regole custom applicate</h4>
    ${r.regole.map(([cond, az]) => `<div class="rule-item"><span>${esc(cond)}</span><span class="arrow">→</span><strong>${esc(az)}</strong></div>`).join('')}
    ${r.stato === 'Errore' ? '<div class="err-box" style="margin-top:10px">Ultimo file scartato: 3 righe con CAP mancante. Scarica il log errori (simulato) o rilancia l\'import.</div>' : ''}`;
}

/* ============================================================
   12. SEZIONE GIACENZE
   ============================================================ */
let dtGiacenze = null;
// Modifiche "in sospeso": id giacenza -> nuovo esito scelto (riga per riga o massivo),
// non ancora scritte sui dati finché non si preme "Salva" nella barra fuori dalla griglia.
const giacenzePending = new Map();

function updateGiacenzeSaveBar() {
  const bar = $('#giacenze-save-bar');
  if (!bar) return;
  const n = giacenzePending.size;
  bar.style.display = n ? '' : 'none';
  $('#giacenze-pending-count').textContent = n ? `${n} modifica${n === 1 ? '' : 'e'} non salvat${n === 1 ? 'a' : 'e'}` : '';
}

function commitGiacenzePending() {
  if (!giacenzePending.size) return;
  let n = 0;
  giacenzePending.forEach((esito, id) => {
    GIACENZE.filter(g => g.id === id).forEach(r => { r.esito = esito; n++; });
  });
  giacenzePending.clear();
  updateGiacenzeSaveBar();
  dtGiacenze.refresh();
  toast(`${n} giacenze aggiornate`, 'ok');
}

function annullaGiacenzePending() {
  if (!giacenzePending.size) return;
  giacenzePending.clear();
  updateGiacenzeSaveBar();
  dtGiacenze.refresh();
  toast('Modifiche annullate', '');
}

function esitoGiacenza(sel, api, esito) {
  const rows = sel.rows.filter(r => r.esito === 'Aperta');
  if (!rows.length) { toast('Nessuna giacenza aperta corrisponde alla selezione o al filtro corrente.', 'warn'); return; }
  rows.forEach(r => giacenzePending.set(r.id, esito));
  api.clearSelection();
  updateGiacenzeSaveBar();
  api.refresh();
  toast(`${rows.length} giacenze pronte per il salvataggio → ${esito}. Premi «Salva» in alto per confermare.`, 'info');
}

function initGiacenze() {
  const azioni = ['Nuovo tentativo di consegna', 'Reso al mittente', 'Smaltimento'];
  const isCliente = currentUser?.livello === 'Cliente finale';
  const isMandante = currentUser?.livello === 'Mandante/Sottocontratto';
  // Filtro dati: cliente finale e mandanti vedono solo le proprie giacenze
  const dataSrc = isCliente || isMandante ? spedizioniVisibili(GIACENZE) : GIACENZE;
  dtGiacenze = renderDataTable({
    mount: '#dt-giacenze', title: 'Giacenze aperte e lavorate', noun: 'giacenze',
    data: () => dataSrc, rowKey: r => r.id, pageSize: 10, selectable: !isCliente,
    onRowClick: r => openShipDetail(r.ref.id, 'modal'),
    columns: [
      { key: 'id', label: 'ID', ftype: 'text', render: r => `<span class="mono" style="color:var(--brand)">${r.id}</span>` },
      { key: 'mandante', label: 'Mandante', ftype: 'enum' },
      { key: 'destinatario', label: 'Destinatario', ftype: 'text' },
      { key: 'localita', label: 'Località', ftype: 'text' },
      { key: 'motivo', label: 'Motivo giacenza', ftype: 'enum', render: r => badge(r.motivo, 'warn') },
      { key: 'giorni', label: 'Giorni aperta', ftype: 'number', numeric: true, render: r => r.giorni >= 5 ? `<strong style="color:var(--err)">${r.giorni}</strong>` : r.giorni },
      { key: 'esito', label: 'Esito', ftype: 'enum', statusOrder: ['Aperta', 'Nuovo tentativo di consegna', 'Reso al mittente', 'Smaltimento'],
        render: r => {
          const pending = giacenzePending.get(r.id);
          const cur = badge(r.esito, r.esito === 'Aperta' ? 'err' : r.esito === 'Nuovo tentativo di consegna' ? 'info' : r.esito === 'Reso al mittente' ? 'warn' : '');
          if (!pending || pending === r.esito) return cur;
          return `${cur} <span class="arrow">→</span> ${badge(pending, 'accent')} <span class="tiny">(da salvare)</span>`;
        } }
    ],
    rowActions: (r, api) => {
      if (isCliente) {
        const v = el('span', { class: 'tiny' }, 'Sola lettura');
        v.title = 'Il cliente finale può solo consultare le giacenze';
        return v;
      }
      const sel = el('select', { class: 'inline-select' });
      sel.appendChild(el('option', { value: '' }, 'Azione…'));
      azioni.forEach(a => sel.appendChild(el('option', {}, a)));
      sel.value = giacenzePending.get(r.id) || '';
      sel.addEventListener('change', () => {
        if (!sel.value) { giacenzePending.delete(r.id); }
        else { giacenzePending.set(r.id, sel.value); }
        updateGiacenzeSaveBar();
        api.refresh();
      });
      return sel;
    },
    bulkActions: isCliente ? [] : azioni.map(a => ({
      label: a + ' (selezione/filtro)', cls: a === 'Reso al mittente' ? 'btn-primary' : '',
      run: (sel, api) => esitoGiacenza(sel, api, a)
    }))
  });

  $('#btn-giacenze-salva').addEventListener('click', commitGiacenzePending);
  $('#btn-giacenze-annulla').addEventListener('click', annullaGiacenzePending);
  updateGiacenzeSaveBar();

  // banner di scoping visibile sopra la tabella (solo per profili limitati)
  if (isCliente || isMandante) {
    const sub = $('#view-giacenze .view-header .sub');
    if (sub) sub.textContent = `Mostro solo le giacenze del mandante ${currentUser.mandante}` + (isCliente ? ' · sola lettura' : ' · modificabili');
  }

}

/* ============================================================
   13. SEZIONE CONNETTORE E-COMMERCE
   ============================================================ */
function initEcommerce() {
  const k = $('#ecom-kpis');
  const push = ORDINI_ECOM.filter(o => o.marketplace === 'Vinted').length;
  const err = ORDINI_ECOM.filter(o => o.statoInt.includes('Errore')).length;
  k.innerHTML = `
    <div class="kpi"><div class="kpi-label">Ordini collegati</div><div class="kpi-value">${ORDINI_ECOM.length}</div><div class="kpi-note">ultimi 7 giorni</div></div>
    <div class="kpi ok"><div class="kpi-label">Marketplace attivi</div><div class="kpi-value">4</div><div class="kpi-note">Amazon · Shopify · eBay · Vinted</div></div>
    <div class="kpi warn"><div class="kpi-label">Ordini via push (Vinted)</div><div class="kpi-value">${push}</div><div class="kpi-note">flusso invertito, tempo reale</div></div>
    <div class="kpi err"><div class="kpi-label">Errori integrazione</div><div class="kpi-value">${err}</div><div class="kpi-note">da rilanciare</div></div>`;

  renderDataTable({
    mount: '#dt-ecom', title: 'Ordini marketplace', noun: 'ordini',
    data: () => ORDINI_ECOM, rowKey: r => r.ordine, pageSize: 10, selectable: true,
    columns: [
      { key: 'ordine', label: 'Ordine', ftype: 'text', render: r => `<span class="mono" style="color:var(--brand)">${r.ordine}</span>` },
      { key: 'marketplace', label: 'Marketplace', ftype: 'enum',
        render: r => badge(r.marketplace, 'brand') + (r.marketplace === 'Vinted' ? ' ' + badge('push', 'accent') : '') },
      { key: 'cliente', label: 'Cliente finale', ftype: 'text' },
      { key: 'data', label: 'Data ordine', ftype: 'date', render: r => `<span class="mono tiny">${r.data}</span>` },
      { key: 'valore', label: 'Valore', ftype: 'number', numeric: true, render: r => fmtEur(r.valore) },
      { key: 'statoInt', label: 'Stato integrazione', ftype: 'enum', statusOrder: ['Errore API', 'Errore push', 'In coda', 'Ricevuto (push)', 'Sincronizzato'],
        render: r => badge(r.statoInt, r.statoInt.includes('Errore') ? 'err' : r.statoInt === 'In coda' ? 'warn' : 'ok') },
      { key: 'spedizione', label: 'Spedizione', ftype: 'enum', filterValue: r => r.spedizione ? 'Collegata' : 'Da creare',
        render: r => r.spedizione ? `<button class="btn-link" onclick="openShipDetail('${r.spedizione}','modal')"><span class="mono">${r.spedizione}</span></button>` : badge('da creare', 'warn') },
      { key: 'giacenza', label: 'Giacenza', ftype: 'enum', filterValue: r => r.giacenza ? 'Sì' : 'No', sortValue: r => r.giacenza ? 1 : 0,
        render: r => r.giacenza ? badge('in giacenza', 'err') : '—' }
    ],
    bulkActions: [
      { label: 'Crea spedizioni dagli ordini', cls: 'btn-primary', run: (sel, api) => {
          const rows = sel.rows.filter(r => !r.spedizione);
          confirmBulk({ azione: 'Crea spedizioni dagli ordini marketplace', count: rows.length, mode: sel.mode,
            onConfirm: () => { rows.forEach(r => r.spedizione = pick(SPEDIZIONI).id); api.clearSelection(); api.refresh(); toast(`${rows.length} spedizioni create (mock)`, 'ok'); } });
        } },
      { label: 'Rilancia sincronizzazione', run: (sel, api) => {
          const rows = sel.rows.filter(r => r.statoInt.includes('Errore') || r.statoInt === 'In coda');
          confirmBulk({ azione: 'Rilancio sincronizzazione marketplace', count: rows.length, mode: sel.mode,
            onConfirm: () => { rows.forEach(r => r.statoInt = r.marketplace === 'Vinted' ? 'Ricevuto (push)' : 'Sincronizzato'); api.clearSelection(); api.refresh(); toast('Sincronizzazione completata', 'ok'); } });
        } }
    ]
  });
}

/* ============================================================
   14. SEZIONE UTENTI E RUOLI
   ============================================================ */
function initUtenti() {
  renderDataTable({
    mount: '#dt-utenti', title: 'Utenti della piattaforma', noun: 'utenti',
    data: () => UTENTI, rowKey: r => r.email, pageSize: 10, selectable: true,
    onRowClick: r => renderPermPanel(r),
    columns: [
      { key: 'nome', label: 'Nome', ftype: 'text', render: r => `<strong>${esc(r.nome)}</strong><br><span class="tiny mono">${esc(r.email)}</span>` },
      { key: 'livello', label: 'Livello di accesso', ftype: 'enum', statusOrder: LIVELLI_UTENTE,
        render: r => badge(r.livello, { 'Piattaforma': 'err', 'Back office': 'brand', 'Mandante/Sottocontratto': 'info', 'Cliente finale': '' }[r.livello]) },
      { key: 'mandante', label: 'Mandante/Sottocontratto', ftype: 'enum' },
      { key: 'ultimoAccesso', label: 'Ultimo accesso', ftype: 'date', render: r => `<span class="mono tiny">${r.ultimoAccesso}</span>` },
      { key: 'stato', label: 'Stato', ftype: 'enum', render: r => badge(r.stato, r.stato === 'Attivo' ? 'ok' : 'warn') }
    ],
    bulkActions: [
      { label: 'Sospendi utenti (selezione/filtro)', run: (sel, api) => {
          confirmBulk({ azione: 'Sospensione utenti', count: sel.rows.length, mode: sel.mode,
            onConfirm: () => { sel.rows.forEach(r => r.stato = 'Sospeso'); api.clearSelection(); api.refresh(); toast(`${sel.rows.length} utenti sospesi`, 'ok'); } });
        } },
      { label: 'Riattiva utenti', run: (sel, api) => {
          confirmBulk({ azione: 'Riattivazione utenti', count: sel.rows.length, mode: sel.mode,
            onConfirm: () => { sel.rows.forEach(r => r.stato = 'Attivo'); api.clearSelection(); api.refresh(); toast(`${sel.rows.length} utenti riattivati`, 'ok'); } });
        } }
    ]
  });
}
function renderPermPanel(u) {
  // la matrice mostrata qui DEVE riflettere ciò che l'app effettivamente fa
  // (filtri in doTrack, initGiacenze, initSpedTable, initListini).
  const preset = PRESET_PERM[u.livello] || PRESET_PERM['Back office'];
  const cols = ['Lettura', 'Scrittura', 'Massive', 'Config'];
  let grid = `<div>Modulo</div>` + cols.map(c => `<div>${c}</div>`).join('');
  MODULI.forEach(m => {
    grid += `<div>${m}</div>`;
    [preset.lettura, preset.scrittura, preset.massive, preset.config].forEach(set => {
      grid += `<div><input type="checkbox" ${set.includes(m) ? 'checked' : ''} onchange="toast('Permesso aggiornato (simulato) per ${esc(u.nome)}')"></div>`;
    });
  });
  const note = u.livello === 'Mandante/Sottocontratto'
    ? `I permessi elencati si applicano solo alle spedizioni/giacenze/listini del mandante <strong>${esc(u.mandante)}</strong>: le righe di altri mandanti non sono visibili né modificabili.`
    : u.livello === 'Cliente finale'
      ? `Il cliente finale vede <strong>solo Tracking e Giacenze</strong> in <strong>sola lettura</strong>, limitatamente alle spedizioni del mandante <strong>${esc(u.mandante)}</strong>. Le altre viste non compaiono nella navbar e il router le rifiuta.`
      : `I livelli inferiori (mandanti e clienti finali) vedono solo le proprie spedizioni e, nel tracking, la sola vista pubblica senza eventi interni.`;
  $('#perm-panel').innerHTML = `
    <h3>Permessi — ${esc(u.nome)}</h3>
    <p class="small">${badge(u.livello, 'brand')} ${u.mandante !== '—' ? `<span class="tiny">vincolato a: <strong>${esc(u.mandante)}</strong></span>` : ''}</p>
    <div class="perm-grid">${grid}</div>
    <p class="tiny" style="margin-top:8px">${note}</p>`;
}

/* ============================================================
   15. TRACKING PUBBLICO
   ============================================================ */

// Una spedizione "appartiene" all'utente corrente se:
//   - l'utente è Back office / Piattaforma → sempre
//   - l'utente è Mandante o Cliente finale → solo se spedizione.mandante === currentUser.mandante
// Restituisce true anche se non c'è currentUser (es. pre-login), così il tracking
// resta consultabile dal pulsante "Prova con" prima del login.
function spedizioneVisibile(r) {
  if (!currentUser) return true;
  const liv = currentUser.livello;
  if (liv === 'Piattaforma' || liv === 'Back office') return true;
  return r.mandante === currentUser.mandante;
}
function spedizioniVisibili(rows) { return rows.filter(spedizioneVisibile); }

function initTracking() {
  const sg = $('#track-suggest');
  sg.innerHTML = 'Prova con:';
  // i suggerimenti rapidi rispettano il filtro per mandante
  const conLdv = spedizioniVisibili(SPEDIZIONI.filter(s => s.ldv)).slice(0, 3);
  if (conLdv.length === 0) {
    sg.appendChild(el('span', { class: 'tiny' }, ' (nessuna spedizione del tuo mandante ha ancora una LDV)'));
  } else {
    conLdv.forEach(s => sg.appendChild(el('button', { onclick: () => { $('#track-input').value = s.ldv; doTrack(); } }, s.ldv)));
  }
  // nota visibile per i ruoli "limitati"
  if (currentUser && (currentUser.livello === 'Cliente finale' || currentUser.livello === 'Mandante/Sottocontratto')) {
    sg.appendChild(el('span', { class: 'tiny', style: 'margin-left:8px' },
      ` — visibili solo le spedizioni del mandante ${currentUser.mandante}`));
  }
  $('#track-btn').addEventListener('click', doTrack);
  $('#track-input').addEventListener('keydown', e => { if (e.key === 'Enter') doTrack(); });
}
function doTrack() {
  const code = $('#track-input').value.trim().toUpperCase();
  const s = SPEDIZIONI.find(x => x.ldv === code || x.id === code);
  const out = $('#track-result');
  // messaggio unico per "non esiste" e "non è tua" — evita enumeration della base
  if (!s || !spedizioneVisibile(s)) {
    out.innerHTML = `<div class="card"><div class="err-box">Nessuna spedizione trovata con il codice <span class="mono">${esc(code || '—')}</span>. Controlla il codice sulla lettera di vettura e riprova.</div></div>`;
    return;
  }
  const pub = s.tracking.filter(t => !t.interno);
  out.innerHTML = '';
  const card = el('div', { class: 'card' });
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">
      <h3 style="margin:0">Spedizione <span class="mono" style="color:var(--brand)">${s.ldv || s.id}</span></h3>
      ${badgeStato(s.stato)}
      <span class="spacer" style="flex:1"></span>
      <span class="tiny">Vista <strong>pubblica</strong> (cliente finale): mostra meno campi e nessun evento interno.</span>
    </div>
    <dl class="kv" style="margin-bottom:12px">
      <dt>Destinazione</dt><dd>${esc(s.localita)} (${esc(s.provincia)})</dd>
      <dt>Ultimo evento</dt><dd>${esc(pub[pub.length - 1].evento)}</dd>
    </dl>
    <ul class="timeline">${[...pub].reverse().map(t => `
      <li class="${t.evento.includes('Consegnata') ? 'done' : ''}">
        <div class="t-when">${t.data}</div>
        <div class="t-what">${esc(t.evento)}</div>
        <div class="t-where">${esc(t.luogo)}</div>
      </li>`).join('')}
    </ul>`;
  const bar = el('div', { style: 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap' });
  bar.appendChild(el('button', { class: 'btn btn-primary', onclick: () => openShipDetail(s.id, 'modal') }, 'Apri dettaglio completo (utente interno)'));
  bar.appendChild(el('span', { class: 'tiny', style: 'align-self:center' }, 'Il dettaglio completo include gli eventi interni ed è visibile solo agli operatori, coerentemente con i livelli di accesso.'));
  card.appendChild(bar);
  out.appendChild(card);
}

/* ============================================================
   16. APP OPERATIVA (simulazione web)
   ============================================================ */
const appopState = { mode: 'padroncino', presi: new Set(), foto: new Set(), consegnati: new Set() };
function initAppop() {
  $('#appop-mode').addEventListener('change', e => { appopState.mode = e.target.value; renderPhone(); });
  renderPhone();
}
function renderPhone() {
  const isProprio = appopState.mode === 'padroncino';
  $('#phone-mode-label').textContent = isProprio ? 'Linea propria — Padroncino Riviera' : 'Corriere esterno — Corriere B';
  const pkgs = SPEDIZIONI.filter(s => ['Pronta per etichettatura', 'In transito'].includes(s.stato)).slice(0, 4);
  const body = $('#phone-body');
  body.innerHTML = '';

  const scan = el('div', { class: 'scan-zone' });
  scan.innerHTML = `<div class="scan-ico">▦</div>Inquadra il barcode del collo`;
  const bip = el('button', { class: 'btn btn-accent', style: 'margin-top:8px', onclick: () => {
    const next = pkgs.find(p => !appopState.presi.has(p.id));
    if (!next) { toast('Tutti i colli del giro sono già stati presi in carico'); return; }
    appopState.presi.add(next.id);
    toast(`🔊 BIP — ${next.id} preso in carico`, 'ok');
    renderPhone();
  } }, '📷 Simula bip di presa in carico');
  scan.appendChild(bip);
  body.appendChild(scan);

  if (isProprio) {
    const bordero = el('div', { class: 'info-box', style: 'font-size:11.5px' });
    bordero.innerHTML = `<strong>Borderò digitale BRD-2026-0107</strong><br>Colli affidati: ${pkgs.length} · presi in carico: ${appopState.presi.size}/${pkgs.length}${appopState.presi.size === pkgs.length ? '<br>✔ Borderò completo — firma di presa in carico registrata' : ''}`;
    body.appendChild(bordero);
  } else {
    body.appendChild(el('div', { class: 'tiny', style: 'margin-bottom:8px' }, 'Corriere esterno: nessun borderò interno — la presa in carico è tracciata sui sistemi del corriere.'));
  }

  pkgs.forEach(p => {
    const item = el('div', { class: 'pkg-item' });
    const preso = appopState.presi.has(p.id);
    const foto = appopState.foto.has(p.id);
    const done = appopState.consegnati.has(p.id);
    item.innerHTML = `<div class="grow"><span class="mono" style="color:var(--brand);font-weight:600">${p.id}</span><br><span class="tiny">${esc(p.destinatario)} · ${esc(p.localita)}</span></div>`;
    if (done) item.appendChild(el('span', {}, badge('Consegnato ✓', 'ok')));
    else if (!preso) item.appendChild(el('span', {}, badge('da bippare', '')));
    else {
      const box = el('div');
      const slot = el('div', { class: 'photo-slot' + (foto ? ' done' : ''), onclick: () => {
        appopState.foto.add(p.id); toast('📸 Foto di consegna acquisita', 'ok'); renderPhone();
      } }, foto ? '📸 Foto acquisita ✓' : '📸 Scatta foto (obbligatoria)');
      box.appendChild(slot);
      const btn = el('button', { class: 'btn btn-sm btn-primary', style: 'width:100%', onclick: () => {
        if (!appopState.foto.has(p.id)) { toast('⚠ Foto obbligatoria prima di confermare la consegna', 'err'); return; }
        appopState.consegnati.add(p.id);
        const s = spedById(p.id);
        s.stato = 'Consegnata';
        s.storico.push({ stato: 'Consegnata', data: nowStr(), operatore: isProprio ? 'Padroncino Riviera' : 'Corriere B' });
        s.tracking.push({ data: nowStr(), evento: 'Consegnata al destinatario (con foto)', luogo: s.localita, interno: false, operatore: isProprio ? 'Padroncino Riviera' : 'Corriere B' });
        toast(`${p.id} consegnata ✓`, 'ok'); renderPhone();
      } }, 'Conferma consegna');
      box.appendChild(btn);
      item.appendChild(box);
    }
    body.appendChild(item);
  });
}

/* ============================================================
   17. CONFIGURAZIONI · ARCHITETTURA (broker, rate limit)
   ============================================================ */
const ARCH = {
  servizi: [
    { nome: 'Import flussi clienti', on: true, rate: 42 },
    { nome: 'Normalizzazione anagrafiche', on: true, rate: 38 },
    { nome: 'Stampa etichette', on: true, rate: 55 },
    { nome: 'Notifiche SMS/e-mail', on: true, rate: 30 },
    { nome: 'Sync marketplace', on: true, rate: 25 }
  ],
  depth: 120
};
function initArch() {
  const list = $('#svc-list');
  list.innerHTML = '';
  ARCH.servizi.forEach(s => {
    const row = el('div', { class: 'svc-row' });
    const led = el('span', { class: 'led' + (s.on ? '' : ' off') });
    row.appendChild(led);
    row.appendChild(el('span', { class: 'grow' }, `<strong>${esc(s.nome)}</strong> <span class="tiny">consumer · ${s.rate} msg/s</span>`));
    row.appendChild(el('button', { class: 'btn btn-sm', onclick: () => {
      s.on = !s.on;
      led.classList.toggle('off', !s.on);
      toast(s.on ? `${s.nome}: servizio riavviato` : `${s.nome}: servizio fermo — la coda inizierà ad accumularsi`, s.on ? 'ok' : 'err');
    } }, s.on ? 'Ferma' : 'Avvia'));
    list.appendChild(row);
  });

  // rate limit per vettore con storico orario (24 barre)
  const rl = $('#rl-list'); rl.innerHTML = '';
  VETTORI.filter(v => v.tipo === 'terzo').forEach((v, vi) => {
    const limite = [600, 450, 300][vi];
    const nodi = [3, 2, 2][vi];
    const hours = Array.from({ length: 24 }, (_, h) => {
      const base = limite * (0.25 + 0.5 * Math.exp(-Math.pow(h - 11, 2) / 18) + 0.35 * Math.exp(-Math.pow(h - 17, 2) / 10));
      return Math.min(limite, Math.round(base * (0.85 + rnd() * 0.3)));
    });
    const max = Math.max(...hours);
    const cur = hours[19];
    const row = el('div', { class: 'rl-row' });
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <strong style="font-family:var(--font-display)">${esc(v.nome)}</strong>
        <span class="tiny">limite API: <span class="mono">${limite} req/min</span> · distribuito su <span class="mono">${nodi} nodi</span></span>
        <span class="spacer" style="flex:1"></span>
        ${cur > limite * 0.85 ? badge('throttling attivo', 'warn') : badge('nessun throttling', 'ok')}
        <span class="tiny">ora corrente: <span class="mono">${cur}/${limite}</span></span>
      </div>
      <div class="bars">${hours.map(h => `<div class="bar ${h > limite * 0.85 ? 'peak' : ''}" style="height:${Math.max(3, Math.round(h / max * 100))}%" title="${h} req/min"></div>`).join('')}</div>
      <div class="bars-x"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>`;
    rl.appendChild(row);
  });

  // simulazione coda in tempo (quasi) reale
  setInterval(() => {
    const off = ARCH.servizi.filter(s => !s.on).length;
    ARCH.depth += off * rint(25, 60) - (ARCH.servizi.length - off) * rint(8, 20);
    ARCH.depth = Math.max(15, Math.min(5000, ARCH.depth));
    if (!$('#view-config').classList.contains('active')) return;
    $('#q-depth').textContent = ARCH.depth.toLocaleString('it-IT') + ' msg';
    $('#q-thr').textContent = ARCH.servizi.filter(s => s.on).reduce((a, s) => a + s.rate, 0) + ' msg/s in consumo';
    $('#q-cons').textContent = `${ARCH.servizi.filter(s => s.on).length}/${ARCH.servizi.length} attivi`;
    $('#q-meter').style.width = Math.min(100, ARCH.depth / 3000 * 100) + '%';
  }, 900);
}

/* ============================================================
   17b. LOG DELLE AZIONI
   ============================================================ */
function initLog() {
  dtLog = renderDataTable({
    mount: '#dt-log', title: 'Cronologia notifiche', noun: 'azioni',
    data: () => LOG_AZIONI, rowKey: r => r.id, pageSize: 15, selectable: false,
    columns: [
      { key: 'ts', label: 'Data/ora', ftype: 'date', sortValue: r => r.ts, render: r => `<span class="mono tiny">${esc(r.ts)}</span>` },
      { key: 'messaggio', label: 'Azione', ftype: 'text', render: r => esc(r.messaggio) },
      { key: 'area', label: 'Modulo', ftype: 'enum', render: r => badge(r.area, 'brand') },
      { key: 'utente', label: 'Utente', ftype: 'text', render: r => `${esc(r.utente)}<br><span class="tiny muted">${esc(r.livello)}</span>` },
      { key: 'kind', label: 'Esito', ftype: 'enum', render: r => badge(KIND_LABEL[r.kind] ?? 'Notifica', KIND_CLS[r.kind] ?? 'brand') }
    ]
  });
  $('#btn-log-clear').addEventListener('click', () => {
    if (!LOG_AZIONI.length) { toast('Il log è già vuoto', ''); return; }
    const count = LOG_AZIONI.length;
    openModal({
      title: 'Svuota log delle azioni',
      body: `<p>Confermi l'eliminazione di <strong>${count}</strong> voci dal log della sessione corrente? L'operazione non è reversibile.</p>`,
      actions: [
        { label: 'Annulla' },
        { label: 'Svuota log', cls: 'btn-danger', onClick: () => {
            LOG_AZIONI.length = 0;
            dtLog.refresh();
            toast('Log azioni svuotato', 'ok');
          } }
      ]
    });
  });
}

/* ============================================================
   18. DASHBOARD
   ============================================================ */
function initDashboard() {
  $('#dash-date').textContent = 'Martedì 21 luglio 2026 · Centro di smistamento Genova Bolzaneto';
  const capErr = SPEDIZIONI.filter(s => !s.capValido).length;
  const giacAperte = GIACENZE.filter(g => g.esito === 'Aperta').length;
  const perdita = LISTINI_VENDITA.filter(r => r.vendita < r.costo).length;
  const flussiErr = FLUSSI.filter(f => f.stato === 'Errore').length;
  $('#dash-kpis').innerHTML = `
    <div class="kpi" onclick="showView('spedizioni')"><div class="kpi-label">Spedizioni in lavorazione</div><div class="kpi-value">${SPEDIZIONI.filter(s => !['Consegnata'].includes(s.stato)).length}</div><div class="kpi-note">su ${SPEDIZIONI.length} totali in vista</div></div>
    <div class="kpi warn" onclick="showView('spedizioni')"><div class="kpi-label">CAP da correggere</div><div class="kpi-value">${capErr}</div><div class="kpi-note">azione massiva disponibile</div></div>
    <div class="kpi err" onclick="showView('giacenze')"><div class="kpi-label">Giacenze aperte</div><div class="kpi-value">${giacAperte}</div><div class="kpi-note">${GIACENZE.filter(g => g.esito === 'Aperta' && g.giorni >= 5).length} oltre 5 giorni</div></div>
    <div class="kpi err" onclick="showView('listini')"><div class="kpi-label">Righe vendita in perdita</div><div class="kpi-value">${perdita}</div><div class="kpi-note">controllo listini</div></div>
    <div class="kpi ${flussiErr ? 'warn' : 'ok'}" onclick="showView('flussi')"><div class="kpi-label">Flussi in errore</div><div class="kpi-value">${flussiErr}</div><div class="kpi-note">su ${FLUSSI_TOTALI} configurati</div></div>`;

  // distribuzione per stato
  const dist = {};
  STATO_PRIORITA.forEach(s => dist[s] = SPEDIZIONI.filter(x => x.stato === s).length);
  const max = Math.max(...Object.values(dist));
  $('#dash-stati').innerHTML = Object.entries(dist).map(([s, n]) => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:7px">
      <span style="width:190px;flex-shrink:0">${badgeStato(s)}</span>
      <div style="flex:1;background:var(--neutral-bg);border-radius:999px;height:10px;overflow:hidden">
        <div style="width:${n / max * 100}%;height:100%;background:var(--brand);border-radius:999px"></div>
      </div>
      <span class="mono small" style="width:26px;text-align:right">${n}</span>
    </div>`).join('');

  $('#dash-activity').innerHTML = [
    ['19:42', 'Import completato — Logistica Beta (CSV, 214 righe)', 'Flussi in ingresso'],
    ['19:15', 'Azione massiva: 23 spedizioni → Corriere B', 'Spedizioni · M. Bruzzone'],
    ['18:50', 'Nuovo listino 2027 caricato per Pharma Ligure', 'Listini · A. Vitali'],
    ['18:22', 'Push Vinted: 3 nuovi ordini ricevuti', 'Connettore e-commerce'],
    ['17:58', 'Giacenza SPD-2026-00131 → reso al mittente', 'Giacenze · S. Piaggio']
  ].map(([t, w, d]) => `<li><div class="t-when">Oggi ${t}</div><div class="t-what">${esc(w)}</div><div class="t-where">${esc(d)}</div></li>`).join('');
}

/* ============================================================
   19. ROUTER + INIT
   ============================================================ */
function showView(name) {
  // Guardia sui permessi: redirect silente se l'utente corrente non può
  // accedere alla vista richiesta. showView viene chiamata sia dal router
  // (click su nav-item) sia da handler interni (openShipDetail, ecc.).
  if (currentUser) {
    const ammesse = VIEW_AMMESSE[currentUser.livello] || VIEW_AMMESSE['Back office'];
    if (!ammesse.includes(name)) {
      const home = HOME_VIEW[currentUser.livello] || 'dashboard';
      name = home;
    }
  }
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + name).classList.add('active');
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'spedizioni' && $('#sped-detail-wrap').style.display === 'none' && $('#colli-wrap').style.display === 'none' && $('#diff-wrap').style.display === 'none') {
    $('#sped-list-wrap').style.display = '';
  }
  window.scrollTo({ top: 0 });
}

/**
 * Nasconde i bottoni della navbar non ammessi per il livello corrente.
 * Viene richiamata dopo il login e ogni volta che il livello dovesse cambiare.
 */
function applyNavForLevel(livello) {
  const ammesse = VIEW_AMMESSE[livello] || VIEW_AMMESSE['Back office'];
  $$('#mainnav .nav-item').forEach(b => {
    const ok = ammesse.includes(b.dataset.view);
    b.style.display = ok ? '' : 'none';
  });
  // ricostruisco il blocco profilo utente in modo idempotente (logout+login non deve duplicare nodi)
  const nu = $('#nav-user');
  if (!nu) return;
  const nome = currentUser?.nome || 'Utente';
  const iniziali = nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'U';
  nu.innerHTML = '';
  nu.appendChild(el('span', { class: 'avatar' }, iniziali));
  const box = el('span');
  box.appendChild(document.createTextNode(nome));
  box.appendChild(el('br'));
  box.appendChild(el('span', { class: 'user-livello', 'data-livello': livello }, livello));
  nu.appendChild(box);
  // se i data table sono già stati inizializzati (caso logout → login con altro livello),
  // ricalcolo i dataSrc basati sul nuovo currentUser
  if (appInitialized) {
    rebuildDataSources();
  }
}

/**
 * Ricalcola i dataSrc dei data table in base al livello del currentUser corrente.
 * Viene chiamato dopo il login (via applyNavForLevel) e copre il caso
 * "stesso tab aperto, logout, login con un altro livello".
 */
function rebuildDataSources() {
  const isMandante = currentUser?.livello === 'Mandante/Sottocontratto';
  if (dtSpedizioni) {
    dtSpedizioni.state.data = () => isMandante ? spedizioniVisibili(SPEDIZIONI) : SPEDIZIONI;
    dtSpedizioni.onFiltersChanged();
  }
  if (dtGiacenze) {
    const isCliente = currentUser?.livello === 'Cliente finale';
    const dataSrc = (isCliente || isMandante) ? spedizioniVisibili(GIACENZE) : GIACENZE;
    dtGiacenze.state.data = () => dataSrc;
    dtGiacenze.onFiltersChanged();
  }
  if (dtFlussi) dtFlussi.onFiltersChanged();
  renderKanban();
  renderListinoVendita();
  // Tracking: i suggerimenti rapidi vanno rigenerati
  const sg = $('#track-suggest');
  if (sg) {
    sg.innerHTML = 'Prova con:';
    const conLdv = spedizioniVisibili(SPEDIZIONI.filter(s => s.ldv)).slice(0, 3);
    if (conLdv.length === 0) {
      sg.appendChild(el('span', { class: 'tiny' }, ' (nessuna spedizione del tuo mandante ha ancora una LDV)'));
    } else {
      conLdv.forEach(s => sg.appendChild(el('button', { onclick: () => { $('#track-input').value = s.ldv; doTrack(); } }, s.ldv)));
    }
    if (currentUser && (currentUser.livello === 'Cliente finale' || currentUser.livello === 'Mandante/Sottocontratto')) {
      sg.appendChild(el('span', { class: 'tiny', style: 'margin-left:8px' },
        ` — visibili solo le spedizioni del mandante ${currentUser.mandante}`));
    }
  }
}

/* ---- Login simulato + utente corrente (punti 6-7) ---- */
let currentUser = null;
let appInitialized = false; // evita doppio binding dei listener dopo logout → nuovo login

function lookupUser(email) {
  const k = (email || '').trim().toLowerCase();
  if (ACCOUNT_DEMO[k]) return { ...ACCOUNT_DEMO[k], email: k };
  // fallback: qualsiasi altra mail entra come Back office (comportamento demo preesistente)
  return {
    nome: 'M. Bruzzone',
    livello: 'Back office',
    email: k || 'm.bruzzone@ctsolution.demo',
    mandante: '—',
    telefono: '+39 335 6402187',
    ultimoAccesso: nowStr(),
    stato: 'Attivo'
  };
}

function doLogin() {
  const email = $('#login-email').value;
  currentUser = lookupUser(email);
  currentUser.ultimoAccesso = nowStr();
  document.body.classList.remove('logged-out');
  if (!appInitialized) { initApp(); appInitialized = true; }
  applyNavForLevel(currentUser.livello); // nasconde voci non ammesse per il livello
  const home = HOME_VIEW[currentUser.livello] || 'dashboard';
  showView(home);
  const note = currentUser.livello === 'Cliente finale'
    ? `${currentUser.livello} (accesso limitato a Tracking e Giacenze del mandante ${currentUser.mandante})`
    : currentUser.livello === 'Mandante/Sottocontratto'
      ? `${currentUser.livello} (vedi solo dati di ${currentUser.mandante})`
      : currentUser.livello;
  toast(`Benvenuto, ${currentUser.nome} — accesso come ${note}`, 'ok');
}

function doLogout() {
  $('.modal-backdrop') && $('.modal-backdrop').remove();
  currentUser = null;
  $('#login-password').value = '';
  document.body.classList.add('logged-out'); // riporta alla schermata di login senza reload
  // reset navbar: rimostra tutte le voci (verranno filtrate di nuovo al prossimo login)
  $$('#mainnav .nav-item').forEach(b => b.style.display = '');
  const nu = $('#nav-user');
  if (nu) nu.innerHTML = '<span class="avatar">--</span><span>Utente<br><span style="opacity:.65">non connesso</span></span>';
}

function openProfilo() {
  if (!currentUser) return;
  const body = el('div');
  body.innerHTML = `
    <dl class="kv" style="grid-template-columns:150px 1fr;margin-bottom:12px">
      <dt>Nome</dt><dd><strong>${esc(currentUser.nome)}</strong></dd>
      <dt>Livello di accesso</dt><dd><span class="badge brand">${esc(currentUser.livello)}</span></dd>
      <dt>E-mail</dt><dd><span class="mono">${esc(currentUser.email)}</span></dd>
      <dt>Telefono</dt><dd><span class="mono">${esc(currentUser.telefono)}</span></dd>
      <dt>Ultimo accesso</dt><dd><span class="mono">${currentUser.ultimoAccesso}</span></dd>
    </dl>
    <p class="tiny">Dati anagrafici simulati — coerenti con l'utente mock della navbar.</p>`;
  openModal({
    title: 'Profilo utente', body,
    actions: [
      { label: 'Chiudi' },
      { label: 'Logout', cls: 'btn-danger', onClick: () => doLogout() }
    ]
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // prima di tutto: schermata di login (l'app parte solo dopo l'accesso)
  $('#login-submit').addEventListener('click', doLogin);
  $('#login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('#login-tab-accedi').addEventListener('click', () => {
    $('#login-tab-accedi').classList.add('active'); $('#login-tab-registrati').classList.remove('active');
    $('#login-extra').style.display = 'none'; $('#login-submit').textContent = 'Accedi';
    const t = $('#login-title'), s = $('#login-sub');
    if (t) t.textContent = 'Bentornato';
    if (s) s.textContent = 'Inserisci le credenziali per accedere alla dashboard.';
    $('.login-submit-label') && ($('.login-submit-label').textContent = 'Accedi');
  });
  $('#login-tab-registrati').addEventListener('click', () => {
    $('#login-tab-registrati').classList.add('active'); $('#login-tab-accedi').classList.remove('active');
    $('#login-extra').style.display = ''; $('#login-submit').textContent = 'Registrati ed entra';
    const t = $('#login-title'), s = $('#login-sub');
    if (t) t.textContent = 'Crea il tuo account';
    if (s) s.textContent = 'Solo pochi dati per iniziare a lavorare con CT Solution.';
    $('.login-submit-label') && ($('.login-submit-label').textContent = 'Registrati ed entra');
  });

  // toggle mostra/nascondi password
  const eye = $('#login-eye');
  if (eye) eye.addEventListener('click', () => {
    const p = $('#login-password');
    const showing = p.type === 'text';
    p.type = showing ? 'password' : 'text';
    eye.textContent = showing ? '👁' : '🙈';
  });

  // pressione "Invio" su qualunque campo del form lancia il submit
  $$('.login-form input').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  });
  const nu = $('#nav-user');
  nu.addEventListener('click', openProfilo);
  nu.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfilo(); } });
});

function initApp() {
  $$('.nav-item').forEach(b => b.addEventListener('click', () => {
    // tornando su Spedizioni dalla navbar si riparte sempre dall'elenco
    if (b.dataset.view === 'spedizioni') {
      $('#sped-detail-wrap').style.display = 'none';
      $('#colli-wrap').style.display = 'none';
      $('#diff-wrap').style.display = 'none';
      $('#sped-list-wrap').style.display = '';
    }
    showView(b.dataset.view);
  }));

  initSpedTabs();
  initSpedTable();
  initListini();
  initFlussi();
  initGiacenze();
  initEcommerce();
  initUtenti();
  initLog();
  initTracking();
  initAppop();
  initArch();
  initDashboard();

  $('#btn-goto-colli').addEventListener('click', gotoColli);
  $('#btn-goto-diff').addEventListener('click', gotoDiff);
  $('#btn-colli-back').addEventListener('click', () => { $('#colli-wrap').style.display = 'none'; $('#sped-list-wrap').style.display = ''; dtSpedizioni.refresh(); });
  $('#btn-diff-back').addEventListener('click', () => { $('#diff-wrap').style.display = 'none'; $('#sped-list-wrap').style.display = ''; dtSpedizioni.refresh(); });
  $('#btn-nuovo-cm').addEventListener('click', openNuovoColloMadre);
}

// esposti per gli onclick inline nei template
window.openShipDetail = openShipDetail;
window.openLdv = openLdv;
window.spedById = spedById;
window.gotoColli = gotoColli;
window.showView = showView;
window.toast = toast;