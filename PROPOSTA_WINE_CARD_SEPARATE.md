# Proposta: Wine Cards Separate per Mobile e Desktop

## Analisi Situazione Attuale

### Problema Identificato
- Le wine cards vengono generate nel backend con HTML unificato
- Il frontend cerca di distinguere mobile/desktop con classi e handler, ma ci sono conflitti
- L'event delegation processa bottoni che non dovrebbero essere processati
- Quando si clicca il bottone hamburger su mobile, viene inviato un messaggio alla chat che apre il viewer desktop

### Architettura Attuale
1. **Backend**: `WineCardHelper.generate_wine_card_html()` genera HTML unificato
2. **Frontend**: `wineCardButtons.js` cerca di gestire bottoni mobile e desktop
3. **Conflitti**: Event delegation interferisce con handler diretti mobile

## Soluzione Proposta: Trasformazione Frontend

### Approccio: Trasformazione Wine Cards al Momento dell'Inserimento

Invece di modificare il backend (che richiede coordinamento e testing), trasformiamo le wine cards nel frontend quando vengono aggiunte, in base al layout attivo.

### Vantaggi
- ✅ **Nessuna modifica backend**: Le wine cards continuano ad essere generate uguali
- ✅ **Separazione completa**: Mobile e desktop hanno HTML completamente diversi
- ✅ **Nessun conflitto**: Bottoni mobile non passano per event delegation
- ✅ **Manutenibilità**: Logica mobile isolata in una funzione dedicata

### Implementazione

#### 1. Nuovo File: `wineCardTransformer.js`
Funzione che trasforma wine cards HTML quando vengono aggiunte su mobile:

```javascript
/**
 * Trasforma wine cards HTML da formato backend a formato mobile
 */
function transformWineCardsForMobile(htmlContent) {
    // Se non siamo su mobile, ritorna HTML originale
    const isMobile = window.LayoutBoundary?.isMobileNamespace() || 
                     document.documentElement.classList.contains('mobileRoot');
    if (!isMobile) {
        return htmlContent;
    }
    
    // Parsa HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
    // Trova tutte le wine cards
    const wineCards = doc.querySelectorAll('.wine-card');
    
    wineCards.forEach(wineCard => {
        const wineId = wineCard.getAttribute('data-wine-id');
        if (!wineId) return;
        
        // Aggiungi classe mobile-specific
        wineCard.classList.add('wine-card-mobile');
        
        // Aggiungi container bottoni mobile se non esiste
        const header = wineCard.querySelector('.wine-card-header');
        if (header && !header.querySelector('.wine-card-buttons-mobile')) {
            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'wine-card-buttons-mobile';
            
            // Crea bottone edit
            const editBtn = createMobileEditButton(wineId);
            // Crea bottone hamburger (inventory)
            const inventoryBtn = createMobileInventoryButton(wineId);
            
            buttonsContainer.appendChild(editBtn);
            buttonsContainer.appendChild(inventoryBtn);
            
            header.appendChild(buttonsContainer);
        }
    });
    
    // Ritorna HTML trasformato
    return doc.body.innerHTML;
}

function createMobileEditButton(wineId) {
    const btn = document.createElement('button');
    btn.className = 'wine-card-button-mobile wine-card-button-edit';
    btn.setAttribute('data-wine-id', wineId);
    btn.setAttribute('data-layout', 'mobile');
    btn.setAttribute('data-button-type', 'info-edit');
    // ... SVG icon ...
    return btn;
}

function createMobileInventoryButton(wineId) {
    const btn = document.createElement('button');
    btn.className = 'wine-card-button-mobile wine-card-button-inventory';
    btn.setAttribute('data-wine-id', wineId);
    btn.setAttribute('data-layout', 'mobile');
    btn.setAttribute('data-button-type', 'info-details');
    // ... SVG icon hamburger ...
    
    // Handler diretto isolato
    btn.addEventListener('click', (e) => {
        e.stopImmediatePropagation();
        // Apri viewer mobile direttamente
        openMobileWineDetails(wineId);
    }, true); // Capture phase
    
    return btn;
}
```

#### 2. Modifica `ChatMobile.js` e `ChatDesktop.js`
Quando viene aggiunto un messaggio HTML, trasformarlo prima di inserirlo:

```javascript
// In ChatMobile.addMessage
if (isHtml) {
    // Trasforma wine cards per mobile
    content = window.WineCardTransformer?.transformForMobile(content) || content;
    messageElement.innerHTML = content;
} else {
    messageElement.textContent = content;
}
```

#### 3. Modifica `wineCardButtons.js`
Rimuovi la logica di setup bottoni mobile (ora gestita dal transformer):
- `setupWineCardInfoButtonsMobile` non serve più
- I bottoni vengono creati direttamente nel transformer con handler isolati

## Vantaggi della Soluzione

1. **Separazione Completa**
   - Wine cards mobile hanno HTML completamente diverso
   - Bottoni mobile non passano per event delegation
   - Handler isolati, nessun conflitto

2. **Manutenibilità**
   - Logica mobile in un file dedicato
   - Facile da testare e debuggare
   - Cambiamenti mobile non impattano desktop

3. **Performance**
   - Trasformazione solo quando necessario (mobile)
   - Nessuna modifica backend
   - Logica eseguita solo una volta all'inserimento

4. **Retrocompatibilità**
   - Desktop continua a funzionare come prima
   - Nessun breaking change
   - Facile rollback se necessario

## Struttura File Proposta

```
frontend/
  features/
    chat/
      shared/
        wineCardButtons.js        # Gestione bottoni desktop + event delegation
        wineCardTransformer.js    # NUOVO: Trasformazione wine cards mobile
        chatAPI.js                # (esistente)
      mobile/
        ChatMobile.js             # Usa transformer per messaggi HTML
      desktop/
        ChatDesktop.js            # Usa HTML originale
```

## Flusso Mobile

1. Backend genera wine card HTML (formato unificato)
2. Frontend riceve messaggio con `is_html: true`
3. `ChatMobile.addMessage()` chiama `WineCardTransformer.transformForMobile()`
4. Transformer:
   - Aggiunge classe `wine-card-mobile`
   - Aggiunge bottoni mobile con handler diretti
   - Ritorna HTML trasformato
5. HTML viene inserito nel DOM
6. Bottoni mobile hanno già handler attaccati (no setup necessario)

## Flusso Desktop

1. Backend genera wine card HTML (formato unificato)
2. Frontend riceve messaggio con `is_html: true`
3. `ChatDesktop.addMessage()` usa HTML originale
4. Event delegation gestisce i click (come ora)

## Prossimi Passi

1. ✅ Creare `wineCardTransformer.js`
2. ✅ Implementare trasformazione wine cards mobile
3. ✅ Modificare `ChatMobile.js` per usare transformer
4. ✅ Testare separazione mobile/desktop
5. ✅ Rimuovere logica duplicata da `wineCardButtons.js`

