# Documentazione Layout Mobile - Gio.ia

## 📋 Indice
1. [Obiettivo Primario](#obiettivo-primario)
2. [Struttura HTML Mobile](#struttura-html-mobile)
3. [State Machine Mobile](#state-machine-mobile)
4. [Tap/Click Isolation](#tapclick-isolation)
5. [Scroll Policy](#scroll-policy)
6. [Componenti Principali](#componenti-principali)
7. [Funzionalità JavaScript](#funzionalità-javascript)
8. [Integrazione con LayoutBoundary](#integrazione-con-layoutboundary)
9. [Acceptance Criteria](#acceptance-criteria)

---

## 🎯 Obiettivo Primario

Su mobile vogliamo una UX **semplice e affidabile**:

- ✅ **Nessuna sovrapposizione di tap** (no tap-through)
- ✅ **Nessun bug di scroll** (un solo scroll container attivo per stato)
- ✅ **Nessun CSS/JS che impatti desktop** (isolamento completo)
- ✅ **Stati prevedibili** (drawer/sheet/modal controllati)

**Filosofia**: Desktop può permettersi layout complessi (sidebar persistente, pannelli affiancati). Mobile deve funzionare a **stati** (drawer/sheet/modal) e deve essere **prevedibile**.

---

## 🏗️ Struttura HTML Mobile

### Container Root
```html
<div id="mobile-layout" class="mApp layout-container" data-layout-root="mobile" style="display: none;">
```

**Caratteristiche:**
- ID: `mobile-layout`
- Class: `mApp layout-container`
- Attributo: `data-layout-root="mobile"` (per isolamento namespace)
- Display: `grid` (grid-template-rows: auto 1fr auto)
- Altezza: `100dvh`
- Overflow: `hidden` (scroll gestito internamente)

### Struttura Gerarchica Completa

```
mApp (grid container, height: 100dvh, overflow: hidden)
├── mHeader (grid-row: 1, sticky top)
│   ├── sidebar-toggle (#sidebar-toggle)
│   ├── logo-container
│   └── chat-title
│
├── mMain (grid-row: 2, flex: 1, overflow: hidden)
│   └── mScroller (#chatScroll) ⭐ SCROLL ROOT MOBILE
│       ├── welcome-message (iniziale)
│       └── chat-message (dinamici)
│
├── mComposer (grid-row: 3, sticky bottom)
│   └── chat-form (#chat-form-mobile)
│       ├── chat-input (#chat-input-mobile)
│       └── chat-send-btn (#chat-send-btn-mobile)
│
└── Layer UI (overlay/sheet/modal - solo quando aperti)
    ├── mOverlay (#sidebarOverlay) - overlay sidebar
    ├── mSidebar (#chatSidebar) - drawer conversazioni
    ├── mViewer (#viewerPanel) - sheet dettagli vino
    └── mModal (#anyModal) - modal azioni/conferme
```

### Elementi Chiave

| Elemento | ID/Class | Ruolo | Stato Default |
|----------|----------|-------|---------------|
| App Container | `.mApp` | Grid root, `100dvh`, `overflow: hidden` | Visibile |
| Header | `.mHeader` | Sticky top, hamburger menu | Visibile |
| Main Content | `.mMain` | Flex container per scroll | Visibile |
| **Scroll Root** | `#chatScroll` / `.mScroller` | **Unico scroll container chat** | Visibile |
| Composer | `.mComposer` | Sticky bottom, input chat | Visibile |
| Overlay | `#sidebarOverlay` | Overlay scuro per sidebar | Nascosto (`display: none`) |
| Sidebar | `#chatSidebar` / `.mSidebar` | Drawer conversazioni | Nascosto (`transform: translateX(-100%)`) |
| Viewer | `#viewerPanel` / `.mViewer` | Sheet dettagli vino | Nascosto (`hidden` attribute) |
| Modal | `#anyModal` / `.mModal` | Modal azioni/conferme | Nascosto (`hidden` attribute) |

---

## 🔄 State Machine Mobile

Mobile è governato da uno **stato unico**, niente condizioni sparse.

### Stati Disponibili

| Stato | Descrizione | Layer Attivo | Layer Disabilitati |
|-------|-------------|--------------|-------------------|
| **CHAT** | Stato default, chat visibile | `mHeader`, `mMain`, `mComposer` | `mSidebar`, `mViewer`, `mModal` |
| **SIDEBAR_OPEN** | Sidebar drawer aperto | `mOverlay`, `mSidebar` | `mMain`, `mComposer` (pointer-events: none) |
| **VIEWER_OPEN** | Viewer sheet aperto | `mViewer` | `mSidebar`, `mMain`, `mComposer` (pointer-events: none) |
| **MODAL_OPEN** | Modal aperto | `mModal` | Tutto il resto (pointer-events: none) |

### Priorità di Layer (z-index logico)

```
1) MODAL_OPEN     → .mModal (z-index: 60) [TOP]
2) VIEWER_OPEN    → .mViewer (z-index: 50)
3) SIDEBAR_OPEN   → .mSidebar + .mOverlay (z-index: 40)
4) CHAT           → mHeader + mMain + mComposer (z-index: 10) [BOTTOM]
```

### Regole di Transizione

| Da Stato | A Stato | Trigger | Azioni |
|----------|---------|---------|--------|
| CHAT | SIDEBAR_OPEN | Click hamburger | Apri sidebar, chiudi viewer se aperto |
| SIDEBAR_OPEN | CHAT | Click overlay o conversazione | Chiudi sidebar |
| CHAT | VIEWER_OPEN | Click vino card | Apri viewer, chiudi sidebar se aperto |
| VIEWER_OPEN | CHAT | Click close (X) | Chiudi viewer |
| * | MODAL_OPEN | Azione che richiede conferma | Blocca tutto sotto |
| MODAL_OPEN | * | Click close/confirm | Torna allo stato precedente |

**Regole Chiave:**
- Aprire Viewer **chiude sempre** Sidebar
- Aprire Modal **blocca tutto** sotto
- Chiudere Modal **torna allo stato precedente**
- Chiudere Viewer **torna a CHAT**
- Chiudere Sidebar **torna a CHAT**

### Implementazione State Machine

```javascript
// Stati possibili
const MOBILE_STATES = {
    CHAT: 'chat',
    SIDEBAR_OPEN: 'sidebar',
    VIEWER_OPEN: 'viewer',
    MODAL_OPEN: 'modal'
};

// Stato corrente
let currentMobileState = MOBILE_STATES.CHAT;

// Transizione stato
function setMobileState(newState) {
    const mApp = document.querySelector('.mApp');
    if (!mApp) return;
    
    // Rimuovi tutte le classi stato
    mApp.classList.remove('state-chat', 'state-sidebar', 'state-viewer', 'state-modal');
    
    // Applica nuovo stato
    mApp.classList.add(`state-${newState}`);
    currentMobileState = newState;
    
    // Gestisci transizioni specifiche
    handleStateTransition(newState);
}
```

---

## 🚫 Tap/Click Isolation (NO tap-through)

**Questa è la parte più importante.**

### Regola Fondamentale

Quando un overlay/sheet è aperto:
- ✅ Tutto ciò che sta **sotto** deve avere `pointer-events: none`
- ✅ Lo strato **attivo** deve avere `pointer-events: auto`
- ✅ L'overlay visivo (se presente) deve **catturare i tap** e chiudere

### Implementazione CSS (Pattern)

```css
/* ============================================
   STATE: CHAT (default)
   ============================================ */
.mApp.state-chat {
    /* Tutto normale */
}

.mApp.state-chat .mMain,
.mApp.state-chat .mComposer {
    pointer-events: auto;
}

.mApp.state-chat .mSidebar,
.mApp.state-chat .mOverlay,
.mApp.state-chat .mViewer,
.mApp.state-chat .mModal {
    pointer-events: none;
}

/* ============================================
   STATE: SIDEBAR_OPEN
   ============================================ */
.mApp.state-sidebar .mOverlay,
.mApp.state-sidebar .mSidebar {
    pointer-events: auto;
}

.mApp.state-sidebar .mMain,
.mApp.state-sidebar .mComposer {
    pointer-events: none; /* NO tap-through */
}

.mApp.state-sidebar #chatScroll {
    overflow: hidden; /* Disabilita scroll chat */
}

/* ============================================
   STATE: VIEWER_OPEN
   ============================================ */
.mApp.state-viewer .mViewer {
    pointer-events: auto;
}

.mApp.state-viewer .mSidebar,
.mApp.state-viewer .mMain,
.mApp.state-viewer .mComposer {
    pointer-events: none; /* NO tap-through */
}

.mApp.state-viewer #chatScroll {
    overflow: hidden; /* Disabilita scroll chat */
}

/* ============================================
   STATE: MODAL_OPEN
   ============================================ */
.mApp.state-modal .mModal {
    pointer-events: auto;
}

.mApp.state-modal .mSidebar,
.mApp.state-modal .mViewer,
.mApp.state-modal .mMain,
.mApp.state-modal .mComposer {
    pointer-events: none; /* NO tap-through */
}

.mApp.state-modal #chatScroll {
    overflow: hidden; /* Disabilita scroll chat */
}
```

### Overlay Tap Handler

```javascript
// Overlay chiude sidebar quando cliccato
function setupSidebarOverlay() {
    const overlay = document.getElementById('sidebarOverlay');
    if (!overlay) return;
    
    overlay.addEventListener('click', () => {
        if (currentMobileState === MOBILE_STATES.SIDEBAR_OPEN) {
            setMobileState(MOBILE_STATES.CHAT);
            closeSidebar();
        }
    });
}
```

---

## 📜 Scroll Policy (1 scroll container per stato)

**Regola**: Un solo scroll container attivo per stato.

### CHAT (Stato Default)

**Scroll Attivo:**
- `#chatScroll` (`.mScroller`) - **unico scroll container**

**Scroll Disattivo:**
- `mMain` non scrolla (`overflow: hidden`)
- `body` non si tocca (gestito da LayoutBoundary)

**CSS:**
```css
.mApp.state-chat #chatScroll {
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    flex: 1;
    min-height: 0;
}
```

### SIDEBAR_OPEN

**Scroll Attivo:**
- Lista conversazioni dentro `.mSidebar .chat-sidebar-list`

**Scroll Disattivo:**
- `#chatScroll` → `overflow: hidden` (opzione A) o `pointer-events: none` (opzione B)

**CSS:**
```css
.mApp.state-sidebar #chatScroll {
    overflow: hidden; /* Opzione A: disabilita scroll */
    /* O */
    pointer-events: none; /* Opzione B: mantiene overflow ma blocca interazione */
}

.mApp.state-sidebar .chat-sidebar-list {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
}
```

### VIEWER_OPEN

**Scroll Attivo:**
- Viewer body interno (`.mViewer .viewer-content`)

**Scroll Disattivo:**
- Chat e sidebar completamente disabilitati

**CSS:**
```css
.mApp.state-viewer .mViewer .viewer-content {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    height: calc(100dvh - header-height);
}

.mApp.state-viewer #chatScroll {
    overflow: hidden;
    pointer-events: none;
}
```

### MODAL_OPEN

**Scroll Attivo:**
- Se modal ha contenuto lungo, scroll nel modal (`.mModal`)

**Scroll Disattivo:**
- Tutto sotto non scrolla

**CSS:**
```css
.mApp.state-modal .mModal {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    max-height: 90dvh;
}

.mApp.state-modal #chatScroll {
    overflow: hidden;
    pointer-events: none;
}
```

---

## 🧩 Componenti Principali

### 1. Header Mobile (`.mHeader`)

**Elementi:**
- `#sidebar-toggle`: Hamburger menu (toggle sidebar)
- `.logo-container`: Logo Gio.ia
- `.chat-title`: Titolo "Gio.ia"

**Caratteristiche:**
- Sticky top (`position: sticky`, `top: 0`)
- Z-index: `var(--z-header)` (10)
- Background: `var(--color-white)`
- Border bottom per separazione

**CSS:**
```css
.mHeader {
    position: sticky;
    top: 0;
    z-index: var(--z-header);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background-color: var(--color-white);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    isolation: isolate;
    pointer-events: auto;
}
```

**Tap Isolation:**
- Logo e titolo: `pointer-events: none` (non intercettano tap)
- Solo hamburger: `pointer-events: auto`

### 2. Main Content (`.mMain`)

**Struttura:**
```
mMain (flex container, overflow: hidden)
└── mScroller (#chatScroll) - SCROLL ROOT
    ├── welcome-message
    └── chat-message (dinamici)
```

**CSS:**
```css
.mMain {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.mScroller {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    min-height: 0;
    padding: 16px;
}
```

### 3. Scroll Root Mobile (`#chatScroll`)

**⭐ SCROLL ROOT MOBILE**: `#chatScroll` (`.mScroller`)

**Caratteristiche:**
- Unico scroll container della chat
- Gestisce tutti i messaggi
- Scroll fluido con `-webkit-overflow-scrolling: touch`
- `min-height: 0` per permettere shrink in flex

**Scroll Automatico:**
```javascript
// Dopo aggiunta messaggio
const scrollContainer = document.getElementById('chatScroll');
scrollContainer.scrollTop = scrollContainer.scrollHeight;
```

### 4. Composer Mobile (`.mComposer`)

**Elementi:**
- `#chat-form-mobile`: Form submit
- `#chat-input-mobile`: Textarea auto-resize
- `#chat-send-btn-mobile`: Pulsante invio

**Caratteristiche:**
- Sticky bottom (`position: sticky`, `bottom: 0`)
- Z-index: `var(--z-composer)` (10)
- Background: `var(--color-white)`
- Border top per separazione

**Keyboard-Safe:**
- Usa `100dvh` per evitare jump su iOS
- Opzionale: `window.visualViewport` per gestione tastiera perfetta

**CSS:**
```css
.mComposer {
    position: sticky;
    bottom: 0;
    z-index: var(--z-composer);
    background-color: var(--color-white);
    border-top: 1px solid var(--color-border);
    padding: 12px 16px;
    flex-shrink: 0;
}
```

### 5. Sidebar Mobile (Drawer Conversazioni)

**Struttura:**
```
mSidebar (#chatSidebar)
├── chat-sidebar-header
│   └── new-chat-btn-mobile
└── chat-sidebar-list (#chat-sidebar-list-mobile)
    └── chat-sidebar-item (dinamici)
```

**Comportamento:**
- **Drawer overlay** (non persistente come desktop)
- Toggle da hamburger in `.mHeader`
- Apertura: aggiunge `is-open` a `#chatSidebar` e rende visibile `#sidebarOverlay`
- Chiusura:
  - Tap su overlay
  - Tap su una conversazione (auto-close)
  - (Opzionale: gesture swipe)

**CSS Stati:**
```css
.mSidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: 280px;
    height: 100dvh;
    background-color: var(--color-white);
    z-index: var(--z-sidebar);
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    pointer-events: none;
}

.mSidebar.is-open {
    transform: translateX(0);
    pointer-events: auto;
}

.mOverlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100dvh;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: var(--z-overlay);
    display: none;
    pointer-events: none;
}

.mOverlay.is-open {
    display: block;
    pointer-events: auto;
}
```

**Anti-Bug:**
- Overlay copre tutto e cattura tap (`pointer-events: auto`)
- Nessun elemento sotto resta tappabile (`pointer-events: none` sul layer chat)

### 6. Viewer Mobile (Sheet Dettagli Vino)

**Struttura:**
```
mViewer (#viewerPanel)
└── viewer-content
    ├── viewer-header
    │   ├── viewer-title
    │   └── viewer-close-btn
    └── viewer-body (scrollabile)
```

**Comportamento:**
- **Sheet/pagina** (non split-view come desktop)
- VIEWER_OPEN mostra `#viewerPanel` come layer sopra la chat (quasi full screen)
- Header viewer con back/close (X) e titolo vino
- Viewer body scrollabile separatamente

**Regole:**
- Quando viewer aperto:
  - Sidebar chiusa (sempre)
  - Composer disabilitato (`pointer-events: none`)
  - Nessun tap sotto

**CSS:**
```css
.mViewer {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100dvh;
    background-color: var(--color-white);
    z-index: var(--z-viewer);
    display: none;
    pointer-events: none;
}

.mViewer:not([hidden]) {
    display: flex;
    flex-direction: column;
    pointer-events: auto;
}

.mViewer .viewer-content {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 16px;
}
```

**Feature Opzionali (non implementate ora):**
- Swipe-to-close
- Transizioni complesse con inertia

### 7. Modal Mobile (Azioni/Conferme)

**Struttura:**
```
mModal (#anyModal)
└── modal-content
    ├── modal-header
    │   └── modal-close-btn
    └── modal-body
```

**Comportamento:**
- **Top layer sempre** (z-index: 60)
- Blocca tutto sotto
- Chiusura: X o CTA
- Click-outside solo per modali non distruttivi

**CSS:**
```css
.mModal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100dvh;
    background-color: rgba(0, 0, 0, 0.7);
    z-index: var(--z-modal);
    display: none;
    align-items: center;
    justify-content: center;
    pointer-events: none;
}

.mModal:not([hidden]) {
    display: flex;
    pointer-events: auto;
}

.mModal .modal-content {
    background-color: var(--color-white);
    border-radius: 12px;
    padding: 24px;
    max-width: 90%;
    max-height: 90dvh;
    overflow-y: auto;
}
```

**Nice-to-Have (non implementato ora):**
- Focus trap/accessibilità completa

---

## ⚙️ Funzionalità JavaScript

### 1. State Management

#### `setMobileState(newState)`
```javascript
const MOBILE_STATES = {
    CHAT: 'chat',
    SIDEBAR_OPEN: 'sidebar',
    VIEWER_OPEN: 'viewer',
    MODAL_OPEN: 'modal'
};

let currentMobileState = MOBILE_STATES.CHAT;

function setMobileState(newState) {
    const mApp = document.querySelector('.mApp');
    if (!mApp) return;
    
    // Rimuovi tutte le classi stato
    mApp.classList.remove('state-chat', 'state-sidebar', 'state-viewer', 'state-modal');
    
    // Applica nuovo stato
    mApp.classList.add(`state-${newState}`);
    currentMobileState = newState;
    
    // Gestisci transizioni specifiche
    handleStateTransition(newState);
}

function handleStateTransition(newState) {
    switch (newState) {
        case MOBILE_STATES.SIDEBAR_OPEN:
            // Chiudi viewer se aperto
            if (currentMobileState === MOBILE_STATES.VIEWER_OPEN) {
                closeViewer();
            }
            openSidebar();
            break;
            
        case MOBILE_STATES.VIEWER_OPEN:
            // Chiudi sidebar se aperto
            if (currentMobileState === MOBILE_STATES.SIDEBAR_OPEN) {
                closeSidebar();
            }
            openViewer();
            break;
            
        case MOBILE_STATES.MODAL_OPEN:
            openModal();
            break;
            
        case MOBILE_STATES.CHAT:
            // Chiudi tutto
            closeSidebar();
            closeViewer();
            closeModal();
            break;
    }
}
```

### 2. Sidebar Management

#### `openSidebar()`
```javascript
function openSidebar() {
    const sidebar = document.getElementById('chatSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (!sidebar || !overlay) return;
    
    sidebar.classList.add('is-open');
    overlay.classList.add('is-open');
    setMobileState(MOBILE_STATES.SIDEBAR_OPEN);
}
```

#### `closeSidebar()`
```javascript
function closeSidebar() {
    const sidebar = document.getElementById('chatSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (!sidebar || !overlay) return;
    
    sidebar.classList.remove('is-open');
    overlay.classList.remove('is-open');
    setMobileState(MOBILE_STATES.CHAT);
}
```

#### `toggleSidebar()`
```javascript
function toggleSidebar() {
    if (currentMobileState === MOBILE_STATES.SIDEBAR_OPEN) {
        closeSidebar();
    } else {
        openSidebar();
    }
}
```

#### `setupSidebarOverlay()`
```javascript
function setupSidebarOverlay() {
    const overlay = document.getElementById('sidebarOverlay');
    if (!overlay) return;
    
    overlay.addEventListener('click', () => {
        if (currentMobileState === MOBILE_STATES.SIDEBAR_OPEN) {
            closeSidebar();
        }
    });
}
```

### 3. Viewer Management

#### `openViewer(wineData)`
```javascript
function openViewer(wineData) {
    const viewer = document.getElementById('viewerPanel');
    if (!viewer) return;
    
    // Copia contenuto dal viewer desktop o genera nuovo
    const viewerContent = viewer.querySelector('.viewer-content');
    // ... popola contenuto ...
    
    viewer.removeAttribute('hidden');
    setMobileState(MOBILE_STATES.VIEWER_OPEN);
}
```

#### `closeViewer()`
```javascript
function closeViewer() {
    const viewer = document.getElementById('viewerPanel');
    if (!viewer) return;
    
    viewer.setAttribute('hidden', '');
    setMobileState(MOBILE_STATES.CHAT);
}
```

### 4. Modal Management

#### `openModal(content)`
```javascript
function openModal(content) {
    const modal = document.getElementById('anyModal');
    if (!modal) return;
    
    const modalContent = modal.querySelector('.modal-content') || modal;
    modalContent.innerHTML = content;
    
    modal.removeAttribute('hidden');
    setMobileState(MOBILE_STATES.MODAL_OPEN);
}
```

#### `closeModal()`
```javascript
function closeModal() {
    const modal = document.getElementById('anyModal');
    if (!modal) return;
    
    modal.setAttribute('hidden', '');
    setMobileState(MOBILE_STATES.CHAT);
}
```

### 5. Chat Management (Mobile-Specific)

#### `initChatMobile()`
```javascript
function initChatMobile() {
    const selectors = window.ChatSelectors?.get();
    if (!selectors || selectors.layout !== 'mobile') {
        console.warn('[ChatMobile] Selectors non disponibili o layout non mobile');
        return;
    }
    
    // Setup form submit
    const form = selectors.form();
    if (form) {
        form.addEventListener('submit', handleChatSubmitMobile);
    }
    
    // Setup input keydown
    const input = selectors.input();
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                form?.dispatchEvent(new Event('submit'));
            }
        });
    }
    
    // Setup sidebar toggle
    const sidebarToggle = selectors.sidebarToggle();
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    // Setup overlay
    setupSidebarOverlay();
    
    // Setup viewer close
    const viewerClose = document.querySelector('#viewerPanel .viewer-close-btn');
    if (viewerClose) {
        viewerClose.addEventListener('click', closeViewer);
    }
    
    console.log('[ChatMobile] Inizializzato');
}
```

#### `handleChatSubmitMobile(e)`
```javascript
async function handleChatSubmitMobile(e) {
    e.preventDefault();
    
    const selectors = window.ChatSelectors?.get();
    const input = selectors?.input();
    const form = selectors?.form();
    
    if (!input || !form) {
        console.error('[ChatMobile] Input o form non trovati');
        return;
    }
    
    const message = input.value.trim();
    if (!message) return;
    
    // Pulisci input
    input.value = '';
    
    // Aggiungi messaggio utente
    addChatMessageMobile('user', message);
    
    // Invia al server
    try {
        const response = await window.ChatAPI?.sendMessage(message);
        if (response && response.message) {
            addChatMessageMobile('ai', response.message, false, false, null, response.is_html);
        }
    } catch (error) {
        console.error('[ChatMobile] Errore invio messaggio:', error);
        addChatMessageMobile('ai', 'Errore invio messaggio', false, true);
    }
}
```

#### `addChatMessageMobile(role, content, isLoading, isError, wineData, isHtml)`
```javascript
function addChatMessageMobile(role, content, isLoading = false, isError = false, wineData = null, isHtml = false) {
    const selectors = window.ChatSelectors?.get();
    const scrollContainer = selectors?.scrollContainer(); // #chatScroll
    
    if (!scrollContainer) {
        console.error('[ChatMobile] Scroll container non trovato');
        return null;
    }
    
    // Crea elemento messaggio
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${role}`;
    
    // Aggiungi contenuto (HTML o testo)
    if (isHtml) {
        messageElement.innerHTML = content;
    } else {
        messageElement.textContent = content;
    }
    
    // Gestione wine cards
    if (wineData) {
        // ... renderizza wine card ...
    }
    
    // Aggiungi al DOM
    scrollContainer.appendChild(messageElement);
    
    // Scroll automatico
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
    
    return messageElement;
}
```

### 6. Cleanup (Fondamentale)

**Quando si cambia layout:**
```javascript
function cleanupChatMobile() {
    // Rimuovi tutti i listener
    const form = document.getElementById('chat-form-mobile');
    const input = document.getElementById('chat-input-mobile');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const overlay = document.getElementById('sidebarOverlay');
    
    // Clone e replace per rimuovere listener
    if (form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
    }
    
    // Reset stato
    setMobileState(MOBILE_STATES.CHAT);
    
    // Abort controllers se presenti
    // ...
    
    console.log('[ChatMobile] Cleanup completato');
}
```

**Chiamata in `switchLayout()`:**
```javascript
function switchLayout() {
    const isMobile = isMobileView();
    
    if (isMobile) {
        // Cleanup desktop se necessario
        if (typeof window.ChatDesktop !== 'undefined') {
            window.ChatDesktop.cleanup?.();
        }
        
        // Init mobile
        if (typeof window.ChatMobile !== 'undefined') {
            window.ChatMobile.init();
        }
    } else {
        // Cleanup mobile
        if (typeof window.ChatMobile !== 'undefined') {
            window.ChatMobile.cleanup?.();
        }
        
        // Init desktop
        if (typeof window.ChatDesktop !== 'undefined') {
            window.ChatDesktop.init();
        }
    }
}
```

---

## 🔗 Integrazione con LayoutBoundary

### Namespace Application
```javascript
// In switchLayout()
if (isMobile) {
    LayoutBoundary.init('mobile');
}
```

**Risultato:**
- Classe `.mobileRoot` su `<html>` e `<body>`
- CSS variable `--scroll-container: #chatScroll`
- Isolamento CSS completo da desktop

### Chat Selectors Integration
```javascript
// In createChatSelectors()
const root = getLayoutRoot(); // Cerca data-layout-root="mobile"

if (isMobile) {
    return {
        scrollContainer: () => root.querySelector('#chatScroll') || root.querySelector('.mScroller'),
        form: () => root.querySelector('#chat-form-mobile'),
        input: () => root.querySelector('#chat-input-mobile'),
        sidebar: () => root.querySelector('#chatSidebar'),
        sidebarToggle: () => root.querySelector('#sidebar-toggle'),
        // ...
        layout: 'mobile',
        root: root
    };
}
```

**Benefici:**
- Selettori isolati per mobile
- Nessuna collisione con desktop
- Root-based queries (più sicuro)

---

## ✅ Acceptance Criteria Mobile (Verificabili)

### 1. Tap Isolation

**Test**: Con sidebar aperta
- ✅ Nessun tap passa alla chat sotto
- ✅ Chat non scrolla
- ✅ Overlay cattura tap e chiude sidebar

**Verifica:**
```javascript
// In stato SIDEBAR_OPEN
const mMain = document.querySelector('.mMain');
const computed = window.getComputedStyle(mMain);
console.assert(computed.pointerEvents === 'none', 'mMain deve avere pointer-events: none');
```

### 2. Viewer Isolation

**Test**: Con viewer aperto
- ✅ Nessun tap passa alla chat o sidebar
- ✅ Scroll solo nel viewer
- ✅ Composer disabilitato

**Verifica:**
```javascript
// In stato VIEWER_OPEN
const mComposer = document.querySelector('.mComposer');
const computed = window.getComputedStyle(mComposer);
console.assert(computed.pointerEvents === 'none', 'mComposer deve avere pointer-events: none');
```

### 3. Modal Isolation

**Test**: Con modal aperto
- ✅ Niente sotto è tappabile
- ✅ Niente sotto è scrollabile
- ✅ Modal è top layer

**Verifica:**
```javascript
// In stato MODAL_OPEN
const mModal = document.querySelector('.mModal');
const zIndex = window.getComputedStyle(mModal).zIndex;
console.assert(parseInt(zIndex) >= 60, 'Modal deve avere z-index >= 60');
```

### 4. Chat Scroll Stabile

**Test**: In stato CHAT
- ✅ Scroll solo su `#chatScroll`
- ✅ Scroll fluido (`-webkit-overflow-scrolling: touch`)
- ✅ Scroll automatico dopo aggiunta messaggio

**Verifica:**
```javascript
// In stato CHAT
const chatScroll = document.getElementById('chatScroll');
const computed = window.getComputedStyle(chatScroll);
console.assert(computed.overflowY === 'auto', 'chatScroll deve avere overflow-y: auto');
console.assert(chatScroll.scrollHeight > chatScroll.clientHeight, 'chatScroll deve essere scrollabile');
```

### 5. Isolamento CSS

**Test**: Nessuna regola CSS mobile tocca desktop
- ✅ Tutte le regole mobile usano namespace `.mobileRoot` o prefisso `.m*`
- ✅ Nessuna regola globale che impatta desktop

**Verifica:**
```javascript
// Verifica che non ci siano regole globali pericolose
const stylesheets = Array.from(document.styleSheets);
stylesheets.forEach(sheet => {
    try {
        const rules = Array.from(sheet.cssRules || []);
        rules.forEach(rule => {
            if (rule.selectorText && 
                (rule.selectorText.includes('.chat-sidebar') || 
                 rule.selectorText.includes('.chat-header')) &&
                !rule.selectorText.includes('.mobileRoot') &&
                !rule.selectorText.startsWith('.m')) {
                console.warn('Regola potenzialmente pericolosa:', rule.selectorText);
            }
        });
    } catch (e) {
        // Cross-origin stylesheet, skip
    }
});
```

---

## 🎯 Best Practices Mobile

### 1. State Management
- ✅ Usa sempre `setMobileState()` per cambiare stato
- ✅ Gestisci transizioni in `handleStateTransition()`
- ✅ Un solo stato attivo alla volta

### 2. Tap Isolation
- ✅ Usa `pointer-events: none` su layer disabilitati
- ✅ Usa `pointer-events: auto` solo su layer attivo
- ✅ Overlay deve sempre catturare tap

### 3. Scroll Management
- ✅ Un solo scroll container attivo per stato
- ✅ Disabilita scroll chat quando sidebar/viewer/modal aperti
- ✅ Usa `overflow: hidden` invece di `pointer-events: none` per scroll

### 4. Cleanup
- ✅ Rimuovi listener al cambio layout
- ✅ Reset stato a CHAT al cleanup
- ✅ Abort controllers se presenti

### 5. Performance
- ✅ Usa `transform` invece di `left/right` per animazioni
- ✅ `will-change: transform` su elementi animati
- ✅ `-webkit-overflow-scrolling: touch` per scroll fluido

---

## 🚀 Prossimi Sviluppi

### Funzionalità Opzionali (Non Implementate Ora)

1. **Gestione Tastiera iOS Perfetta**
   - Usa `window.visualViewport` per aggiornare CSS var
   - Mantiene composer visibile durante keyboard

2. **Swipe Gesture**
   - Swipe-to-close sidebar
   - Swipe-to-close viewer
   - Richiede libreria dedicata (es. Hammer.js)

3. **Focus Trap/Accessibilità**
   - Focus trap in modal
   - Navigazione keyboard completa
   - Screen reader support

### Migrazione CSS Layout-Specific

1. Creare `layout/MobileLayout/mobile.css`
2. Spostare regole da `styles.css` con namespace `.mobileRoot`
3. Isolare completamente da desktop

---

## 📝 Note Implementazione

### Breakpoint Responsive
- **Mobile**: `width <= 768px`
- **Desktop**: `width > 768px`
- Switch automatico al resize

### Z-Index Scale
```css
:root {
    --z-header: 10;
    --z-composer: 10;
    --z-fab: 20;
    --z-overlay: 30;
    --z-sidebar: 40;
    --z-viewer: 50;
    --z-modal: 60;
}
```

### Keyboard Handling
- **Enter**: Submit form (no Shift)
- **Shift+Enter**: Newline in textarea
- **Escape**: Chiudi modal/viewer (opzionale)

---

**Ultima modifica**: 2024
**Versione**: 1.0.0
**Filosofia**: Semplice, affidabile, prevedibile
