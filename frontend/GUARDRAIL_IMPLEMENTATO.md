# Guardrail CSS Implementato - Protezione da Regressioni

## ✅ Correzioni Critiche Completate

### 1. LayoutBoundary CSS Pulito
- **File**: `layout/LayoutBoundary/layoutBoundary.css`
- **Stato**: ✅ SOLO namespace, NIENTE layout
- **Rimosso**: `overflow`, `height`, `position` su `html`/`body`
- **Mantiene**: Solo identificazione namespace (`.mobileRoot` / `.desktopRoot`)

### 2. CSS Legacy Fenced
- **File**: `styles/legacy-fenced.css`
- **Stato**: ✅ Regole pericolose isolate nei namespace
- **Contiene**:
  - Variabili CSS globali (tokens, ok)
  - Regole `html`/`body` wrappate in `.mobileRoot` e `.desktopRoot`
  - Touch-action e tap-highlight isolati per mobile
- **Strategia**: Fence temporaneo per prevenire regressioni durante migrazione

### 3. Styles.css Pulito
- **File**: `styles.css`
- **Stato**: ✅ Regole pericolose rimosse
- **Rimosso**:
  - `body { overflow-x: hidden; }`
  - `html, body { touch-action }` (spostato in namespace)
  - `button, a, input { touch-action }` (spostato in namespace)
- **Mantiene**: Tutto il resto (da migrare gradualmente)

### 4. Chat Selectors Root-Based
- **File**: `features/chat/shared/chatSelectors.js`
- **Stato**: ✅ Partono dal root container con `data-layout-root`
- **Cambiamenti**:
  - Usa `getLayoutRoot()` per trovare container con `data-layout-root`
  - Fallback a namespace class se `data-layout-root` non presente
  - Tutti i selettori partono da `root.querySelector()` invece di `document.getElementById()`
- **Beneficio**: Evita collisioni tra mobile/desktop

### 5. Data Layout Root Attributes
- **File**: `index.html`
- **Stato**: ✅ Aggiunto `data-layout-root="mobile"` e `data-layout-root="desktop"`
- **Elementi**:
  - `#mobile-layout` → `data-layout-root="mobile"`
  - `#desktop-layout` → `data-layout-root="desktop"`

### 6. CSS Guardrail Script
- **File**: `scripts/css-guardrail.js`
- **Stato**: ✅ Validazione automatica
- **Verifica**:
  - `overflow` su `html`/`body`/`#root` → ERRORE
  - `height: 100vh` su `html`/`body`/`#root` → ERRORE
  - `position: fixed` senza namespace → ERRORE
  - Media query che cambia `display` → WARNING
  - LayoutBoundary con layout → ERRORE

## 🎯 Regole da Rispettare

### ✅ Consentito
- Variabili CSS globali (`:root`, `body.dark-theme`)
- Utility globali (`.hidden`)
- Reset minimo (`* { box-sizing }`)
- Tokens e font-face

### ❌ Vietato
- `overflow` su `html`/`body`/`#root` (solo layout-specific)
- `height: 100vh` su `html`/`body`/`#root` (solo layout-specific)
- `position: fixed` senza namespace (solo layout-specific)
- Media query che cambiano struttura/hierarchy (split layout invece)

## 📋 Prossimi Passi

### Fase 1: Migrazione CSS Layout-Specific
1. Creare `layout/MobileLayout/mobile.css`
2. Creare `layout/DesktopLayout/desktop.css`
3. Spostare regole da `styles.css` nei file corretti
4. Usare namespace `.mobileRoot` e `.desktopRoot`

### Fase 2: Rimozione Legacy Fence
1. Migrare tutte le regole da `styles.css` nei layout-specific
2. Rimuovere `legacy-fenced.css`
3. Mantenere solo tokens in `globals.css`

### Fase 3: Testing
1. Eseguire `node scripts/css-guardrail.js` prima di ogni commit
2. Verificare che modifiche mobile non impattino desktop
3. Verificare che modifiche desktop non impattino mobile
4. Test scroll desktop chat stabile

## 🔍 Come Usare il Guardrail

```bash
# Verifica automatica
node scripts/css-guardrail.js

# Se trova errori, correggere prima di procedere
# Se tutto ok, procedere con commit
```

## 📝 Note

- Il fence legacy è temporaneo ma necessario per evitare regressioni
- La migrazione graduale è preferibile a un refactor completo
- Il guardrail previene nuovi problemi ma non risolve quelli esistenti
- Testare sempre dopo modifiche CSS per verificare isolamento
