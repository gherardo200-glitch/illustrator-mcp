# Roadmap: una chat dentro Illustrator

Obiettivo: un pannello *dentro* Illustrator con una casella di chat, così l'utente
può parlare con l'assistente senza cambiare applicazione. Questo documento descrive
il progetto e — soprattutto — **quanto costa**. Non è ancora implementato: la v1
(controllo da Claude/ChatGPT tramite il server MCP) funziona già oggi.

---

## I pezzi

I plugin di Illustrator si costruiscono con una di due tecnologie:

- **UXP** (moderna; Illustrator 26.4+ / 2022+) — pannelli in HTML/JS/CSS, è la via consigliata.
- **CEP** (legacy) — pannelli HTML; copre più versioni ma è deprecata.

Un pannello di chat ha bisogno di tre cose:

1. **Un'interfaccia (UXP/CEP)** — una casella di testo + l'elenco dei messaggi.
2. **Un modello LLM** — il pannello invia la conversazione a un modello (API di
   Anthropic o OpenAI, oppure un relay locale) e riceve indietro testo e chiamate ai tool.
3. **Un esecutore dei tool** — le chiamate del modello devono raggiungere Illustrator.
   Dentro un pannello puoi chiamare **direttamente** l'API ExtendScript/UXP, quindi
   puoi riusare le *definizioni dei tool e gli ExtendScript* di questa repo
   (`src/jsx.ts`, `src/tools/*`) senza il livello MCP in mezzo.

---

## Due architetture possibili

### 1. Pannello → server MCP locale (riusa tutto)

```
Pannello UXP  ──HTTP/WebSocket──►  un piccolo host locale che parla con l'LLM
                                   e chiama i tool di QUESTO server MCP
```

Pro: il pannello resta "stupido"; tutta la logica Illustrator + i tool vivono qui e
sono condivisi con l'esperienza Claude/ChatGPT. Contro: serve un piccolo processo
host locale e una chiave API.

### 2. Pannello autonomo (senza MCP)

```
Pannello UXP  ──►  API dell'LLM (con gli schemi dei tool)  ──►  il pannello esegue lo ExtendScript in locale
```

Pro: un unico artefatto, nessun processo esterno. Contro: duplica il livello dei tool
dentro il pannello; la gestione della chiave API vive nel pannello.

**Consigliata:** partire dall'architettura #1 e fattorizzare le definizioni dei tool in
`src/tools/*` così che sia il server MCP sia l'host del pannello importino gli stessi ExtendScript.

---

## Packaging e distribuzione

- I plugin UXP si impacchettano come `.ccx` e si distribuiscono via Adobe Exchange,
  oppure si condividono come build di sviluppo (UDT — UXP Developer Tool).
- Serve un account sviluppatore Adobe; la distribuzione in produzione richiede una revisione.

---

## Versione minima (MVP)

1. Pannello UXP con una casella di input e un log dei messaggi.
2. All'invio, manda la conversazione + gli schemi dei tool di questa repo a un LLM.
3. Per ogni tool call restituita, esegui lo ExtendScript corrispondente e rimanda il risultato al modello.
4. Mostra il testo dell'assistente nel pannello.

Finché questo non esiste, le stesse funzionalità sono già disponibili oggi chattando in
Claude/ChatGPT/Cursor con il server MCP — semplicemente lo fai nella finestra
dell'assistente invece che in un pannello di Illustrator.

---

## 💶 Costi

Punto più importante da capire: **il costo dipende da COME l'AI viene invocata**, non
dal connettore in sé (che è gratuito e open source).

### Cosa è già gratis

| Voce | Costo |
|------|-------|
| Il server MCP di questa repo | **Gratis** (open source, MIT) |
| Usarlo tramite **Claude Desktop** o **ChatGPT** | **Nessun costo extra**: il modello è già incluso nell'abbonamento che hai (Claude Pro ~€18/mese, ChatGPT Plus ~€23/mese). Comandare Illustrator da lì non costa nulla in più. |
| Account sviluppatore Adobe (per costruire il pannello UXP) | **Gratis** |
| Pubblicare il plugin su Adobe Exchange | **Gratis** (listing base) |

➡️ **Se ti basta chattare da Claude o ChatGPT, il costo aggiuntivo è zero.** Il pannello
in-app diventa a pagamento solo perché deve chiamare l'API del modello **direttamente**
(a consumo), invece di passare da un client con abbonamento fisso.

### Costo delle API LLM (solo per il pannello in-app, architettura a consumo)

Il pannello chiama un modello via API e paga **a token** (input = quello che mandi,
output = quello che il modello genera). Prezzi Claude (USD per **1 milione** di token,
dati aggiornati a metà 2026):

| Modello | Input /1M | Output /1M | Quando usarlo |
|---------|-----------|------------|---------------|
| **Claude Haiku 4.5** | $1 | $5 | Comandi semplici, il più economico |
| **Claude Sonnet 5** | $3 ($2 promo*) | $15 ($10 promo*) | Ottimo equilibrio qualità/prezzo |
| **Claude Opus 4.8** | $5 | $25 | Massima capacità, task complessi |

\* Prezzo introduttivo di Sonnet 5 fino al 31/08/2026. Per **OpenAI/GPT** i prezzi
variano per modello: verifica la pagina prezzi ufficiale di OpenAI.

**Stima per singola interazione** (un comando tipo "crea un poster con titolo e forme").
Una richiesta include prompt di sistema + schemi dei ~28 tool + messaggio (~5.000 token
in input) e le tool call + testo del modello (~1.000 token in output):

| Modello | Costo ~per richiesta | ~100 richieste (giornata intensa) |
|---------|----------------------|-----------------------------------|
| Haiku 4.5 | ~$0,01 | ~$1 |
| Sonnet 5 | ~$0,03 | ~$3 |
| Opus 4.8 | ~$0,05 | ~$5 |

Sono stime approssimative: task complessi (molte forme, molti passaggi) costano di più.
Il **prompt caching** riduce molto il costo delle richieste ripetute (gli schemi dei tool
e il prompt di sistema, una volta in cache, costano circa il 90% in meno in lettura) —
in pratica dalla seconda richiesta in poi si spende meno delle cifre qui sopra.

**Chi paga.** Con l'architettura a consumo serve una chiave API del tuo amico (o tua) e
si paga il consumo effettivo. In alternativa, se il pannello instrada le richieste verso
un client con abbonamento (via il server MCP), il modello resta coperto dall'abbonamento
e il consumo API si azzera — a scapito di dover tenere aperto quel client.

### Costi Adobe

- **Illustrator / Creative Cloud** — abbonamento che il tuo amico ha già (non è un costo
  di questo progetto).
- **Account sviluppatore Adobe** — gratuito.
- **Distribuzione** su Adobe Exchange — il listing base è gratuito; una eventuale
  revisione/certificazione per la vendita ha regole a parte.

### Costi hosting / tunnel (opzionali)

Servono **solo** se vuoi far usare il connettore a ChatGPT da remoto (server MCP esposto
via HTTP) o centralizzare l'host su un server:

| Voce | Costo tipico |
|------|--------------|
| Tunnel `localhost` (cloudflared / ngrok) | Piano gratuito sufficiente per uso personale |
| Piccolo VPS (se vuoi un host sempre attivo) | ~€5/mese |

Per l'uso locale (server + Illustrator sulla stessa macchina) **non serve nulla di tutto questo**.

### Riepilogo e raccomandazione

- **Oggi, gratis:** usa il connettore da **Claude Desktop / ChatGPT** — nessun costo oltre
  l'abbonamento già in tuo possesso.
- **Pannello in-app a consumo:** metti in conto **pochi centesimi per interazione**
  (parti da **Sonnet 5** o **Haiku 4.5** per contenere i costi, passa a Opus 4.8 solo per
  i lavori più complessi). Una giornata intensa raramente supera qualche euro.
- **Adobe e hosting:** trascurabili o nulli per l'uso personale.

---

## Nota finale

Il pannello dentro Illustrator è la parte "wow", ma non è indispensabile: tutte le
capacità sono già utilizzabili oggi via Claude/ChatGPT/Cursor con il server MCP — a costo
zero se passi da un client con abbonamento. Il pannello si giustifica quando vuoi
l'esperienza integrata dentro l'app e sei disposto a pagare il consumo delle API (o a
tenere aperto un client con abbonamento come "motore").
