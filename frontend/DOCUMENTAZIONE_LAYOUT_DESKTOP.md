# Documentazione Layout Desktop - Gio.ia

## 📋 Indice
1. [Struttura HTML](#struttura-html)
2. [Architettura CSS](#architettura-css)
3. [Componenti Principali](#componenti-principali)
4. [Funzionalità JavaScript](#funzionalità-javascript)
5. [Scroll Management](#scroll-management)
6. [Interazioni Utente](#interazioni-utente)
7. [Integrazione con LayoutBoundary](#integrazione-con-layoutboundary)

---

## 🏗️ Struttura HTML

### Container Root
```html
<div id="desktop-layout" class="desktop-layout layout-container" data-layout-root="desktop">
```

**Caratteristiche:**
- ID: `desktop-layout`
- Class: `desktop-layout layout-container`
- Attributo: `data-layout-root="desktop"` (per isolamento namespace)
- Display: `flex` (flex-direction: row)
- Altezza: `100vh`
- Background: `var(--color-chat-bg)`

### Struttura Gerarchica

```
desktop-layout (flex row)
├── chat-sidebar (aside)
│   ├── chat-sidebar-header
│   │   └── new-chat-btn
│   └── chat-sidebar-list
│       └── chat-sidebar-item (dinamici)
│
└── chat-main-content (flex column, flex: 1)
    ├── chat-header
    │   ├── chat-header-left
    │   │   ├── sidebar-toggle-desktop
    │   │   ├── logo-container
    │   │   └── chat-title
    │   └── chat-header-right
    │       ├── themeToggle
    │       ├── add-wine-btn
    │       └── logout-btn
    │
    └── chat-container
        ├── chat-messages-container (#chat-messages)
        │   └── chat-messages-scroll-wrapper (#chat-messages-scroll-wrapper) ⭐ SCROLL ROOT
        │       ├── welcome-message (iniziale)
        │       └── chat-message (dinamici)
        │
        └── chat-input-container
            └── chat-form (#chat-form)
                ├── chat-input (#chat-input)
                └── chat-send-btn (#chat-send-btn)
```

---

## 🎨 Architettura CSS

### Layout Container
```css
.desktop-layout {
    display: flex;
    flex-direction: row;
    width: 100%;
    min-width: 100%;
    height: 100vh;
    background-color: var(--color-chat-bg);
}
```

### Sidebar (Left Panel)
```css
.chat-sidebar {
    width: 280px;
    background-color: var(--color-white);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    transition: transform 0.3s ease, width 0.3s ease;
}

.chat-sidebar.collapsed {
    width: 0;
    overflow: hidden;
    border-right: none;
}
```

**Stati:**
- **Espansa**: `width: 280px`, visibile
- **Collassata**: `width: 0`, nascosta con transizione

### Main Content Area
```css
.chat-main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 100%;
    min-width: 0;
}
```

**Caratteristiche:**
- Flex grow per occupare spazio rimanente
- Column layout per header + chat container
- Overflow hidden per contenere scroll interno

### Header
```css
.chat-header {
    background-color: var(--color-white);
    border-bottom: 1px solid var(--color-border);
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
}
```

**Elementi:**
- **Left**: Toggle sidebar, logo, titolo
- **Right**: Theme toggle, aggiungi vino, logout

### Chat Container (Scroll Area)
```css
.chat-messages-container {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.chat-messages-scroll-wrapper {
    flex: 1;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    min-height: 0;
    position: relative;
    z-index: 1;
    will-change: scroll-position;
    isolation: isolate;
}
```

**⭐ SCROLL ROOT DESKTOP**: `#chat-messages-scroll-wrapper`
- Gestisce tutto lo scroll dei messaggi
- Isolato con `isolation: isolate`
- `overflow-y: auto` forzato con `!important`

### Input Area
```css
.chat-input-container {
    flex-shrink: 0;
    padding: 16px 24px;
    background-color: var(--color-white);
    border-top: 1px solid var(--color-border);
}

.chat-form {
    display: flex;
    gap: 12px;
    align-items: flex-end;
}
```

---

## 🧩 Componenti Principali

### 1. Sidebar Conversazioni

**Elementi:**
- **Header**: Pulsante "Nuova chat" (`#new-chat-btn`)
- **Lista**: Container scrollabile (`#chat-sidebar-list`)
- **Items**: Conversazioni dinamiche (`.chat-sidebar-item`)

**Funzionalità:**
- Toggle collapse/expand
- Selezione conversazione attiva (`.active`)
- Eliminazione conversazione (hover → delete button)
- Scroll indipendente dalla chat principale

**CSS Stati:**
```css
.chat-sidebar-item {
    padding: 12px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.chat-sidebar-item:hover {
    background-color: var(--color-light-gray);
}

.chat-sidebar-item.active {
    background-color: var(--color-granaccia);
    color: var(--color-white);
}
```

### 2. Header Desktop

**Elementi Left:**
- `#sidebar-toggle-desktop`: Toggle sidebar (hamburger menu)
- `.logo-container`: Logo Gio.ia
- `.chat-title`: Titolo "Gio.ia"

**Elementi Right:**
- `#themeToggle`: Toggle dark/light mode
- `#add-wine-btn`: Aggiungi nuovo vino (desktop-only)
- `#logout-btn`: Logout utente (desktop-only)

**Comportamento:**
- Sticky/fixed in alto
- Non scrollabile
- Border bottom per separazione visiva

### 3. Chat Messages Area

**Struttura:**
```
chat-messages-container (flex container)
└── chat-messages-scroll-wrapper (scroll root)
    ├── welcome-message (iniziale)
    └── chat-message (dinamici)
        ├── chat-message-avatar
        ├── chat-message-content
        └── chat-message-time
```

**Messaggi:**
- **User**: Allineati a destra, background `var(--color-chat-user-bg)`
- **AI**: Allineati a sinistra, background `var(--color-chat-ai-bg)`
- Animazione: `fadeIn` (opacity + translateY)

**Wine Cards:**
- Renderizzate dentro messaggi AI
- Scroll isolato (`.wines-list-body`)
- Interazione con inventario

### 4. Chat Input

**Elementi:**
- `#chat-input`: Textarea auto-resize
- `#chat-send-btn`: Pulsante invio (SVG icon)

**Comportamento:**
- Submit su Enter (Shift+Enter per newline)
- Auto-resize textarea
- Disabilitato durante invio
- Scroll automatico dopo invio

---

## ⚙️ Funzionalità JavaScript

### 1. Layout Management

#### `switchLayout()`
```javascript
function switchLayout() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        mobileLayout.style.display = 'grid';
        desktopLayout.style.display = 'none';
        LayoutBoundary.init('mobile');
    } else {
        mobileLayout.style.display = 'none';
        desktopLayout.style.display = 'flex';
        LayoutBoundary.init('desktop');
    }
}
```

**Responsabilità:**
- Rileva viewport width
- Mostra/nasconde layout corretto
- Applica namespace LayoutBoundary
- Reset ChatSelectors

#### `initLayoutManager()`
- Chiama `switchLayout()` all'avvio
- Listener resize con debounce (150ms)
- Reset selectors al cambio layout
- Inizializza chat per layout corrente

### 2. Sidebar Management

#### `toggleSidebar()`
```javascript
function toggleSidebar() {
    const sidebar = document.getElementById('chat-sidebar');
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
}
```

**Funzionalità:**
- Toggle classe `.collapsed`
- Persistenza stato in localStorage
- Transizione CSS smooth (0.3s)

#### `loadSidebarState()`
- Carica stato da localStorage
- Applica classe `.collapsed` se salvata
- Chiamata in `showChatPage()`

#### `attachSidebarToggleListeners()`
- Attacca listener a `#sidebar-toggle-desktop`
- Eventi: `pointerup`, `click`, `touchend` (fallback)
- Capture phase per sicurezza
- Prevenzione duplicati con `dataset.listenerAttached`

### 3. Chat Management

#### `showChatPage()`
```javascript
function showChatPage() {
    // Nascondi auth, mostra chat
    document.getElementById('auth-page').classList.add('hidden');
    document.getElementById('chat-page').classList.remove('hidden');
    
    // Refresh layout
    refreshLayoutOnShow();
    
    // Setup sidebar
    setTimeout(() => attachSidebarToggleListeners(), 100);
    loadSidebarState();
    
    // Carica dati
    loadConversations();
    const savedId = localStorage.getItem('current_conversation_id');
    if (savedId) {
        currentConversationId = parseInt(savedId);
        loadConversationMessages(currentConversationId);
    }
}
```

**Sequenza:**
1. Mostra/nascondi pagine
2. Refresh layout (namespace)
3. Setup sidebar listeners
4. Carica conversazioni
5. Ripristina conversazione corrente

#### `handleChatSubmit(e)`
```javascript
async function handleChatSubmit(e) {
    e.preventDefault();
    
    const selectors = ChatSelectors.get();
    const input = selectors.input();
    const message = input.value.trim();
    
    if (!message) return;
    
    input.value = '';
    await sendChatMessage(message, true);
}
```

**Flusso:**
1. Prevenzione default submit
2. Lettura input via ChatSelectors
3. Validazione messaggio
4. Reset input
5. Invio messaggio

#### `sendChatMessage(message, showUserMessage)`
```javascript
async function sendChatMessage(message, showUserMessage = true) {
    // Aggiungi messaggio utente
    if (showUserMessage) {
        addChatMessage('user', message);
    }
    
    // Mostra loading
    const loadingId = addChatMessage('ai', '', true);
    
    try {
        // Invio API
        const response = await fetch(`${API_BASE_URL}/api/chat/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
                message,
                conversation_id: currentConversationId || null
            }),
        });
        
        const data = await response.json();
        
        // Aggiorna conversation_id
        if (data.conversation_id) {
            currentConversationId = data.conversation_id;
            localStorage.setItem('current_conversation_id', currentConversationId);
            loadConversations(); // Refresh sidebar
        }
        
        // Rimuovi loading, aggiungi risposta
        removeChatMessage(loadingId);
        addChatMessage('ai', data.message, false, false, data.buttons, data.is_html);
        
    } catch (error) {
        removeChatMessage(loadingId);
        addChatMessage('ai', `Errore: ${error.message}`, false, true);
    }
}
```

**Caratteristiche:**
- Gestione conversation_id (creazione/continuazione)
- Loading state con messaggio temporaneo
- Error handling con messaggio errore
- Supporto HTML e buttons

#### `addChatMessage(role, content, isLoading, isError, buttons, isHtml)`
```javascript
function addChatMessage(role, content, isLoading, false, isError, buttons, isHtml) {
    const selectors = ChatSelectors.get();
    const scrollContainer = selectors.scrollContainer();
    
    // Crea elemento messaggio
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${role}`;
    
    // Aggiungi contenuto (HTML o testo)
    if (isHtml) {
        messageElement.innerHTML = content;
    } else {
        messageElement.textContent = content;
    }
    
    // Aggiungi al DOM
    scrollContainer.appendChild(messageElement);
    
    // Scroll automatico
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    
    return messageElement;
}
```

**Responsabilità:**
- Creazione elemento DOM
- Parsing HTML se `isHtml === true`
- Gestione loading/error states
- Scroll automatico dopo aggiunta
- Supporto wine cards

### 4. Conversazioni Management

#### `loadConversations()`
```javascript
async function loadConversations() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const conversations = await response.json();
        renderConversationsList(conversations);
    } catch (error) {
        console.error('Errore caricamento conversazioni:', error);
        renderConversationsList([], true);
    }
}
```

#### `renderConversationsList(conversations, isError)`
- Renderizza lista in `#chat-sidebar-list`
- Highlight conversazione attiva (`.active`)
- Gestione stati: loading, empty, error
- Listener click per selezione
- Listener delete per eliminazione

#### `loadConversationMessages(conversationId)`
```javascript
async function loadConversationMessages(conversationId) {
    currentConversationId = conversationId;
    localStorage.setItem('current_conversation_id', conversationId);
    
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/chat/conversations/${conversationId}/messages`,
            { headers: { 'Authorization': `Bearer ${authToken}` } }
        );
        
        const messages = await response.json();
        
        // Pulisci chat
        const scrollContainer = ChatSelectors.get().scrollContainer();
        scrollContainer.innerHTML = '';
        
        // Renderizza messaggi
        messages.forEach(msg => {
            addChatMessage(msg.role, msg.content, false, false, null, msg.is_html);
        });
        
        // Scroll in fondo
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        
        // Refresh sidebar (highlight attiva)
        loadConversations();
        
    } catch (error) {
        console.error('Errore caricamento messaggi:', error);
    }
}
```

---

## 📜 Scroll Management

### Scroll Container Desktop
**Elemento**: `#chat-messages-scroll-wrapper`

**CSS Critico:**
```css
.chat-messages-scroll-wrapper {
    flex: 1;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    min-height: 0 !important;
    position: relative;
    z-index: 1;
    will-change: scroll-position;
    isolation: isolate;
}
```

**Proprietà Chiave:**
- `overflow-y: auto !important`: Forza scroll verticale
- `min-height: 0`: Permette shrink in flex container
- `isolation: isolate`: Isola stacking context
- `will-change: scroll-position`: Ottimizzazione performance

### Scroll Automatico
```javascript
// Dopo aggiunta messaggio
scrollContainer.scrollTop = scrollContainer.scrollHeight;

// Dopo caricamento conversazione
scrollContainer.scrollTop = scrollContainer.scrollHeight;
```

### Isolamento Scroll
- Chat scroll: `#chat-messages-scroll-wrapper`
- Sidebar scroll: `#chat-sidebar-list`
- Nessun scroll su `body` o `html`
- Wine cards: scroll isolato con `stopPropagation()`

---

## 🖱️ Interazioni Utente

### 1. Toggle Sidebar
- **Trigger**: Click su `#sidebar-toggle-desktop`
- **Azione**: Toggle classe `.collapsed`
- **Persistenza**: localStorage `sidebarCollapsed`
- **Transizione**: CSS 0.3s ease

### 2. Selezione Conversazione
- **Trigger**: Click su `.chat-sidebar-item`
- **Azione**: 
  - Carica messaggi conversazione
  - Highlight item (`.active`)
  - Aggiorna `currentConversationId`

### 3. Eliminazione Conversazione
- **Trigger**: Click su `.chat-sidebar-item-delete` (hover)
- **Azione**: 
  - API DELETE `/api/chat/conversations/{id}`
  - Refresh lista
  - Se era attiva, pulisci chat

### 4. Invio Messaggio
- **Trigger**: Submit form o Enter (no Shift)
- **Azione**:
  - Aggiungi messaggio utente
  - Mostra loading
  - Invio API
  - Aggiungi risposta AI
  - Scroll automatico

### 5. Theme Toggle
- **Trigger**: Click su `#themeToggle`
- **Azione**: Toggle classe `dark-theme` su `body`
- **Persistenza**: localStorage `theme`

### 6. Aggiungi Vino
- **Trigger**: Click su `#add-wine-btn`
- **Azione**: Apri modal/form aggiunta vino (da implementare)

### 7. Logout
- **Trigger**: Click su `#logout-btn`
- **Azione**: 
  - Clear localStorage
  - Redirect a login
  - Clear authToken

---

## 🔗 Integrazione con LayoutBoundary

### Namespace Application
```javascript
// In switchLayout()
if (!isMobile) {
    LayoutBoundary.init('desktop');
}
```

**Risultato:**
- Classe `.desktopRoot` su `<html>` e `<body>`
- CSS variable `--scroll-container: #chat-messages-scroll-wrapper`
- Isolamento CSS completo da mobile

### Chat Selectors Integration
```javascript
// In createChatSelectors()
const root = getLayoutRoot(); // Cerca data-layout-root="desktop"

return {
    scrollContainer: () => root.querySelector('#chat-messages-scroll-wrapper'),
    form: () => root.querySelector('#chat-form'),
    input: () => root.querySelector('#chat-input'),
    // ...
    layout: 'desktop',
    root: root
};
```

**Benefici:**
- Selettori isolati per desktop
- Nessuna collisione con mobile
- Root-based queries (più sicuro)

---

## 📊 Flusso Dati

### Inizializzazione
```
1. DOMContentLoaded
2. initLayoutManager()
3. switchLayout() → LayoutBoundary.init('desktop')
4. ChatSelectors.reset()
5. initChatForCurrentLayout() → ChatDesktop.init()
6. showChatPage() (se autenticato)
7. loadConversations()
8. loadConversationMessages(savedId)
```

### Invio Messaggio
```
1. handleChatSubmit(e)
2. sendChatMessage(message)
3. addChatMessage('user', message)
4. addChatMessage('ai', '', true) // loading
5. fetch('/api/chat/message')
6. update conversation_id
7. removeChatMessage(loadingId)
8. addChatMessage('ai', response.message)
9. scrollContainer.scrollTop = scrollHeight
```

### Cambio Conversazione
```
1. Click sidebar item
2. loadConversationMessages(id)
3. Clear scrollContainer.innerHTML
4. messages.forEach(addChatMessage)
5. scrollContainer.scrollTop = scrollHeight
6. loadConversations() // refresh sidebar
```

---

## 🎯 Best Practices

### 1. Scroll Management
- ✅ Usa sempre `#chat-messages-scroll-wrapper` come scroll root
- ✅ Scroll automatico dopo aggiunta messaggio
- ✅ `min-height: 0` su flex items scrollabili
- ❌ Non scrollare `body` o `html`

### 2. Selectors
- ✅ Usa `ChatSelectors.get()` invece di `getElementById` diretto
- ✅ Reset selectors al cambio layout
- ✅ Query da root container (`data-layout-root`)

### 3. State Management
- ✅ Persistenza sidebar state (localStorage)
- ✅ Persistenza conversation_id (localStorage)
- ✅ Persistenza theme (localStorage)
- ✅ Clear state al logout

### 4. Performance
- ✅ Debounce resize listener (150ms)
- ✅ `will-change: scroll-position` su scroll container
- ✅ `isolation: isolate` per stacking context
- ✅ Lazy loading conversazioni (se necessario)

### 5. Error Handling
- ✅ Try-catch su API calls
- ✅ Messaggi errore user-friendly
- ✅ Fallback per elementi DOM non trovati
- ✅ Retry logic per sidebar listeners

---

## 🔍 Debugging

### Verifica Layout Attivo
```javascript
console.log('Layout:', document.documentElement.classList.contains('desktopRoot') ? 'DESKTOP' : 'MOBILE');
console.log('Root:', document.querySelector('[data-layout-root="desktop"]'));
```

### Verifica Scroll Container
```javascript
const selectors = ChatSelectors.get();
const scrollContainer = selectors.scrollContainer();
console.log('Scroll container:', scrollContainer);
console.log('Scrollable:', scrollContainer.scrollHeight > scrollContainer.clientHeight);
console.log('ScrollTop:', scrollContainer.scrollTop);
```

### Verifica Sidebar State
```javascript
const sidebar = document.getElementById('chat-sidebar');
console.log('Collapsed:', sidebar.classList.contains('collapsed'));
console.log('Saved state:', localStorage.getItem('sidebarCollapsed'));
```

---

## 📝 Note Implementazione

### Breakpoint Responsive
- **Desktop**: `width > 768px`
- **Mobile**: `width <= 768px`
- Switch automatico al resize

### Persistenza Dati
- `sidebarCollapsed`: stato sidebar
- `current_conversation_id`: conversazione attiva
- `theme`: dark/light mode
- `authToken`: token autenticazione

### API Endpoints
- `GET /api/chat/conversations`: lista conversazioni
- `GET /api/chat/conversations/{id}/messages`: messaggi conversazione
- `POST /api/chat/message`: invio messaggio
- `DELETE /api/chat/conversations/{id}`: elimina conversazione

---

## 🚀 Prossimi Sviluppi

1. **Migrazione CSS Layout-Specific**
   - Creare `layout/DesktopLayout/desktop.css`
   - Spostare regole da `styles.css`
   - Namespace `.desktopRoot` su tutte le regole

2. **Componenti Modulari**
   - `features/sidebar/desktop/SidebarDesktop.js`
   - `features/chat/desktop/ChatDesktop.js` (già iniziato)
   - `features/viewer/desktop/ViewerDesktop.js`

3. **Testing**
   - E2E test scroll chat
   - Test sidebar toggle
   - Test cambio conversazione
   - Test invio messaggio

4. **Ottimizzazioni**
   - Virtual scrolling per liste lunghe
   - Lazy loading messaggi
   - Debounce ricerca conversazioni

---

**Ultima modifica**: 2024
**Versione**: 1.0.0
