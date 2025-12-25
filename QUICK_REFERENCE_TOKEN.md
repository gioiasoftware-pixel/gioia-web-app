# ⚡ Quick Reference: Riduzione Token Cursor

## 🎯 Comandi Essenziali

### In Cursor

| Azione | Comando | Risparmio Token |
|--------|---------|----------------|
| Riferimento file senza aprirlo | `@filename` | ~90% |
| Modifica inline | `Ctrl+K` | ~50% |
| Chat specifica | `Ctrl+L` + `@filename` | ~70% |
| Chiudi altri file | `Ctrl+K W` | ~80% |
| Chiudi tab | `Ctrl+W` | Variabile |

## 📋 Checklist Rapida

### Prima di Iniziare
- [ ] Chiudi file aperti non necessari
- [ ] Chiudi chat vecchie
- [ ] Apri max 3-5 file necessari

### Durante Sviluppo
- [ ] Usa `@filename` invece di aprire file
- [ ] Chiudi file quando non li usi
- [ ] Mantieni chat focused

### File da Evitare (se non necessario)
- ❌ `backend/app/services/ai_service.py` (2,765 righe)
- ❌ `frontend/app.js` (~4,877 righe)
- ❌ File `.md` di documentazione

## 🚨 Pattern da Evitare

### ❌ NON FARE:
```
1. Apri ai_service.py
2. Apri app.js  
3. Apri 5 file .md
4. "Analizza tutto il progetto"
= ~100k+ token
```

### ✅ FARE INVECE:
```
1. Usa @ai_service.py
2. "Mostra solo funzione X"
3. Modifica solo quella funzione
= ~5k token
```

## 💡 Esempi Pratici

### Esempio 1: Modifica Piccola
```
❌ [Apri file] "Modifica riga 150"
✅ "Modifica riga 150 in @filename"
```

### Esempio 2: Debug
```
❌ [Apri 5 file] "Trova il bug"
✅ "Errore in @app.js riga 234, mostra solo quella funzione"
```

### Esempio 3: Refactoring
```
❌ [Apri file grande] "Rifattorizza tutto"
✅ "Analizza classe X in @filename e suggerisci moduli"
```

## 📊 File Grandi da Monitorare

| File | Righe | Token Stimati | Priorità Refactoring |
|------|-------|---------------|---------------------|
| `ai_service.py` | 2,765 | ~33,000 | 🔴 Alta |
| `app.js` | ~4,877 | ~50,000 | 🔴 Alta |
| `ChatMobile.js` | ~1,000+ | ~12,000 | 🟡 Media |
| `database.py` | ~500+ | ~6,000 | 🟢 Bassa |

## 🎯 Obiettivo

**Ridurre consumo token del 70-80%** mantenendo produttività.

## 📞 Quando Usare Cosa

| Scenario | Tool | Token Stimati |
|----------|------|---------------|
| Modifica 1-5 righe | `Ctrl+K` inline | ~1,000-2,000 |
| Domanda su funzione | Chat + `@filename` | ~3,000-5,000 |
| Analisi file specifico | Chat + `@filename` + "solo X" | ~5,000-10,000 |
| Refactoring grande | Chat + "analizza struttura" | ~10,000-20,000 |

---

**Ricorda:** Ogni file aperto = token consumati. Usa `@filename` quando possibile!

