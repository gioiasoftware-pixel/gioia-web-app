# Problema: Popup di test non appare quando si clicca su bottoni wine cards

## CONTESTO
Stiamo lavorando su un'applicazione web per gestione inventario vini. Abbiamo implementato un sistema di "wine cards" che vengono generate dalla chat AI quando restituisce risultati multipli. Queste cards hanno bottoni rossi (`.wines-list-item-button`) che permettono di:
1. Confermare movimenti (consumo/rifornimento) su un vino specifico
2. Cercare informazioni su un vino specifico

**Obiettivo**: Vogliamo mostrare un popup di test quando viene cliccato uno di questi bottoni per verificare che il click funzioni correttamente.

**Problema**: Il popup NON appare quando clicchiamo sui bottoni, anche se vediamo feedback visivo (il bottone cambia stato).

---

## STRUTTURA DEL CODICE

### File principale: `wineCardButtons.js`
Questo file contiene:
1. `showWineCardTestPopup()` - Funzione che crea e mostra il popup
2. `setupWineCardMovementButtons()` - Funzione che setup i listener sui bottoni

### Integrazione: `ChatDesktop.js`
Quando viene aggiunto un messaggio HTML con wine cards, chiama `window.WineCardButtons.setup(messageElement)` dopo 100ms.

---

## CODICE COMPLETO

### 1. Funzione popup (`showWineCardTestPopup`)

```javascript
function showWineCardTestPopup(title, message, type = 'info') {
    // Crea popup temporaneo
    const popup = document.createElement('div');
    popup.className = 'wine-card-test-popup';
    popup.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 99999;
        font-size: 14px;
        font-weight: 500;
        max-width: 90%;
        text-align: center;
        animation: slideDownPopup 0.3s ease-out;
        pointer-events: none;
    `;
    
    popup.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
        <div style="font-size: 12px; opacity: 0.9;">${message}</div>
    `;
    
    // Aggiungi animazione CSS se non esiste
    if (!document.getElementById('wine-card-popup-style')) {
        const style = document.createElement('style');
        style.id = 'wine-card-popup-style';
        style.textContent = `
            @keyframes slideDownPopup {
                from {
                    opacity: 0;
                    transform: translateX(-50%) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(popup);
    
    // Rimuovi dopo 3 secondi
    setTimeout(() => {
        popup.style.animation = 'slideDownPopup 0.3s ease-out reverse';
        setTimeout(() => {
            if (popup.parentNode) {
                popup.remove();
            }
        }, 300);
    }, 3000);
}
```

### 2. Setup listener bottoni (`setupWineCardMovementButtons`)

```javascript
function setupWineCardMovementButtons(messageElement) {
    if (!messageElement) {
        console.warn('[WineCardButtons] messageElement non fornito');
        return;
    }
    
    // Cerca tutti i pulsanti di movimento (.wines-list-item-button e .chat-button)
    const buttonElements = messageElement.querySelectorAll('.chat-button, .wines-list-item-button');
    
    if (buttonElements.length === 0) {
        console.log('[WineCardButtons] Nessun bottone movimento trovato nel messaggio');
        return;
    }
    
    console.log(`[WineCardButtons] ✅ Trovati ${buttonElements.length} bottoni movimento da collegare`);
    
    // Determina layout (mobile o desktop)
    const isMobile = window.LayoutBoundary?.isMobileNamespace() || 
                     document.documentElement.classList.contains('mobileRoot');
    
    buttonElements.forEach((btn, index) => {
        // Rimuovi listener esistenti clonando il bottone
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        // Leggi data attributes dal pulsante
        const wineId = newBtn.dataset.wineId || newBtn.getAttribute('data-wine-id');
        const wineText = newBtn.dataset.wineText || newBtn.getAttribute('data-wine-text');
        const movementType = newBtn.dataset.movementType || newBtn.getAttribute('data-movement-type');
        const quantity = newBtn.dataset.quantity || newBtn.getAttribute('data-quantity');
        
        console.log(`[WineCardButtons] 🔗 Collegamento listener bottone ${index + 1}:`, {
            wineId,
            wineText,
            movementType,
            quantity,
            hasMovementData: !!(movementType && quantity && wineId),
            isMobile,
            buttonClass: newBtn.className,
            buttonText: newBtn.textContent?.trim().substring(0, 30)
        });
        
        // Aggiungi listener - supporta sia click che pointerup per mobile
        const handleClick = async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            console.log('[WineCardButtons] 🎯 CLICK RILEVATO sul bottone movimento!', {
                wineId,
                wineText,
                movementType,
                quantity,
                eventType: e.type,
                isMobile
            });
            
            // Leggi data attributes al momento del click (per sicurezza)
            const clickWineId = newBtn.dataset.wineId || newBtn.getAttribute('data-wine-id');
            const clickWineText = newBtn.dataset.wineText || newBtn.getAttribute('data-wine-text');
            const clickMovementType = newBtn.dataset.movementType || newBtn.getAttribute('data-movement-type');
            const clickQuantity = newBtn.dataset.quantity || newBtn.getAttribute('data-quantity');
            
            // MOSTRA POPUP DI TEST
            if (clickMovementType && clickQuantity && clickWineId) {
                showWineCardTestPopup(
                    '✅ Movimento rilevato',
                    `${clickMovementType} di ${clickQuantity} bottiglie per vino ID: ${clickWineId}`,
                    'success'
                );
            } else {
                showWineCardTestPopup(
                    '✅ Click rilevato',
                    `Ricerca info per: ${clickWineText || 'vino'}`,
                    'info'
                );
            }
            
            // ... resto del codice per invio messaggio ...
        };
        
        // Aggiungi listener multipli per compatibilità mobile/desktop
        newBtn.addEventListener('click', handleClick, { passive: false });
        newBtn.addEventListener('pointerup', handleClick, { passive: false });
        
        // Su mobile, aggiungi anche touchstart per migliore risposta
        if (isMobile) {
            newBtn.addEventListener('touchstart', (e) => {
                e.stopPropagation();
            }, { passive: false });
        }
    });
    
    console.log('[WineCardButtons] ✅ Setup bottoni movimento completato');
}
```

### 3. Integrazione in ChatDesktop

```javascript
function addChatMessageDesktop(role, content, isLoading = false, isError = false, wineData = null, isHtml = false) {
    const selectors = window.ChatSelectors?.get();
    const scrollContainer = selectors?.scrollContainer();
    
    if (!scrollContainer) {
        console.error('[ChatDesktop] Scroll container non trovato');
        return null;
    }
    
    // Usa la funzione esistente addChatMessage che gestisce entrambi i layout
    const messageElement = addChatMessage(role, content, isLoading, isError, wineData, isHtml);
    
    // Setup bottoni wine card se è HTML con wine card
    if (isHtml && role === 'ai' && messageElement && window.WineCardButtons) {
        setTimeout(() => {
            window.WineCardButtons.setup(messageElement);
        }, 100);
    }
    
    return messageElement;
}
```

---

## STRUTTURA HTML GENERATA (Wines List Card)

Il backend genera HTML tipo:

```html
<div class="wines-list-card">
  <div class="wines-list-header">
    <h3 class="wines-list-title">Trovati 3 vini</h3>
    <span class="wines-list-query">per "Cuvee"</span>
  </div>
  <div class="wines-list-body">
    <div class="wines-list-item">
      <div class="wines-list-item-content">
        <span class="wines-list-item-name">Cuvee Prestige</span>
        <span class="wines-list-item-producer">Ca Del Bosco</span>
        <span class="wines-list-item-qty">23 bott.</span>
      </div>
      <button class="wines-list-item-button chat-button"
              data-wine-id="123"
              data-wine-text="Cuvee Prestige (Ca Del Bosco)"
              data-movement-type="consumo"
              data-quantity="10">
        Cuvee Prestige (Ca Del Bosco)
      </button>
    </div>
  </div>
</div>
```

Questo HTML viene inserito dentro un elemento `<div class="chat-message ai">` che è il `messageElement` passato a `setupWineCardMovementButtons()`.

---

## COSA DOVREBBE ACCADERE

1. L'AI risponde con HTML contenente una wines-list-card
2. `addChatMessageDesktop()` viene chiamato con `isHtml=true`
3. Dopo 100ms, `window.WineCardButtons.setup(messageElement)` viene chiamato
4. La funzione trova i bottoni `.wines-list-item-button`
5. Per ogni bottone, clona il nodo e aggiunge listener `click` e `pointerup`
6. Quando l'utente clicca:
   - Il listener `handleClick` viene eseguito
   - Viene chiamato `showWineCardTestPopup()`
   - Il popup dovrebbe apparire in alto al centro con z-index 99999

---

## COSA STA ACCADENDO (PROBLEMA)

✅ **FUNZIONA**:
- I bottoni vengono trovati (vediamo log "[WineCardButtons] ✅ Trovati X bottoni")
- I listener vengono collegati (vediamo log "[WineCardButtons] 🔗 Collegamento listener bottone")
- Quando clicchiamo, vediamo feedback visivo (bottone cambia colore/stato)
- Vediamo log "[WineCardButtons] 🎯 CLICK RILEVATO" nella console

❌ **NON FUNZIONA**:
- Il popup NON appare visivamente sullo schermo
- La funzione `showWineCardTestPopup()` viene chiamata (confermato dai log)
- Il popup viene aggiunto al DOM (`document.body.appendChild(popup)`)
- Ma non è visibile

---

## VERIFICHE EFFETTUATE

1. ✅ Lo script `wineCardButtons.js` è caricato (verificato in `index.html`)
2. ✅ `window.WineCardButtons` esiste (verificato in console)
3. ✅ I bottoni vengono trovati (log confermano)
4. ✅ I listener vengono collegati (log confermano)
5. ✅ Il click viene rilevato (log "[WineCardButtons] 🎯 CLICK RILEVATO")
6. ✅ La funzione `showWineCardTestPopup()` viene chiamata
7. ❓ Il popup viene aggiunto al DOM ma non è visibile

---

## POSSIBILI CAUSE

### 1. CSS che nasconde il popup
- `display: none` su `.wine-card-test-popup`
- `visibility: hidden`
- `opacity: 0` permanente
- `overflow: hidden` su un parent che nasconde il popup

### 2. Problemi di z-index stacking context
- Anche con z-index 99999, se il popup è dentro un elemento con `position: relative` che ha z-index basso, potrebbe essere limitato
- Stacking context creati da `transform`, `opacity`, `filter`, etc.

### 3. Problemi di timing
- Il popup viene creato ma subito rimosso/nascosto da altro codice
- Race condition con animazioni

### 4. Problemi di body/html
- `document.body` potrebbe non essere il parent corretto
- HTML/Body potrebbero avere overflow hidden o height 0

### 5. Problemi di viewport/positioning
- Il popup è creato ma fuori viewport
- `transform: translateX(-50%)` potrebbe non funzionare correttamente

### 6. Problemi di animazione
- L'animazione CSS potrebbe fallire silenziosamente
- Il popup parte con `opacity: 0` e l'animazione non completa

---

## INFORMAZIONI DI DEBUG

**Browser**: Chrome/Edge (presumibilmente)
**Layout**: Mobile o Desktop (entrambi dovrebbero funzionare)
**Console logs**: Vediamo tutti i log fino a "[WineCardButtons] 🎯 CLICK RILEVATO"
**Feedback visivo**: Il bottone cambia stato quando cliccato (quindi il click funziona)

---

## DOMINIO DI TEST

Dovresti poter testare manualmente chiamando:
```javascript
window.WineCardButtons.showPopup('Test', 'Questo è un test', 'success');
```

Questo dovrebbe mostrare il popup immediatamente senza bisogno di cliccare bottoni.

---

## RICHIESTA

Per favore analizza il codice e identifica perché il popup non appare visivamente anche se:
- La funzione viene chiamata
- Il popup viene aggiunto al DOM
- Lo z-index è 99999
- Il CSS sembra corretto

Fornisci:
1. Possibili cause specifiche basate sul codice
2. Codice di debug da aggiungere per verificare se il popup è nel DOM
3. Soluzioni alternative per mostrare il popup
4. Verifiche da fare nella console del browser

