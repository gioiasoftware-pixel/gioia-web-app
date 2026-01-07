# Stato Attuale: Fix Refresh Android e Problema Input Tastiera

## Problema Originale

**Sintomo**: Su Android in verticale, quando si tocca il campo input chat e si apre la tastiera virtuale, la pagina sembra ricaricarsi/refreshare completamente.

**Condizioni specifiche**:
- ✅ **Android in verticale** → **SUCCEDE**
- ❌ Android in orizzontale → NON succede
- ❌ iPhone (verticale/orizzontale) → NON succede

**Log rilevato**:
```
resize: 831px → 501px (diff: 330px)
Warn [ChatSelectors] Cambio Viewport significativo (330px) - potrebbe essere tastiera
```

---

## Causa Root Identificata

**Non è**:
- ❌ Refresh voluto dal codice
- ❌ Problema di 100vh / 100dvh
- ❌ Submit form
- ❌ window.location.reload

**È**:
🎯 **"SOFT RELOAD" causato da Android Chrome + address bar + layout full-height**

**Meccanismo**:
1. Pagina è full-screen / app-like
2. In portrait
3. Tastiera riduce drasticamente l'altezza (330px)
4. Layout è costruito con elementi full height vincolati
5. Chrome nasconde/mostra top/bottom bar
6. → L'intero browsing context viene ricreato (non è vero reload, è reflow catastrofico)

**Perché solo Android portrait?**
- iPhone usa visual viewport corretta
- Landscape non alza subito address bar
- Solo Android Chrome in portrait ha questo comportamento

---

## Fix Applicati (in ordine cronologico)

### Fix 1: Meta Viewport - Cambiato `resizes-content` → `overlays-content`
**File**: `frontend/index.html`

**Cambio**:
```html
<!-- PRIMA -->
<meta name="viewport" content="..., interactive-widget=resizes-content">

<!-- DOPO -->
<meta name="viewport" content="..., interactive-widget=overlays-content">
```

**Motivazione**: 
- `resizes-content` = tastiera **riduce** altezza viewport → causa resize 330px → trigger refresh
- `overlays-content` = tastiera **sovrappone** contenuto → niente resize → niente refresh

**Risultato**: ✅ **RISOLTO** - Il refresh non avviene più

---

### Fix 2: Rimosso Vincoli Full-Height e Overflow Hidden
**File**: `frontend/layout/MobileLayout/mobile.css`

**Cambi**:
- `.mApp`: `height: 100vh` → `height: auto / min-height: 100vh`
- `.mApp`: rimosso `overflow: hidden`
- `.mMain`: rimosso `overflow: hidden`

**Motivazione**: Layout full-height con overflow bloccato + tastiera = layout shift che triggera refresh

**Risultato**: ✅ **RISOLTO** - Il refresh non avviene più

---

### Fix 3: Scroll Spostato da Container Custom a Body
**File**: `frontend/styles/legacy-fenced.css` e `frontend/layout/MobileLayout/mobile.css`

**Cambi**:
- `html/body`: aggiunto `overflow-y: auto`
- `.mScroller`: rimosso `overflow-y: auto` (ora `overflow: visible`)

**Motivazione**: Android Chrome gestisce meglio scroll sul body invece che su container custom

**Risultato**: ✅ **RISOLTO** - Il refresh non avviene più

---

### Fix 4: Rimosso method="post" dal Form
**File**: `frontend/index.html`

**Cambio**: Rimosso `method="post"`, aggiunto `novalidate`

**Risultato**: ✅ **RISOLTO** - Prevenzione aggiuntiva

---

### Fix 5: Logging Dettagliato
**File**: `frontend/features/chat/shared/chatSelectors.js`

**Aggiunto**: Logging completo per diagnosticare il problema

**Risultato**: ✅ **FUNZIONA** - I log mostrano correttamente cosa succede

---

### Fix 6: Rimosso window.location.reload()
**File**: `frontend/features/inventory/mobile/inventoryMobile.js`

**Cambio**: Rimosso `window.location.reload()` dal catch block

**Risultato**: ✅ **RISOLTO** - Prevenzione aggiuntiva

---

## Stato Attuale

### ✅ Problema Refresh: RISOLTO
Il refresh della pagina non avviene più quando si apre la tastiera su Android verticale.

### ❌ Problema Input: NON RISOLTO
**Nuovo problema**: La casella di testo (input chat) non si alza insieme alla tastiera, rendendo difficile vedere cosa si sta scrivendo.

**Cosa succede**:
- La tastiera si apre correttamente
- Il refresh non avviene più ✅
- Ma l'input rimane nella sua posizione originale
- L'input viene coperto dalla tastiera
- L'utente non vede cosa sta scrivendo

---

## Fix Tentati per Input (non funzionanti)

### Tentativo 1: Scroll Automatico con scrollIntoView
**File**: `frontend/features/chat/shared/chatSelectors.js`

**Cosa fa**: Scrolla l'input in view quando riceve focus

**Problema**: Con `overlays-content`, la tastiera sovrappone il contenuto ma non riduce il viewport, quindi `scrollIntoView` non funziona correttamente.

**Risultato**: ❌ **NON FUNZIONA**

---

### Tentativo 2: Padding-Bottom Dinamico
**File**: `frontend/features/chat/shared/chatSelectors.js`

**Cosa fa**: 
- Calcola altezza tastiera: `window.innerHeight - visualViewport.height`
- Aggiunge `padding-bottom` dinamico a `body/html` pari all'altezza tastiera + 20px
- Questo dovrebbe spingere tutto il contenuto verso l'alto

**Problema**: Non funziona come previsto - l'input non si alza ancora.

**Risultato**: ❌ **NON FUNZIONA COMPLETAMENTE**

---

## Perché l'Input Non Si Alza

### Problema con `overlays-content`
Con `interactive-widget=overlays-content`:
- ✅ La tastiera **non riduce** il viewport → niente resize → niente refresh
- ❌ Ma la tastiera **sovrappone** il contenuto
- ❌ L'input rimane nella sua posizione originale
- ❌ L'input viene coperto dalla tastiera

### Perché il padding-bottom non funziona
Il `padding-bottom` dinamico:
- Spinge il contenuto verso l'alto
- Ma l'input è `position: sticky` con `bottom: 0`
- Quindi l'input rimane attaccato al fondo del viewport
- Il padding-bottom spinge il contenuto sopra, ma l'input rimane dove è

---

## Soluzione Necessaria

### Opzione 1: Usare `position: fixed` per l'input quando tastiera è aperta
**Come funziona**:
- Quando input riceve focus → cambia a `position: fixed`
- Posiziona l'input sopra la tastiera usando `bottom: [altezza tastiera]`
- Quando input perde focus → torna a `position: sticky`

**Vantaggi**:
- L'input rimane sempre visibile sopra la tastiera
- Funziona con `overlays-content`

**Svantaggi**:
- Potrebbe causare problemi di layout se non gestito correttamente

---

### Opzione 2: Usare `env(keyboard-inset-height)` se disponibile
**Come funziona**:
- Alcuni browser supportano `env(keyboard-inset-height)` per ottenere altezza tastiera
- Usare questo valore per posizionare l'input

**Vantaggi**:
- Soluzione nativa del browser
- Più accurata

**Svantaggi**:
- Non supportato da tutti i browser
- Potrebbe non funzionare con `overlays-content`

---

### Opzione 3: Cambiare approccio - Usare `resizes-content` ma gestire meglio
**Come funziona**:
- Tornare a `interactive-widget=resizes-content`
- Ma gestire il resize in modo che non causi refresh
- Usare `visualViewport` API per posizionare l'input

**Vantaggi**:
- Con `resizes-content`, l'input si alza automaticamente
- Il browser gestisce il posizionamento

**Svantaggi**:
- Potrebbe causare di nuovo il refresh se non gestito correttamente
- Richiede fix più complessi

---

## File Modificati (Riepilogo)

1. `frontend/index.html` - Meta viewport e form
2. `frontend/features/inventory/mobile/inventoryMobile.js` - Rimosso reload()
3. `frontend/features/chat/shared/chatSelectors.js` - Logging e padding-bottom dinamico
4. `frontend/layout/MobileLayout/mobile.css` - Rimosso vincoli full-height
5. `frontend/styles/legacy-fenced.css` - Scroll sul body

---

## Cosa Serve Ora

**Obiettivo**: Far salire l'input insieme alla tastiera quando si apre.

**Approccio suggerito**:
1. Quando input riceve focus → rileva altezza tastiera usando `visualViewport`
2. Cambia `position: sticky` → `position: fixed` per l'input
3. Posiziona l'input sopra la tastiera: `bottom: [altezza tastiera]px`
4. Quando input perde focus → torna a `position: sticky`

**Alternativa**:
- Usare `env(keyboard-inset-height)` se supportato
- Oppure tornare a `resizes-content` ma con fix più robusti per prevenire refresh

---

## Note Tecniche

- **Layout attuale**: `.mComposer` è `position: sticky` con `bottom: 0`
- **Tastiera**: Con `overlays-content`, la tastiera sovrappone il contenuto
- **Viewport**: `window.innerHeight` non cambia con `overlays-content`
- **Visual Viewport**: `window.visualViewport.height` indica l'area visibile sopra la tastiera
- **Altezza tastiera**: `window.innerHeight - visualViewport.height`

---

## Test da Fare

1. Aprire app su Android verticale
2. Toccare input chat
3. Verificare che:
   - ✅ Tastiera si apra senza refresh
   - ❌ Input si alzi insieme alla tastiera (NON FUNZIONA)
   - ❌ Input rimanga visibile sopra la tastiera (NON FUNZIONA)

---

## Conclusione

Il problema del refresh è **risolto** cambiando a `overlays-content` e rimuovendo vincoli full-height.

Il nuovo problema è che l'input non si alza insieme alla tastiera. Serve una soluzione per posizionare l'input sopra la tastiera quando si apre, probabilmente usando `position: fixed` dinamico.

