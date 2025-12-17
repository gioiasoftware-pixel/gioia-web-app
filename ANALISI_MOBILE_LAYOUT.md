# Analisi Layout Mobile - Gio.ia Web App

## Data Analisi
**Data**: 2025-01-XX  
**Versione Desktop Analizzata**: Commit corrente  
**Obiettivo**: Creare layout mobile ottimizzato dedicato

---

## 1. ANALISI STRUTTURA DESKTOP ATTUALE

### 1.1 Architettura Layout Desktop

```
┌─────────────────────────────────────────────────────────────┐
│                    CHAT PAGE (flex row)                      │
├──────────────┬──────────────────────────────────────────────┤
│              │                                               │
│  SIDEBAR     │         MAIN CONTENT AREA                     │
│  (280px)     │         (flex: 1)                             │
│              │                                               │
│  - Lista     │  ┌─────────────────────────────────────┐    │
│    chat      │  │ HEADER (fixed top)                    │    │
│  - Nuova     │  │ - Logo + Titolo                      │    │
│    chat      │  │ - Toggle tema                        │    │
│              │  │ - Aggiungi Vino                      │    │
│              │  │ - Esci                               │    │
│              │  └─────────────────────────────────────┘    │
│              │                                               │
│              │  ┌─────────────────────────────────────┐    │
│              │  │ CHAT MESSAGES                        │    │
│              │  │ - Welcome message                    │    │
│              │  │ - Wine cards                         │    │
│              │  │ - Movement cards                      │    │
│              │  │ - Chat bubbles (user/AI)             │    │
│              │  └─────────────────────────────────────┘    │
│              │                                               │
│              │  ┌─────────────────────────────────────┐    │
│              │  │ CHAT INPUT (fixed bottom)            │    │
│              │  │ - Textarea                           │    │
│              │  │ - Send button                        │    │
│              │  └─────────────────────────────────────┘    │
│              │                                               │
└──────────────┴──────────────────────────────────────────────┘
                              │
                              │ (draggable sidebar)
                              ▼
                    ┌─────────────────────┐
                    │ VIEWER PANEL        │
                    │ (right side)        │
                    │ - Inventario table  │
                    │ - Filtri            │
                    │ - Search            │
                    │ - Pagination        │
                    └─────────────────────┘
```

### 1.2 Componenti Principali Desktop

#### A. **Sidebar Chat** (`.chat-sidebar`)
- **Posizione**: Fissa a sinistra, sempre visibile
- **Larghezza**: 280px (collassabile)
- **Contenuto**:
  - Header: Bottone "Nuova chat"
  - Lista conversazioni con:
    - Titolo chat
    - Timestamp (es. "2h fa")
    - Pulsante cancellazione rotondo
- **Comportamento**: Collassabile su desktop

#### B. **Main Content Area** (`.chat-main-content`)
- **Layout**: Flex column
- **Componenti**:
  1. **Header** (`.chat-header`)
     - Logo + Titolo a sinistra
     - Toggle tema + Aggiungi Vino + Esci a destra
  2. **Chat Container** (`.chat-container`)
     - Messages area scrollabile
     - Input area fissa in basso
  3. **Wine Cards** (`.wine-card`)
     - Card bianche con informazioni vino
     - Bookmark "Modifica" e "Mostra in inventario"
  4. **Movement Cards** (`.movement-card`)
     - Card per conferma movimenti

#### C. **Viewer Panel** (`.viewer-panel`)
- **Posizione**: Sidebar destra draggabile
- **Contenuto**:
  - Header con titolo, download CSV, fullscreen, close
  - Search bar
  - Filtri (Tipologia, Annata, Cantina, Fornitori)
  - Tabella inventario (scrollabile)
  - Paginazione
- **Toggle**: Bottone fisso a destra per aprire/chiudere

#### D. **Modals**
- **Add Wine Modal**: Form completo per aggiungere vino
- **Edit Wine Modal**: Form per modificare vino (chat e viewer)
- **Movements Chart Modal**: Grafico movimenti vino

---

## 2. ANALISI LAYOUT MOBILE ATTUALE

### 2.1 Breakpoint Attuale
- **Mobile**: `@media (max-width: 768px)`
- **Desktop**: `@media (min-width: 769px)`

### 2.2 Comportamento Mobile Attuale

#### Sidebar Chat
- ✅ **Già implementato**: Sidebar nascosta di default (`transform: translateX(-100%)`)
- ✅ **Già implementato**: Overlay quando aperta
- ✅ **Già implementato**: Apertura/chiusura con hamburger menu
- ✅ **Già implementato**: Larghezza 75vw (max 400px)

#### Header
- ⚠️ **Problema**: Troppi elementi (logo, titolo, toggle, aggiungi vino, esci)
- ⚠️ **Problema**: Bottone "Aggiungi Vino" con testo potrebbe essere troppo largo
- ⚠️ **Problema**: Toggle e pulsanti potrebbero essere troppo piccoli per touch

#### Chat Messages
- ✅ **OK**: Scroll funzionante
- ⚠️ **Problema**: Wine cards potrebbero essere troppo larghe
- ⚠️ **Problema**: Movement cards potrebbero essere troppo larghe

#### Viewer Panel
- ⚠️ **Problema**: Sidebar destra non ottimizzata per mobile
- ⚠️ **Problema**: Tabella inventario non responsive (troppe colonne)
- ⚠️ **Problema**: Filtri potrebbero essere troppo stretti
- ⚠️ **Problema**: Fullscreen button nascosto ma funzionalità potrebbe servire

#### Modals
- ⚠️ **Problema**: Form potrebbero essere troppo larghi
- ⚠️ **Problema**: Input fields potrebbero essere troppo piccoli per touch

---

## 3. PROPOSTA LAYOUT MOBILE OTTIMIZZATO

### 3.1 Architettura Mobile Proposta

```
┌─────────────────────────────────────┐
│         MOBILE VIEW (100vw)         │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ HEADER (fixed top)            │ │
│  │ - Hamburger (left)            │ │
│  │ - Logo + Titolo (center)      │ │
│  │ - Toggle tema (right)         │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ MAIN CONTENT (scrollable)      │ │
│  │                                │ │
│  │  ┌─────────────────────────┐  │ │
│  │  │ QUICK ACTIONS BAR        │  │ │
│  │  │ - Aggiungi Vino (icon)   │  │ │
│  │  │ - Inventario (icon)      │  │ │
│  │  │ - Esci (icon)            │  │ │
│  │  └─────────────────────────┘  │ │
│  │                                │ │
│  │  ┌─────────────────────────┐  │ │
│  │  │ CHAT MESSAGES            │  │ │
│  │  │ - Welcome message        │  │ │
│  │  │ - Wine cards (full width)│  │ │
│  │  │ - Movement cards         │  │ │
│  │  │ - Chat bubbles           │  │ │
│  │  └─────────────────────────┘  │ │
│  │                                │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ CHAT INPUT (fixed bottom)      │ │
│  │ - Textarea (larger)            │ │
│  │ - Send button                  │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘

SIDEBAR (overlay quando aperta):
┌─────────────────────┐
│ SIDEBAR CHAT         │
│ - Nuova chat         │
│ - Lista conversazioni│
│                      │
└─────────────────────┘

VIEWER (fullscreen modal quando aperto):
┌─────────────────────────────────────┐
│ VIEWER FULLSCREEN                   │
│ - Header con close                   │
│ - Search                             │
│ - Filtri (accordion)                │
│ - Tabella (card layout)              │
│ - Pagination                         │
└─────────────────────────────────────┘
```

### 3.2 Modifiche Principali Proposte

#### A. **Header Mobile**
- **Ridotto**: Solo hamburger + logo/titolo + toggle tema
- **Quick Actions Bar**: Nuova barra sotto header con:
  - Icona "Aggiungi Vino" (senza testo)
  - Icona "Inventario" (apre viewer)
  - Icona "Esci" (senza testo)
- **Posizionamento**: Fixed top con z-index alto

#### B. **Sidebar Chat Mobile**
- **Mantenere**: Comportamento attuale (overlay)
- **Migliorare**: 
  - Aggiungere swipe-to-close
  - Migliorare animazioni
  - Aggiungere backdrop blur

#### C. **Chat Messages Mobile**
- **Wine Cards**: Full width, padding ottimizzato
- **Movement Cards**: Full width, padding ottimizzato
- **Chat Bubbles**: Padding aumentato per touch
- **Scroll**: Smooth scroll, pull-to-refresh (opzionale)

#### D. **Chat Input Mobile**
- **Textarea**: Altezza minima aumentata per touch
- **Send Button**: Più grande, sempre visibile
- **Keyboard**: Gestione migliore quando si apre tastiera

#### E. **Viewer Panel Mobile**
- **Modalità**: Fullscreen modal invece di sidebar
- **Header**: Fixed con close button prominente
- **Search**: Full width, più grande
- **Filtri**: Accordion collassabile invece di dropdown
- **Tabella**: 
  - **Desktop**: Tabella normale
  - **Mobile**: Card layout (una card per vino)
    - Card mostra: Nome, Cantina, Quantità, Prezzo
    - Tap per espandere dettagli
    - Pulsanti azione (Grafico, Modifica) sempre visibili
- **Pagination**: Touch-friendly con pulsanti più grandi

#### F. **Modals Mobile**
- **Fullscreen**: Tutti i modals fullscreen su mobile
- **Form Fields**: Input più grandi (min-height 48px)
- **Buttons**: Touch-friendly (min-height 44px)
- **Scroll**: Gestione scroll interna ai modals

#### G. **Wine Cards Mobile**
- **Full Width**: 100% width con padding laterale
- **Touch Targets**: Bookmark più grandi
- **Gestures**: Swipe per azioni rapide (opzionale)

---

## 4. COMPONENTI DA MODIFICARE/CREARE

### 4.1 CSS - Nuove Classi Mobile

```css
/* Mobile-specific classes */
.mobile-only { display: none; }
.desktop-only { display: block; }

@media (max-width: 768px) {
    .mobile-only { display: block; }
    .desktop-only { display: none; }
    
    /* Quick Actions Bar */
    .mobile-quick-actions {
        display: flex;
        justify-content: space-around;
        padding: 12px;
        background: var(--color-white);
        border-bottom: 1px solid var(--color-border);
    }
    
    /* Viewer Fullscreen Modal */
    .viewer-panel.mobile-fullscreen {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100vw;
        height: 100vh;
        z-index: 2000;
    }
    
    /* Table Card Layout */
    .viewer-table-mobile-card {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    
    .viewer-wine-card-mobile {
        background: var(--color-white);
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
}
```

### 4.2 JavaScript - Nuove Funzionalità

- **Swipe Gestures**: Per chiudere sidebar/viewer
- **Touch Event Handlers**: Migliorati per mobile
- **Keyboard Handling**: Gestione migliore quando si apre tastiera
- **Viewport Height**: Gestione viewport height su mobile (evitare problemi con browser UI)
- **Pull-to-Refresh**: Opzionale per ricaricare chat

---

## 5. CHECKLIST IMPLEMENTAZIONE

### FASE 1: Header e Navigation Mobile
- [ ] **1.1** Ridurre header mobile: solo hamburger + logo/titolo + toggle
- [ ] **1.2** Creare Quick Actions Bar sotto header con icone
- [ ] **1.3** Nascondere testo pulsanti su mobile, mostrare solo icone
- [ ] **1.4** Aggiungere tooltip/title per icone senza testo
- [ ] **1.5** Testare touch targets (min 44x44px)

### FASE 2: Sidebar Chat Mobile
- [ ] **2.1** Migliorare animazioni apertura/chiusura sidebar
- [ ] **2.2** Aggiungere swipe-to-close gesture
- [ ] **2.3** Migliorare overlay (backdrop blur)
- [ ] **2.4** Ottimizzare lista chat per touch (item più alti)
- [ ] **2.5** Testare scroll nella sidebar

### FASE 3: Chat Messages e Cards Mobile
- [ ] **3.1** Ottimizzare wine cards per mobile (full width, padding)
- [ ] **3.2** Ottimizzare movement cards per mobile
- [ ] **3.3** Aumentare touch targets per bookmark
- [ ] **3.4** Migliorare chat bubbles (padding, font size)
- [ ] **3.5** Testare scroll e performance

### FASE 4: Chat Input Mobile
- [ ] **4.1** Aumentare altezza textarea (min-height per touch)
- [ ] **4.2** Migliorare send button (più grande)
- [ ] **4.3** Gestire apertura/chiusura tastiera
- [ ] **4.4** Aggiustare viewport quando tastiera è aperta
- [ ] **4.5** Testare su iOS e Android

### FASE 5: Viewer Panel Mobile (Fullscreen)
- [ ] **5.1** Convertire viewer da sidebar a fullscreen modal
- [ ] **5.2** Creare header viewer mobile con close button prominente
- [ ] **5.3** Ottimizzare search bar (full width, più grande)
- [ ] **5.4** Convertire filtri da dropdown a accordion
- [ ] **5.5** Implementare card layout per tabella (invece di table)
- [ ] **5.6** Aggiungere swipe-to-close per viewer
- [ ] **5.7** Ottimizzare pagination (pulsanti più grandi)
- [ ] **5.8** Testare scroll e performance

### FASE 6: Modals Mobile
- [ ] **6.1** Convertire tutti i modals a fullscreen su mobile
- [ ] **6.2** Aumentare dimensioni input fields (min-height 48px)
- [ ] **6.3** Ottimizzare form layout (stack verticale)
- [ ] **6.4** Migliorare pulsanti (touch-friendly)
- [ ] **6.5** Gestire scroll interno ai modals
- [ ] **6.6** Testare tutti i modals (Add Wine, Edit Wine, Chart)

### FASE 7: Wine Cards Mobile
- [ ] **7.1** Ottimizzare wine cards per mobile (full width)
- [ ] **7.2** Aumentare touch targets bookmark
- [ ] **7.3** Migliorare layout informazioni vino
- [ ] **7.4** Testare interazioni touch

### FASE 8: Gestures e Interazioni Mobile
- [ ] **8.1** Implementare swipe-to-close sidebar
- [ ] **8.2** Implementare swipe-to-close viewer
- [ ] **8.3** Migliorare touch event handlers
- [ ] **8.4** Aggiungere haptic feedback (opzionale)
- [ ] **8.5** Testare su vari dispositivi

### FASE 9: Performance e Ottimizzazioni
- [ ] **9.1** Ottimizzare CSS per mobile (rimuovere stili desktop non necessari)
- [ ] **9.2** Lazy loading immagini
- [ ] **9.3** Debounce scroll events
- [ ] **9.4** Ottimizzare rendering wine cards
- [ ] **9.5** Test performance su dispositivi low-end

### FASE 10: Testing e Refinement
- [ ] **10.1** Test su iOS Safari
- [ ] **10.2** Test su Chrome Android
- [ ] **10.3** Test su Firefox Mobile
- [ ] **10.4** Test su vari screen sizes (320px, 375px, 414px, 768px)
- [ ] **10.5** Test dark mode su mobile
- [ ] **10.6** Test accessibilità (screen reader, keyboard navigation)
- [ ] **10.7** Fix bug trovati durante testing
- [ ] **10.8** Documentazione modifiche

---

## 6. CONSIDERAZIONI TECNICHE

### 6.1 Breakpoints
- **Mobile**: `max-width: 768px`
- **Tablet**: `min-width: 769px` e `max-width: 1024px` (opzionale)
- **Desktop**: `min-width: 1025px`

### 6.2 Touch Targets
- **Minimo**: 44x44px (Apple HIG, Material Design)
- **Raccomandato**: 48x48px per elementi importanti
- **Spaziatura**: Minimo 8px tra elementi touch

### 6.3 Viewport e Keyboard
- **Viewport Height**: Usare `100vh` con attenzione (browser UI mobile)
- **Keyboard**: Gestire `visualViewport` API quando disponibile
- **Safe Area**: Considerare safe area insets (notch, home indicator)

### 6.4 Performance
- **CSS**: Usare `will-change` per animazioni
- **JavaScript**: Debounce/throttle event handlers
- **Rendering**: Virtual scrolling per liste lunghe (opzionale)

### 6.5 Accessibilità
- **ARIA Labels**: Aggiungere per icone senza testo
- **Focus Management**: Gestire focus quando si aprono/chiusono modals
- **Keyboard Navigation**: Supportare navigazione da tastiera anche su mobile

---

## 7. PRIORITÀ IMPLEMENTAZIONE

### Alta Priorità (MVP Mobile)
1. Header ridotto + Quick Actions Bar
2. Viewer fullscreen modal
3. Tabella inventario come card layout
4. Modals fullscreen
5. Touch targets ottimizzati

### Media Priorità
6. Swipe gestures
7. Accordion filtri
8. Miglioramenti animazioni
9. Gestione keyboard/viewport

### Bassa Priorità (Nice to Have)
10. Pull-to-refresh
11. Haptic feedback
12. Virtual scrolling
13. Gesture avanzate (swipe su cards)

---

## 8. NOTE FINALI

- **Approccio**: Mobile-first non necessario, ma ottimizzazione dedicata mobile sì
- **Compatibilità**: Mantenere compatibilità con desktop esistente
- **Testing**: Testare su dispositivi reali, non solo emulatori
- **Iterazione**: Implementare in fasi, testare dopo ogni fase

---

**Documento creato il**: 2025-01-XX  
**Prossimo step**: Review e approvazione, poi inizio implementazione FASE 1
