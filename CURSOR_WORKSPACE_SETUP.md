# 🚀 Setup Workspace Cursor per Riduzione Token

## ✅ Configurazione Automatica

Questo file ti aiuta a configurare Cursor per ridurre il consumo di token.

## 📋 Checklist Setup Immediato

### 1. Verifica `.cursorignore`
✅ Il file `.cursorignore` è già configurato nella root del progetto
✅ Esclude file grandi e non necessari dall'analisi automatica

### 2. Chiudi File Non Necessari ORA
- [ ] Chiudi tutti i file aperti che non stai modificando
- [ ] Usa "Close Others" (Ctrl+K W) per mantenere solo file necessario
- [ ] Max 3-5 file aperti contemporaneamente

### 3. Chiudi Chat Vecchie
- [ ] Chiudi tutte le conversazioni vecchie
- [ ] Inizia una nuova chat per ogni nuovo task

### 4. File da NON Aprire (usare @filename invece)
- ❌ `backend/app/services/ai_service.py` (2,765 righe)
- ❌ `frontend/app.js` (~4,877 righe)
- ❌ `frontend/features/chat/mobile/ChatMobile.js` (~2,465 righe)
- ❌ File `.md` di documentazione grandi

## 🎯 Workflow Ottimizzato

### Quando Inizi un Nuovo Task:

1. **Chiudi tutto** (Ctrl+K W)
2. **Apri solo file necessari** (max 3-5)
3. **Usa @filename per riferimenti** invece di aprire file grandi
4. **Inizia nuova chat** per il nuovo task

### Durante lo Sviluppo:

- ✅ Usa `Ctrl+K` per modifiche inline (non chat)
- ✅ Usa `@filename` per riferire file senza aprirli
- ✅ Chiudi file quando non li usi più
- ✅ Mantieni chat focused su un solo task

### Quando Finisci:

- ✅ Chiudi tutti i file
- ✅ Chiudi la chat corrente
- ✅ Verifica consumo token nel dashboard

## 💡 Esempi Pratici di Uso

### Esempio 1: Modificare una funzione
```
❌ NON FARE:
1. Apri ai_service.py (33k token caricati)
2. "Modifica la funzione process_message"

✅ FARE INVECE:
1. "Mostra solo la funzione process_message in @ai_service.py"
2. Modifica solo quella funzione
3. Chiudi il file dopo
```

### Esempio 2: Debug
```
❌ NON FARE:
1. Apri ai_service.py
2. Apri app.js
3. Apri database.py
4. "Trova il bug"

✅ FARE INVECE:
1. "Errore nella chat: [descrivi errore], analizza solo @chatAPI.js"
2. Se necessario, chiedi "mostra solo la funzione X in @ai_service.py"
```

### Esempio 3: Analisi
```
❌ NON FARE:
1. Apri tutti i file del progetto
2. "Analizza tutto il codice"

✅ FARE INVECE:
1. "Analizza solo la struttura di @ai_service.py per suggerire refactoring"
2. Oppure: "Mostra solo le funzioni che gestiscono movimenti in @ai_service.py"
```

## 📊 Monitoraggio

### Dashboard Cursor
- Controlla uso token: Menu → Settings → Usage
- Identifica pattern di alto consumo
- Monitora sessioni lunghe

### Metriche Target
- **Max file aperti**: 3-5 contemporaneamente
- **Max righe per file aperto**: < 1,000 righe
- **Max messaggi per chat**: 20-30
- **Uso @filename**: 80%+ delle volte

## 🔧 Configurazione Cursor Settings

Vai su: `File → Preferences → Settings` (o `Ctrl+,`)

### Impostazioni Consigliate:

1. **Auto-save**: Abilita per salvare automaticamente
2. **File Watcher**: Riduci per file molto grandi
3. **Max File Size**: Imposta limite (es: 1MB)

## 🎓 Training Sviluppatore

### Settimana 1: Formazione
- Leggi `RIDUZIONE_TOKEN_CURSOR.md`
- Leggi `QUICK_REFERENCE_TOKEN.md`
- Pratica con @filename su file grandi

### Settimana 2: Abitudini
- Usa sempre @filename per file > 500 righe
- Limita file aperti a 3-5
- Chiudi chat ogni task completato

### Settimana 3: Ottimizzazione
- Monitora consumo token
- Identifica pattern inefficienti
- Ottimizza workflow personale

## 🚨 Warning Segni di Alto Consumo

Se vedi questi pattern, stai consumando troppi token:

- ⚠️ 10+ file aperti contemporaneamente
- ⚠️ Chat con 50+ messaggi
- ⚠️ File grandi (1000+ righe) aperti senza motivo
- ⚠️ Richieste generiche "analizza tutto"
- ⚠️ Sessioni di lavoro > 2 ore senza riavvio

## ✅ Quick Win Checklist

Usa questa checklist ogni giorno:

- [ ] Max 5 file aperti
- [ ] Usato @filename per file grandi
- [ ] Chat focused su un solo task
- [ ] File chiusi quando non necessari
- [ ] Nuova chat per nuovo task

---

**Ultimo aggiornamento**: 2025-01-XX  
**Prossimo step**: Dopo 1 settimana, considera refactoring file grandi

