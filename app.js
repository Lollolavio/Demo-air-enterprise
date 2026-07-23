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

function toast(msg, kind = '', area = null) {
  const t = el('div', { class: `toast ${kind}` }, msg);
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 3800);
  logAzione(msg, kind, area);
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

function logAzione(msg, kind = '', area = null) {
  LOG_AZIONI.unshift({
    id: logSeq++,
    ts: nowStr(),
    utente: currentUser ? currentUser.nome : 'Sistema',
    livello: currentUser ? currentUser.livello : '—',
    area: area || currentAreaLabel(),
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
  { id: 'CA', nome: 'Bartolini', tipo: 'terzo' },
  { id: 'CB', nome: 'DHL', tipo: 'terzo' },
  { id: 'CC', nome: 'FedEX', tipo: 'terzo' },
  { id: 'P1', nome: 'Padroncino Nord-Ovest', tipo: 'proprio' },
  { id: 'P2', nome: 'Padroncino Riviera',    tipo: 'proprio' },
  { id: 'P3', nome: 'Padroncino Val Padana', tipo: 'proprio' }
];
const vettoreByNome = nome => VETTORI.find(v => v.nome === nome);

const SERVIZI = ['Consegna al piano', 'SMS di preavviso', 'Consegna su appuntamento', 'Contrassegno', 'Reso documenti'];
// Matrice di compatibilità servizio → vettori che lo supportano
const COMPAT = {
  'Consegna al piano':        ['Bartolini', 'Padroncino Nord-Ovest', 'Padroncino Riviera', 'Padroncino Val Padana'],
  'SMS di preavviso':         ['Bartolini', 'DHL', 'FedEX', 'Padroncino Nord-Ovest', 'Padroncino Riviera', 'Padroncino Val Padana'],
  'Consegna su appuntamento': ['DHL', 'Padroncino Nord-Ovest', 'Padroncino Riviera'],
  'Contrassegno':             ['Bartolini', 'DHL'],
  'Reso documenti':           ['Bartolini', 'FedEX', 'Padroncino Val Padana']
};
const servizioCompatibile = (servizio, vettoreNome) => !vettoreNome || (COMPAT[servizio] || []).includes(vettoreNome);

const STATI_SPED = ['In revisione', 'In staging', 'Pronta per etichettatura', 'Pronto per la spedizione', 'In transito', 'Consegnata', 'In giacenza'];
// Priorità logica per l'ordinamento dei badge di stato
const STATO_PRIORITA = ['In revisione', 'In staging', 'Pronta per etichettatura', 'Pronto per la spedizione', 'In giacenza', 'In transito', 'Consegnata'];
const statoBadgeCls = s => ({
  'In revisione': 'warn', 'In staging': 'info',
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
    const haVettore = !['In revisione', 'In staging'].includes(stato) || rnd() > 0.6;
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
    const flowIdx = { 'In revisione': 0, 'In staging': 1, 'Pronta per etichettatura': 2, 'Pronto per la spedizione': 3, 'In transito': 4, 'Consegnata': 5, 'In giacenza': 5 };
    const flow = ['In revisione', 'In staging', 'Pronta per etichettatura', 'Pronto per la spedizione', 'In transito', stato === 'In giacenza' ? 'In giacenza' : 'Consegnata'];
    const storico = flow.slice(0, flowIdx[stato] + 1).map((s, ix) => ({
      stato: ix === flowIdx[stato] ? stato : s,
      data: `2026-07-${String(Math.min(giorno + ix, 21)).padStart(2, '0')} ${String(Math.min(ora + ix, 23)).padStart(2, '0')}:${String(rint(0, 59)).padStart(2, '0')}`,
      operatore: pick(OPERATORI)
    }));

    const note = rnd() > 0.7 ? [{ testo: pick(['Il destinatario chiede consegna dopo le 17.', 'Citofono guasto: chiamare al telefono.', 'Merce fragile, già segnalato al vettore.', 'Verificare CAP con il mandante.']), data: dataIn, autore: pick(OPERATORI) }] : [];

    const tracking = storico.map(h => ({
      data: h.data,
      evento: { 'In revisione': 'Spedizione acquisita dal flusso cliente', 'In staging': 'Dati validati — in attesa di assegnazione vettore', 'Pronta per etichettatura': 'Etichetta pronta per la stampa', 'Pronto per la spedizione': 'LDV generata e stampata — spedizione pronta per il ritiro/affidamento al vettore', 'In transito': 'Affidata al vettore — in transito', 'Consegnata': 'Consegnata al destinatario', 'In giacenza': 'Tentativo di consegna non riuscito — in giacenza' }[h.stato] || h.stato,
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

function normalizzaDatasetDemo() {
  const STATI_FINALI = ['In transito', 'Consegnata', 'Pronto per la spedizione', 'In giacenza'];
  const REV = ['In revisione'];
  const REV_STAGING = ['In revisione', 'In staging'];

  let A = 0, B = 0, C = 0, D = 0;

  for (const r of SPEDIZIONI) {
    const isStatoFinale = STATI_FINALI.includes(r.stato);

    // ---- A) Fix CAP/tel/vettore per stati finali ----
    if (isStatoFinale) {
      const capChanged = !r.capValido;
      const telChanged = !r.telOk;
      const vetChanged = !r.vettore;
      if (capChanged) {
        const loc = LOCALITA.find(l => l[0] === r.localita);
        r.cap = loc ? loc[2] : '16121';
        r.capValido = true;
      }
      if (telChanged) {
        r.telefono = '+39 3' + rint(20, 89) + ' ' + rint(1000000, 9999999);
        r.telOk = true;
      }
      if (vetChanged) r.vettore = pick(VETTORI).nome;
      if (capChanged || telChanged || vetChanged) {
        A++;
        const campi = [capChanged && 'CAP', telChanged && 'tel', vetChanged && 'vettore'].filter(Boolean).join('/');
        r.storico.push({
          stato: r.stato,
          data: nowStr(),
          operatore: 'M. Bruzzone',
          nota: 'Normalizzazione dati demo (boot)'
        });
        r.tracking.push({
          data: nowStr(),
          evento: 'Normalizzazione dati anagrafici al boot',
          luogo: 'Back office',
          interno: true,
          operatore: 'M. Bruzzone',
          notaInterna: `Fix automatico dati demo (boot): ${campi}`
        });
      }
    }

    // ---- B) Declassamento a "In revisione" se CAP o tel non validi ----
    if (!r.capValido || !r.telOk) {
      r.stato = 'In revisione';
      r.vettore = null;
      B++;
      r.storico.push({
        stato: 'In revisione',
        data: nowStr(),
        operatore: 'M. Bruzzone',
        nota: 'CAP o telefono non valido — riportata in revisione (boot)'
      });
      r.tracking.push({
        data: nowStr(),
        evento: 'CAP o telefono non valido — spedizione riportata in revisione',
        luogo: 'Back office',
        interno: true,
        operatore: 'M. Bruzzone',
        notaInterna: 'Declassamento automatico al boot per dati anagrafici incompleti'
      });
      continue; // salta C e D: appena declassata, non può essere promossa nello stesso giro
    }

    // ---- C) Promozione a "In staging" (CAP+tel OK, in revisione, senza vettore) ----
    if (REV.includes(r.stato) && !r.vettore) {
      r.stato = 'In staging';
      C++;
      r.storico.push({
        stato: 'In staging',
        data: nowStr(),
        operatore: 'M. Bruzzone',
        nota: 'CAP e telefono validi — promozione automatica a staging (boot)'
      });
      r.tracking.push({
        data: nowStr(),
        evento: 'CAP e telefono validi — dati anagrafici validati, in attesa di assegnazione vettore',
        luogo: 'Back office',
        interno: true,
        operatore: 'M. Bruzzone',
        notaInterna: 'Auto-promo a staging al boot (CAP+tel OK)'
      });
    }

    // ---- D) Promozione a "Pronta per etichettatura" (CAP+tel+vettore OK) ----
    // ---- D) Promozione a "Pronta per etichettatura" (CAP+tel+vettore OK) ----
    if (r.vettore && REV_STAGING.includes(r.stato)) {
      r.stato = 'Pronta per etichettatura';
      D++;
      r.storico.push({
        stato: 'Pronta per etichettatura',
        data: nowStr(),
        operatore: 'M. Bruzzone',
        nota: 'CAP+tel validi e vettore assegnato — promozione a Pronta per etichettatura (boot)'
      });
      r.tracking.push({
        data: nowStr(),
        evento: 'Vettore assegnato — spedizione pronta per la stampa etichetta',
        luogo: 'Back office',
        interno: true,
        operatore: 'M. Bruzzone',
        notaInterna: 'Auto-promo a Pronta per etichettatura al boot (CAP+tel+vettore OK)'
      });
    }
  }

  toast(
    `Demo normalizzato: ${A} stati finali corretti, ${B} in revisione, ${C} promozioni a staging, ${D} promozioni a Pronta per etichettatura`,
    'info',
    'Boot'
  );

  return { A, B, C, D };
}

/* ---- Colli madre: 3 bancali che raggruppano alcune spedizioni ----
 * Il collo madre NON ha un codice a sé (vedi nota più sotto): il suo "id" è
 * semplicemente l'id della prima spedizione del gruppo, esattamente come nel
 * flusso di creazione manuale (openNuovoColloMadre). */
const COLLI_MADRE = [];
const BANCALI_DESCR = ['Bancale Pharma Ligure — lotto 07/26', 'Bancale ElettroHouse — elettrodomestici', 'Bancale ModaExpress — resi stagionali'];
const gruppiBancali = [[], [], []];
SPEDIZIONI.slice(0, 11).forEach((s, i) => gruppiBancali[i % 3].push(s));
gruppiBancali.forEach((gruppo, i) => {
  const [madre, ...figli] = gruppo;
  const cm = { id: madre.id, descr: BANCALI_DESCR[i], figli: figli.map(s => s.id) };
  figli.forEach(s => { s.colloMadre = cm.id; });
  COLLI_MADRE.push(cm);
});
function statoAggregato(cm) {
  const stati = cm.figli.map(id => spedById(id).stato);
  const cons = stati.filter(s => s === 'Consegnata').length;
  if (cons === stati.length) return ['Consegnato', 'ok'];
  if (cons === 0) return ['Non consegnato', 'err'];
  return [`Consegnato parzialmente (${cons}/${stati.length})`, 'warn'];
}
// Il "collo madre" è a tutti gli effetti una spedizione come le altre: è semplicemente
// il primo collo scansionato sul bancale. isMadre/madreOf derivano il ruolo dalla sola
// appartenenza a COLLI_MADRE, così non serve tenere un flag duplicato sulla spedizione.
function isMadre(id) { return COLLI_MADRE.some(cm => cm.id === id); }
function madreOf(id) { return COLLI_MADRE.find(cm => cm.id === id); }

/* ---------------------------------------------------------- *
 * 3. Flussi in ingresso
 * ---------------------------------------------------------- */
const REGOLE_POOL = [
  ['Tutte le spedizioni del mandante', 'SMS di preavviso automatico'],
  ['Destinazione = Milano', 'Consegna al piano attivata'],
  ['Peso > 20 kg', 'Instradamento su linea propria'],
  ['CAP in zona 191xx', 'Etichetta DHL'],
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
 * 4. Listini e tariffe — modello a VERSIONI
 *
 *    Ogni listino (costo o vendita) è una "versione" con proprie righe
 *    e un periodo di validità (decorrenzaInizio / decorrenzaFine). Le
 *    sezioni della UI sono 4: listino di costo ATTIVO, suo STORICO,
 *    listino di vendita ATTIVO, suo STORICO.
 *
 *    - I listini di costo non hanno un "mandante" (sono il costo che
 *      CT Solution paga al vettore, uguale per tutti i clienti).
 *    - I listini di vendita sono per-mandante.
 *    - Lo stato è derivato dalla data odierna: 'attivo' se oggi è nel
 *      periodo, 'futuro' se decorrenzaInizio > oggi, 'archiviato' se
 *      decorrenzaFine < oggi. Una decorrenza vuota = sempre attivo.
 * ---------------------------------------------------------- */
// Scaglioni e zone allineati al formato dei listini vettore reali (es. DHL Express
// Worldwide Export) che vengono importati da CSV: scaglioni di peso ogni 0.5 kg da
// 0.5 a 70.0 kg, e 9 zone di destinazione ("Zona 1" … "Zona 9").
const SCAGLIONI = Array.from({ length: 140 }, (_, i) => (0.5 * (i + 1)).toFixed(1) + ' kg');
const ZONE = Array.from({ length: 9 }, (_, i) => `Zona ${i + 1}`);
// Ricava il peso numerico (kg) da uno scaglione tipo "12.5 kg"
const pesoScaglione = sc => parseFloat(String(sc).replace(',', '.'));
const OGGI = '2026-07-22'; // demo: data fissa, congelata per i test di auto-arciviazione

// 4a. Listini dei vettori terzi (base costo esterna, non negoziabile)
//     Restano come dataset di consultazione nella sotto-tab "Origine vettori".
const LISTINI_VETTORE = {};
VETTORI.filter(v => v.tipo === 'terzo').forEach((v, vi) => {
  const rows = [];
  SCAGLIONI.forEach(sc => {
    const peso = pesoScaglione(sc);
    ZONE.forEach((z, zi) => {
      rows.push({
        vettore: v.nome, scaglione: sc, zona: z,
        prezzo: +(3.2 + peso * 0.42 + zi * 1.35 + vi * 0.45 + rnd() * 0.8).toFixed(2),
        fuel: +(4 + vi * 1.5 + rnd() * 2).toFixed(1),
        validita: vi === 1 ? '01/07/2026 – 31/12/2026' : '01/03/2026 – 31/12/2026'
      });
    });
  });
  LISTINI_VETTORE[v.nome] = {
    rows,
    rowsByKey: new Map(rows.map(r => [`${r.scaglione}|${r.zona}`, r])),
    aggiornato: ['03/03/2026', '28/06/2026', '15/05/2026'][vi],
    versione: ['03/2026', '07/2026', '05/2026'][vi],
    nota: `Listino ${v.nome} aggiornato dal fornitore il ${['03/03/2026', '28/06/2026', '15/05/2026'][vi]} — dati di esempio`
  };
});

/* ---- Helper: stato di una versione di listino in base alla data odierna ---- */
function statoListino(listino) {
  const oggi = OGGI;
  if (listino.stato === 'archiviato') return 'archiviato'; // forzato manualmente
  if (listino.decorrenzaInizio && oggi < listino.decorrenzaInizio) return 'futuro';
  if (listino.decorrenzaFine && oggi > listino.decorrenzaFine) return 'archiviato';
  return 'attivo';
}

/* ---- 4b. Listini di costo (per vettore, con versioning) ----
 * LISTINI_COSTO: { [vettoreId]: { versioni: ListinoCosto[] } }
 * ListinoCosto: { id, vettore, label, decorrenzaInizio, decorrenzaFine, stato, righe[], note, creatoIl, creatoDa }
 * Riga: { scaglione, zona, costo, costoVettore, origine, origineTipo, valoreOriginale, personalizzazione }
 * Lo stato è derivato da OGGI (ricalcolato a ogni ricalcolaStatoListini).
 * Reset totale: partono vuoti. I listini si creano importando un CSV o duplicando uno esistente.
 */
const LISTINI_COSTO = {};

/* ---- 4c. Listini di vendita (per mandante × vettore, con versioning) ----
 * LISTINI_VENDITA: { [mandante]: { [vettoreId]: { versioni: ListinoVendita[] } } }
 * ListinoVendita: { id, mandante, vettore, label, decorrenzaInizio, decorrenzaFine, stato, righe[], agente, provvigionePct, scontoPct, note, creatoIl, creatoDa }
 * Riga: { scaglione, zona, costo, costoVettore, vendita, margine, personalizzazione }
 */
const LISTINI_VENDITA = {};

/* ---- Helper di accesso ---- */
// Tag del mandante per gli ID dei listini di vendita (prima parola, uppercase, alphanumeric).
const mandanteTag = m => ((m || '').split(' ')[0] || 'CLI').replace(/[^A-Za-z]/g, '').toUpperCase();
// Tag vettore = l'id di VETTORI (CA, CB, CC, P1, P2, P3).

// Prossimo ID listino di costo per un vettore (suffisso -CSV se importato).
function nextListinoCostoId(vettoreId, anno, isCsv) {
  const bucket = LISTINI_COSTO[vettoreId] || { versioni: [] };
  const prefix = 'LC-' + anno + '-' + vettoreId + '-';
  const same = bucket.versioni.filter(l => l.id.startsWith(prefix));
  const nn = same.length + 1;
  return prefix + String(nn).padStart(2, '0') + (isCsv ? '-CSV' : '');
}

// Prossimo ID listino di vendita per una coppia (mandante, vettore).
function nextListinoVenditaId2(mandante, vettoreId, isCsv) {
  const bucket = (LISTINI_VENDITA[mandante] || {})[vettoreId] || { versioni: [] };
  const mTag = mandanteTag(mandante);
  const prefix = 'LV-' + mTag + '-' + vettoreId + '-';
  const same = bucket.versioni.filter(l => l.id.startsWith(prefix));
  const nn = same.length + 1;
  return prefix + String(nn).padStart(3, '0') + (isCsv ? '-CSV' : '');
}

// Lookup O(1) per riga di listino di costo, dato (vettore, scaglione, zona).
// Ritorna la riga della versione attiva del listino del vettore, oppure null.
function lookupRigaCosto(vettoreId, scaglione, zona) {
  const bucket = LISTINI_COSTO[vettoreId];
  if (!bucket) return null;
  const attiva = bucket.versioni.find(v => v.stato === 'attivo');
  if (!attiva) return null;
  return attiva.righe.find(r => r.scaglione === scaglione && r.zona === zona) || null;
}

// Costruisce la mappa (scaglione|zona -> riga) per la versione attiva del listino del vettore.
function mappaCostoAttivo(vettoreId) {
  const bucket = LISTINI_COSTO[vettoreId];
  if (!bucket) return new Map();
  const attiva = bucket.versioni.find(v => v.stato === 'attivo');
  if (!attiva) return new Map();
  return new Map(attiva.righe.map(r => [`${r.scaglione}|${r.zona}`, r]));
}

// Accessor con auto-creazione del bucket di scope.
function ensureListinoCosto(vettoreId) {
  if (!LISTINI_COSTO[vettoreId]) LISTINI_COSTO[vettoreId] = { versioni: [] };
  return LISTINI_COSTO[vettoreId];
}
function ensureListinoVendita(mandante, vettoreId) {
  if (!LISTINI_VENDITA[mandante]) LISTINI_VENDITA[mandante] = {};
  if (!LISTINI_VENDITA[mandante][vettoreId]) LISTINI_VENDITA[mandante][vettoreId] = { versioni: [] };
  return LISTINI_VENDITA[mandante][vettoreId];
}

// Listino di costo attivo per un dato vettore (o null).
function listinoCostoAttivo(vettoreId) {
  const bucket = LISTINI_COSTO[vettoreId];
  if (!bucket) return null;
  return bucket.versioni.find(v => v.stato === 'attivo') || null;
}

// Listino di vendita attivo per una data coppia (mandante, vettore).
function getListinoVenditaAttivo(mandante, vettoreId) {
  const byMand = LISTINI_VENDITA[mandante];
  if (!byMand) return null;
  const byVet = byMand[vettoreId];
  if (!byVet) return null;
  return byVet.versioni.find(v => v.stato === 'attivo') || null;
}

// Tutte le versioni di un listino (qualunque stato), ordinate per decorrenza disc.
function versioniListinoCosto(vettoreId) {
  return (LISTINI_COSTO[vettoreId]?.versioni || []).slice().sort((a, b) =>
    (b.decorrenzaInizio || '').localeCompare(a.decorrenzaInizio || ''));
}
function versioniListinoVendita(mandante, vettoreId) {
  return (LISTINI_VENDITA[mandante]?.[vettoreId]?.versioni || []).slice().sort((a, b) =>
    (b.decorrenzaInizio || '').localeCompare(a.decorrenzaInizio || ''));
}

// Iteratori piatti usati dalla dashboard e da ricalcolaStatoListini.
function tutteVersioniCosto() {
  return VETTORI.flatMap(v => LISTINI_COSTO[v.id]?.versioni || []);
}
function tutteVersioniVendita() {
  return Object.values(LISTINI_VENDITA)
    .flatMap(byV => Object.values(byV).flatMap(b => b.versioni));
}

/* ---- Auto-arciviazione: prima di ogni render, ricalcola lo stato in base a OGGI.
 * Le righe storiche che sono 'attive' secondo decorrenza ma 'archiviato' forzato restano tali. */
function ricalcolaStatoListini() {
  [...tutteVersioniCosto(), ...tutteVersioniVendita()].forEach(l => {
    l.stato = statoListino(l);
  });
}

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

  // Insieme delle colonne da nascondere al rendering corrente. Accetta una funzione
  // per consentire regole dinamiche (es. dipendenti dalla sotto-tab attiva).
  function getHiddenKeys() {
    const hc = cfg.hiddenColumns;
    if (!hc) return new Set();
    const list = typeof hc === 'function' ? hc() : hc;
    return new Set(list || []);
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
    const hiddenKeys = getHiddenKeys();
    const visCols = cfg.columns.filter(c => !hiddenKeys.has(c.key));
    const colSpanN = visCols.length + (cfg.selectable ? 1 : 0) + (cfg.rowActions ? 1 : 0);

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
      if (hiddenKeys.has(col.key)) return;
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
      if (hiddenKeys.has(col.key)) return;
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
      const td = el('td', { colspan: colSpanN });
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
        if (hiddenKeys.has(col.key)) return;
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
  // Da "In revisione" si esce solo promuovendo a "In staging"
  if (r.stato === 'In revisione' && nuovoStato !== 'In staging') {
    return { ok: false, msg: `${r.id}: da «In revisione» si esce solo con «In staging» (dati validi)` };
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
    const daRevisione = st !== 'In staging' ? sel.rows.filter(r => r.stato === 'In revisione').length : 0;
    let html = '';
    if (noVet)    html += `<div class="warn-box">⚠ <strong>${noVet}</strong> spedizioni senza vettore: non possono passare a «Pronta per etichettatura».</div>`;
    if (noDati)   html += `<div class="warn-box">⚠ <strong>${noDati}</strong> spedizioni con CAP o telefono non validi: non possono passare a «In staging».</div>`;
    if (daRevisione) html += `<div class="warn-box">⚠ <strong>${daRevisione}</strong> spedizioni sono attualmente in «In revisione»: da questo stato si esce solo con «In staging».</div>`;
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
  const promoCount = () => target.filter(r => (r.stato === 'In revisione') && r.telOk).length;
  confirmBulk({
    azione: 'Correggi CAP non validi (mock)', count: target.length, mode: 'filter',
    dettagli: 'Vengono considerate solo le righe con stato «CAP da correggere» all\'interno del risultato del filtro corrente. Le spedizioni attualmente in «In revisione» con telefono già valido vengono promosse automaticamente a «In staging».',
    onConfirm: () => {
      let promo = 0;
      target.forEach(r => {
        const loc = LOCALITA.find(l => l[0] === r.localita);
        r.cap = loc ? loc[2] : '16121'; r.capValido = true;
        // auto-promozione: CAP appena corretto, tel già ok → passa a staging
        if ((r.stato === 'In revisione') && r.telOk) {
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
    dettagli: 'I numeri in formato non standard vengono riportati al formato internazionale +39 per l\'invio SMS. Le spedizioni attualmente in «In revisione» con CAP già valido vengono promosse automaticamente a «In staging».',
    onConfirm: () => {
      let promo = 0;
      target.forEach(r => {
        r.telefono = '+39 3' + rint(20, 89) + ' ' + rint(1000000, 9999999); r.telOk = true;
        if ((r.stato === 'In revisione') && r.capValido) {
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
    // Nella sotto-tab "Pronta per etichettatura" nascondi le colonne "Validazione" e
    // "Telefono": in quello stato le spedizioni sono già state validate e il CAP/tel
    // non è più un'informazione rilevante per l'operatore. Restano visibili in tutte
    // le altre sotto-tab (compresa "Tutte").
    hiddenColumns: () => spedTab === 'Pronta per etichettatura' ? ['capValido', 'telefono'] : [],
    columns: [
      { key: 'id', label: 'ID spedizione', ftype: 'text', render: r => `<span class="mono" style="color:var(--brand);font-weight:600">${r.id}</span>${isMadre(r.id) ? ' <span class="tag" title="È il collo madre (primo collo scansionato) di un bancale">MADRE</span>' : r.colloMadre ? ' <span class="tag" title="Fa parte di un collo madre">CM</span>' : ''}` },
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

      if (r.stato === 'Pronta per etichettatura') box.appendChild(el('button', { class: 'btn btn-sm btn-accent', onclick: () => openLdv(r) }, 'LDV'));
/*
      box.appendChild(el('button', { class: 'btn btn-sm', title: 'Apri in tab dedicata', onclick: () => openShipDetail(r.id, 'tab') }, 'Apri ↗'));
      if (r.stato === 'Pronti per etichettatura') box.appendChild(el('button', { class: 'btn btn-sm btn-accent', onclick: () => openLdv(r) }, 'LDV'));
*/
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
    { titolo: 'Pronta per etichettatura', stati: ['Pronta per etichettatura'], next: null, nextLabel: null }
  ];
  const root = $('#staging-kanban');
  if (!root) return; // la vista kanban non è presente in questa versione dell'interfaccia
  root.innerHTML = '';
  cols.forEach(c => {
    const rows = src.filter(s => c.stati.includes(s.stato)).slice(0, 6);
    const tot = src.filter(s => c.stati.includes(s.stato)).length;
    const col = el('div', { class: 'kanban-col' });
    col.appendChild(el('h4', {}, `${esc(c.titolo)} <span class="count">${tot}</span>`));
    rows.forEach(r => {
      const card = el('div', { class: 'kcard', onclick: () => openShipDetail(r.id, 'modal') });
      card.innerHTML = `<div class="k-id">${r.id}</div>
        <div class="k-dest">${esc(r.destinatario)} · ${esc(r.localita)}</div>
        <div class="k-meta">${esc(r.mandante)} · ${r.vettore ? esc(r.vettore) : '<span style="color:var(--warn)">vettore da assegnare</span>'} ${r.stato === 'Pronta per etichettatura' ? badge('Pronti', 'accent') : ''}</div>`;
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
      <dt>Collo madre</dt><dd>${isMadre(r.id) ? `<span class="tag" title="Primo collo scansionato sul bancale">Collo madre</span> di ${madreOf(r.id).figli.length} sotto-colli — <button class="btn-link" onclick="gotoColli('${r.id}')">vai alla vista ad albero</button>` : r.colloMadre ? `Sotto-collo di <span class="mono">${r.colloMadre}</span> — <button class="btn-link" onclick="gotoColli('${r.colloMadre}')">vai alla vista ad albero</button>` : '<span class="muted">spedizione singola</span>'}</dd>
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
function gotoColli(prefillId = '') {
  $('.modal-backdrop') && $('.modal-backdrop').remove();
  showView('spedizioni');
  $('#sped-list-wrap').style.display = 'none';
  $('#sped-detail-wrap').style.display = 'none';
  $('#diff-wrap').style.display = 'none';
  $('#colli-wrap').style.display = '';
  const search = $('#colli-search');
  if (search) search.value = prefillId;
  renderColli(prefillId);
}
function renderColli(filter) {
  if (filter === undefined) { const s = $('#colli-search'); filter = s ? s.value : ''; }
  const root = $('#colli-tree'); root.innerHTML = '';
  const q = filter.trim().toLowerCase();
  const lista = q ? COLLI_MADRE.filter(cm => cm.id.toLowerCase().includes(q) || cm.figli.some(fid => fid.toLowerCase().includes(q))) : COLLI_MADRE;
  if (!lista.length) { root.innerHTML = '<li class="dt-empty" style="padding:14px">Nessun bancale corrisponde alla ricerca.</li>'; return; }
  lista.forEach(cm => {
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
    const madreSped = spedById(cm.id);
    const madreRow = el('div', { class: 'tc-row', style: 'background:var(--bg-soft,rgba(127,127,127,.08))' });
    madreRow.innerHTML = `<span class="mono" style="color:var(--brand);font-weight:700">${madreSped.id}</span>
      <span>${esc(madreSped.destinatario)} · ${esc(madreSped.localita)}</span>
      ${badgeStato(madreSped.stato)}
      <span class="tag" title="Primo collo scansionato sul bancale: identifica la provenienza del gruppo">Collo madre</span>
      <span class="grow"></span>`;
    madreRow.appendChild(el('button', { class: 'btn btn-sm', onclick: () => openShipDetail(madreSped.id, 'modal') }, 'Dettaglio'));
    body.appendChild(madreRow);
    cm.figli.forEach(fid => {
      const s = spedById(fid);
      const row = el('div', { class: 'tc-row' });
      row.innerHTML = `<span class="mono" style="color:var(--brand)">${s.id}</span>
        <span>${esc(s.destinatario)} · ${esc(s.localita)}</span>
        ${badgeStato(s.stato)}
        <span class="tiny" style="opacity:.7">↳ figlio di ${cm.id}</span>
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

/* ---- Creazione nuovo collo madre ----
 * Simula lo scan fisico in magazzino: il PRIMO collo scansionato diventa
 * automaticamente il "collo madre" (non ha un codice a sé: è identificato dal
 * proprio ID/barcode); ogni collo scansionato successivamente diventa un suo
 * "figlio". L'operatore può correggere il ruolo in qualsiasi momento prima di
 * confermare, spostando la designazione di "madre" su un altro collo già scansionato. */
function openNuovoColloMadre() {
  const sequenza = []; // ordine di scan: sequenza[0] è sempre il collo madre
  const disponibili = () => SPEDIZIONI.filter(s => !s.colloMadre && !isMadre(s.id) && !sequenza.includes(s.id));

  const body = el('div');
  body.innerHTML = `
    <div class="form-row"><label>Descrizione bancale (facoltativa)</label><input type="text" id="cm-descr" placeholder="es. Bancale TechnoParts — ricambi urgenti"></div>
    <div class="info-box">📦 Simula lo scan dei colli in arrivo sul bancale: il <strong>primo collo scansionato</strong> diventa automaticamente il <strong>collo madre</strong> (serve solo a tracciare la provenienza); i successivi ne diventano i sotto-colli. Puoi correggere il collo madre in qualsiasi momento con "Imposta come madre".</div>
    <div class="grid-2" style="align-items:start;gap:16px">
      <div class="form-row">
        <label>Colli da scansionare</label>
        <input type="text" id="cm-search" placeholder="Cerca per ID, destinatario o località…" style="margin-bottom:6px">
        <div id="cm-avail" style="max-height:280px;overflow-y:auto;border:1px solid var(--line);border-radius:var(--radius-sm)"></div>
      </div>
      <div class="form-row">
        <label>Sequenza di scan sul bancale (<span id="cm-count">0</span> colli)</label>
        <div id="cm-seq" style="max-height:280px;overflow-y:auto;border:1px solid var(--line);border-radius:var(--radius-sm)">
          <div class="dt-empty" style="padding:14px">Nessun collo ancora scansionato.</div>
        </div>
      </div>
    </div>`;

  const availEl = $('#cm-avail', body);
  const seqEl = $('#cm-seq', body);

  function renderAvail(q = '') {
    const ql = q.toLowerCase();
    const rows = disponibili().filter(s => !ql || s.id.toLowerCase().includes(ql) || s.destinatario.toLowerCase().includes(ql) || s.localita.toLowerCase().includes(ql));
    availEl.innerHTML = rows.length ? '' : '<div class="dt-empty" style="padding:14px">Nessuna spedizione corrisponde alla ricerca.</div>';
    rows.slice(0, 60).forEach(s => {
      const row = el('div', { style: 'display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--line);font-size:12.5px' });
      row.appendChild(el('span', { style: 'flex:1' }, `<span class="mono" style="color:var(--brand)">${s.id}</span> · ${esc(s.destinatario)} · ${esc(s.localita)} ${badgeStato(s.stato)}`));
      row.appendChild(el('button', { class: 'btn btn-sm', title: 'Simula lo scan di questo collo', onclick: () => { sequenza.push(s.id); renderAvail($('#cm-search', body).value); renderSeq(); } }, 'Scansiona ▸'));
      availEl.appendChild(row);
    });
    if (rows.length > 60) availEl.appendChild(el('div', { class: 'tiny', style: 'padding:6px 10px' }, `… e altre ${rows.length - 60}: restringi con la ricerca`));
  }

  function renderSeq() {
    $('#cm-count', body).textContent = sequenza.length;
    seqEl.innerHTML = '';
    if (!sequenza.length) { seqEl.innerHTML = '<div class="dt-empty" style="padding:14px">Nessun collo ancora scansionato.</div>'; return; }
    sequenza.forEach((sid, i) => {
      const s = spedById(sid);
      const isM = i === 0;
      const row = el('div', { style: `display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--line);font-size:12.5px;${isM ? 'background:var(--bg-soft,rgba(127,127,127,.08))' : ''}` });
      row.appendChild(el('span', { style: 'flex:1' },
        `<span class="mono" style="color:var(--brand)">${s.id}</span> · ${esc(s.destinatario)} · ${esc(s.localita)} ${isM ? '<span class="tag" title="Primo collo scansionato">Collo madre</span>' : `<span class="tiny" style="opacity:.7">figlio #${i}</span>`}`));
      if (!isM) row.appendChild(el('button', { class: 'btn btn-sm', title: 'Rendi questo il collo madre del bancale', onclick: () => { sequenza.splice(i, 1); sequenza.unshift(sid); renderSeq(); } }, 'Imposta come madre'));
      row.appendChild(el('button', { class: 'btn btn-sm', title: 'Rimuovi dalla sequenza', onclick: () => { sequenza.splice(i, 1); renderAvail($('#cm-search', body).value); renderSeq(); } }, '✕'));
      seqEl.appendChild(row);
    });
  }

  renderAvail();
  renderSeq();
  $('#cm-search', body).addEventListener('input', e => renderAvail(e.target.value));

  openModal({
    title: 'Nuovo collo madre', body, size: 'wide',
    actions: [
      { label: 'Annulla' },
      { label: 'Crea collo madre', cls: 'btn-primary', keepOpen: true, onClick: (bd, close) => {
          if (sequenza.length < 2) { toast('Scansiona almeno un collo madre e un sotto-collo', 'err'); return false; }
          const madreId = sequenza[0];
          const figli = sequenza.slice(1);
          const nuovo = { id: madreId, descr: $('#cm-descr', bd).value.trim() || 'Bancale senza descrizione', figli: [] };
          figli.forEach(fid => { nuovo.figli.push(fid); spedById(fid).colloMadre = madreId; });
          COLLI_MADRE.push(nuovo);
          renderColli(); dtSpedizioni.refresh(); // i tag "MADRE"/"CM" compaiono anche in tabella spedizioni
          toast(`${madreId} impostato come collo madre di ${figli.length} sotto-colli`, 'ok');
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
   10. SEZIONE LISTINI E TARIFFE — 4 sezioni
   ============================================================ */

// Stato corrente della UI (scope globale: vettore + mandante corrente + mandante storico)
// vettore/mandante/storMandante = null significa "Tutti" (vista aggregata).
let lvScope = {
  vettore: null,        // 'CA' | 'CB' | 'CC' | 'P1' | 'P2' | 'P3' | null (Tutti)
  mandante: null,        // mandante attivo nel tab "Listino di vendita" | null (Tutti)
  storMandante: null     // mandante attivo nel tab "Storico listino di vendita" | null (Tutti)
};

// Nome leggibile del vettore corrente (per i titoli delle tabelle).
function vettoreLabel() {
  if (!lvScope.vettore) return 'Tutti i vettori';
  const v = VETTORI.find(x => x.id === lvScope.vettore);
  return v ? v.nome : lvScope.vettore;
}

function initListini() {
  // 1. auto-arciviazione in base a OGGI
  ricalcolaStatoListini();

  // 2. permessi: il Mandante vede solo "Listino di vendita" del proprio mandante
  const isMandante = currentUser?.livello === 'Mandante/Sottocontratto';
  if (isMandante) {
    $$('#listini-tabs .tab-btn').forEach(b => {
      if (!['lv', 'lv-stor'].includes(b.dataset.tab)) b.style.display = 'none';
    });
    ['#pane-lc', '#pane-lc-stor', '#pane-lv-stor'].forEach(sel => { const p = $(sel); if (p) p.style.display = 'none'; });
    const tab = $$('#listini-tabs .tab-btn').find(b => b.dataset.tab === 'lv');
    if (tab) tab.classList.add('active');
    const pane = $('#pane-lv'); if (pane) pane.classList.add('active');
    // forza il mandante selezionato a quello dell'utente
    lvScope.mandante = currentUser.mandante;
    lvScope.storMandante = currentUser.mandante;
  }

  // 3. tab principali
  $$('#listini-tabs .tab-btn').forEach(b => b.addEventListener('click', () => {
    $$('#listini-tabs .tab-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $$('#view-listini .tab-pane').forEach(p => p.classList.remove('active'));
    $('#pane-' + b.dataset.tab).classList.add('active');
    // rinfresca la sezione appena aperta
    if (b.dataset.tab === 'lc') renderListinoCostoAttivo();
    else if (b.dataset.tab === 'lc-stor') renderListinoCostoStorico();
    else if (b.dataset.tab === 'lv') renderListinoVenditaAttivo();
    else if (b.dataset.tab === 'lv-stor') renderListinoVenditaStorico();
  }));

  // 4. selettore vettore condiviso dalle quattro sezioni
  //    Mostra TUTTI i vettori (terzi + propri). Ogni vettore ha i propri listini.
  //    Cliccando cambia lvScope.vettore e re-renderizza le 4 sezioni + le sub-tabs interne.
  const refreshAllListini = () => {
    renderListinoCostoAttivo();
    renderListinoCostoStorico();
    renderListinoVenditaAttivo();
    renderListinoVenditaStorico();
    // sincronizza sub-tabs interne (se presenti)
    renderMandanteVettoreTabs('#lv-mandante-tabs', 'mandante', currentUser?.livello === 'Mandante/Sottocontratto');
    renderMandanteVettoreTabs('#lv-stor-mandante-tabs', 'storMandante', currentUser?.livello === 'Mandante/Sottocontratto');
  };
  const vt = $('#lc-vettori-tabs');
  if (vt) {
    vt.innerHTML = '';
    const bTutti = el('button', { class: 'tab-btn' + (lvScope.vettore === null ? ' active' : ''), onclick: () => {
      $$('.tab-btn', vt).forEach(x => x.classList.remove('active'));
      bTutti.classList.add('active');
      lvScope.vettore = null;
      refreshAllListini();
    } }, 'Tutti');
    vt.appendChild(bTutti);
    VETTORI.forEach((v) => {
      const b = el('button', { class: 'tab-btn' + (v.id === lvScope.vettore ? ' active' : ''), onclick: () => {
        $$('.tab-btn', vt).forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        lvScope.vettore = v.id;
        refreshAllListini();
      } }, esc(v.nome));
      vt.appendChild(b);
    });
  }

  // 5. tab mandante + sub-tabs vettore (listino di vendita attivo)
  renderMandanteVettoreTabs('#lv-mandante-tabs', 'mandante', isMandante);

  // 6. tab mandante + sub-tabs vettore (storico vendita)
  renderMandanteVettoreTabs('#lv-stor-mandante-tabs', 'storMandante', isMandante);

  // 7. render iniziale di tutte le 4 sezioni (e sub-tabs)
  refreshAllListini();
}

/* Costruisce la UI a semplici tab "mandante" per le sezioni vendita, nello stesso
 * stile già usato per il selettore vettore condiviso e per le sub-tabs vettore —
 * coerente con "Listino di costo" / "Storico listino di costo".
 * `campoScope` ∈ {'mandante', 'storMandante'} indica quale slot di lvScope aggiornare. */
function renderMandanteVettoreTabs(sel, campoScope, isMandante) {
  const mt = $(sel);
  if (!mt) return;
  mt.innerHTML = '';
  const mandantiVisibili = isMandante ? [currentUser.mandante] : MANDANTI;
  if (!isMandante) {
    const bTutti = el('button', { class: 'tab-btn tab-btn-sm' + (lvScope[campoScope] === null ? ' active' : ''), onclick: () => {
      $$('.tab-btn', mt).forEach(x => x.classList.remove('active'));
      bTutti.classList.add('active');
      lvScope[campoScope] = null;
      renderListinoVenditaAttivo();
      renderListinoVenditaStorico();
      renderMandanteVettoreTabs('#lv-mandante-tabs', 'mandante', isMandante);
      renderMandanteVettoreTabs('#lv-stor-mandante-tabs', 'storMandante', isMandante);
    } }, 'Tutti');
    mt.appendChild(bTutti);
  }
  mandantiVisibili.forEach(m => {
    const b = el('button', { class: 'tab-btn tab-btn-sm' + (m === lvScope[campoScope] ? ' active' : ''), onclick: () => {
      if (isMandante) return;
      $$('.tab-btn', mt).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      // aggiorna solo lo scope del campo passato (mandante o storMandante)
      lvScope[campoScope] = m;
      // re-renderizza tutta la sezione listini (anche lo scope comune)
      renderListinoVenditaAttivo();
      renderListinoVenditaStorico();
      // aggiorna classi active su entrambe le tabs mandante
      renderMandanteVettoreTabs('#lv-mandante-tabs', 'mandante', isMandante);
      renderMandanteVettoreTabs('#lv-stor-mandante-tabs', 'storMandante', isMandante);
    } }, esc(m));
    mt.appendChild(b);
  });
}

/* ---- Header con versione attiva, decorrenza, azioni ---- */
function buildListinoHeader(l, azioni) {
  const head = el('div', { class: 'listino-header' });
  const stato = l.stato;
  const statoBadge = stato === 'attivo' ? badge('in vigore', 'ok')
    : stato === 'futuro' ? badge('futuro — coesiste con l\'attuale', 'accent')
    : badge('archiviato', '');
  head.innerHTML = `
    <div class="lh-left">
      <div class="lh-title"><strong>${esc(l.label)}</strong> ${statoBadge}</div>
      <div class="lh-meta tiny">
        <span>📅 Decorrenza: <span class="mono">${esc(l.decorrenzaInizio || '—')}</span> → <span class="mono">${esc(l.decorrenzaFine || '—')}</span></span>
        <span>· ID: <span class="mono">${esc(l.id)}</span></span>
        <span>· Creato il <span class="mono">${esc(l.creatoIl || '—')}</span> da <strong>${esc(l.creatoDa || '—')}</strong></span>
        ${l.agente ? `<span>· Agente: <strong>${esc(l.agente)}</strong> (provvigione ${l.provvigionePct}%)</span>` : ''}
      </div>
      ${l.note ? `<div class="lh-note small">${esc(l.note)}</div>` : ''}
    </div>
    <div class="lh-actions">${azioni}</div>`;
  return head;
}

function btnAction(label, cls, onClick) {
  return el('button', { class: `btn btn-sm ${cls || ''}`, onclick: onClick }, label);
}

/* ============================================================
   10a. SEZIONE 1 — LISTINO DI COSTO (attivo)
   ============================================================ */
function apriDettaglioRigaCosto(r, vetNome) {
  openModal({ title: 'Origine listino di costo', body: `
    <dl class="confirm-summary">
      <dt>Vettore</dt><dd>${esc(vetNome)}</dd>
      <dt>Scaglione / zona</dt><dd>${esc(r.scaglione)} — ${esc(r.zona)}</dd>
      <dt>Costo interno</dt><dd><strong>${fmtEur(r.costo)}</strong></dd>
      ${r.costoVettore ? `<dt>Listino vettore di origine</dt><dd>${fmtEur(r.costoVettore)} <span class="tiny">(+3% oneri interni)</span></dd>` : ''}
      <dt>Origine</dt><dd>${esc(r.origine)}</dd>
      ${r.personalizzazione ? `<dt>Personalizzazione</dt><dd>${r.personalizzazione.tipo === 'perc' ? `Ricarico +${r.personalizzazione.valore}%` : `Sovrascrittura assoluta: ${fmtEur(r.personalizzazione.valore)}`} <span class="tiny">(applicata il ${esc(r.personalizzazione.applicataIl || '—')})</span></dd>` : ''}
    </dl>`, actions: [{ label: 'Chiudi' }] });
}

const COLONNE_RIGA_COSTO = [
  { key: 'scaglione', label: 'Scaglione', ftype: 'enum' },
  { key: 'zona', label: 'Zona', ftype: 'enum' },
  { key: 'costo', label: 'Costo interno', ftype: 'number', numeric: true, render: r => `<strong>${fmtEur(r.costo)}</strong>${r.personalizzazione ? ' ' + badge('personalizzata', 'warn') : ''}` },
  { key: 'costoVettore', label: 'Listino vettore', ftype: 'number', numeric: true, render: r => r.costoVettore ? fmtEur(r.costoVettore) : '<span class="muted">—</span>' },
  { key: 'delta', label: 'Δ%', ftype: 'number', numeric: true, sortable: false,
    render: r => {
      if (!r.costoVettore) return '<span class="muted">—</span>';
      const delta = ((r.costo - r.costoVettore) / r.costoVettore) * 100;
      return `<span style="color:${delta > 0 ? 'var(--warn)' : 'var(--ok)'}">${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%</span>`;
    } },
  { key: 'origine', label: 'Origine / personalizzazione', ftype: 'text', sortable: false, render: r => `<span class="tiny">${esc(r.origine)}${r.personalizzazione ? `<br><strong>Personalizzata:</strong> ${r.personalizzazione.tipo === 'perc' ? '+' + r.personalizzazione.valore + '%' : fmtEur(r.personalizzazione.valore)}` : ''}</span>` }
];

function renderListinoCostoAttivo() {
  const vet = lvScope.vettore;
  const head = $('#lc-header');
  if (!head) return;

  // ---- Vista aggregata "Tutti i vettori" ----
  if (vet === null) {
    const rows = [];
    VETTORI.forEach(v => {
      const l = listinoCostoAttivo(v.id);
      if (l) rows.push(...l.righe.map(r => Object.assign({}, r, { _vettoreId: v.id, _vettoreNome: v.nome })));
    });
    head.innerHTML = `
      <div class="lh-title"><strong>Listino di costo attivo — Tutti i vettori</strong></div>
      <div class="lh-meta tiny">Vista aggregata di tutti i listini di costo attualmente in vigore, un vettore per riga.</div>
      <div class="info-box" style="margin-top:8px">👉 <strong>Duplica listino</strong>, <strong>Importa CSV</strong> e lo <strong>storico</strong> sono azioni legate a un singolo vettore: seleziona un vettore specifico dalla barra in alto (accanto a "Tutti") per farle comparire.</div>
      ${rows.length ? '' : `<div class="warn-box" style="margin-top:8px">⚠️ Nessun listino di costo attivo per alcun vettore (data odierna: ${OGGI}).</div>`}`;
    renderDataTable({
      mount: '#dt-listino-costo', title: 'Righe listino di costo — Tutti i vettori', noun: 'righe di listino',
      data: () => rows, rowKey: r => r._vettoreId + '|' + r.scaglione + '|' + r.zona, pageSize: 25,
      onRowClick: r => apriDettaglioRigaCosto(r, r._vettoreNome),
      columns: [
        { key: 'vettore', label: 'Vettore', ftype: 'enum', render: r => `<strong>${esc(r._vettoreNome)}</strong>` },
        ...COLONNE_RIGA_COSTO
      ]
    });
    return;
  }

  const l = listinoCostoAttivo(vet);
  if (!l) {
    const nVers = (LISTINI_COSTO[vet]?.versioni || []).length;
    head.innerHTML = `<div class="warn-box">⚠️ Nessun listino di costo <strong>attivo</strong> per il vettore <strong>${esc(vettoreLabel())}</strong> (data odierna: ${OGGI}).${
      nVers
        ? ' Vai allo <strong>Storico listino di costo</strong> per attivarne uno.'
        : ' Clicca <strong>Importa CSV</strong> o <strong>Duplica listino</strong> per crearne uno.'
    }</div>
    <div class="lh-actions" style="margin-top:8px">
      <button class="btn btn-sm btn-primary" id="lc-duplica">Duplica listino</button>
      <button class="btn btn-sm" id="lc-importa">Importa CSV</button>
      <button class="btn btn-sm" id="lc-storico">Vai allo storico →</button>
    </div>`;
    const d1 = $('#lc-duplica'); if (d1) d1.addEventListener('click', () => openDuplicaListinoCosto(null, vet));
    const d2 = $('#lc-importa'); if (d2) d2.addEventListener('click', () => openImportCSV('costo', null, vet));
    const d3 = $('#lc-storico'); if (d3) d3.addEventListener('click', () => {
      const t = $$('#listini-tabs .tab-btn').find(b => b.dataset.tab === 'lc-stor');
      if (t) t.click();
    });
    $('#dt-listino-costo').innerHTML = '';
    return;
  }
  head.innerHTML = '';
  head.appendChild(buildListinoHeader(l, `
    <button class="btn btn-sm btn-primary" id="lc-duplica">Duplica listino</button>
    <button class="btn btn-sm" id="lc-importa">Importa CSV</button>
    <button class="btn btn-sm" id="lc-storico">Vai allo storico →</button>
  `));
  $('#lc-duplica').addEventListener('click', () => openDuplicaListinoCosto(l, vet));
  $('#lc-importa').addEventListener('click', () => openImportCSV('costo', l, vet));
  $('#lc-storico').addEventListener('click', () => {
    const t = $$('#listini-tabs .tab-btn').find(b => b.dataset.tab === 'lc-stor');
    if (t) t.click();
  });

  renderDataTable({
    mount: '#dt-listino-costo', title: `Righe listino di costo — ${esc(vettoreLabel())} — ${esc(l.label)}`, noun: 'righe di listino',
    data: () => l.righe, rowKey: r => r.scaglione + '|' + r.zona, pageSize: 25,
    onRowClick: r => apriDettaglioRigaCosto(r, vettoreLabel()),
    columns: COLONNE_RIGA_COSTO
  });
}

/* ============================================================
   10b. SEZIONE 2 — STORICO LISTINO DI COSTO
   ============================================================ */
function renderListinoCostoStorico() {
  // Mostra tutte le versioni del listino di costo del vettore corrente (o di tutti),
  // ordinate per decorrenzaInizio discendente.
  const vet = lvScope.vettore;
  const isAll = vet === null;
  const head = $('#lc-stor-header');
  if (head) {
    head.innerHTML = '';
    const tit = el('div');
    tit.innerHTML = isAll
      ? `<div class="lh-title"><strong>Storico listini di costo — Tutti i vettori</strong></div>
         <div class="lh-meta tiny">Tutte le versioni dei listini di costo di tutti i vettori, dalla più recente alla più vecchia. Clicca <strong>Duplica</strong> per crearne una nuova a partire da una esistente.</div>`
      : `<div class="lh-title"><strong>Storico listini di costo — ${esc(vettoreLabel())}</strong></div>
         <div class="lh-meta tiny">Tutte le versioni del listino di costo interno del vettore <strong>${esc(vettoreLabel())}</strong>, dal più recente al più vecchio. Clicca <strong>Duplica</strong> per crearne uno nuovo a partire da uno esistente.</div>`;
    head.appendChild(tit);
  }

  const vettoriDaMostrare = isAll ? VETTORI.map(v => v.id) : [vet];
  const versioni = vettoriDaMostrare
    .flatMap(vid => versioniListinoCosto(vid))
    .sort((a, b) => (b.decorrenzaInizio || '').localeCompare(a.decorrenzaInizio || ''));
  const dataRows = versioni.map(v => ({
    versione: v,
    id: v.id, label: v.label,
    vettoreNome: (VETTORI.find(x => x.id === v.vettore) || {}).nome || v.vettore,
    decorrenza: `${v.decorrenzaInizio || '—'} → ${v.decorrenzaFine || '—'}`,
    stato: v.stato, nRighe: v.righe.length, note: v.note,
    creatoIl: v.creatoIl, creatoDa: v.creatoDa
  }));

  renderDataTable({
    mount: '#dt-listino-costo-stor', title: isAll ? 'Versioni del listino di costo — Tutti i vettori' : `Versioni del listino di costo — ${esc(vettoreLabel())}`, noun: 'versioni di listino',
    data: () => dataRows, rowKey: r => r.id, pageSize: 10,
    onRowClick: r => openDettaglioVersioneCosto(r.versione),
    rowActions: (r) => {
      const box = el('div', { style: 'display:flex;gap:4px;flex-wrap:wrap' });
      box.appendChild(btnAction('Visualizza', '', () => openDettaglioVersioneCosto(r.versione)));
      box.appendChild(btnAction('Duplica', 'btn-primary', () => openDuplicaListinoCosto(r.versione, r.versione.vettore)));
      box.appendChild(btnAction('Esporta CSV', '', () => esportaListinoCSV(r.versione, 'costo')));
      if (r.versione.stato !== 'archiviato') {
        box.appendChild(btnAction('Archivia', 'btn-danger', () => archiviaListino('costo', r.versione)));
      }
      return box;
    },
    columns: [
      ...(isAll ? [{ key: 'vettoreNome', label: 'Vettore', ftype: 'enum', render: r => `<strong>${esc(r.vettoreNome)}</strong>` }] : []),
      { key: 'id', label: 'ID', ftype: 'text', render: r => `<span class="mono" style="color:var(--brand);font-weight:600">${r.id}</span>` },
      { key: 'label', label: 'Etichetta', ftype: 'text', render: r => `<strong>${esc(r.label)}</strong>` },
      { key: 'decorrenza', label: 'Decorrenza', ftype: 'text', render: r => `<span class="mono tiny">${esc(r.decorrenza)}</span>` },
      { key: 'stato', label: 'Stato', ftype: 'enum', statusOrder: ['attivo', 'futuro', 'archiviato'],
        render: r => r.stato === 'attivo' ? badge('in vigore', 'ok') : r.stato === 'futuro' ? badge('futuro', 'accent') : badge('archiviato', '') },
      { key: 'nRighe', label: 'Righe', ftype: 'number', numeric: true },
      { key: 'creatoIl', label: 'Creato il', ftype: 'text', render: r => `<span class="mono tiny">${esc(r.creatoIl || '—')}</span> <span class="tiny">da <strong>${esc(r.creatoDa || '—')}</strong></span>` },
      { key: 'note', label: 'Note', ftype: 'text', render: r => `<span class="tiny">${esc(r.note || '—')}</span>` }
    ]
  });
}

function openDettaglioVersioneCosto(v) {
  const vetNome = (VETTORI.find(x => x.id === v.vettore) || {}).nome || vettoreLabel();
  const html = `
    <p class="small muted">Versione: <strong>${esc(v.label)}</strong> (${esc(v.id)}) — vettore <strong>${esc(vetNome)}</strong> — decorrenza <span class="mono">${esc(v.decorrenzaInizio || '—')}</span> → <span class="mono">${esc(v.decorrenzaFine || '—')}</span></p>
    <div style="max-height:60vh;overflow-y:auto">
    <table class="dt">
      <thead><tr>
        <th>Scaglione</th><th>Zona</th><th class="num">Costo</th><th class="num">Listino vettore</th><th>Personalizzata</th>
      </tr></thead>
      <tbody>${v.righe.map(r => `<tr>
        <td>${esc(r.scaglione)}</td>
        <td>${esc(r.zona)}</td>
        <td class="num"><strong>${fmtEur(r.costo)}</strong></td>
        <td class="num">${r.costoVettore ? fmtEur(r.costoVettore) : '—'}</td>
        <td>${r.personalizzazione ? badge(r.personalizzazione.tipo === 'perc' ? '+' + r.personalizzazione.valore + '%' : fmtEur(r.personalizzazione.valore), 'warn') : '<span class="muted tiny">no</span>'}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="tiny" style="margin-top:8px">Creato il <span class="mono">${esc(v.creatoIl || '—')}</span> da <strong>${esc(v.creatoDa || '—')}</strong>. ${v.note ? 'Note: ' + esc(v.note) : ''}</div>`;
  openModal({
    title: `Dettaglio versione listino di costo — ${v.label}`,
    body: html, size: 'wide',
    actions: [
      { label: 'Chiudi' },
      { label: 'Duplica questa versione', cls: 'btn-primary', onClick: (b, close) => { close(); openDuplicaListinoCosto(v, v.vettore || lvScope.vettore); } },
      { label: 'Esporta CSV', onClick: () => esportaListinoCSV(v, 'costo') }
    ]
  });
}

function archiviaListino(tipo, v) {
  confirmBulk({
    azione: `Archiviazione manuale del listino ${v.label}`,
    count: 1, mode: 'rows',
    dettagli: `Una volta archiviato, il listino non sarà più "in vigore" ma resterà consultabile nello storico. Se era l'unico attivo per il suo scope, non avverrà alcuna sostituzione automatica.`,
    onConfirm: () => {
      v.stato = 'archiviato';
      ricalcolaStatoListini();
      renderListinoCostoAttivo(); renderListinoCostoStorico();
      renderListinoVenditaAttivo(); renderListinoVenditaStorico();
      toast(`Listino ${v.id} archiviato`, 'ok');
    }
  });
}

/* ============================================================
   10c. SEZIONE 3 — LISTINO DI VENDITA (attivo, per mandante × vettore)
   ============================================================ */
const COLONNE_RIGA_VENDITA = [
  { key: 'scaglione', label: 'Scaglione', ftype: 'enum' },
  { key: 'zona', label: 'Zona', ftype: 'enum' },
  { key: 'costo', label: 'Costo interno', ftype: 'number', numeric: true, render: r => fmtEur(r.costo) },
  { key: 'vendita', label: 'Prezzo di vendita', ftype: 'number', numeric: true, render: r => `<strong>${fmtEur(r.vendita)}</strong>` },
  { key: 'margine', label: 'Margine', ftype: 'number', numeric: true, render: r => `<span style="color:${r.margine < 0 ? 'var(--err)' : 'var(--ok)'};font-weight:600">${r.margine >= 0 ? '+' : ''}${fmtEur(r.margine)}</span>` },
  { key: 'alert', label: 'Controllo', sortable: false, render: r => {
      if (r.costoVettore && r.vendita < r.costoVettore)
        return `<span class="badge err" title="Il prezzo di vendita è inferiore perfino al listino del vettore terzo di origine">⛔ sotto costo vettore (${fmtEur(r.costoVettore)})</span>`;
      if (r.vendita < r.costo)
        return `<span class="badge warn">vendita sotto il costo interno</span>`;
      return `<span class="badge ok">ok</span>`;
    } },
  { key: 'personalizzazione', label: 'Personalizzazione', ftype: 'text', sortable: false, render: r => r.personalizzazione ? badge(r.personalizzazione.tipo === 'perc' ? '+' + r.personalizzazione.valore + '%' : fmtEur(r.personalizzazione.valore), 'warn') : '<span class="muted tiny">no</span>' }
];

function renderListinoVenditaAttivo() {
  const head = $('#lv-header');
  if (!head) return;
  head.innerHTML = '';
  const mand = lvScope.mandante;
  const vet = lvScope.vettore;

  // ---- Vista aggregata: mandante e/o vettore = "Tutti" ----
  if (mand === null || vet === null) {
    const mandanti = mand === null ? MANDANTI : [mand];
    const vettori = vet === null ? VETTORI.map(v => v.id) : [vet];
    const rows = [];
    mandanti.forEach(m => {
      vettori.forEach(vid => {
        const l = getListinoVenditaAttivo(m, vid);
        if (l) rows.push(...l.righe.map(r => Object.assign({}, r, {
          _mandante: m, _vettoreId: vid, _vettoreNome: (VETTORI.find(x => x.id === vid) || {}).nome || vid
        })));
      });
    });
    const perdita = rows.filter(r => r.vendita < r.costo).length;
    const titolo = mand === null && vet === null ? 'Tutti i mandanti · Tutti i vettori'
      : mand === null ? `Tutti i mandanti · ${esc(vettoreLabel())}`
      : `${esc(mand)} · Tutti i vettori`;
    const cosaManca = mand === null && vet === null ? 'un mandante (barra sotto) e un vettore (barra in alto)'
      : mand === null ? 'un mandante specifico dalla barra qui sotto (accanto a "Tutti")'
      : 'un vettore specifico dalla barra in alto (accanto a "Tutti")';
    head.innerHTML = `
      <div class="lh-title"><strong>Listino di vendita attivo — ${titolo}</strong></div>
      <div class="lh-meta tiny">Vista aggregata dei listini di vendita attualmente in vigore.</div>
      <div class="info-box" style="margin-top:8px">👉 <strong>Duplica listino</strong>, <strong>Importa CSV</strong> e lo <strong>storico</strong> richiedono una coppia mandante × vettore specifica: seleziona ${cosaManca} per farle comparire.</div>
      ${rows.length ? '' : `<div class="warn-box" style="margin-top:8px">⚠️ Nessun listino di vendita attivo per lo scope selezionato.</div>`}`;
    if (perdita) {
      const box = el('div', { class: 'err-box', style: 'margin-top:8px' });
      box.innerHTML = `⛔ <strong>${perdita} righe in perdita</strong> (vendita &lt; costo) nello scope selezionato.`;
      head.appendChild(box);
    }
    renderDataTable({
      mount: '#dt-listino-vendita', title: `Righe listino di vendita — ${titolo}`, noun: 'righe di listino',
      data: () => rows, rowKey: r => r._mandante + '|' + r._vettoreId + '|' + r.scaglione + '|' + r.zona, pageSize: 25,
      rowClass: r => r.vendita < r.costo ? 'row-danger' : '',
      columns: [
        ...(mand === null ? [{ key: 'mandante', label: 'Mandante', ftype: 'enum', render: r => `<strong>${esc(r._mandante)}</strong>` }] : []),
        ...(vet === null ? [{ key: 'vettore', label: 'Vettore', ftype: 'enum', render: r => `<strong>${esc(r._vettoreNome)}</strong>` }] : []),
        ...COLONNE_RIGA_VENDITA
      ]
    });
    return;
  }

  // cerco il listino attivo per la coppia (mandante, vettore) selezionata
  const l = getListinoVenditaAttivo(mand, vet);
  if (!l) {
    const nVers = (LISTINI_VENDITA[mand]?.[vet]?.versioni || []).length;
    const vetLabel = vettoreLabel();
    head.appendChild(el('div', { class: 'warn-box' },
      `⚠️ Nessun listino di vendita <strong>attivo</strong> per il mandante <strong>${esc(mand)}</strong> × vettore <strong>${esc(vetLabel)}</strong>.${nVers ? '' : ' Non esiste ancora alcuna versione.'} Duplica un listino esistente, importa un CSV (anche ricevuto direttamente dal mandante) o consulta lo storico.`));
    const azioni = el('div', { class: 'lh-actions', style: 'margin-top:8px' });
    azioni.innerHTML = `
      <button class="btn btn-sm btn-primary" id="lv-duplica-empty">Duplica listino</button>
      <button class="btn btn-sm" id="lv-importa-empty">Importa CSV</button>
      <button class="btn btn-sm" id="lv-storico-empty">Vai allo storico →</button>`;
    head.appendChild(azioni);
    $('#lv-duplica-empty', azioni).addEventListener('click', () => openDuplicaListinoVendita(null, mand, vet));
    $('#lv-importa-empty', azioni).addEventListener('click', () => openImportCSV('vendita', { mandante: mand, vettore: vet }, vet));
    $('#lv-storico-empty', azioni).addEventListener('click', () => {
      const t = $$('#listini-tabs .tab-btn').find(b => b.dataset.tab === 'lv-stor');
      if (t) t.click();
    });
    $('#dt-listino-vendita').innerHTML = '';
    return;
  }
  head.appendChild(buildListinoHeader(l, `
    <button class="btn btn-sm btn-primary" id="lv-duplica">Duplica listino</button>
    <button class="btn btn-sm" id="lv-importa">Importa CSV</button>
    <button class="btn btn-sm" id="lv-storico">Vai allo storico →</button>
  `));
  $('#lv-duplica').addEventListener('click', () => openDuplicaListinoVendita(l));
  $('#lv-importa').addEventListener('click', () => openImportCSV('vendita', l, l.vettore));
  $('#lv-storico').addEventListener('click', () => {
    const t = $$('#listini-tabs .tab-btn').find(b => b.dataset.tab === 'lv-stor');
    if (t) t.click();
  });

  const perdita = l.righe.filter(r => r.vendita < r.costo).length;
  if (perdita) {
    const box = el('div', { class: 'err-box' });
    box.innerHTML = `⛔ <strong>${perdita} righe in perdita</strong> (vendita &lt; costo). I listini di vendita non dovrebbero mai essere sotto il listino di costo: correggere o duplicare con valori aggiornati. <a href="#" id="lv-vai-storico">Vai allo storico per duplicare</a>.`;
    head.appendChild(box);
    setTimeout(() => {
      const a = $('#lv-vai-storico');
      if (a) a.addEventListener('click', e => { e.preventDefault(); const t = $$('#listini-tabs .tab-btn').find(b => b.dataset.tab === 'lv-stor'); if (t) t.click(); });
    }, 0);
  }

  renderDataTable({
    mount: '#dt-listino-vendita', title: `Righe listino di vendita — ${esc(mand)} · ${esc(vettoreLabel())} — ${esc(l.label)}`, noun: 'righe di listino',
    data: () => l.righe, rowKey: r => r.scaglione + '|' + r.zona, pageSize: 25,
    rowClass: r => r.vendita < r.costo ? 'row-danger' : '',
    columns: COLONNE_RIGA_VENDITA
  });
}

/* ============================================================
   10d. SEZIONE 4 — STORICO LISTINO DI VENDITA (per mandante × vettore)
   ============================================================ */
function renderListinoVenditaStorico() {
  const smand = lvScope.storMandante;
  const vet = lvScope.vettore;
  const isAllMand = smand === null;
  const isAllVet = vet === null;
  const head = $('#lv-stor-header');
  const titoloScope = isAllMand && isAllVet ? 'Tutti i mandanti · Tutti i vettori'
    : isAllMand ? `Tutti i mandanti · ${esc(vettoreLabel())}`
    : isAllVet ? `${esc(smand)} · Tutti i vettori`
    : `${esc(smand)} · ${esc(vettoreLabel())}`;
  if (head) {
    head.innerHTML = '';
    head.appendChild(el('div', {}, `
      <div class="lh-title"><strong>Storico listini di vendita — ${titoloScope}</strong></div>
      <div class="lh-meta tiny">Tutte le versioni del listino di vendita per lo scope selezionato, dalla più recente alla più vecchia. Clicca <strong>Duplica</strong> per creare un nuovo listino a partire da uno esistente (anche se archiviato).</div>`));
  }

  const mandanti = isAllMand ? MANDANTI : [smand];
  const vettori = isAllVet ? VETTORI.map(v => v.id) : [vet];
  const versioni = mandanti
    .flatMap(m => vettori.flatMap(vid => versioniListinoVendita(m, vid)))
    .sort((a, b) => (b.decorrenzaInizio || '').localeCompare(a.decorrenzaInizio || ''));
  const dataRows = versioni.map(v => ({
    versione: v,
    id: v.id, label: v.label, mandante: v.mandante,
    vettoreNome: (VETTORI.find(x => x.id === v.vettore) || {}).nome || v.vettore,
    decorrenza: `${v.decorrenzaInizio || '—'} → ${v.decorrenzaFine || '—'}`,
    stato: v.stato, nRighe: v.righe.length,
    note: v.note, creatoIl: v.creatoIl, creatoDa: v.creatoDa
  }));

  renderDataTable({
    mount: '#dt-listino-vendita-stor', title: `Versioni del listino di vendita — ${titoloScope}`, noun: 'versioni di listino',
    data: () => dataRows, rowKey: r => r.id, pageSize: 10,
    onRowClick: r => openDettaglioVersioneVendita(r.versione),
    rowActions: (r) => {
      const box = el('div', { style: 'display:flex;gap:4px;flex-wrap:wrap' });
      box.appendChild(btnAction('Visualizza', '', () => openDettaglioVersioneVendita(r.versione)));
      box.appendChild(btnAction('Duplica', 'btn-primary', () => openDuplicaListinoVendita(r.versione)));
      box.appendChild(btnAction('Esporta CSV', '', () => esportaListinoCSV(r.versione, 'vendita')));
      if (r.versione.stato !== 'archiviato') {
        box.appendChild(btnAction('Archivia', 'btn-danger', () => archiviaListino('vendita', r.versione)));
      }
      return box;
    },
    columns: [
      ...(isAllMand ? [{ key: 'mandante', label: 'Mandante', ftype: 'enum', render: r => `<strong>${esc(r.mandante)}</strong>` }] : []),
      ...(isAllVet ? [{ key: 'vettoreNome', label: 'Vettore', ftype: 'enum', render: r => `<strong>${esc(r.vettoreNome)}</strong>` }] : []),
      { key: 'id', label: 'ID', ftype: 'text', render: r => `<span class="mono" style="color:var(--brand);font-weight:600">${r.id}</span>` },
      { key: 'label', label: 'Etichetta', ftype: 'text', render: r => `<strong>${esc(r.label)}</strong>` },
      { key: 'decorrenza', label: 'Decorrenza', ftype: 'text', render: r => `<span class="mono tiny">${esc(r.decorrenza)}</span>` },
      { key: 'stato', label: 'Stato', ftype: 'enum', statusOrder: ['attivo', 'futuro', 'archiviato'],
        render: r => r.stato === 'attivo' ? badge('in vigore', 'ok') : r.stato === 'futuro' ? badge('futuro', 'accent') : badge('archiviato', '') },
      { key: 'nRighe', label: 'Righe', ftype: 'number', numeric: true },
      { key: 'creatoIl', label: 'Creato il', ftype: 'text', render: r => `<span class="mono tiny">${esc(r.creatoIl || '—')}</span> <span class="tiny">da <strong>${esc(r.creatoDa || '—')}</strong></span>` },
      { key: 'note', label: 'Note', ftype: 'text', render: r => `<span class="tiny">${esc(r.note || '—')}</span>` }
    ]
  });
}

function openDettaglioVersioneVendita(v) {
  const vetName = v.vettore ? (VETTORI.find(x => x.id === v.vettore)?.nome || v.vettore) : '—';
  const perdita = v.righe.filter(r => r.vendita < r.costo);
  const html = `
    <p class="small muted">Versione: <strong>${esc(v.label)}</strong> (${esc(v.id)}) — mandante <strong>${esc(v.mandante)}</strong> × vettore <strong>${esc(vetName)}</strong> — decorrenza <span class="mono">${esc(v.decorrenzaInizio || '—')}</span> → <span class="mono">${esc(v.decorrenzaFine || '—')}</span></p>
    <p class="tiny">Agente: <strong>${esc(v.agente)}</strong> (provvigione ${v.provvigionePct}%) · Sconto tariffa: ${v.scontoPct || 0}%${v.note ? ' · Note: ' + esc(v.note) : ''}</p>
    ${perdita.length ? `<div class="err-box">⛔ <strong>${perdita.length} righe in perdita</strong> in questa versione.</div>` : ''}
    <div style="max-height:55vh;overflow-y:auto;margin-top:8px">
    <table class="dt">
      <thead><tr>
        <th>Scaglione</th><th>Zona</th><th class="num">Costo</th><th class="num">Vendita</th><th class="num">Margine</th><th>Personalizzata</th><th>Stato</th>
      </tr></thead>
      <tbody>${v.righe.map(r => `<tr${r.vendita < r.costo ? ' class="row-danger"' : ''}>
        <td>${esc(r.scaglione)}</td>
        <td>${esc(r.zona)}</td>
        <td class="num">${fmtEur(r.costo)}</td>
        <td class="num"><strong>${fmtEur(r.vendita)}</strong></td>
        <td class="num" style="color:${r.margine < 0 ? 'var(--err)' : 'var(--ok)'}">${r.margine >= 0 ? '+' : ''}${fmtEur(r.margine)}</td>
        <td>${r.personalizzazione ? badge(r.personalizzazione.tipo === 'perc' ? '+' + r.personalizzazione.valore + '%' : fmtEur(r.personalizzazione.valore), 'warn') : '<span class="muted tiny">no</span>'}</td>
        <td>${r.vendita < r.costo ? (r.costoVettore && r.vendita < r.costoVettore ? '<span class="badge err">sotto vettore</span>' : '<span class="badge warn">sotto costo</span>') : '<span class="badge ok">ok</span>'}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <div class="tiny" style="margin-top:8px">Creato il <span class="mono">${esc(v.creatoIl || '—')}</span> da <strong>${esc(v.creatoDa || '—')}</strong>.</div>`;
  openModal({
    title: `Dettaglio versione listino di vendita — ${v.label}`,
    body: html, size: 'wide',
    actions: [
      { label: 'Chiudi' },
      { label: 'Duplica questa versione', cls: 'btn-primary', onClick: (b, close) => { close(); openDuplicaListinoVendita(v); } },
      { label: 'Esporta CSV', onClick: () => esportaListinoCSV(v, 'vendita') }
    ]
  });
}

/* ============================================================
   10e. Listino vettore (consultazione, dentro la sezione Costo)
   ============================================================ */
function renderListinoVettore() {
  const vetName = vettoreLabel();
  const lv = LISTINI_VETTORE[vetName];
  const meta = $('#lc-vettori-meta');
  const tab = $('#dt-listino-vettore');
  if (!lv) {
    if (meta) meta.innerHTML = `<span>ℹ️ <strong>${esc(vetName)}</strong> è un vettore proprio (padroncino): non esiste un listino vettore esterno di riferimento. Le tariffe di costo sono calcolate internamente.</span>`;
    if (tab) tab.innerHTML = '';
    return;
  }
  if (meta) meta.innerHTML = `
    <span>📄 <strong>${esc(lv.nota)}</strong></span>
    <span>Versione: <span class="mono">${lv.versione}</span></span>
    <span class="tiny">Dato di partenza esterno, non negoziabile da CT Solution: base per i listini di costo interni.</span>`;
  if (tab) {
    renderDataTable({
      mount: '#dt-listino-vettore', title: `Listino ${esc(vetName)}`, noun: 'righe di listino',
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
}

/* ============================================================
   10f. Duplicazione (costo / vendita)
   ============================================================ */

/* ---- Helper: validazione sotto-costo per la vendita ----
 * Restituisce { ok, problemi:[{ix, riga, tipo, msg}] }
 *   tipo: 'sotto_costo' | 'sotto_vettore' | 'no_costo_rif'
 */
function validaRigheVendita(righe) {
  const problemi = [];
  righe.forEach((r, ix) => {
    if (!r.costo || r.costo <= 0) {
      problemi.push({ ix, riga: r, tipo: 'no_costo_rif', msg: 'riga senza costo interno di riferimento' });
      return;
    }
    if (r.costoVettore && r.vendita < r.costoVettore) {
      problemi.push({ ix, riga: r, tipo: 'sotto_vettore', msg: `vendita ${fmtEur(r.vendita)} < listino vettore ${fmtEur(r.costoVettore)}` });
    } else if (r.vendita < r.costo) {
      problemi.push({ ix, riga: r, tipo: 'sotto_costo', msg: `vendita ${fmtEur(r.vendita)} < costo interno ${fmtEur(r.costo)}` });
    }
  });
  return { ok: problemi.length === 0, problemi };
}

function openDuplicaListinoCosto(src, vettoreId) {
  const vet = vettoreId || (src && src.vettore) || lvScope.vettore;
  const etichDefault = src && src.righe && src.righe.length
    ? `${src.label} (copia)`
    : `Listino di costo ${vettoreLabel()} — nuovo`;
  const noteDefault = src && src.righe && src.righe.length
    ? 'Duplicato da ' + src.id
    : 'Nuovo listino (da compilare)';
  openDuplicaModal({
    tipo: 'costo',
    src: src || { id: 'LC-NUOVO', label: etichDefault, vettore: vet, righe: [], note: '' },
    vettoreId: vet,
    campiIntestazione: [
      { key: 'etichetta', label: 'Etichetta nuovo listino', type: 'text', required: true, default: etichDefault },
      { key: 'decorrenzaInizio', label: 'Decorrenza inizio', type: 'date', required: true, default: '2027-01-01' },
      { key: 'decorrenzaFine', label: 'Decorrenza fine', type: 'date', default: '2027-12-31' },
      { key: 'note', label: 'Note', type: 'text', default: noteDefault }
    ]
  });
}

function openDuplicaListinoVendita(src, mandForzato, vetForzato) {
  const mand = src ? src.mandante : (mandForzato || lvScope.mandante);
  const vet = (src && src.vettore) || vetForzato || lvScope.vettore;
  const vetName = (VETTORI.find(v => v.id === vet) || {}).nome || vet;
  const srcEffettivo = src || { id: 'LV-NUOVO', label: `${mand} · ${vetName} — nuovo`, mandante: mand, vettore: vet, righe: [], note: '', agente: '', provvigionePct: 0, scontoPct: 0 };
  openDuplicaModal({
    tipo: 'vendita',
    src: srcEffettivo,
    vettoreId: vet,
    mandante: mand,
    campiIntestazione: [
      { key: 'etichetta', label: 'Etichetta nuovo listino', type: 'text', required: true, default: src ? `${src.mandante} · ${vetName} — duplicato` : `${mand} · ${vetName} — nuovo` },
      { key: 'decorrenzaInizio', label: 'Decorrenza inizio', type: 'date', required: true, default: '2027-01-01' },
      { key: 'decorrenzaFine', label: 'Decorrenza fine', type: 'date', default: '2027-12-31' },
      { key: 'agente', label: 'Agente di riferimento', type: 'text', default: srcEffettivo.agente || '' },
      { key: 'provvigionePct', label: 'Provvigione agente (%)', type: 'number', default: srcEffettivo.provvigionePct || 0 },
      { key: 'scontoPct', label: 'Sconto sulla tariffa totale (%)', type: 'number', default: srcEffettivo.scontoPct || 0 },
      { key: 'note', label: 'Note', type: 'text', default: src ? 'Duplicato da ' + src.id : 'Nuovo listino (da compilare)' }
    ]
  });
}

function openDuplicaModal({ tipo, src, campiIntestazione, vettoreId, mandante }) {
  const isVendita = tipo === 'vendita';
  const vetName = vettoreLabel();
  const headerDesc = isVendita
    ? `del listino di vendita per il mandante <strong>${esc(src.mandante)}</strong> × vettore <strong>${esc(vetName)}</strong>`
    : `del listino di costo interno del vettore <strong>${esc(vetName)}</strong>`;
  const b = el('div');
  b.innerHTML = `
    <p class="small muted">Stai duplicando <strong>${esc(src.label)}</strong> (${esc(src.id)}). Scegli la modalità di personalizzazione: le modifiche vengono applicate a una copia che sarà salvata come <strong>nuova versione</strong> ${headerDesc}.</p>
    <h4 style="margin-top:10px">Intestazione nuovo listino</h4>
    <div id="dup-head-fields"></div>
    <h4 style="margin-top:14px">Modalità di personalizzazione</h4>
    <div class="form-row"><label>Modalità</label>
      <select id="dup-modo">
        <option value="perc">Ricarico percentuale su tutte le voci (es. +10%)</option>
        <option value="abs">Sovrascrittura assoluta per singola voce (editabile riga per riga)</option>
      </select>
    </div>
    <div id="dup-perc" class="form-row"><label>Percentuale di ricarico (%)</label><input type="number" id="dup-perc-val" value="10" step="0.1"></div>
    <h4 style="margin-top:14px">Anteprima righe (${src.righe.length})</h4>
    <div id="dup-warn" class="err-box" style="display:none"></div>
    <div id="dup-preview" style="max-height:42vh;overflow-y:auto"></div>`;
  const fields = $('#dup-head-fields', b);
  campiIntestazione.forEach(f => {
    const row = el('div', { class: 'form-row' });
    row.appendChild(el('label', {}, f.label + (f.required ? ' *' : '')));
    const inp = el('input', { type: f.type, id: 'dup-h-' + f.key, value: f.default ?? '' });
    if (f.type === 'number') inp.step = '0.01';
    row.appendChild(inp);
    fields.appendChild(row);
  });

  // campi dinamici editabili per modalità 'abs'
  let editabili = src.righe.map((r, ix) => ({ ...r, _editVal: isVendita ? r.vendita : r.costo, _ix: ix }));

  const renderPreview = () => {
    const modo = $('#dup-modo', b).value;
    const perc = parseFloat($('#dup-perc-val', b).value) || 0;
    editabili = src.righe.map((r, ix) => {
      const editVal = modo === 'perc' ? +(r[isVendita ? 'vendita' : 'costo'] * (1 + perc / 100)).toFixed(2) : (editabili[ix]?._editVal ?? r[isVendita ? 'vendita' : 'costo']);
      return { ...r, _editVal: editVal, _ix: ix };
    });
    // preview
    const isAbs = modo === 'abs';
    const table = el('table', { class: 'dt' });
    table.innerHTML = `<thead><tr>
      <th>Scaglione</th>
      <th>Zona</th>
      <th class="num">Costo</th>
      <th class="num">${isVendita ? 'Vendita attuale' : 'Costo attuale'}</th>
      <th class="num">${isVendita ? 'Nuova vendita' : 'Nuovo costo'}</th>
      <th class="num">Margine</th>
      <th>Stato</th>
    </tr></thead>`;
    const tb = el('tbody');
    editabili.forEach((r, i) => {
      const tr = el('tr', { class: r._editVal < r.costo ? 'row-danger' : '' });
      tr.innerHTML = `<td>${esc(r.scaglione)}</td>
        <td>${esc(r.zona)}</td>
        <td class="num">${fmtEur(r.costo)}</td>
        <td class="num">${fmtEur(r[isVendita ? 'vendita' : 'costo'])}</td>
        <td class="num">${isAbs ? `<input type="number" step="0.01" class="dt-colfilter" data-ix="${i}" value="${r._editVal}" style="width:90px;text-align:right">` : `<strong>${fmtEur(r._editVal)}</strong>`}</td>
        <td class="num" style="color:${r._editVal - r.costo < 0 ? 'var(--err)' : 'var(--ok)'}">${(r._editVal - r.costo) >= 0 ? '+' : ''}${fmtEur(r._editVal - r.costo)}</td>
        <td>${r._editVal < r.costo ? '<span class="badge err">sotto costo</span>' : '<span class="badge ok">ok</span>'}</td>`;
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    const prev = $('#dup-preview', b);
    prev.innerHTML = ''; prev.appendChild(table);

    // listener per editing riga per riga
    if (isAbs) {
      $$('input[data-ix]', prev).forEach(inp => {
        inp.addEventListener('input', () => {
          const ix = +inp.dataset.ix;
          editabili[ix]._editVal = parseFloat(inp.value) || 0;
          // ricalcolo classe + celle di margine/stato per la riga
          const tr = inp.closest('tr');
          if (editabili[ix]._editVal < editabili[ix].costo) tr.classList.add('row-danger'); else tr.classList.remove('row-danger');
          const tds = tr.querySelectorAll('td');
          const newMargine = editabili[ix]._editVal - editabili[ix].costo;
          tds[5].textContent = (newMargine >= 0 ? '+' : '') + fmtEur(newMargine);
          tds[5].style.color = newMargine < 0 ? 'var(--err)' : 'var(--ok)';
          tds[6].innerHTML = editabili[ix]._editVal < editabili[ix].costo ? '<span class="badge err">sotto costo</span>' : '<span class="badge ok">ok</span>';
          checkWarn();
        });
      });
    }
    checkWarn();
  };

  const checkWarn = () => {
    if (!isVendita) { $('#dup-warn', b).style.display = 'none'; return; }
    const problemi = editabili.filter(r => r._editVal < r.costo).map(r => ({ r, msg: r.costoVettore && r._editVal < r.costoVettore ? `sotto vettore (${fmtEur(r.costoVettore)})` : `sotto costo interno (${fmtEur(r.costo)})` }));
    if (problemi.length) {
      const html = `⛔ <strong>${problemi.length} righe in perdita</strong> (vendita &lt; costo). Per procedere è richiesta una conferma esplicita.<br><ul style="margin:6px 0 0 18px">${problemi.slice(0, 8).map(p => `<li><span class="mono">${esc(p.r.scaglione)}</span>: ${esc(p.msg)}</li>`).join('')}</ul>${problemi.length > 8 ? `<li class="tiny">… e altre ${problemi.length - 8}</li>` : ''}`;
      $('#dup-warn', b).style.display = ''; $('#dup-warn', b).innerHTML = html;
    } else {
      $('#dup-warn', b).style.display = 'none';
    }
  };

  openModal({
    title: `Duplica listino ${tipo} — ${src.label}`, body: b, size: 'wide',
    actions: [
      { label: 'Annulla' },
      { label: 'Crea nuovo listino', cls: 'btn-primary', keepOpen: true, onClick: (bd, close) => {
          // raccolgo valori
          const head = {};
          for (const f of campiIntestazione) {
            head[f.key] = $('#dup-h-' + f.key, bd).value.trim();
          }
          if (!head.etichetta) { toast('Inserisci un\'etichetta per il nuovo listino', 'err'); return false; }
          if (!head.decorrenzaInizio) { toast('Inserisci la decorrenza di inizio', 'err'); return false; }
          // validazione sotto-costo per la vendita
          if (isVendita) {
            const problemi = editabili.filter(r => r._editVal < r.costo);
            if (problemi.length) {
              // chiedo conferma esplicita
              openModal({
                title: 'Conferma righe in perdita',
                body: `<p>Stai per creare un listino con <strong>${problemi.length} righe in perdita</strong> (vendita &lt; costo). Questo è tecnicamente possibile ma è una situazione anomala che richiede un'esplicita conferma.</p>
                  <p class="small muted">Suggerimento: rivedi i valori o salva lo stesso per forzare la creazione (il sistema lo registrerà come un'anomalia consapevole).</p>`,
                actions: [
                  { label: 'Annulla' },
                  { label: `Forza creazione con ${problemi.length} righe in perdita`, cls: 'btn-danger', onClick: () => {
                      finalizeDuplicaCreaListino(tipo, src, head, editabili, true, { vettoreId, mandante });
                      close();
                    } }
                ]
              });
              return false; // non chiudere la modale di duplicazione
            }
          }
          finalizeDuplicaCreaListino(tipo, src, head, editabili, false, { vettoreId, mandante });
          close();
        } }
    ]
  });
  setTimeout(() => {
    $('#dup-modo', b).addEventListener('change', renderPreview);
    $('#dup-perc-val', b).addEventListener('input', renderPreview);
    renderPreview();
  }, 0);
}

function finalizeDuplicaCreaListino(tipo, src, head, editabili, forzato, scope) {
  const isVendita = tipo === 'vendita';
  const { vettoreId, mandante } = scope || {};
  const vet = vettoreId || (src && src.vettore) || lvScope.vettore;
  const mand = mandante || (src && src.mandante) || lvScope.mandante;
  const nuoveRighe = src.righe.map((r, i) => {
    const e = editabili[i];
    if (isVendita) {
      return {
        scaglione: r.scaglione, zona: r.zona,
        costo: r.costo, costoVettore: r.costoVettore,
        vendita: e._editVal,
        margine: +(e._editVal - r.costo).toFixed(2),
        personalizzazione: { tipo: $('#dup-modo')?.value === 'perc' ? 'perc' : 'abs', valore: $('#dup-modo')?.value === 'perc' ? +(parseFloat($('#dup-perc-val')?.value) || 0) : e._editVal, applicataIl: nowStr().slice(0, 10) }
      };
    } else {
      return {
        scaglione: r.scaglione, zona: r.zona,
        costo: e._editVal,
        costoVettore: r.costoVettore,
        origine: r.origine || 'Duplicato/inserito manualmente',
        origineTipo: r.origineTipo || 'interna',
        valoreOriginale: r.valoreOriginale ?? e._editVal,
        personalizzazione: { tipo: $('#dup-modo')?.value === 'perc' ? 'perc' : 'abs', valore: $('#dup-modo')?.value === 'perc' ? +(parseFloat($('#dup-perc-val')?.value) || 0) : e._editVal, applicataIl: nowStr().slice(0, 10) }
      };
    }
  });

  // determinazione stato
  const decorrenzaInizio = head.decorrenzaInizio;
  const decorrenzaFine = head.decorrenzaFine;
  let stato = OGGI < decorrenzaInizio ? 'futuro' : (decorrenzaFine && OGGI > decorrenzaFine ? 'archiviato' : 'attivo');

  // genera id per scope
  let id;
  if (isVendita) {
    id = nextListinoVenditaId2(mand, vet, false);
  } else {
    const anno = decorrenzaInizio.slice(0, 4);
    id = nextListinoCostoId(vet, anno, false);
  }

  // auto-arciviazione: solo stesso scope
  if (stato === 'attivo' || stato === 'futuro') {
    const versioniStessoScope = isVendita
      ? ensureListinoVendita(mand, vet).versioni
      : ensureListinoCosto(vet).versioni;
    versioniStessoScope
      .filter(x => x.stato === stato && x.id !== id)
      .forEach(prev => {
        if (decorrenzaInizio <= (prev.decorrenzaInizio || '')) {
          prev.stato = 'archiviato';
          prev.decorrenzaFine = decorrenzaInizio;
        }
      });
  }

  const nuovo = {
    id,
    label: head.etichetta,
    decorrenzaInizio, decorrenzaFine,
    stato,
    righe: nuoveRighe,
    note: head.note || '',
    creatoIl: nowStr(),
    creatoDa: currentUser?.nome || 'Sistema'
  };
  if (isVendita) {
    nuovo.mandante = mand;
    nuovo.vettore = vet;
    nuovo.agente = head.agente || src.agente;
    nuovo.provvigionePct = parseFloat(head.provvigionePct) || 0;
    nuovo.scontoPct = parseFloat(head.scontoPct) || 0;
    ensureListinoVendita(mand, vet).versioni.push(nuovo);
  } else {
    nuovo.vettore = vet;
    ensureListinoCosto(vet).versioni.push(nuovo);
  }
  ricalcolaStatoListini();
  // refresh di tutte le 4 viste + sub-tabs
  renderListinoCostoAttivo(); renderListinoCostoStorico();
  renderListinoVenditaAttivo(); renderListinoVenditaStorico();
  const isMand = currentUser?.livello === 'Mandante/Sottocontratto';
  renderMandanteVettoreTabs('#lv-mandante-tabs', 'mandante', isMand);
  renderMandanteVettoreTabs('#lv-stor-mandante-tabs', 'storMandante', isMand);
  toast(`Creato listino ${id} (${stato})${forzato ? ' con righe in perdita confermate esplicitamente' : ''}`, forzato ? 'warn' : 'ok');
}

/* ============================================================
   10g. Import CSV con mapping colonne
   ============================================================ */

function parseCSVText(text) {
  // separatore: rileva ', ' o ';' scegliendo quello con più occorrenze nella prima riga
  const firstLine = text.split(/\r?\n/)[0] || '';
  const sep = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQuotes = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === sep) { row.push(field); field = ''; i++; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = []; i++; continue;
    }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* Rileva ed estrae le tabelle "tariffe peso × zona" da un export vettore tipo DHL
 * (righe intestate "KG,,Zona 1,Zona 2,…"). Le altre sezioni del file (supplemento oltre
 * soglia, premium orari, note legali, blocchi firma) vengono ignorate automaticamente:
 * non hanno un'intestazione che inizia con "KG" seguita da colonne "Zona N" e quindi
 * non vengono mai riconosciute come tabella dati.
 * Se nel file compaiono più tabelle sovrapposte (es. "Documenti fino a 2kg" e poi
 * "Non documenti / Documenti oltre 2.5kg"), l'ultima tabella letta vince sulle
 * combinazioni scaglione+zona in comune. Ritorna una Map "scaglione|zona" -> costo.
 */
function estraiTabellePesoZona(rawRows) {
  const risultato = new Map();
  let zonaCols = null; // [{ ix, label }] quando siamo dentro una tabella riconosciuta
  rawRows.forEach(row => {
    const primaCella = (row[0] || '').trim();
    const colonneZona = row
      .map((cell, ix) => ({ cell: (cell || '').trim(), ix }))
      .filter(c => /^zona\s*\d+$/i.test(c.cell));
    // intestazione di una tabella peso/zona: prima colonna "KG" + almeno 2 colonne "Zona N"
    if (primaCella.toLowerCase() === 'kg' && colonneZona.length >= 2) {
      zonaCols = colonneZona.map(c => ({ ix: c.ix, label: c.cell.replace(/\s+/g, ' ') }));
      return;
    }
    if (!zonaCols) return; // fuori da una tabella riconosciuta: riga ignorata (supplementi, premium, note legali, firme…)
    const peso = parseFloat(primaCella.replace(',', '.'));
    if (!primaCella || isNaN(peso)) { zonaCols = null; return; } // riga vuota/non numerica = fine tabella
    const scaglione = peso.toFixed(1) + ' kg';
    zonaCols.forEach(zc => {
      const raw = (row[zc.ix] || '').trim();
      if (!raw) return; // tariffa non disponibile per questo peso/zona
      const val = parseFloat(raw.replace(',', '.'));
      if (!isNaN(val)) risultato.set(`${scaglione}|${zc.label}`, val);
    });
  });
  return risultato;
}

function openImportCSV(tipo, listinoRiferimento, vettoreId) {
  // vettoreId è obbligatorio per costo; per vendita si ricava da listinoRiferimento.vettore
  // o si usa lo scope corrente come fallback.
  const vetId = vettoreId
    || (listinoRiferimento && listinoRiferimento.vettore)
    || lvScope.vettore;
  const vetName = (VETTORI.find(v => v.id === vetId) || {}).nome || vetId;
  const mand = (listinoRiferimento && listinoRiferimento.mandante) || lvScope.mandante;
  // Per vendita, se non esiste un listino di costo attivo per il vettore, l'import resta
  // comunque possibile (es. il mandante invia direttamente il proprio listino di vendita):
  // il costo verrà preso dalla colonna CSV se mappata, altrimenti sarà impostato a 0 e i
  // controlli di margine non saranno affidabili finché non verrà creato anche il listino di costo.
  const costoAttivoMancante = tipo === 'vendita' && !listinoCostoAttivo(vetId);

  // campi attesi (per il mapping)
  // Per costo il vettore è fissato dallo scope (non mappabile da CSV).
  const campiAttesi = tipo === 'costo'
    ? [
        { key: 'scaglione', label: 'Scaglione', required: true, aliases: ['scaglione', 'fascia', 'peso'] },
        { key: 'zona', label: 'Zona', required: true, aliases: ['zona', 'area', 'destinazione'] },
        { key: 'costo', label: 'Costo', required: true, aliases: ['costo', 'prezzo costo', 'cost', 'tariffa'] }
      ]
    : [
        { key: 'scaglione', label: 'Scaglione', required: true, aliases: ['scaglione', 'fascia', 'peso'] },
        { key: 'zona', label: 'Zona', required: true, aliases: ['zona', 'area', 'destinazione'] },
        { key: 'costo', label: 'Costo interno (opz.)', required: false, aliases: ['costo', 'cost'] },
        { key: 'vendita', label: 'Prezzo di vendita', required: true, aliases: ['vendita', 'prezzo vendita', 'price', 'tariffa vendita'] }
      ];

  const b = el('div');
  const subHeader = tipo === 'vendita'
    ? ` del listino di vendita per il mandante <strong>${esc(mand)}</strong> × vettore <strong>${esc(vetName)}</strong>`
    : ` del listino di costo interno del vettore <strong>${esc(vetName)}</strong>`;
  b.innerHTML = `
    <p class="small muted">Importazione di un listino da CSV. Se il file è nel formato "a matrice" tipico dei listini vettore (es. export DHL: scaglioni di peso × colonne Zona 1…N), viene riconosciuto <strong>automaticamente</strong>. Altrimenti le colonne vengono <strong>mappate</strong> manualmente sui campi${subHeader}. L'anteprima mostra le righe parsate; solo dopo la conferma i dati vengono salvati come nuova versione del listino.</p>
    <div class="info-box"><strong>Vettore di destinazione:</strong> <span class="badge">${esc(vetName)}</span>${tipo === 'costo' ? ' <span class="tiny muted">(fissato dallo scope; la colonna "Vettore" del CSV, se presente, verrà ignorata)</span>' : ''}</div>
    ${costoAttivoMancante ? `<div class="warn-box">⚠️ Non esiste ancora un <strong>listino di costo attivo</strong> per <strong>${esc(vetName)}</strong>. Puoi comunque importare: se il file include già una colonna Costo verrà usata quella riga per riga, altrimenti il costo resterà a 0 e i controlli di margine non saranno affidabili finché non crei anche il listino di costo.</div>` : ''}
    <h4 style="margin-top:8px">1. Carica file CSV</h4>
    <div class="form-row"><label>File</label>
      <input type="file" id="csv-file" accept=".csv,.txt,text/csv">
    </div>
    <p class="tiny" style="margin-top:-4px">Separatori supportati: <span class="mono">, ;</span> · Testo tra virgolette: <span class="mono">"…"</span></p>
    <div id="csv-hint" class="info-box" style="display:none"></div>
    <div id="csv-pivot-box" class="info-box" style="display:none">
      <div id="csv-pivot-msg"></div>
    </div>
    <div id="csv-mapping-section">
      <h4 style="margin-top:12px">2. Mapping colonne</h4>
      <div id="csv-mapping"></div>
    </div>
    <h4 style="margin-top:12px">3. Anteprima righe</h4>
    <div id="csv-warn" class="err-box" style="display:none"></div>
    <div id="csv-preview"></div>
    <h4 style="margin-top:12px">4. Dettagli nuova versione</h4>
    <div class="form-row"><label>Etichetta</label><input type="text" id="csv-label" value="Import CSV — ${esc(vetName)}${tipo === 'vendita' ? ' · ' + esc(mand) : ''}"></div>
    <div class="form-row"><label>Decorrenza inizio</label><input type="date" id="csv-dec-in" value="2027-01-01"></div>
    <div class="form-row"><label>Decorrenza fine</label><input type="date" id="csv-dec-out" value="2027-12-31"></div>
    <div class="form-row"><label>Note</label><input type="text" id="csv-note" value="Importazione CSV"></div>`;
  let parsed = null; // { header, rows }
  let mapping = {}; // campoAtteso -> index
  let pivotMode = false;
  let pivotEntries = []; // [ "scaglione|zona", valore ]

  // Converte la matrice peso/zona riconosciuta automaticamente nelle stesse strutture
  // (parsed.header/rows + mapping) usate dal flusso di mapping manuale.
  const buildPivotRows = () => {
    parsed = {
      header: tipo === 'costo' ? ['Scaglione', 'Zona', 'Costo'] : ['Scaglione', 'Zona', 'Vendita'],
      rows: pivotEntries.map(([key, val]) => {
        const [scaglione, zona] = key.split('|');
        return [scaglione, zona, String(val)];
      })
    };
    mapping = tipo === 'costo'
      ? { scaglione: 0, zona: 1, costo: 2 }
      : { scaglione: 0, zona: 1, vendita: 2 };
    renderPreview();
  };

  const buildMapping = () => {
    const cont = $('#csv-mapping', b);
    if (!parsed) { cont.innerHTML = '<div class="dt-empty">Carica prima un file CSV.</div>'; return; }
    cont.innerHTML = '';
    parsed.header.forEach((h, ix) => {
      const row = el('div', { class: 'form-row', style: 'grid-template-columns:1fr 1fr;gap:8px' });
      row.appendChild(el('label', {}, `Colonna ${ix + 1}: <span class="mono">${esc(h)}</span>`));
      const sel = el('select', { 'data-ix': ix, class: 'inline-select', style: 'max-width:none;width:100%' });
      sel.appendChild(el('option', { value: '' }, '— ignora —'));
      campiAttesi.forEach(c => {
        const opt = el('option', { value: c.key }, c.label + (c.required ? ' *' : ''));
        // auto-suggest per alias
        if (h.toLowerCase().trim() === c.key.toLowerCase() || c.aliases.some(a => h.toLowerCase().trim() === a.toLowerCase())) {
          opt.selected = true;
          mapping[c.key] = ix;
        }
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        // mapping è campoAtteso -> ix (l'ultima assegnazione vince)
        const wasMapped = Object.entries(mapping).find(([k, v]) => v === ix);
        if (wasMapped) delete mapping[wasMapped[0]];
        if (sel.value) mapping[sel.value] = ix;
        renderPreview();
      });
      row.appendChild(sel);
      cont.appendChild(row);
    });
    // Campi senza match: warning
    const mancanti = campiAttesi.filter(c => c.required && mapping[c.key] == null).map(c => c.label);
    if (mancanti.length) {
      cont.appendChild(el('div', { class: 'warn-box' }, `⚠️ Campi obbligatori non mappati: <strong>${mancanti.map(esc).join(', ')}</strong>. Mappali prima di importare.`));
    }
    renderPreview();
  };

  const renderPreview = () => {
    if (!parsed) { $('#csv-preview', b).innerHTML = ''; return; }
    if (!mapping['vendita'] && tipo === 'vendita') { $('#csv-preview', b).innerHTML = ''; return; }
    if (!mapping['costo'] && tipo === 'costo') { $('#csv-preview', b).innerHTML = ''; return; }

    const ixS = mapping['scaglione'];
    const ixZ = mapping['zona'];
    const ixC = mapping['costo'];
    const ixV2 = mapping['vendita'];

    const parsedRows = parsed.rows.map((r, i) => {
      const obj = {
        _ix: i,
        scaglione: ixS != null ? (r[ixS] || '').trim() : '',
        zona: ixZ != null ? (r[ixZ] || '').trim() : '',
        costo: ixC != null ? parseFloat(String(r[ixC] || '').replace(',', '.')) : null,
        vendita: ixV2 != null ? parseFloat(String(r[ixV2] || '').replace(',', '.')) : null
      };
      obj.errori = [];
      if (!obj.scaglione) obj.errori.push('scaglione mancante');
      if (!obj.zona) obj.errori.push('zona mancante');
      if (tipo === 'costo' && (obj.costo == null || isNaN(obj.costo))) obj.errori.push('costo non numerico');
      if (tipo === 'vendita' && (obj.vendita == null || isNaN(obj.vendita))) obj.errori.push('vendita non numerica');
      return obj;
    });
    const errate = parsedRows.filter(p => p.errori.length);
    const sottoCosto = tipo === 'vendita' ? parsedRows.filter(p => p.costo && p.vendita < p.costo) : [];

    let warnHtml = '';
    if (errate.length) warnHtml += `<div class="err-box">⚠️ <strong>${errate.length}</strong> righe con errori di parsing (verranno <strong>saltate</strong> in fase di importazione).</div>`;
    if (sottoCosto.length) warnHtml += `<div class="warn-box">⛔ <strong>${sottoCosto.length}</strong> righe con vendita &lt; costo. In fase di conferma ti verrà chiesto di confermare esplicitamente prima di procedere.</div>`;
    if (warnHtml) { $('#csv-warn', b).style.display = ''; $('#csv-warn', b).innerHTML = warnHtml; } else { $('#csv-warn', b).style.display = 'none'; }

    const table = el('table', { class: 'dt' });
    table.innerHTML = `<thead><tr>
      <th>#</th>
      <th>Scaglione</th><th>Zona</th>
      <th class="num">Costo</th>
      ${tipo === 'vendita' ? '<th class="num">Vendita</th><th class="num">Margine</th>' : ''}
      <th>Esito parsing</th>
    </tr></thead>`;
    const tb = el('tbody');
    parsedRows.slice(0, 200).forEach(p => {
      const tr = el('tr', { class: p.errori.length ? 'row-danger' : '' });
      const margine = p.costo && p.vendita ? p.vendita - p.costo : null;
      tr.innerHTML = `<td class="tiny">${p._ix + 1}</td>
        <td>${esc(p.scaglione || '—')}</td>
        <td>${esc(p.zona || '—')}</td>
        <td class="num">${p.costo != null && !isNaN(p.costo) ? fmtEur(p.costo) : '<span class="muted">—</span>'}</td>
        ${tipo === 'vendita' ? `<td class="num">${p.vendita != null && !isNaN(p.vendita) ? `<strong>${fmtEur(p.vendita)}</strong>` : '<span class="muted">—</span>'}</td><td class="num" style="color:${margine != null && margine < 0 ? 'var(--err)' : 'var(--ok)'}">${margine != null ? (margine >= 0 ? '+' : '') + fmtEur(margine) : '—'}</td>` : ''}
        <td>${p.errori.length ? '<span class="badge err">' + p.errori.join(', ') + '</span>' : '<span class="badge ok">ok</span>'}</td>`;
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    if (parsedRows.length > 200) {
      table.appendChild(el('div', { class: 'tiny', style: 'padding:6px' }, `… mostrate prime 200 righe di ${parsedRows.length}.`));
    }
    const prev = $('#csv-preview', b); prev.innerHTML = ''; prev.appendChild(table);
  };

  const csvFile = $('#csv-file', b);
  csvFile.addEventListener('change', () => {
    const f = csvFile.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      const rawRows = parseCSVText(text);
      if (!rawRows.length) { toast('CSV vuoto o non valido', 'err'); return; }
      const pivotMap = estraiTabellePesoZona(rawRows);
      if (pivotMap.size > 0) {
        // Formato a matrice riconosciuto (es. export DHL): niente mapping manuale.
        pivotMode = true;
        pivotEntries = [...pivotMap.entries()];
        const nScaglioni = new Set(pivotEntries.map(([k]) => k.split('|')[0])).size;
        const nZone = new Set(pivotEntries.map(([k]) => k.split('|')[1])).size;
        $('#csv-hint', b).style.display = 'none';
        $('#csv-mapping-section', b).style.display = 'none';
        $('#csv-pivot-box', b).style.display = '';
        $('#csv-pivot-msg', b).innerHTML = `✔ Rilevato un file in formato <strong>a matrice peso × zona</strong>: <strong>${nScaglioni}</strong> scaglioni × <strong>${nZone}</strong> zone, <strong>${pivotEntries.length}</strong> tariffe lette. Le tariffe saranno importate come listino del vettore <strong>${esc(vetName)}</strong>.`;
        buildPivotRows();
      } else {
        pivotMode = false;
        $('#csv-pivot-box', b).style.display = 'none';
        $('#csv-mapping-section', b).style.display = '';
        if (rawRows.length < 2) { toast('CSV vuoto o non valido', 'err'); return; }
        const header = rawRows[0].map(h => h.trim());
        parsed = { header, rows: rawRows.slice(1) };
        $('#csv-hint', b).style.display = '';
        $('#csv-hint', b).innerHTML = `✔ <strong>${parsed.rows.length}</strong> righe lette (oltre l'intestazione). <strong>${parsed.header.length}</strong> colonne: <span class="mono">${parsed.header.map(esc).join(' · ')}</span>`;
        buildMapping();
      }
    };
    reader.readAsText(f);
  });

  openModal({
    title: `Importa CSV — listino di ${tipo === 'costo' ? 'costo' : 'vendita'} · ${esc(vetName)}`, body: b, size: 'wide',
    actions: [
      { label: 'Annulla' },
      { label: 'Importa e crea nuova versione', cls: 'btn-primary', keepOpen: true, onClick: (bd, close) => {
          if (!parsed) { toast('Carica prima un file CSV', 'err'); return false; }
          const required = campiAttesi.filter(c => c.required);
          const mancanti = required.filter(c => mapping[c.key] == null);
          if (mancanti.length) { toast(`Mappatura incompleta: ${mancanti.map(c => c.label).join(', ')}`, 'err'); return false; }

          // parsing finale
          const parsedRows = parsed.rows.map((r, i) => {
            const obj = {
              _ix: i,
              scaglione: (r[mapping['scaglione']] || '').trim(),
              zona: (r[mapping['zona']] || '').trim(),
              costo: mapping['costo'] != null ? parseFloat(String(r[mapping['costo']] || '').replace(',', '.')) : null,
              vendita: mapping['vendita'] != null ? parseFloat(String(r[mapping['vendita']] || '').replace(',', '.')) : null
            };
            obj.errori = [];
            if (!obj.scaglione) obj.errori.push('scaglione mancante');
            if (!obj.zona) obj.errori.push('zona mancante');
            if (tipo === 'costo' && (obj.costo == null || isNaN(obj.costo))) obj.errori.push('costo non numerico');
            if (tipo === 'vendita' && (obj.vendita == null || isNaN(obj.vendita))) obj.errori.push('vendita non numerica');
            return obj;
          });
          const okRows = parsedRows.filter(p => !p.errori.length);
          if (!okRows.length) { toast('Nessuna riga valida da importare', 'err'); return false; }

          // arricchisci con riferimento al listino di costo per vendita
          let righeFinali;
          if (tipo === 'vendita') {
            const mappaCosto = mappaCostoAttivo(vetId);
            righeFinali = okRows.map(r => {
              const rifCosto = mappaCosto.get(r.scaglione + '|' + r.zona);
              const costo = r.costo != null ? r.costo : (rifCosto ? rifCosto.costo : null);
              const costoVettore = rifCosto ? rifCosto.costoVettore : null;
              return {
                scaglione: r.scaglione, zona: r.zona,
                costo: costo || 0, costoVettore, vendita: r.vendita,
                margine: costo ? +(r.vendita - costo).toFixed(2) : 0,
                personalizzazione: { tipo: 'abs', valore: r.vendita, applicataIl: nowStr().slice(0, 10) }
              };
            });
          } else {
            const lv = LISTINI_VETTORE[vetName];
            righeFinali = okRows.map(r => {
              // per il costo: prova a derivare costoVettore dal listino vettore di riferimento
              const vrow = lv?.rows.find(x => x.scaglione === r.scaglione && x.zona === r.zona);
              return {
                scaglione: r.scaglione, zona: r.zona,
                costo: r.costo, costoVettore: vrow ? vrow.prezzo : null,
                origine: vrow ? `Importato da CSV — listino vettore ${vetName}` : 'Importato da CSV',
                origineTipo: 'csv',
                valoreOriginale: r.costo,
                personalizzazione: { tipo: 'abs', valore: r.costo, applicataIl: nowStr().slice(0, 10) }
              };
            });
          }

          // validazione sotto-costo per vendita
          const sottoCosto = tipo === 'vendita' ? righeFinali.filter(r => r.costo && r.vendita < r.costo) : [];
          const finalizeImport = () => {
            const decorrenzaInizio = $('#csv-dec-in', bd).value || OGGI;
            const decorrenzaFine = $('#csv-dec-out', bd).value || '';
            const label = $('#csv-label', bd).value.trim() || `Import CSV ${nowStr().slice(0, 10)}`;
            const note = $('#csv-note', bd).value.trim() || 'Importazione CSV';
            // Un listino importato da CSV nasce sempre come "futuro" (richiede conferma/attivazione
            // manuale prima di entrare in vigore), a meno che la sua decorrenza fine non sia già
            // trascorsa: in quel caso nasce direttamente "archiviato".
            let stato = (decorrenzaFine && OGGI > decorrenzaFine) ? 'archiviato' : 'futuro';

            // genera id per scope
            let id;
            if (tipo === 'vendita') {
              id = nextListinoVenditaId2(mand, vetId, true);
            } else {
              const anno = decorrenzaInizio.slice(0, 4);
              id = nextListinoCostoId(vetId, anno, true);
            }

            // auto-arciviazione: solo stesso scope
            if (stato === 'attivo' || stato === 'futuro') {
              const versioniStessoScope = tipo === 'vendita'
                ? ensureListinoVendita(mand, vetId).versioni
                : ensureListinoCosto(vetId).versioni;
              versioniStessoScope
                .filter(x => x.stato === stato && x.id !== id)
                .forEach(prev => {
                  if (decorrenzaInizio <= (prev.decorrenzaInizio || '')) {
                    prev.stato = 'archiviato';
                    prev.decorrenzaFine = decorrenzaInizio;
                  }
                });
            }

            const nuovo = {
              id, label, decorrenzaInizio, decorrenzaFine, stato,
              righe: righeFinali, note: note + ` (${okRows.length} righe importate${parsedRows.length - okRows.length ? `, ${parsedRows.length - okRows.length} saltate` : ''})`,
              creatoIl: nowStr(), creatoDa: currentUser?.nome || 'Sistema'
            };
            if (tipo === 'vendita') {
              nuovo.mandante = mand;
              nuovo.vettore = vetId;
              nuovo.agente = (listinoRiferimento && listinoRiferimento.agente) || '';
              nuovo.provvigionePct = (listinoRiferimento && listinoRiferimento.provvigionePct) || 0;
              nuovo.scontoPct = (listinoRiferimento && listinoRiferimento.scontoPct) || 0;
              ensureListinoVendita(mand, vetId).versioni.push(nuovo);
            } else {
              nuovo.vettore = vetId;
              ensureListinoCosto(vetId).versioni.push(nuovo);
            }
            ricalcolaStatoListini();
            renderListinoCostoAttivo(); renderListinoCostoStorico();
            renderListinoVenditaAttivo(); renderListinoVenditaStorico();
            const isMand = currentUser?.livello === 'Mandante/Sottocontratto';
            renderMandanteVettoreTabs('#lv-mandante-tabs', 'mandante', isMand);
            renderMandanteVettoreTabs('#lv-stor-mandante-tabs', 'storMandante', isMand);
            toast(`Importate ${okRows.length} righe in ${id} (${stato})${parsedRows.length - okRows.length ? `, ${parsedRows.length - okRows.length} saltate` : ''}`, sottoCosto.length ? 'warn' : 'ok');
            close();
          };

          if (sottoCosto.length) {
            openModal({
              title: 'Conferma righe in perdita',
              body: `<p>Il file CSV contiene <strong>${sottoCosto.length} righe con vendita &lt; costo</strong>. Per procedere è richiesta una conferma esplicita.</p>
                <ul style="margin:6px 0 0 18px">${sottoCosto.slice(0, 5).map(r => `<li class="mono">${esc(r.scaglione)}</li>`).join('')}</ul>
                ${sottoCosto.length > 5 ? `<li class="tiny">… e altre ${sottoCosto.length - 5}</li>` : ''}`,
              actions: [
                { label: 'Annulla' },
                { label: `Conferma e importa con ${sottoCosto.length} righe in perdita`, cls: 'btn-danger', onClick: () => finalizeImport() }
              ]
            });
            return false;
          }
          finalizeImport();
        } }
    ]
  });
}

/* ============================================================
   10h. Esporta CSV
   ============================================================ */
function esportaListinoCSV(v, tipo) {
  const header = tipo === 'costo'
    ? ['vettore', 'scaglione', 'zona', 'costo', 'costo_vettore', 'personalizzazione_tipo', 'personalizzazione_valore']
    : ['mandante', 'vettore', 'scaglione', 'zona', 'costo', 'vendita', 'margine', 'agente', 'provvigione_pct', 'sconto_pct'];
  const csvSep = ';';
  const escape = val => {
    if (val == null) return '';
    const s = String(val);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const vetName = v.vettore ? ((VETTORI.find(x => x.id === v.vettore) || {}).nome || v.vettore) : '';
  const lines = [header.join(csvSep)];
  v.righe.forEach(r => {
    if (tipo === 'costo') {
      // Il vettore è nello scope: lo valorizziamo per completezza del CSV
      lines.push([vetName, r.scaglione, r.zona, r.costo, r.costoVettore || '', r.personalizzazione?.tipo || '', r.personalizzazione?.valore || ''].map(escape).join(csvSep));
    } else {
      lines.push([v.mandante, vetName, r.scaglione, r.zona, r.costo, r.vendita, r.margine, v.agente || '', v.provvigionePct || 0, v.scontoPct || 0].map(escape).join(csvSep));
    }
  });
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `${v.id}.csv` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Esportato ${v.id} (${v.righe.length} righe)`, 'ok');
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
  $('#phone-mode-label').textContent = isProprio ? 'Linea propria — Padroncino Riviera' : 'Corriere esterno — DHL';
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
        s.storico.push({ stato: 'Consegnata', data: nowStr(), operatore: isProprio ? 'Padroncino Riviera' : 'DHL' });
        s.tracking.push({ data: nowStr(), evento: 'Consegnata al destinatario (con foto)', luogo: s.localita, interno: false, operatore: isProprio ? 'Padroncino Riviera' : 'DHL' });
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
  // Righe di vendita in perdita: solo listini attivi (futuro/attivo), in tutte le versioni correnti
  // di tutte le coppie (mandante × vettore).
  const perdita = tutteVersioniVendita()
    .filter(l => l.stato !== 'archiviato')
    .reduce((acc, l) => acc + l.righe.filter(r => r.vendita < r.costo).length, 0);
  const flussiErr = FLUSSI.filter(f => f.stato === 'Errore').length;
  const nVersCosto = tutteVersioniCosto();
  const nVersVendita = tutteVersioniVendita();
  const listiniCostoAttivi = nVersCosto.filter(l => l.stato === 'attivo').length;
  const listiniVenditaAttivi = nVersVendita.filter(l => l.stato === 'attivo').length;
  $('#dash-kpis').innerHTML = `
    <div class="kpi" onclick="showView('spedizioni')"><div class="kpi-label">Spedizioni in lavorazione</div><div class="kpi-value">${SPEDIZIONI.filter(s => !['Consegnata'].includes(s.stato)).length}</div><div class="kpi-note">su ${SPEDIZIONI.length} totali in vista</div></div>
    <div class="kpi warn" onclick="showView('spedizioni')"><div class="kpi-label">CAP da correggere</div><div class="kpi-value">${capErr}</div><div class="kpi-note">azione massiva disponibile</div></div>
    <div class="kpi err" onclick="showView('giacenze')"><div class="kpi-label">Giacenze aperte</div><div class="kpi-value">${giacAperte}</div><div class="kpi-note">${GIACENZE.filter(g => g.esito === 'Aperta' && g.giorni >= 5).length} oltre 5 giorni</div></div>
    <div class="kpi err" onclick="showView('listini')"><div class="kpi-label">Righe vendita in perdita</div><div class="kpi-value">${perdita}</div><div class="kpi-note">controllo listini</div></div>
    <div class="kpi" onclick="showView('listini')"><div class="kpi-label">Listini costo / vendita attivi</div><div class="kpi-value">${listiniCostoAttivi} / ${listiniVenditaAttivi}</div><div class="kpi-note">su ${nVersCosto.length} + ${nVersVendita.length} totali (per vettore / per coppia mandante×vettore)</div></div>
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
    ['19:15', 'Azione massiva: 23 spedizioni → DHL', 'Spedizioni · M. Bruzzone'],
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
  // Le 4 sezioni listini: ricalcolo + re-render
  ricalcolaStatoListini();
  renderListinoCostoAttivo(); renderListinoCostoStorico();
  renderListinoVenditaAttivo(); renderListinoVenditaStorico();
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
  const isRegistrazione = $('#login-tab-registrati')?.classList.contains('active');
  currentUser = lookupUser(email);
  if (isRegistrazione) {
    const nomeInserito = $('#login-nome')?.value.trim();
    if (nomeInserito) currentUser.nome = nomeInserito;
  }
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
  const msg = isRegistrazione
    ? `Registrazione completata — benvenuto, ${currentUser.nome} — accesso come ${note}`
    : `Benvenuto, ${currentUser.nome} — accesso come ${note}`;
  toast(msg, 'ok', 'Autenticazione');
}

function doLogout() {
  $('.modal-backdrop') && $('.modal-backdrop').remove();
  if (currentUser) logAzione(`Logout — ${currentUser.nome}`, '', 'Autenticazione');
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

  normalizzaDatasetDemo();
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

  $('#btn-goto-colli').addEventListener('click', () => gotoColli());
  $('#btn-goto-diff').addEventListener('click', gotoDiff);
  $('#colli-search').addEventListener('input', e => renderColli(e.target.value));
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