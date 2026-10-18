# Deutsch Tracker

PWA per tracciare le ore di tedesco, i metodi che funzionano e la costanza verso il B1.
HTML/CSS/JS vanilla, nessun build step. I dati restano sul telefono (IndexedDB).

## Pubblicare su GitHub Pages

```bash
cd german-tracker
git init && git add . && git commit -m "Deutsch Tracker v1"
git branch -M main
git remote add origin git@github.com:isBre/german-tracker.git
git push -u origin main
```

Poi su GitHub: **Settings → Pages → Deploy from a branch → main / (root)**.
Dopo un minuto l'app è su `https://isbre.github.io/german-tracker/`.

## Installare sull'iPhone

1. Apri il link in **Safari** (non Chrome: su iOS solo Safari installa le PWA).
2. **Condividi → Aggiungi alla schermata Home**.
3. Aprila sempre dall'icona: i dati sono legati all'app installata, non alla scheda di Safari.

## Provarla in locale

```bash
python3 -m http.server 8000   # poi apri http://localhost:8000
```

## Struttura

| File | Cosa fa |
|---|---|
| `index.html` | Layout: 4 tab (Oggi, Statistiche, Storico, Impostazioni) + dialog |
| `app.js` | Logica, calcoli (streak, proiezione, statistiche per metodo), render |
| `db.js` | Storage layer su IndexedDB. Per passare a un backend (es. Supabase) si cambia solo questo file |
| `style.css` | Stile, dark/light automatico |
| `sw.js` | Service worker per l'uso offline (network-first) |
| `manifest.json` | Metadati PWA |

## Aggiornamenti

Fai push e riapri l'app: il service worker scarica la nuova versione quando sei online.
Se aggiungi file nuovi, aggiungili alla lista `ASSETS` in `sw.js` e aumenta `CACHE` (es. `dt-v2`).

## Backup

Impostazioni → **Esporta backup** salva un JSON (in File o iCloud Drive).
**Importa backup** lo ripristina. L'app ti ricorda di farlo ogni 2 settimane.
