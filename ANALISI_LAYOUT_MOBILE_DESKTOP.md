# Analisi Layout Mobile e Desktop

## 📋 Panoramica

L'applicazione gestisce due layout completamente separati:
- **Mobile Layout** (`#mobile-layout`): Architettura pulita con prefisso `.m*`
- **Desktop Layout** (`#desktop-layout`): Struttura tradizionale con classi standard

## 🏗️ Struttura HTML

### Mobile Layout (`#mobile-layout`)
```html
<div id="mobile-layout" class="mApp layout-container" style="display: none;">
    <header class="mHeader">...</header>
    <main class="mMain">
        <div class="mScroller" id="chatScroll">...</div>
    </main>
    <footer class="mComposer">...</footer>
    <div class="mOverlay" id="sidebarOverlay"></div>
    <aside class="mSidebar" id="chatSidebar">...</aside>
    <section class="mViewer" id="viewerPanel">...</section>
    <div class="mModal" id="anyModal"></div>
</div>
```

**Elementi chiave:**
- `.mApp`: Container principale con `display: grid`
- `.mHeader`: Header sticky con hamburger menu
- `.mMain`: Area principale scrollabile
- `.mScroller`: Container scroll per messaggi (`#chatScroll`)
- `.mComposer`: Footer con form input chat
- `.mSidebar`: Sidebar laterale (overlay)
- `.mViewer`: Viewer per dettagli vini
- `.mModal`: Modal generico

### Desktop Layout (`#desktop-layout`)
```html
<div id="desktop-layout" class="desktop-layout layout-container" style="display: none;">
    <aside id="chat-sidebar" class="chat-sidebar">...</aside>
    <div class="chat-main-content">
        <header class="chat-header">...</header>
        <div class="chat-container">
            <div class="chat-messages-container" id="chat-messages">
                <div class="chat-messages-scroll-wrapper" id="chat-messages-scroll-wrapper">...</div>
            </div>
            <div class="chat-input-container">
                <form id="chat-form">...</form>
            </div>
        </div>
    </div>
</div>
```

**Elementi chiave:**
- `.desktop-layout`: Container principale con `display: flex`
- `#chat-sidebar`: Sidebar laterale sempre visibile
- `.chat-main-content`: Area principale con header e chat
- `#chat-messages`: Container messaggi
- `#chat-messages-scroll-wrapper`: Wrapper scrollabile per messaggi
- `#chat-form`: Form input chat

## 🎨 Gestione CSS

### Breakpoint
- **Mobile**: `@media (max-width: 768px)`
- **Desktop**: `@media (min-width: 769px)` o default

### Classe di utilità
- `.mobile-only`: Visibile solo su mobile (gestita da JS)
- `.desktop-only`: Visibile solo su desktop (gestita da JS)

### Layout Mobile (`.mApp`)
```css
.mApp {
    height: 100dvh;
    display: grid;
    grid-template-rows: auto 1fr auto; /* Header, Main, Composer */
    overflow: hidden;
    position: relative;
}
```

### Layout Desktop (`.desktop-layout`)
```css
.desktop-layout {
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100vh;
}
```

## ⚙️ Gestione JavaScript

### Funzione di rilevamento
```javascript
function isMobileView() {
    return window.innerWidth <= 768;
}
```

### Switch Layout
```javascript
function switchLayout() {
    const mobileLayout = document.getElementById('mobile-layout');
    const desktopLayout = document.getElementById('desktop-layout');
    const isMobile = isMobileView();
    
    if (isMobile) {
        mobileLayout.style.display = 'grid';  // mApp usa grid
        desktopLayout.style.display = 'none';
    } else {
        mobileLayout.style.display = 'none';
        desktopLayout.style.display = 'flex';  // desktop-layout usa flex
    }
}
```

### Inizializzazione
- `initLayoutManager()`: Chiamata all'avvio e al resize
- `refreshLayoutOnShow()`: Chiamata quando la chat page viene mostrata
- Listener resize con debounce di 150ms

## 🔄 Elementi Comuni e Differenze

### Messaggi Chat

**Mobile:**
- Container: `.mScroller` (`#chatScroll`)
- Funzione: `getChatScroller()` cerca `#chatScroll` o `.mScroller`
- Scroll: Gestito da `.mScroller` con overflow-y

**Desktop:**
- Container: `#chat-messages-scroll-wrapper`
- Funzione: `getChatScroller()` cerca `#chat-messages-scroll-wrapper` o `#chat-messages`
- Scroll: Gestito da `.chat-messages-scroll-wrapper` con overflow-y

**Funzione comune:** `addChatMessage()` usa `getChatScroller()` che gestisce entrambi

### Form Input Chat

**Mobile:**
- Form ID: `#chat-form-mobile`
- Input ID: `#chat-input-mobile`
- Button ID: `#chat-send-btn-mobile`
- Container: `.mComposer`

**Desktop:**
- Form ID: `#chat-form`
- Input ID: `#chat-input`
- Button ID: `#chat-send-btn`
- Container: `.chat-input-container`

**Gestione:** Listener separati o condizionali basati su `isMobileView()`

### Sidebar

**Mobile:**
- ID: `#chatSidebar`
- Classe: `.mSidebar`
- Comportamento: Overlay con `is-open` class
- List ID: `#chat-sidebar-list-mobile`
- Toggle: `#sidebar-toggle`

**Desktop:**
- ID: `#chat-sidebar`
- Classe: `.chat-sidebar`
- Comportamento: Sempre visibile, può essere `collapsed`
- List ID: `#chat-sidebar-list`
- Toggle: `#sidebar-toggle-desktop`

**Gestione:** `toggleSidebar()` e `loadSidebarState()` gestiscono entrambi con logica condizionale

### Conversazioni

**Mobile:**
- List container: `#chat-sidebar-list-mobile`
- Funzione: `loadConversations()` renderizza in entrambi

**Desktop:**
- List container: `#chat-sidebar-list`
- Funzione: `loadConversations()` renderizza in entrambi

**Gestione:** `renderConversationsList()` gestisce entrambi i container

## 🎯 Punti Critici per Separazione

### 1. **Selezione Elementi**
Molte funzioni usano `isMobileView()` per selezionare elementi diversi:
```javascript
const isMobile = window.innerWidth <= 768;
const scrollWrapper = isMobile 
    ? document.getElementById('chatScroll') 
    : document.getElementById('chat-messages-scroll-wrapper');
```

### 2. **Event Listeners**
Alcuni listener sono duplicati per mobile/desktop:
- Form submit: `#chat-form` vs `#chat-form-mobile`
- Sidebar toggle: `#sidebar-toggle` vs `#sidebar-toggle-desktop`
- Input keydown: gestiti separatamente

### 3. **CSS Condizionale**
Molti stili usano media queries invece di classi:
```css
@media (max-width: 768px) {
    .mobile-only { display: block; }
    .desktop-only { display: none; }
}
```

### 4. **Funzioni Condizionali**
Molte funzioni hanno logica condizionale:
- `toggleSidebar()`: Gestisce mobile e desktop diversamente
- `loadSidebarState()`: Comportamento diverso per mobile/desktop
- `getChatScroller()`: Cerca elementi diversi

### 5. **Viewer/Modal**
- Mobile: `.mViewer` e `.mModal` con z-index scalari
- Desktop: `.viewer-panel` con comportamento diverso

## 📊 Statistiche

- **Layout containers**: 2 (`#mobile-layout`, `#desktop-layout`)
- **Form chat**: 2 (`#chat-form`, `#chat-form-mobile`)
- **Input chat**: 2 (`#chat-input`, `#chat-input-mobile`)
- **Sidebar**: 2 (`#chatSidebar`, `#chat-sidebar`)
- **Sidebar lists**: 2 (`#chat-sidebar-list`, `#chat-sidebar-list-mobile`)
- **Scroll containers**: 2 (`#chatScroll`, `#chat-messages-scroll-wrapper`)

## 🔍 Problemi Attuali

1. **Duplicazione codice**: Molte funzioni hanno logica condizionale per mobile/desktop
2. **Selezione elementi**: Logica condizionale sparsa nel codice
3. **Event listeners**: Alcuni duplicati, altri condizionali
4. **CSS**: Mix di media queries e classi utility
5. **Manutenzione**: Difficile modificare senza toccare entrambi i layout

## 💡 Opportunità di Miglioramento

1. **Separazione completa**: File/moduli separati per mobile e desktop
2. **Factory pattern**: Funzioni factory che restituiscono implementazioni corrette
3. **Strategy pattern**: Strategie diverse per mobile/desktop
4. **Unificazione API**: Interfaccia comune con implementazioni diverse
5. **CSS Modules**: Separazione CSS per layout

## 📝 Note per Separazione

Quando implementi la separazione, considera:

1. **Mantenere compatibilità**: Assicurati che le funzioni esistenti continuino a funzionare
2. **API comune**: Crea un'interfaccia comune per operazioni comuni (addMessage, toggleSidebar, ecc.)
3. **Lazy loading**: Carica solo il layout necessario
4. **Testing**: Test separati per mobile e desktop
5. **Performance**: Evita duplicazione di codice non necessario
