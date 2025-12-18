# Funzionalità Mancanti al Layout Mobile

Questo documento elenca tutte le funzionalità implementate nel desktop che mancano o sono incomplete nel layout mobile.

---

## 📋 Indice

1. [Gestione Conversazioni](#gestione-conversazioni)
2. [Rendering Messaggi](#rendering-messaggi)
3. [Wine Cards](#wine-cards)
4. [Pulsanti Chat](#pulsanti-chat)
5. [Gestione Stati UI](#gestione-stati-ui)
6. [Integrazione API](#integrazione-api)

---

## 🔴 1. Gestione Conversazioni

### 1.1 Caricamento Conversazioni
**Desktop:** ✅ `loadConversations()` carica le conversazioni e chiama `renderConversationsList()`
**Mobile:** ❌ **MANCANTE** - La sidebar mobile non carica mai le conversazioni

**File desktop:** `app.js:3937`
**File mobile:** `ChatMobile.js` - Non implementato

**Cosa fare:**
- Aggiungere funzione `loadConversationsMobile()` che:
  - Chiama `window.ChatAPI.loadConversations()`
  - Popola `#chat-sidebar-list-mobile`
  - Gestisce stati loading/error/empty

---

### 1.2 Rendering Lista Conversazioni
**Desktop:** ✅ `renderConversationsList()` renderizza HTML con:
  - Titolo conversazione
  - Timestamp ultimo messaggio
  - Pulsante elimina
  - Stato attivo/non attivo
  - Event listeners per click e delete

**Mobile:** ❌ **MANCANTE** - Nessun rendering della lista

**File desktop:** `app.js:3962`
**File mobile:** `ChatMobile.js` - Non implementato

**Cosa fare:**
- Aggiungere funzione `renderConversationsListMobile()` che:
  - Renderizza HTML nella sidebar mobile (`#chat-sidebar-list-mobile`)
  - Gestisce click per selezionare conversazione
  - Gestisce click per eliminare conversazione
  - Auto-chiude sidebar dopo selezione (già gestito in `setupConversationsClick()`)

---

### 1.3 Selezione Conversazione
**Desktop:** ✅ `selectConversation(conversationId)`:
  - Aggiorna `currentConversationId`
  - Salva in localStorage
  - Aggiorna UI sidebar (classe `active`)
  - Carica messaggi conversazione

**Mobile:** ❌ **MANCANTE** - Nessuna selezione conversazione

**File desktop:** `app.js:4096`
**File mobile:** `ChatMobile.js` - Non implementato

**Cosa fare:**
- Aggiungere funzione `selectConversationMobile(conversationId)` che:
  - Chiama `selectConversation()` (condivisa) o implementa logica mobile-specifica
  - Aggiorna UI sidebar mobile
  - Carica messaggi conversazione mobile
  - Auto-chiude sidebar dopo selezione

---

### 1.4 Caricamento Messaggi Conversazione
**Desktop:** ✅ `loadConversationMessages(conversationId)`:
  - Pulisce messaggi correnti
  - Carica messaggi da API
  - Renderizza messaggi con parsing HTML avanzato
  - Setup wine card bookmarks
  - Scrolla in fondo

**Mobile:** ❌ **MANCANTE** - Nessun caricamento messaggi conversazione

**File desktop:** `app.js:4111`
**File mobile:** `ChatMobile.js` - Non implementato

**Cosa fare:**
- Aggiungere funzione `loadConversationMessagesMobile(conversationId)` che:
  - Chiama `window.ChatAPI.loadMessages(conversationId)`
  - Pulisce `#chatScroll` (container mobile)
  - Renderizza messaggi usando `addChatMessageMobile()` con parsing HTML
  - Setup wine card bookmarks mobile
  - Scrolla in fondo

---

### 1.5 Eliminazione Conversazione
**Desktop:** ✅ `deleteConversation(conversationId)`:
  - Conferma cancellazione
  - Chiama API DELETE
  - Aggiorna UI
  - Resetta se era conversazione corrente

**Mobile:** ❌ **MANCANTE** - Nessuna eliminazione conversazione

**File desktop:** `app.js:4012`
**File mobile:** `ChatMobile.js` - Non implementato

**Cosa fare:**
- Aggiungere funzione `deleteConversationMobile(conversationId)` che:
  - Usa `window.ChatMobile.openModal()` per conferma (invece di `confirm()`)
  - Chiama `window.ChatAPI.deleteConversation(conversationId)`
  - Ricarica lista conversazioni
  - Gestisce reset se era conversazione corrente

---

### 1.6 Creazione Nuova Conversazione
**Desktop:** ✅ Pulsante "Nuova chat" (`#new-chat-btn`):
  - Resetta `currentConversationId`
  - Pulisce messaggi
  - Mostra welcome message
  - Aggiorna UI sidebar

**Mobile:** ❌ **MANCANTE** - Pulsante presente (`#new-chat-btn-mobile`) ma non funzionante

**File desktop:** `app.js` - Gestito da event listener globale
**File mobile:** `ChatMobile.js` - Non implementato

**Cosa fare:**
- Aggiungere listener in `initChatMobile()` per `#new-chat-btn-mobile`:
  - Resetta `currentConversationId`
  - Pulisce `#chatScroll`
  - Mostra welcome message
  - Chiude sidebar se aperta
  - Ricarica lista conversazioni

---

## 🔴 2. Rendering Messaggi

### 2.1 Parsing HTML Avanzato
**Desktop:** ✅ `addChatMessage()` gestisce:
  - HTML escapato (`&lt;div` → `<div`)
  - HTML non escapato
  - Container temporaneo per parsing sicuro
  - Rilevamento automatico HTML (controlla `class="wine-card"`, ecc.)

**Mobile:** ⚠️ **INCOMPLETO** - `addChatMessageMobile()` gestisce solo HTML base

**File desktop:** `app.js:1497-1678`
**File mobile:** `ChatMobile.js:435-479`

**Cosa fare:**
- Migliorare `addChatMessageMobile()` per:
  - Rilevare HTML escapato/non escapato
  - Usare container temporaneo per parsing sicuro
  - Gestire tutti i tipi di card (wine-card, wines-list-card, movement-card, inventory-list-card, stats-card)

---

### 2.2 Avatar Utente/AI
**Desktop:** ✅ Avatar personalizzati:
  - Utente: iniziale email
  - AI: logo Gio.ia con fallback "G"

**Mobile:** ❌ **MANCANTE** - Nessun avatar nei messaggi

**File desktop:** `app.js:1543-1551`
**File mobile:** `ChatMobile.js:444-452` - Solo classe `chat-message ${role}`

**Cosa fare:**
- Aggiungere avatar in `addChatMessageMobile()`:
  - Avatar utente: iniziale da `currentUser.email`
  - Avatar AI: logo Gio.ia con fallback

---

### 2.3 Stati Loading/Error
**Desktop:** ✅ Gestione completa:
  - Loading spinner animato
  - Error styling con colore granaccia
  - Rimozione messaggi loading

**Mobile:** ⚠️ **PARZIALE** - Solo classe `loading` e `error`, nessuno spinner

**File desktop:** `app.js:1529-1541, 1586-1588`
**File mobile:** `ChatMobile.js:454-463`

**Cosa fare:**
- Migliorare `addChatMessageMobile()` per:
  - Spinner loading animato (come desktop)
  - Error styling con colore granaccia
  - Rimozione messaggi loading quando arriva risposta

---

### 2.4 Welcome Message
**Desktop:** ✅ Gestito da `clearChatMessages(keepWelcome = true)`
**Mobile:** ⚠️ **PRESENTE IN HTML** ma non gestito dinamicamente

**File desktop:** `app.js:4185-4196`
**File mobile:** `index.html:115-118` - Solo HTML statico

**Cosa fare:**
- Aggiungere funzione `showWelcomeMessageMobile()` che:
  - Pulisce `#chatScroll`
  - Mostra welcome message
  - Chiamata quando: nuova conversazione, conversazione vuota, reset

---

### 2.5 Clear Chat Messages
**Desktop:** ✅ `clearChatMessages(keepWelcome = true)`
**Mobile:** ❌ **MANCANTE**

**File desktop:** `app.js:4185`
**File mobile:** `ChatMobile.js` - Non implementato

**Cosa fare:**
- Aggiungere funzione `clearChatMessagesMobile(keepWelcome = true)` che:
  - Pulisce `#chatScroll`
  - Opzionalmente mostra welcome message

---

## 🔴 3. Wine Cards

### 3.1 Setup Wine Card Bookmarks
**Desktop:** ✅ `setupWineCardBookmarks(messageEl)`:
  - Crea wrapper esterno
  - Aggiunge bookmarks "Modifica" e "Mostra in inventario"
  - Event listeners per click

**Mobile:** ❌ **MANCANTE** - Nessun bookmark sulle wine cards

**File desktop:** `app.js:1697-1758`
**File mobile:** `ChatMobile.js` - Non implementato

**Cosa fare:**
- Aggiungere funzione `setupWineCardBookmarksMobile(messageEl)` che:
  - Crea wrapper esterno (come desktop)
  - Aggiunge bookmarks con styling mobile-friendly
  - Event listeners con `pointerup` per mobile
  - Chiama `handleWineCardEditMobile()` e `handleWineCardShowInInventoryMobile()`

---

### 3.2 Gestione Wine Card Edit
**Desktop:** ✅ `handleWineCardEdit(wineCard, wineId)`:
  - Apre viewer con form modifica vino
  - Popola form con dati vino
  - Gestisce submit

**Mobile:** ❌ **MANCANTE**

**File desktop:** `app.js:1760`
**File mobile:** `ChatMobile.js` - Non implementato

**Cosa fare:**
- Aggiungere funzione `handleWineCardEditMobile(wineCard, wineId)` che:
  - Carica dati vino da API
  - Apre viewer mobile (`window.ChatMobile.openViewer()`)
  - Popola viewer con form modifica
  - Gestisce submit con API
  - Chiude viewer dopo successo

---

### 3.3 Gestione Wine Card Show in Inventory
**Desktop:** ✅ `handleWineCardShowInInventory(wineCard, wineId)`:
  - Apre viewer con inventario filtrato per vino
  - Mostra movimenti vino

**Mobile:** ❌ **MANCANTE**

**File desktop:** `app.js:2588`
**File mobile:** `ChatMobile.js` - Non implementato

**Cosa fare:**
- Aggiungere funzione `handleWineCardShowInInventoryMobile(wineCard, wineId)` che:
  - Carica inventario filtrato da API
  - Apre viewer mobile con lista inventario
  - Mostra movimenti vino
  - Gestisce scroll e interazioni mobile-friendly

---

## 🔴 4. Pulsanti Chat

### 4.1 Gestione Pulsanti Wine (Ricerca Vino)
**Desktop:** ✅ Event listeners su `.chat-button`:
  - Click su pulsante → inserisce testo in input
  - Submit automatico form
  - Gestisce `data-wine-id` e `data-wine-text`

**Mobile:** ❌ **MANCANTE** - Nessun listener sui pulsanti

**File desktop:** `app.js:1632-1663`
**File mobile:** `ChatMobile.js` - Non implementato

**Cosa fare:**
- Aggiungere in `addChatMessageMobile()` dopo rendering HTML:
  - Query selector `.chat-button` nel messaggio
  - Event listener `pointerup` su ogni pulsante
  - Inserisce testo in `#chat-input-mobile`
  - Submit form mobile

---

### 4.2 Gestione Pulsanti Conferma Movimento
**Desktop:** ✅ Gestione speciale per pulsanti movimento:
  - Rileva `data-movement-type`, `data-quantity`
  - Invia direttamente all'API senza mostrare messaggio utente
  - Messaggio formato: `[movement:${type}] [wine_id:${id}] [quantity:${qty}]`

**Mobile:** ❌ **MANCANTE**

**File desktop:** `app.js:1643-1649`
**File mobile:** `ChatMobile.js` - Non implementato

**Cosa fare:**
- Aggiungere logica in listener pulsanti mobile:
  - Controlla `data-movement-type`
  - Se presente, invia direttamente a `window.ChatAPI.sendMessage()` senza UI
  - Altrimenti, comportamento normale (ricerca vino)

---

## 🔴 5. Gestione Stati UI

### 5.1 Integrazione con showChatPage()
**Desktop:** ✅ `showChatPage()`:
  - Mostra pagina chat
  - Carica conversazioni
  - Carica conversazione corrente da localStorage
  - Setup sidebar

**Mobile:** ⚠️ **PARZIALE** - `initChatMobile()` viene chiamato ma non carica conversazioni

**File desktop:** `app.js:949-983`
**File mobile:** `ChatMobile.js:320-372`

**Cosa fare:**
- Migliorare `initChatMobile()` per:
  - Caricare conversazioni (`loadConversationsMobile()`)
  - Caricare conversazione corrente da localStorage
  - Mostrare welcome message se nessuna conversazione

---

### 5.2 Gestione Conversazione Corrente
**Desktop:** ✅ `currentConversationId` gestito globalmente con localStorage
**Mobile:** ⚠️ **NON GESTITO** - Variabile globale esiste ma non usata

**File desktop:** `app.js` - Variabile globale `currentConversationId`
**File mobile:** `ChatMobile.js` - Non gestito

**Cosa fare:**
- Integrare gestione `currentConversationId` in mobile:
  - Salva in localStorage quando si seleziona conversazione
  - Carica da localStorage all'inizializzazione
  - Aggiorna UI quando cambia

---

## 🔴 6. Integrazione API

### 6.1 ChatAPI Integration
**Desktop:** ✅ Usa `window.ChatAPI` per:
  - `sendMessage()`
  - `loadConversations()`
  - `loadMessages()`
  - `deleteConversation()`

**Mobile:** ⚠️ **PARZIALE** - Solo `sendMessage()` usato

**File desktop:** `app.js` - Usa tutte le API
**File mobile:** `ChatMobile.js:423` - Solo `sendMessage()`

**Cosa fare:**
- Integrare tutte le API in mobile:
  - `loadConversations()` → `loadConversationsMobile()`
  - `loadMessages()` → `loadConversationMessagesMobile()`
  - `deleteConversation()` → `deleteConversationMobile()`

---

## 📊 Riepilogo Priorità

### 🔴 Alta Priorità (Funzionalità Core)
1. **Caricamento e rendering conversazioni** - Essenziale per usabilità
2. **Selezione e caricamento messaggi conversazione** - Core feature chat
3. **Creazione nuova conversazione** - Pulsante già presente ma non funzionante
4. **Rendering messaggi con HTML parsing** - Necessario per wine cards

### 🟡 Media Priorità (Funzionalità Importanti)
5. **Wine card bookmarks** - Interazione con wine cards
6. **Pulsanti chat (ricerca vino)** - Interazione con risposte AI
7. **Gestione conversazione corrente** - Persistenza stato
8. **Welcome message dinamico** - UX migliore

### 🟢 Bassa Priorità (Nice to Have)
9. **Eliminazione conversazione** - Funzionalità secondaria
10. **Wine card edit/show in inventory** - Feature avanzate
11. **Avatar utente/AI** - Miglioramento visivo
12. **Loading/error states migliorati** - Polish UI

---

## 📝 Note Implementazione

- Tutte le funzioni mobile dovrebbero essere aggiunte in `ChatMobile.js`
- Usare `window.ChatAPI` per business logic (condivisa)
- Usare `window.ChatSelectors.get()` per selettori DOM mobile
- Gestire cleanup quando si cambia layout (già implementato)
- Testare tap isolation quando si aggiungono nuovi elementi interattivi
- Assicurarsi che scroll funzioni correttamente dopo aggiunta messaggi

---

## 🔗 File Riferimento

- **Desktop chat functions:** `app.js:949-4337`
- **Mobile chat functions:** `features/chat/mobile/ChatMobile.js`
- **Shared API:** `features/chat/shared/chatAPI.js`
- **Shared selectors:** `features/chat/shared/chatSelectors.js`
- **HTML mobile:** `index.html:100-164`
