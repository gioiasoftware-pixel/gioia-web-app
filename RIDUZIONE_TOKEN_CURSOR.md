# 🎯 Guida alla Riduzione Token in Cursor

## 📊 Analisi Problemi Identificati

### File Molto Grandi (Alto Consumo Token)

1. **`backend/app/services/ai_service.py`** - **2,765 righe** ⚠️ CRITICO
   - File monolitico con tutta la logica AI
   - Ogni volta che lo apri, Cursor carica ~33,000 token
   - **Raccomandazione**: Refactoring urgente in moduli più piccoli

2. **`frontend/app.js`** - **~4,877 righe** ⚠️ CRITICO
   - File JavaScript monolitico con tutta la logica frontend
   - **Raccomandazione**: Suddividere in moduli più piccoli

3. **File di Documentazione `.md`** - Molti file grandi
   - `DOCUMENTAZIONE_LAYOUT_MOBILE.md`
   - `DOCUMENTAZIONE_LAYOUT_DESKTOP.md`
   - `COST_ANALYSIS.md`
   - **Raccomandazione**: Non aprire se non necessario

## 🚨 Azioni Immediate (Alta Priorità)

### 1. **Non Aprire File Grandi Inutilmente**

**❌ EVITA:**
- Aprire `ai_service.py` se stai lavorando su una piccola modifica
- Aprire `app.js` se stai modificando solo una feature specifica
- Aprire file `.md` di documentazione durante lo sviluppo

**✅ FAI INVECE:**
- Usa `@filename` per riferirti a file specifici senza aprirli
- Usa la ricerca nel codice (`Ctrl+Shift+F`) invece di aprire file grandi
- Apri solo le sezioni che ti servono

### 2. **Usa Comandi Cursor in Modo Efficiente**

**Comando Inline (`Ctrl+K`):**
- Per modifiche locali a poche righe
- Non carica tutto il contesto del file

**Chat (`Ctrl+L`):**
- Per domande specifiche
- Menziona file con `@filename` invece di aprirli

**❌ EVITA:**
- Chiedere "analizza tutto il progetto"
- Chiedere "rifattorizza tutto"
- Aprire 10+ file contemporaneamente

### 3. **Chiudi File Non Necessari**

**Checklist:**
- [ ] Chiudi file `.md` dopo averli letti
- [ ] Chiudi file grandi quando non li stai modificando
- [ ] Usa "Close Others" per mantenere solo il file corrente aperto

## 🔧 Refactoring Consigliato (Riduzione Permanente)

### Priorità 1: Refactoring `ai_service.py`

**Problema:** File monolitico di 2,765 righe

**Soluzione:** Suddividere in moduli:

```
backend/app/services/
├── ai_service.py (solo orchestratore, ~200 righe)
├── ai_handlers/
│   ├── movement_handler.py
│   ├── query_handler.py
│   ├── analytics_handler.py
│   ├── wine_handler.py
│   └── report_handler.py
└── ai_utils/
    ├── prompt_builder.py
    ├── response_formatter.py
    └── context_manager.py
```

**Beneficio:** 
- Riduce token da ~33,000 a ~2,000-5,000 per file
- Più facile da mantenere
- Più veloce da navigare

### Priorità 2: Refactoring `app.js`

**Problema:** File monolitico di ~4,877 righe

**Soluzione:** Suddividere in moduli ES6:

```
frontend/
├── app.js (solo inizializzazione, ~100 righe)
├── modules/
│   ├── auth.js
│   ├── chat.js
│   ├── inventory.js
│   ├── viewer.js
│   ├── charts.js
│   └── notifications.js
└── utils/
    ├── api.js
    ├── storage.js
    └── helpers.js
```

**Beneficio:**
- Riduce token da ~50,000+ a ~5,000-10,000 per file
- Migliore organizzazione
- Più facile da testare

## 📋 Best Practices per Ridurre Token

### 1. **Gestione Conversazioni**

**❌ EVITA:**
- Mantenere chat vecchie aperte
- Accumulare 50+ messaggi in una conversazione

**✅ FAI:**
- Chiudi chat quando completi un task
- Inizia nuove conversazioni per nuovi task
- Usa "New Chat" frequentemente

### 2. **Richieste Specifiche**

**❌ EVITA:**
- "Analizza tutto il progetto"
- "Rifattorizza tutto"
- "Trova tutti i bug"

**✅ FAI:**
- "Analizza solo `@ai_service.py` per problemi di performance"
- "Rifattorizza la funzione `process_message` in `@ai_service.py`"
- "Cerca pattern X in `@filename`"

### 3. **Uso di @filename**

**Esempio Efficace:**
```
"Modifica la funzione process_message in @ai_service.py 
per aggiungere logging"
```

**Esempio Inefficace:**
```
[Apri ai_service.py manualmente]
"Modifica la funzione process_message per aggiungere logging"
```

### 4. **Limitare Contesto**

**❌ EVITA:**
- Aprire cartelle intere (`backend/`, `frontend/`)
- Aprire tutti i file di un modulo insieme

**✅ FAI:**
- Apri solo file specifici
- Usa `@directory` per riferirti a directory senza aprirle

## 🎯 Strategia di Sviluppo Ottimizzata

### Workflow Consigliato:

1. **Inizio Task:**
   - Apri solo file necessari (max 3-5 file)
   - Usa `@filename` per riferimenti

2. **Durante Sviluppo:**
   - Mantieni aperto solo il file su cui stai lavorando
   - Usa ricerca invece di aprire file grandi

3. **Fine Task:**
   - Chiudi tutti i file aperti
   - Chiudi chat corrente
   - Inizia nuova conversazione per prossimo task

### Esempio Pratico:

**❌ Approccio Inefficiente:**
```
1. Apri ai_service.py (33k token)
2. Apri app.js (50k token)
3. Apri 5 file .md (20k token)
4. Chiedi "analizza tutto"
= ~103k token consumati
```

**✅ Approccio Efficiente:**
```
1. Usa @ai_service.py per riferimento
2. Chiedi "mostra solo la funzione process_message"
3. Modifica solo quella funzione
= ~5k token consumati
```

## 📈 Monitoraggio Consumo

### Come Monitorare:

1. **Dashboard Cursor:**
   - Controlla uso token nel pannello
   - Identifica pattern di alto consumo

2. **Pattern da Evitare:**
   - Sessioni con 10+ file aperti
   - Chat con 50+ messaggi
   - Richieste generiche "analizza tutto"

3. **Metriche Target:**
   - Max 3-5 file aperti contemporaneamente
   - Max 20-30 messaggi per conversazione
   - File aperti < 1,000 righe ciascuno

## 🚀 Quick Wins (Implementazione Immediata)

### 1. Crea `.cursorignore` (se non esiste)

Aggiungi file che non vuoi che Cursor analizzi:

```
# File di documentazione grandi
*.md
docs/

# File generati
node_modules/
__pycache__/
*.pyc
dist/
build/

# File di backup
backup_*/
*.bak
```

### 2. Organizza Workspace

**Struttura Consigliata:**
- Lavora su un file alla volta
- Usa "File Explorer" per navigare, non aprire tutto
- Chiudi tab non necessari

### 3. Usa Snippets e Templates

**Invece di:**
- Chiedere all'AI di generare codice ogni volta

**Crea:**
- Snippets per pattern comuni
- Templates per nuovi file
- Snippet library personale

## 📝 Checklist Giornaliera

Prima di iniziare a lavorare:

- [ ] Chiudi tutti i file aperti dal giorno precedente
- [ ] Chiudi chat vecchie
- [ ] Apri solo file necessari per il task corrente
- [ ] Usa `@filename` invece di aprire file grandi
- [ ] Limita a max 3-5 file aperti

Durante lo sviluppo:

- [ ] Chiudi file quando non li usi più
- [ ] Usa ricerca invece di aprire file grandi
- [ ] Mantieni chat focused su un task
- [ ] Evita richieste generiche

Fine giornata:

- [ ] Chiudi tutti i file
- [ ] Chiudi tutte le chat
- [ ] Verifica consumo token nel dashboard

## 🎓 Esempi Pratici

### Esempio 1: Modifica Piccola

**❌ Inefficiente:**
```
[Apri ai_service.py - 33k token]
"Modifica la riga 150 per aggiungere un log"
```

**✅ Efficiente:**
```
"Mostra solo la funzione process_message in @ai_service.py"
[Ricevi solo quella funzione - 500 token]
"Modifica per aggiungere logging alla riga 150"
```

### Esempio 2: Debug

**❌ Inefficiente:**
```
[Apri app.js - 50k token]
[Apri ai_service.py - 33k token]
[Apri 3 altri file - 15k token]
"Trova il bug"
```

**✅ Efficiente:**
```
"Ho un errore in @app.js alla riga 234, 
mostra solo quella funzione e le dipendenze"
[Ricevi solo contesto rilevante - 2k token]
```

### Esempio 3: Refactoring

**❌ Inefficiente:**
```
[Apri ai_service.py - 33k token]
"Rifattorizza tutto il file"
```

**✅ Efficiente:**
```
"Analizza solo la classe AIService in @ai_service.py 
e suggerisci come suddividerla in moduli più piccoli"
[Ricevi solo analisi - 5k token]
```

## 🔄 Piano di Refactoring Prioritario

### Fase 1 (Settimana 1): Quick Wins
- [ ] Creare `.cursorignore`
- [ ] Documentare workflow ottimizzato
- [ ] Formare team su best practices

### Fase 2 (Settimana 2-3): Refactoring `ai_service.py`
- [ ] Identificare funzioni da estrarre
- [ ] Creare moduli `ai_handlers/`
- [ ] Migrare funzionalità gradualmente
- [ ] Testare dopo ogni migrazione

### Fase 3 (Settimana 4-5): Refactoring `app.js`
- [ ] Identificare moduli da estrarre
- [ ] Creare struttura `modules/`
- [ ] Migrare funzionalità gradualmente
- [ ] Testare dopo ogni migrazione

## 📊 Stima Risparmio Token

### Prima (Situazione Attuale):
- File aperti: 10-15 file
- Token medi per sessione: ~100,000-200,000
- Consumo giornaliero: ~500,000-1,000,000 token

### Dopo Ottimizzazioni:
- File aperti: 3-5 file
- Token medi per sessione: ~20,000-50,000
- Consumo giornaliero: ~100,000-250,000 token

**Risparmio Stimato: 70-80%** 🎉

## 🎯 Obiettivo Finale

Ridurre consumo token del **70-80%** mantenendo la stessa produttività, attraverso:

1. ✅ Workflow ottimizzato
2. ✅ File più piccoli e modulari
3. ✅ Uso efficiente di Cursor
4. ✅ Best practices consolidate

---

**Ultimo aggiornamento:** 2025-01-XX  
**Autore:** Analisi automatica codebase

