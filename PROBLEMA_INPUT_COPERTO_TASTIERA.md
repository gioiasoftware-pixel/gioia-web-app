# Problema: Input Chat Coperto dalla Tastiera su Android

## Problema Attuale

**Sintomo**: Su Android in verticale, quando si tocca il campo input chat e si apre la tastiera virtuale, la casella di testo viene coperta dalla tastiera e non si alza insieme ad essa.

**Risultato**: L'utente non vede cosa sta scrivendo perché l'input è nascosto sotto la tastiera.

**Condizioni**:
- ✅ Android in verticale → **SUCCEDE**
- ❌ Android in orizzontale → Non testato
- ❌ iPhone → Non testato

---

## Contesto: Fix Precedente per Refresh

**Problema precedente**: La pagina si refreshava quando si apriva la tastiera.

**Soluzione applicata**:
1. Cambiato meta viewport: `interactive-widget=resizes-content` → `interactive-widget=overlays-content`
2. Rimosso vincoli full-height e overflow hidden
3. Scroll spostato da container custom a body

**Risultato**: ✅ Il refresh è risolto, ma ora l'input non si alza con la tastiera.

---

## Perché l'Input Non Si Alza

### Con `interactive-widget=overlays-content`:

**Comportamento**:
- ✅ La tastiera **sovrappone** il contenuto (non lo sposta)
- ✅ Non riduce il viewport → niente resize → niente refresh
- ❌ Ma l'input rimane nella sua posizione originale
- ❌ L'input viene coperto dalla tastiera

### Layout Attuale:

**CSS dell'input** (`.mComposer`):
```css
.mobileRoot .mComposer {
    position: sticky !important;
    bottom: 0 !important;
    /* ... */
}
```

**Problema**:
- `position: sticky` con `bottom: 0` mantiene l'input attaccato al fondo del viewport
- Con `overlays-content`, la tastiera sovrappone il contenuto ma non sposta nulla
- L'input rimane dove è e viene coperto

---

## Fix Tentati (Non Funzionanti)

### Tentativo 1: Scroll Automatico con `scrollIntoView`

**File**: `frontend/features/chat/shared/chatSelectors.js`

**Cosa fa**:
```javascript
chatInput.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' });
```

**Problema**:
- Con `overlays-content`, `scrollIntoView` non funziona correttamente
- La tastiera sovrappone il contenuto ma non riduce il viewport
- `scrollIntoView` scrolla rispetto al viewport completo, non all'area visibile sopra la tastiera

**Risultato**: ❌ **NON FUNZIONA**

---

### Tentativo 2: Scroll con Visual Viewport API

**File**: `frontend/features/chat/shared/chatSelectors.js`

**Cosa fa**:
```javascript
if (window.visualViewport) {
    const vvp = window.visualViewport;
    const inputRect = chatInput.getBoundingClientRect();
    const inputBottom = inputRect.bottom;
    const viewportBottom = vvp.height;
    
    if (inputBottom > viewportBottom) {
        const scrollAmount = inputBottom - viewportBottom + 20;
        window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    }
}
```

**Problema**:
- Calcola correttamente la posizione dell'input rispetto alla viewport visibile
- Ma l'input è `position: sticky` con `bottom: 0`
- Anche se scrolla, l'input rimane attaccato al fondo del viewport
- Il scroll sposta il contenuto sopra, ma l'input rimane dove è

**Risultato**: ❌ **NON FUNZIONA**

---

### Tentativo 3: Padding-Bottom Dinamico al Body

**File**: `frontend/features/chat/shared/chatSelectors.js`

**Cosa fa**:
```javascript
// Quando input riceve focus
const keyboardHeight = window.innerHeight - visualViewport.height;
const paddingBottom = keyboardHeight + 20;
document.body.style.paddingBottom = `${paddingBottom}px`;
document.documentElement.style.paddingBottom = `${paddingBottom}px`;
```

**Problema**:
- Il padding-bottom spinge tutto il contenuto verso l'alto
- Ma l'input è `position: sticky` con `bottom: 0`
- L'input rimane attaccato al fondo del viewport, non al contenuto
- Il padding-bottom spinge il contenuto sopra, ma l'input rimane dove è

**Risultato**: ❌ **NON FUNZIONA**

---

### Tentativo 4: Padding-Bottom Dinamico + Scroll

**File**: `frontend/features/chat/shared/chatSelectors.js`

**Cosa fa**:
- Combina padding-bottom dinamico + scroll automatico
- Aggiusta padding quando `visualViewport` si riduce

**Problema**:
- Stesso problema: l'input è `position: sticky` quindi rimane attaccato al fondo
- Il padding e lo scroll spostano il contenuto, ma non l'input

**Risultato**: ❌ **NON FUNZIONA**

---

## Perché i Fix Non Funzionano

### Il Problema Fondamentale:

**`position: sticky` con `bottom: 0`**:
- L'input è "incollato" al fondo del viewport
- Non si muove con il contenuto quando si scrolla
- Non si muove quando si aggiunge padding-bottom
- Rimane sempre nella stessa posizione relativa al viewport

**Con `overlays-content`**:
- La tastiera sovrappone il contenuto
- Il viewport non cambia dimensione
- L'input rimane dove è (attaccato al fondo)
- La tastiera copre l'input

---

## Soluzione Necessaria

### Opzione 1: Cambiare `position: sticky` → `position: fixed` quando tastiera si apre

**Come funziona**:
1. Quando input riceve focus → rileva altezza tastiera: `window.innerHeight - visualViewport.height`
2. Cambia `.mComposer` da `position: sticky` → `position: fixed`
3. Posiziona l'input sopra la tastiera: `bottom: [altezza tastiera]px`
4. Quando input perde focus → torna a `position: sticky`

**Vantaggi**:
- L'input rimane sempre visibile sopra la tastiera
- Funziona con `overlays-content`
- Non causa refresh

**Svantaggi**:
- Richiede JavaScript per cambiare position
- Potrebbe causare problemi di layout se non gestito correttamente

---

### Opzione 2: Usare `env(keyboard-inset-height)` se supportato

**Come funziona**:
```css
.mobileRoot .mComposer {
    position: sticky;
    bottom: env(keyboard-inset-height, 0px);
}
```

**Vantaggi**:
- Soluzione nativa del browser
- Più accurata
- Non richiede JavaScript

**Svantaggi**:
- Non supportato da tutti i browser
- Potrebbe non funzionare con `overlays-content`

---

### Opzione 3: Cambiare approccio - Tornare a `resizes-content` ma gestire meglio

**Come funziona**:
- Tornare a `interactive-widget=resizes-content`
- Ma gestire il resize in modo che non causi refresh
- Con `resizes-content`, l'input si alza automaticamente

**Vantaggi**:
- Con `resizes-content`, l'input si alza automaticamente
- Il browser gestisce il posizionamento
- Non richiede JavaScript complesso

**Svantaggi**:
- Potrebbe causare di nuovo il refresh se non gestito correttamente
- Richiede fix più complessi per prevenire refresh

---

## File Modificati (Riepilogo)

1. **`frontend/features/chat/shared/chatSelectors.js`**
   - Aggiunto listener `focus` con scroll automatico
   - Aggiunto listener `visualViewport resize` con scroll automatico
   - Aggiunto padding-bottom dinamico al body
   - Aggiunto listener `blur` per rimuovere padding-bottom

2. **`frontend/layout/MobileLayout/mobile.css`**
   - `.mComposer` è `position: sticky` con `bottom: 0`

---

## Stato Attuale del Codice

### Listener Focus (chatSelectors.js):
```javascript
chatInput.addEventListener('focus', (e) => {
    // Calcola altezza tastiera
    const keyboardHeight = window.innerHeight - visualViewport.height;
    
    // Aggiunge padding-bottom al body
    const paddingBottom = keyboardHeight + 20;
    document.body.style.paddingBottom = `${paddingBottom}px`;
    
    // Scrolla input in view
    chatInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
});
```

### Listener Visual Viewport Resize (chatSelectors.js):
```javascript
window.visualViewport.addEventListener('resize', () => {
    if (chatInput && document.activeElement === chatInput) {
        const keyboardHeight = window.innerHeight - visualViewport.height;
        const paddingBottom = keyboardHeight + 20;
        document.body.style.paddingBottom = `${paddingBottom}px`;
        chatInput.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
});
```

### CSS (mobile.css):
```css
.mobileRoot .mComposer {
    position: sticky !important;
    bottom: 0 !important;
    /* ... */
}
```

---

## Conclusione

**Problema**: L'input è `position: sticky` con `bottom: 0`, quindi rimane attaccato al fondo del viewport. Con `overlays-content`, la tastiera sovrappone il contenuto ma non sposta nulla, quindi l'input viene coperto.

**Fix tentati**: Scroll automatico, padding-bottom dinamico, combinazioni di entrambi. Nessuno funziona perché l'input è sticky e rimane sempre nella stessa posizione.

**Soluzione necessaria**: Cambiare `position: sticky` → `position: fixed` quando la tastiera si apre, posizionando l'input sopra la tastiera usando `bottom: [altezza tastiera]px`.

