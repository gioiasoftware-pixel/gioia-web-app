# Implementazione Layout Isolation - Stato e Prossimi Passi

## ✅ Completato

### 1. Struttura Cartelle
- ✅ `layout/LayoutBoundary/` - Namespace isolation
- ✅ `layout/MobileLayout/` - Layout mobile (da popolare)
- ✅ `layout/DesktopLayout/` - Layout desktop (da popolare)
- ✅ `features/chat/shared/` - Business logic condivisa
- ✅ `features/chat/mobile/` - Implementazione mobile
- ✅ `features/chat/desktop/` - Implementazione desktop
- ✅ `styles/` - Reset e globals isolati

### 2. LayoutBoundary
- ✅ `LayoutBoundary.js` - Applica namespace `.mobileRoot` / `.desktopRoot`
- ✅ `layoutBoundary.css` - Isolamento CSS con namespace
- ✅ Integrato in `switchLayout()`

### 3. CSS Isolato
- ✅ `styles/reset.css` - Solo reset minimo, NO layout
- ✅ `styles/globals.css` - Solo variabili/tokens, NO layout
- ✅ CSS legacy mantenuto per compatibilità (da migrare)

### 4. Chat Factory Pattern
- ✅ `chatAPI.js` - Business logic condivisa
- ✅ `chatSelectors.js` - Factory per selettori DOM
- ✅ `ChatMobile.js` - Implementazione mobile
- ✅ `ChatDesktop.js` - Implementazione desktop
- ✅ `initChatForCurrentLayout()` - Inizializza layout corretto

## 🔄 In Corso

### 1. Migrazione CSS
- ⚠️ CSS legacy (`styles.css`) ancora presente
- ⚠️ Media queries da rimuovere o isolare
- ⚠️ Stili globali da spostare in layout-specific

### 2. Componenti Layout-Specific
- ⚠️ Sidebar: logica condizionale da separare
- ⚠️ Viewer: due implementazioni separate
- ⚠️ Form chat: già separati ma da testare

## 📋 Prossimi Passi

### Fase 1: Migrazione CSS (Priorità Alta)
1. **Separare CSS mobile da desktop**
   - Creare `layout/MobileLayout/mobile.css`
   - Creare `layout/DesktopLayout/desktop.css`
   - Spostare stili da `styles.css` nei file corretti
   - Usare namespace `.mobileRoot` e `.desktopRoot`

2. **Rimuovere media queries strutturali**
   - Identificare media queries che cambiano layout/hierarchy
   - Convertire in classi layout-specific
   - Mantenere solo media queries cosmetiche (spacing/font)

3. **Isolare scroll CSS**
   - Mobile: scroll su `.mScroller`
   - Desktop: scroll su `.chat-messages-scroll-wrapper`
   - Nessun `overflow: hidden` globale su `body/html`

### Fase 2: Separazione Componenti (Priorità Media)
1. **Sidebar**
   - `features/sidebar/mobile/SidebarMobile.js`
   - `features/sidebar/desktop/SidebarDesktop.js`
   - `features/sidebar/shared/sidebarAPI.js`

2. **Viewer**
   - `features/viewer/mobile/ViewerMobile.js`
   - `features/viewer/desktop/ViewerDesktop.js`
   - `features/viewer/shared/viewerAPI.js`

3. **Conversazioni**
   - `features/conversations/shared/conversationsAPI.js`
   - Render separato per mobile/desktop

### Fase 3: Testing e Validazione (Priorità Alta)
1. **Acceptance Criteria**
   - ✅ Modificare CSS mobile non cambia desktop
   - ✅ Modificare CSS desktop non cambia mobile
   - ✅ Scroll desktop chat stabile
   - ✅ Scroll mobile stabile
   - ⚠️ Nessun selector condiviso tra layout (da verificare)

2. **Test E2E**
   - Desktop: chat scroll works + input raggiungibile
   - Mobile: layout render + scroll works
   - Switch layout: nessuna regressione

## 🎯 Regole da Rispettare

### ✅ Consentito
- CSS variables in `globals.css`
- Font-face in `globals.css`
- Reset minimo in `reset.css`
- Business logic condivisa in `features/*/shared/`
- Componenti UI atomici (Button, Input, ecc.)

### ❌ Vietato
- CSS globali che impattano entrambi i layout
- Media queries che cambiano struttura/hierarchy
- Selector condivisi tra mobile/desktop (es: `.container`, `.chat`)
- `overflow/height/position` su `html/body` device-agnostic
- Componenti "responsive" con logica condizionale complessa

## 📝 Note Implementazione

### Namespace CSS
Tutti gli stili layout-specific devono essere scoped:
```css
/* Mobile */
.mobileRoot .mApp { ... }
.mobileRoot .mHeader { ... }

/* Desktop */
.desktopRoot .desktop-layout { ... }
.desktopRoot .chat-main-content { ... }
```

### Factory Pattern
Usare `ChatSelectors.get()` invece di selezionare direttamente:
```javascript
// ❌ NO
const input = document.getElementById('chat-input');

// ✅ SÌ
const selectors = ChatSelectors.get();
const input = selectors.input();
```

### Scroll Container
Definito via CSS variable:
- Mobile: `--scroll-container: #chatScroll`
- Desktop: `--scroll-container: #chat-messages-scroll-wrapper`

## 🔍 Debugging

Per verificare che la separazione funzioni:
1. Apri DevTools
2. Verifica namespace: `document.documentElement.classList`
3. Verifica CSS variables: `getComputedStyle(document.documentElement).getPropertyValue('--scroll-container')`
4. Modifica CSS mobile e verifica che desktop non cambi
5. Modifica CSS desktop e verifica che mobile non cambi
