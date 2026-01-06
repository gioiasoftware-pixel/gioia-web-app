# Modifiche HTML e CSS Inventario Mobile
## Commit: 228da18 (4 gennaio 2026)
## "Fix: Risolti problemi form modifica vini su mobile"

Questo documento contiene tutte le modifiche HTML e CSS implementate per la pagina inventario mobile nei commit successivi al 1 gennaio 2026, prima che venissero aggiunte le modifiche JavaScript che hanno rotto il desktop.

---

## 📋 INDICE
1. [Struttura HTML](#struttura-html)
2. [Stili CSS - Form Inventario Mobile](#stili-css---form-inventario-mobile)
3. [Stili CSS - Bottone Salva](#stili-css---bottone-salva)
4. [Stili CSS - Input e Label](#stili-css---input-e-label)
5. [Note Implementazione](#note-implementazione)

---

## 🏗️ STRUTTURA HTML

### Form Inventario Mobile (Schermata Dettagli Vino)

```html
<!-- SCHERMATA 2: Dettagli Vino -->
<div class="inventory-screen inventory-screen-details hidden" id="inventory-screen-details" data-screen="details">
    <!-- Wine Banner -->
    <div class="inventory-wine-banner-mobile" id="inventory-wine-banner-mobile">
        <span id="inventory-wine-name-banner-mobile">Nome Vino</span>
    </div>

    <!-- Content Layout: Form Left, Log Right -->
    <div class="inventory-details-content-mobile">
        <!-- Left Column: Form + Quantity + Graph Preview -->
        <div class="inventory-details-left-mobile">
            <!-- Quantity Section -->
            <div class="inventory-quantity-section-mobile">
                <div class="inventory-quantity-label">QUANTITÀ DISPONIBILE</div>
                <div class="inventory-quantity-value" id="inventory-quantity-value-mobile">0 bottiglie</div>
            </div>

            <!-- Small Graph Preview (Clickable) -->
            <div class="inventory-graph-preview-mobile" id="inventory-graph-preview-mobile">
                <!-- Canvas sarà creato dinamicamente da loadAndRenderMovementsChartMobile -->
            </div>

            <!-- Save Button -->
            <button type="button" class="inventory-save-btn-mobile" id="inventory-save-btn-mobile">
                SALVA MODIFICHE
            </button>

            <!-- Wine Form Fields -->
            <div class="inventory-wine-form-mobile" id="inventory-wine-form-mobile">
                <!-- Fields will be dynamically generated -->
            </div>
        </div>

        <!-- Right Column: Movements Log -->
        <div class="inventory-details-right-mobile">
            <div class="inventory-movements-log-mobile" id="inventory-movements-log-mobile">
                <div class="inventory-loading">Caricamento movimenti...</div>
            </div>
        </div>
    </div>
</div>
```

---

## 🎨 STILI CSS - FORM INVENTARIO MOBILE

### Container Principale

```css
/* Content Layout: Form Left, Log Right */
.mobileRoot .mViewer .inventory-details-content-mobile {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3vw, 16px);
    padding: clamp(12px, 3vw, 16px);
    box-sizing: border-box;
    max-width: 100vw;
}

/* Left Column */
.mobileRoot .mViewer .inventory-details-left-mobile {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3vw, 16px);
    max-width: 100%;
    box-sizing: border-box;
}
```

### Sezione Quantità

```css
/* Quantity Section */
.mobileRoot .mViewer .inventory-quantity-section-mobile {
    padding: clamp(12px, 3vw, 16px);
    background-color: var(--color-light-gray);
    border-radius: 8px;
    box-sizing: border-box;
    max-width: 100%;
}

.mobileRoot .mViewer .inventory-quantity-label {
    font-size: clamp(10px, 2.5vw, 12px);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    margin-bottom: clamp(6px, 1.5vw, 8px);
}

.mobileRoot .mViewer .inventory-quantity-value {
    font-size: clamp(24px, 6vw, 32px);
    font-weight: 700;
    color: var(--color-text-primary);
}
```

### Anteprima Grafico

```css
/* Graph Preview (Clickable) */
.mobileRoot .mViewer .inventory-graph-preview-mobile {
    width: 100%;
    max-width: 100%;
    height: clamp(150px, 40vw, 200px);
    background-color: var(--color-light-gray);
    border-radius: 8px;
    padding: clamp(10px, 2.5vw, 12px);
    cursor: pointer;
    transition: background-color 0.2s;
    box-sizing: border-box;
}

.mobileRoot .mViewer .inventory-graph-preview-mobile:active {
    background-color: var(--color-border);
}

.mobileRoot .mViewer .inventory-graph-preview-canvas-mobile {
    width: 100%;
    height: 100%;
}
```

---

## 🎨 STILI CSS - BOTTONE SALVA

```css
/* Save Button */
.mobileRoot .mViewer .inventory-save-btn-mobile {
    width: 100%;
    max-width: 100%;
    padding: clamp(12px, 3vw, 16px);
    background-color: var(--color-granaccia);
    color: var(--color-white);
    border: none;
    border-radius: 8px;
    font-size: clamp(14px, 3.5vw, 16px);
    font-weight: 600;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 0.2s;
    box-sizing: border-box;
}

.mobileRoot .mViewer .inventory-save-btn-mobile:active {
    opacity: 0.8;
}
```

**Caratteristiche:**
- ✅ Larghezza 100% con `max-width: 100%` per evitare overflow
- ✅ Padding responsive con `clamp(12px, 3vw, 16px)`
- ✅ Colore di sfondo: `var(--color-granaccia)` (rosso/bordeaux)
- ✅ Testo bianco, uppercase, font-weight 600
- ✅ Transizione opacity su `:active` per feedback touch
- ✅ `box-sizing: border-box` per calcolo dimensioni corretto

---

## 🎨 STILI CSS - INPUT E LABEL

### Container Form

```css
/* Wine Form */
.mobileRoot .mViewer .inventory-wine-form-mobile {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3vw, 16px);
    max-width: 100%;
    box-sizing: border-box;
}
```

### Campo Form (Field)

```css
.mobileRoot .mViewer .inventory-form-field-mobile {
    display: flex;
    flex-direction: column;
    gap: clamp(4px, 1vw, 6px);
    max-width: 100%;
}
```

### Label

```css
.mobileRoot .mViewer .inventory-form-label-mobile {
    font-size: clamp(10px, 2.5vw, 12px);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
}
```

**Caratteristiche:**
- ✅ Font size responsive: `clamp(10px, 2.5vw, 12px)`
- ✅ Font weight 600 per leggibilità
- ✅ Colore secondario per gerarchia visiva
- ✅ Uppercase per stile uniforme

### Input

```css
.mobileRoot .mViewer .inventory-form-input-mobile {
    width: 100%;
    max-width: 100%;
    padding: clamp(10px, 2.5vw, 12px);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    font-size: clamp(14px, 3.5vw, 16px);
    background-color: var(--color-white);
    color: var(--color-text-primary);
    box-sizing: border-box;
}

.mobileRoot .mViewer .inventory-form-input-mobile:focus {
    outline: none;
    border-color: var(--color-granaccia);
}
```

**Caratteristiche:**
- ✅ Larghezza 100% con `max-width: 100%` per evitare overflow
- ✅ Padding responsive: `clamp(10px, 2.5vw, 12px)` (touch-friendly)
- ✅ Font size responsive: `clamp(14px, 3.5vw, 16px)` (minimo 14px per evitare zoom su iOS)
- ✅ Border radius 6px per stile moderno
- ✅ Focus state con bordo colorato `var(--color-granaccia)`
- ✅ `box-sizing: border-box` per calcolo dimensioni corretto

---

## 🎨 STILI CSS - MOVEMENTS LOG (Colonna Destra)

```css
/* Right Column: Movements Log */
.mobileRoot .mViewer .inventory-details-right-mobile {
    display: flex;
    flex-direction: column;
}

.mobileRoot .mViewer .inventory-movements-log-mobile {
    max-height: clamp(300px, 80vw, 400px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 2.5vw, 12px);
    padding: clamp(12px, 3vw, 16px);
    background-color: var(--color-light-gray);
    border-radius: 8px;
    box-sizing: border-box;
    max-width: 100%;
}
```

### Card Movimenti

```css
.mobileRoot .mViewer .inventory-movement-card-mobile {
    padding: 12px;
    border-radius: 8px;
    font-size: 14px;
    margin-bottom: 8px;
}

.mobileRoot .mViewer .inventory-movement-card-mobile:last-child {
    margin-bottom: 0;
}

.mobileRoot .mViewer .inventory-movement-card-mobile.consumed {
    background-color: var(--color-granaccia);
    color: var(--color-white);
}

.mobileRoot .mViewer .inventory-movement-card-mobile.refilled {
    background-color: var(--color-white);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
}
```

---

## 📝 NOTE IMPLEMENTAZIONE

### Principi di Design Mobile

1. **Responsive con `clamp()`**
   - Tutti i padding, margin, font-size usano `clamp(min, preferred, max)`
   - Garantisce leggibilità su schermi piccoli e proporzioni corrette su schermi grandi

2. **Touch-Friendly**
   - Padding minimo 10-12px per input (evita zoom su iOS)
   - Font size minimo 14px per input (evita zoom automatico su iOS)
   - Area di tocco sufficiente per bottoni (minimo 44x44px)

3. **Box-Sizing Border-Box**
   - Tutti gli elementi usano `box-sizing: border-box`
   - Previene overflow con padding/border

4. **Max-Width 100%**
   - Tutti i container hanno `max-width: 100%`
   - Previene overflow orizzontale

5. **Namespace `.mobileRoot`**
   - Tutti gli stili sono dentro `.mobileRoot .mViewer`
   - Isolamento completo da stili desktop

### Variabili CSS Utilizzate

- `var(--color-granaccia)` - Colore principale (rosso/bordeaux)
- `var(--color-white)` - Bianco
- `var(--color-light-gray)` - Grigio chiaro per sfondi
- `var(--color-border)` - Colore bordo
- `var(--color-text-primary)` - Testo principale
- `var(--color-text-secondary)` - Testo secondario

### Struttura Form Dinamica

Il form viene popolato dinamicamente via JavaScript. La struttura HTML base è:

```html
<div class="inventory-wine-form-mobile" id="inventory-wine-form-mobile">
    <!-- Fields will be dynamically generated -->
</div>
```

Ogni campo generato dovrebbe seguire questa struttura:

```html
<div class="inventory-form-field-mobile">
    <label class="inventory-form-label-mobile">NOME CAMPO</label>
    <input 
        type="text" 
        class="inventory-form-input-mobile" 
        data-field="nome_campo_db"
        name="nome_campo_db"
        value="valore"
    >
</div>
```

### ID e Classi Chiave

- **Form Container**: `#inventory-wine-form-mobile` / `.inventory-wine-form-mobile`
- **Save Button**: `#inventory-save-btn-mobile` / `.inventory-save-btn-mobile`
- **Screen Details**: `#inventory-screen-details` / `.inventory-screen-details`
- **Wine Banner**: `#inventory-wine-banner-mobile` / `.inventory-wine-banner-mobile`
- **Wine Name Banner**: `#inventory-wine-name-banner-mobile`

---

## ✅ CHECKLIST REIMPLEMENTAZIONE

Quando si reimplementeranno queste modifiche, verificare:

- [ ] Tutti gli stili sono dentro `.mobileRoot .mViewer`
- [ ] Tutti i padding/margin usano `clamp()` per responsive
- [ ] Tutti gli input hanno `box-sizing: border-box` e `max-width: 100%`
- [ ] Font size input minimo 14px (evita zoom iOS)
- [ ] Padding input minimo 10px (touch-friendly)
- [ ] Bottone salva ha colore `var(--color-granaccia)`
- [ ] Focus state input ha bordo `var(--color-granaccia)`
- [ ] Tutti i container hanno `max-width: 100%` per evitare overflow
- [ ] Struttura HTML corrisponde esattamente a quella documentata
- [ ] ID e classi corrispondono esattamente a quelli documentati

---

## 🔄 DIFFERENZE CON VERSIONE ATTUALE

La versione attuale (commit 19224f7) **NON** contiene:
- ❌ Stili per `.inventory-wine-form-mobile`
- ❌ Stili per `.inventory-save-btn-mobile`
- ❌ Stili per `.inventory-form-field-mobile`
- ❌ Stili per `.inventory-form-label-mobile`
- ❌ Stili per `.inventory-form-input-mobile`
- ❌ Struttura HTML completa della schermata dettagli inventario mobile

Queste modifiche devono essere riapplicate quando si reimplementerà la funzionalità di modifica inventario mobile.

---

**Data Creazione**: 6 gennaio 2026  
**Commit Riferimento**: 228da18  
**Autore**: Giovanni <gio.ia.software@gmail.com>

