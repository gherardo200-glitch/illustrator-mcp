# Come attivare il connettore — Claude **e** ChatGPT

Il connettore è **un solo programma** che si può collegare in due modi:

- **Modalità Claude** (stdio) → per **Claude Desktop / Claude Code / Cursor**. La più semplice: nessun tunnel, nessun account extra.
- **Modalità ChatGPT** (HTTP + Secure MCP Tunnel) → per **ChatGPT** (anche l'app desktop del Mac).

⚠️ In tutti i casi il connettore e **Illustrator devono girare sullo stesso computer**.

---

## Prerequisiti (comuni a entrambe)

1. Installare **Node.js 18+** (da [nodejs.org](https://nodejs.org)).
2. Avere **Adobe Illustrator** installato.
3. Installare il connettore, una volta sola:
   ```bash
   git clone https://github.com/gherardo200-glitch/illustrator-mcp.git
   cd illustrator-mcp
   npm install
   ```
   Questo crea `dist/index.js` (il programma da avviare). Segnati il suo **percorso assoluto**, ad esempio:
   ```
   /Users/tuonome/.../illustrator-mcp/dist/index.js
   ```

Prova rapida (senza Illustrator): dopo la configurazione, chiedi all'assistente
*"usa illustrator_get_status"* — verifica il collegamento senza avviare Illustrator.

---

## 🟣 Versione A — Claude (la più semplice)

Il connettore parte in modalità **stdio** (predefinita): `node dist/index.js`.

1. Apri il file di configurazione di Claude Desktop:
   - **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
2. Incolla (mettendo il tuo percorso reale):
   ```json
   {
     "mcpServers": {
       "illustrator": {
         "command": "node",
         "args": ["/percorso/assoluto/di/illustrator-mcp/dist/index.js"]
       }
     }
   }
   ```
3. **Riavvia Claude Desktop.** Al primo comando, su macOS concedi il permesso di
   **controllare Adobe Illustrator** (System Settings → Privacy & Security → Automation).
4. Accedi = scrivi in chat: *"crea un documento 1080×1080 e aggiungi il titolo 'SALDI' in arancione"*.

> Per **Claude Code**: `claude mcp add illustrator -- node /percorso/.../dist/index.js`
> Per **Cursor**: stessa struttura JSON in `~/.cursor/mcp.json`.

Costo: **nessuno oltre l'abbonamento Claude** che già hai.

---

## 🟢 Versione B — ChatGPT (app desktop del Mac)

ChatGPT **non** parla con un server locale "a comando": raggiunge un endpoint
tramite i suoi **connettori**, e la richiesta parte dai server di OpenAI. Per
collegare in sicurezza un server **locale** senza esporre il Mac su internet si usa
il **Secure MCP Tunnel** di OpenAI (un programmino, `tunnel-client`, che fa solo
connessioni in uscita).

### Cosa ti serve

| Elemento | Dove |
|---|---|
| Piano **ChatGPT Plus o Pro** | (il gratuito non basta) |
| **Developer Mode** attivo | ChatGPT → Impostazioni → App e connettori → Impostazioni avanzate → Developer mode |
| **`tunnel-client`** (il programma del tunnel) | scaricalo da [platform.openai.com/settings/organization/tunnels](https://platform.openai.com/settings/organization/tunnels) |
| Un **`tunnel_id`** | stessa pagina Tunnels |
| Una **Runtime API key** | [platform.openai.com/settings/organization/api-keys](https://platform.openai.com/settings/organization/api-keys) |

> La API key serve **solo** ad autenticare il tunnel: le risposte dell'AI restano
> coperte dal tuo abbonamento ChatGPT. Serve però un account su **platform.openai.com**.

### Passi

**1. Avvia il tunnel puntandolo al connettore.** Due opzioni equivalenti:

**Opzione B1 — consigliata (il tunnel lancia direttamente il server stdio, niente altro da avviare):**
```bash
export CONTROL_PLANE_API_KEY="la-tua-runtime-api-key"

tunnel-client init \
  --sample sample_mcp_stdio_local \
  --profile illustrator \
  --tunnel-id tunnel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --mcp-command "node /percorso/assoluto/di/illustrator-mcp/dist/index.js"

tunnel-client doctor --profile illustrator --explain
tunnel-client run --profile illustrator      # lascialo in esecuzione
```

**Opzione B2 — alternativa (avvii tu il server in modalità HTTP e il tunnel lo raggiunge via URL locale):**
```bash
# In un terminale: avvia il connettore in modalità HTTP (ascolta su 127.0.0.1:3000/mcp)
cd /percorso/di/illustrator-mcp
npm run start:http
```
```bash
# In un altro terminale: collega il tunnel all'URL locale
export CONTROL_PLANE_API_KEY="la-tua-runtime-api-key"

tunnel-client init \
  --sample sample_mcp_remote_no_auth \
  --profile illustrator \
  --tunnel-id tunnel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  --mcp-server-url http://127.0.0.1:3000/mcp

tunnel-client run --profile illustrator      # lascialo in esecuzione
```
> La porta si cambia con `PORT=4000 npm run start:http`.

**2. Crea il connettore in ChatGPT.** *Mentre `tunnel-client run` è attivo e "healthy"*,
vai su ChatGPT → **Impostazioni → Connettori** ([chatgpt.com/#settings/Connectors](https://chatgpt.com/#settings/Connectors))
e aggiungi il connettore associato al tuo tunnel (segui le istruzioni: comparirà
l'endpoint del tunnel). Per i dettagli esatti del passaggio lato ChatGPT vedi la
[guida ufficiale Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).

**3. Usalo dall'app desktop.** Il connettore, creato dalle impostazioni, è disponibile
anche nell'**app desktop di ChatGPT sul Mac**: nel campo del messaggio attivalo dallo
strumento "Developer Mode" e scrivi i tuoi comandi. Le azioni che modificano
(creare forme, testo, ecc.) **richiedono una conferma** prima di essere eseguite.

Il tunnel deve restare **in esecuzione** finché usi il connettore.

---

## Riepilogo

| | Claude | ChatGPT |
|---|---|---|
| Trasporto | stdio (`node dist/index.js`) | HTTP + Secure MCP Tunnel |
| Setup | 3 passi | Developer Mode + tunnel + account Platform |
| Account extra | nessuno | account OpenAI Platform (API key) |
| Costo | incluso nell'abbonamento Claude | incluso in ChatGPT Plus/Pro (il tunnel è per l'autenticazione) |
| Esposizione internet | nessuna | nessuna (il tunnel è solo in uscita) |

---

## Problemi comuni

| Sintomo | Soluzione |
|---|---|
| *"Not authorized to control Illustrator"* (macOS) | Concedi il permesso in System Settings → Privacy & Security → Automation. |
| *"Could not reach Adobe Illustrator"* | Illustrator dev'essere installato e possibilmente già aperto. |
| ChatGPT non vede il connettore | Il `tunnel-client run` dev'essere attivo e "healthy"; il connettore va creato mentre il tunnel gira. |
| I comandi vanno in timeout | Illustrator potrebbe avere una finestra aperta: portalo in primo piano e chiudila. |
| Developer Mode non compare | Serve un piano ChatGPT Plus/Pro (o Business/Enterprise/Edu). |
