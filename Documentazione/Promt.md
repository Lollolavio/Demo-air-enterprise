### Prompt per agente AI — Demo gestionale Air Enterprise (solo frontend: HTML, CSS, JavaScript)

Realizza una **demo frontend** (non funzionante lato backend, ma credibile dal punto di vista UX/UI) del nuovo gestionale per il cliente **Air Enterprise**, operatore nel settore logistica/spedizioni.  
La demo deve essere composta da **tre file**:

- **index.html** — struttura delle pagine e delle viste principali  
- **style.css** — stile, layout, colori, tipografia, componenti UI  
- **app.js** — logica di interazione lato client (simulazioni, mock data, cambi stato, filtri, ecc.)

L'obiettivo è mostrare in modo realistico come potrebbe funzionare il gestionale, con particolare attenzione ai flussi operativi, alle schermate e alla chiarezza delle informazioni, anche se i dati sono finti o simulati.

---

### Contesto operativo da rappresentare

**Air Enterprise**:

- **Ruolo:** aggregatore/gestore di spedizioni, non corriere finale.  
- Gestisce spedizioni provenienti da clienti (es. spedizionieri come "Chiapparino") e decide se usare:
  - un **corriere terzo** (DHL, SDA, GLS, ecc.)
  - una **linea propria** (padroncini: piccoli vettori locali con partita IVA).
- Ha un **centro di smistamento** dove:
  - riceve flussi di spedizioni da vari clienti
  - decide quale etichetta stampare in base al **CAP di destinazione** e alle regole del mandante.

Il gestionale attuale è un **AS400 legacy** (schermate tipo DOS, solo tastiera, lento e poco flessibile). La demo deve rappresentare il **nuovo gestionale moderno**, web-based, con:

- interfaccia chiara
- operazioni massive
- filtri avanzati
- gestione configurazioni
- tracking e portale clienti.

---

### Glossario da tenere presente nella UI

Usa questi termini nelle etichette, tooltip, titoli:

- **Mandante:** cliente finale rappresentato dallo spedizioniere (es. azienda farmaceutica).
- **Sottocontratto:** contratto legato al singolo mandante.
- **Padroncino:** vettore locale indipendente (partita IVA propria).
- **Borderò:** documento con elenco dei colli affidati a un vettore/padroncino.
- **Collo madre / sotto-colli:** relazione tra un bancale principale e i colli associati.
- **Qapla:** connettore e-commerce (servizio da sostituire con soluzione interna).

---

### Struttura generale della demo

La demo deve simulare un **portale gestionale interno** con più moduli, navigabili tramite:

- **Navbar principale** (in alto) con voci tipo:
  - Dashboard
  - Spedizioni
  - Listini e tariffe
  - Flussi in ingresso
  - Giacenze
  - Qapla / e-commerce
  - Utenti e ruoli
  - Configurazioni
- **Sidebar opzionale** per filtri contestuali (es. nella sezione Spedizioni).

Puoi usare un layout tipo **single-page app** con sezioni che si mostrano/nascondono via JavaScript (niente routing reale, solo simulazione).

---

### Sezione: Flussi in ingresso (microservizi per cliente)

Rappresenta una schermata che simula la gestione dei **34 flussi/file diversi** (CSV/TXT) provenienti dai clienti.

**UI richiesta:**

- **Tabella/Lista dei clienti** (es. Chiapparino, Jigsaw, ecc.) con colonne:
  - Nome cliente
  - Tipo flusso (CSV/TXT)
  - Stato ultimo import (OK, errore, in coda)
  - Data/ora ultimo import
  - Tipo microservizio:
    - "Istanza dedicata" (un microservizio per cliente)
    - "Configurazione condivisa" (multi-configurazione)
- **Dettaglio cliente** (pannello laterale o modale) con:
  - Regole custom applicate (es. "tutte le spedizioni del mandante Jigsaw → SMS di preavviso", "spedizioni per Modena → consegna al piano").
  - Pulsante "Simula import" che aggiorna lo stato (via mock in `app.js`).

**Logica simulata in JavaScript:**

- Mock di alcuni clienti con configurazioni diverse.
- Click su "Simula import" cambia lo stato (es. da "in coda" a "OK" o "Errore").
- Possibilità di filtrare per stato (dropdown o checkbox).

---

### Sezione: Spedizioni (gestionale principale)

Questa è la sezione centrale della demo. Deve mostrare:

#### 1. Normalizzazione anagrafica e CAP

- Tabella spedizioni con colonne:
  - ID spedizione
  - Mandante
  - Destinatario
  - CAP
  - Località
  - Provincia
  - Stato validazione (es. "CAP valido", "CAP da correggere").
- Pulsante "Correggi CAP non validi" che simula una **operazione massiva**:
  - In `app.js`, aggiorna i CAP non validi a valori corretti (mock) e cambia lo stato.

#### 2. Numeri di telefono per SMS

- Campo "Telefono destinatario" con indicatori:
  - Formato corretto (es. `+39 333 1234567`)
  - Formato non standard (es. numero nel campo note).
- Pulsante "Normalizza numeri" che:
  - Aggiunge/rimuove `+39`
  - Sposta numeri dal campo note al campo telefono (simulato).

#### 3. Linee, vettore e stato spedizione

Il nuovo sistema deve **separare**:

- **Vettore assegnato** (es. DHL, SDA, Padroncino Rossi).
- **Stato spedizione** (es. "In revisione", "In staging", "In sospeso", "Pronta per etichettatura").

**UI:**

- Per ogni spedizione:
  - Dropdown "Vettore"
  - Dropdown "Stato"
- Non usare numeri di linea (501, 509, 330, 800) come nel legacy; mostra invece etichette testuali.

#### 4. Operazioni massive

- Selezione multipla delle spedizioni (checkbox per riga).
- Pulsante "Seleziona tutto" per le spedizioni filtrate.
- Pulsante "Applica servizio accessorio" con:
  - Modal che permette di scegliere servizi (es. SMS, consegna al piano, assicurazione).
  - Simulazione in `app.js` che aggiunge il servizio alle spedizioni selezionate.

#### 5. Assegnazione vettore e coda di staging

Simula il flusso:

1. Spedizioni arrivano in **coda di gestione** (stato "In revisione").
2. Se i dati sono validi → passano automaticamente a **staging**.
3. Una volta assegnato un vettore → finiscono in **area di parcheggio**.
4. Da lì l'operatore le rende "Disponibili per etichettatura".

**UI:**

- Pannello con **tre colonne** o **tre tab**:
  - "In revisione"
  - "In staging"
  - "Parcheggio / Pronte per etichettatura"
- Drag & drop simulato o pulsanti "Avanza di stato" per spostare le spedizioni tra le colonne.

#### 6. Compatibilità servizi/vettore

- Quando si seleziona un vettore per una spedizione:
  - Se il vettore non supporta un servizio richiesto (es. consegna al piano), mostra:
    - servizio in grigio
    - icona warning
    - tooltip "Servizio non supportato da questo vettore".
- Logica simulata in `app.js` con una mappa vettore → servizi supportati.

#### 7. Creazione lettera di vettura (simulata)

- Pulsante "Genera lettera di vettura" per spedizioni in stato "Pronte per etichettatura".
- Invece di chiamare web service reali:
  - Genera un **PDF finto** o un pannello con layout tipo lettera di vettura:
    - Mittente
    - Destinatario
    - Codice spedizione
    - Vettore
    - Servizi accessori
- Mostra un **preview modale** con stile simile a una lettera di vettura.

---

### Sezione: Listini e tariffe

Questa parte è descritta come la più complessa. La demo deve mostrare una UI che faccia capire la ricchezza delle regole.

#### 1. Struttura listini

Rappresenta:

- **Listini di costo** (quanto costa ad Air Enterprise il servizio).
- **Listini di vendita** (quanto viene fatturato al cliente).

**UI:**

- Tabella/lista listini con colonne:
  - Nome listino
  - Tipo (Costo/Vendita)
  - Cliente/mandante
  - Data inizio validità
  - Data fine validità
- Selezionando un listino, mostra:
  - Griglia di **scaglioni**:
    - Peso (da–a)
    - Misure (da–a)
    - Peso volumetrico (calcolato)
    - Prezzo base
    - Fuel surcharge
    - Tasse
    - Servizi accessori
    - Maggiorazioni (località disagiate, isole)
    - Tariffa nazionale / UE / extra-UE
    - Agente e % provvigione
    - Sconti applicati.

#### 2. Duplicazione e personalizzazione

- Pulsante "Duplica listino":
  - Chiede se creare un **listino di vendita** a partire da uno di costo.
- Modal con due modalità:
  - **Ricarico percentuale** su tutte le voci (es. +10%).
  - **Sovrascrittura prezzo assoluto** per singole voci.
- Logica simulata:
  - Applica il ricarico percentuale ai prezzi.
  - Permette di modificare manualmente alcune righe.

#### 3. Controllo vendita in perdita

- Se un listino di vendita ha una voce con prezzo < costo corrispondente:
  - Evidenzia la riga in rosso.
  - Mostra warning "Prezzo di vendita inferiore al costo".

#### 4. Storicità

- Permetti di visualizzare **più listini nel tempo** per lo stesso cliente:
  - Timeline o elenco con date di validità.
- Simula la coesistenza di listino attuale e listino futuro (già negoziato).

---

### Sezione: Utenti, ruoli e livelli di accesso

Rappresenta la gestione utenti con **multi-livello commerciale**:

- **Livello 1:** proprietà/piattaforma (accesso completo).
- **Livello 2:** back office operatori tipo Air Enterprise.
- **Livello 3:** clienti contrattualizzati (sottocontratti/mandanti).
- **Livello 4:** clienti finali.

**UI:**

- Tabella utenti con:
  - Nome
  - Ruolo (es. Admin piattaforma, Operatore Air Enterprise, Cliente mandante, Cliente finale)
  - Livello (1–4)
  - Permessi (visualizzazione completa, sola consultazione, customer care).
- Pannello di configurazione permessi:
  - Checkbox per moduli accessibili (Spedizioni, Listini, Giacenze, Qapla, ecc.).
- Simula un utente "customer care" con permessi specifici.

---

### Sezione: Tracking pubblico e giacenze

#### Tracking pubblico

- Campo input "Codice lettera di vettura".
- Pulsante "Cerca".
- Mostra:
  - Stato spedizione (in transito, consegnata, in giacenza).
  - Cronologia eventi (presa in carico, partenza, tentativo consegna, ecc.).

#### Giacenze e svincolo autonomo

- Se la spedizione è in **giacenza**:
  - Mostra pannello con opzioni:
    - Nuovo tentativo di consegna
    - Reso al mittente
    - Smaltimento/eccesso
  - Pulsanti che simulano la scelta del cliente finale.
- Aggiorna lo stato in `app.js` e mostra conferma.

---

### Sezione: App operativa (magazzino/padroncini) — simulazione web

Simula l'interfaccia di una **app mobile** (ma in versione web) per:

- Presa in carico pacchi tramite "bip" (simulato con input codice + pulsante).
- Conferma consegna:
  - Campo codice collo
  - Pulsante "Conferma consegna"
  - Upload/simulazione foto obbligatoria (usa un placeholder o anteprima finta).

Per i vettori esterni (DHL, SDA):

- Mostra che hanno una configurazione diversa (es. niente borderò digitale interno).

---

### Sezione: Qapla / connettore e-commerce

Simula una **web app separata** (ma nella stessa demo) dedicata ai clienti finali:

- Lista ordini provenienti da:
  - Amazon
  - Shopify
  - eBay
  - Vinted
- Per ogni ordine:
  - Stato integrazione (es. "Spedizione generata", "Errore", "In attesa").
- Caso particolare Amazon:
  - Mostra che il flusso è "invertito":
    - Etichetta o badge "Notifica da Amazon (push)" invece di "Richiesta spedizione".

Include:

- Sezione "Gestione giacenze" integrata.
- Sezione "Consultazione spedizioni" per clienti finali.

---

### Sezione: Colli madre e sotto-colli

Rappresenta la relazione tra:

- **Collo madre** (bancale principale).
- **Sotto-colli** (colli associati).

**UI:**

- Vista ad albero:
  - Collo madre (ID, peso, dimensioni).
  - Lista sotto-colli (ID, stato consegna).
- Gestione consegna parziale:
  - Alcuni sotto-colli in stato "Consegnato", altri "Non consegnato".
  - Stato complessivo bancale:
    - "Consegnato parzialmente" se non tutti i sotto-colli sono consegnati.
- Possibilità di spedire sotto-colli separatamente (mezzi/date diverse):
  - Mostra date diverse per i singoli sotto-colli.

---

### Sezione: Differenziale peso/misure

Simula il confronto tra:

- **Peso/dimensioni dichiarati** dal mittente.
- **Peso/dimensioni reali** rilevati da sistemi automatici (bilancia, telecamere).

**UI:**

- Tabella con colonne:
  - Peso dichiarato
  - Peso reale
  - Dimensioni dichiarate
  - Dimensioni reali
  - Differenziale (calcolato in `app.js`)
  - Impatto sul prezzo (es. "+2,50€").

---

### Sezione: Architettura tecnica (message broker, rate limit) — vista concettuale

Non devi implementare un vero broker, ma puoi:

- Mostrare una **dashboard concettuale** con:
  - Coda messaggi (numero messaggi in attesa).
  - Consumer attivi (numero istanze).
  - Stato servizi (online/offline).
- Simulare:
  - Se un servizio "va giù", i messaggi restano in coda.
  - Quando torna "online", la coda si svuota.

Per il **rate limit dei vettori**:

- Mostra:
  - Limite API (es. 60 richieste/minuto).
  - Volume richieste (es. 2.000 spedizioni/ora).
- Simula strategie:
  - Throttling (barra di progressione).
  - Distribuzione su IP diversi (etichetta "Nodo 1", "Nodo 2", ecc.).

---

### Stile e UX

Nel file **style.css**:

- Usa uno stile moderno, tipo dashboard B2B:
  - Colori sobri (grigi, blu, accenti arancioni/verde per stati).
  - Tipografia leggibile.
  - Card, tab, badge per stati.
- Evidenzia:
  - Errori (rosso)
  - Warning (giallo/arancione)
  - Successi (verde)
- Cura la leggibilità delle tabelle e dei filtri.

Nel file **app.js**:

- Usa **mock data** per:
  - Clienti
  - Mandanti
  - Spedizioni
  - Listini
  - Utenti
  - Colli madre/sotto-colli
- Implementa:
  - Filtri (per stato, vettore, cliente).
  - Operazioni massive (seleziona tutto, applica servizio).
  - Cambi di stato (revisione → staging → parcheggio → etichettatura).
  - Simulazioni di normalizzazione (CAP, telefoni).
  - Calcolo differenziali (peso/misure, prezzi).

---

### Obiettivo finale della demo

La demo deve permettere a chi la guarda di:

- **Capire il modello di business** di Air Enterprise.
- **Vedere i flussi chiave**:
  - Acquisizione flussi clienti.
  - Gestione spedizioni.
  - Listini e tariffe.
  - Giacenze e svincolo.
  - Tracking pubblico.
  - Connettore e-commerce (Qapla).
  - Colli madre/sotto-colli.
- **Percepire la complessità** del sistema, pur essendo solo frontend.

Non è necessario alcun backend reale: tutto può essere simulato con JavaScript e dati finti, ma la struttura deve essere **coerente, precisa e aderente** ai requisiti descritti.
