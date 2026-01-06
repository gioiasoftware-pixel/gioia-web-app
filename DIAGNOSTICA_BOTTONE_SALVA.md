# Diagnostica Bottone Salva Modifiche

## Problema
Il bottone "Salva modifiche" non funziona, probabilmente gli stessi problemi del bottone indietro.

## Confronto Bottoni: Indietro vs Salva

### BOTTONE INDIETRO (funziona)
**JavaScript:**
- ✅ Flag `backButtonInitialized` per evitare setup multipli
- ✅ Verifica `viewerPanel` visibile e `state-viewer` attivo
- ✅ Stili inline forzati con `!important`
- ✅ `z-index: 9999`
- ✅ `pointer-events: auto !important`
- ✅ Listener con `capture: true`
- ✅ `preventDefault()` e `stopPropagation()`

**CSS:**
- ✅ Selettori multipli per massima specificità:
  ```css
  #inventory-back-btn-mobile,
  .mobileRoot .mViewer .inventory-back-btn-mobile,
  .mobileRoot .mViewer:not([hidden]) .inventory-back-btn-mobile,
  .mobileRoot .mApp.state-viewer .mViewer .inventory-back-btn-mobile,
  .mobileRoot .mViewer #inventory-back-btn-mobile
  ```
- ✅ Regola esplicita per `state-viewer`:
  ```css
  .mobileRoot .mApp.state-viewer #viewerPanel:not([hidden]) .inventory-back-btn-mobile {
      pointer-events: auto !important;
  }
  ```
- ✅ Regola per header:
  ```css
  .mobileRoot .mApp.state-viewer .inventory-header-mobile {
      pointer-events: auto !important;
      z-index: 10000 !important;
  }
  ```

**Posizione:**
- ✅ Nell'header (`inventory-header-mobile`)
- ✅ Sempre visibile in tutte le schermate

---

### BOTTONE SALVA (non funziona)
**JavaScript:**
- ✅ Flag `saveButtonInitialized` per evitare setup multipli
- ✅ Verifica `viewerPanel` visibile e `state-viewer` attivo
- ✅ Stili inline forzati con `!important`
- ⚠️ `z-index: 9998` (più basso del bottone indietro!)
- ✅ `pointer-events: auto !important`
- ✅ Listener con `capture: true`
- ✅ `preventDefault()` e `stopPropagation()`

**CSS:**
- ❌ Selettori base, NON multipli come il bottone indietro:
  ```css
  .mobileRoot .mViewer .inventory-save-btn-mobile {
      /* solo regole base */
  }
  ```
- ❌ NON ha regola esplicita per `state-viewer` con `pointer-events: auto`
- ❌ NON ha selettori multipli per massima specificità

**Posizione:**
- ⚠️ Dentro `inventory-details-left-mobile` (schermata dettagli)
- ⚠️ Dentro form (`inventory-wine-form-mobile`)
- ⚠️ Visibile solo nella schermata dettagli

---

## Problemi Identificati

### 1. Z-INDEX TROPPO BASSO
- Bottone salva: `z-index: 9998`
- Bottone indietro: `z-index: 9999`
- **RISCHIO**: Il bottone salva potrebbe essere coperto da altri elementi

### 2. CSS NON COMPLETO
- ❌ Mancano selettori multipli per massima specificità
- ❌ Mancano regole esplicite per `state-viewer` con `pointer-events: auto`
- ❌ CSS base potrebbe essere sovrascritto da altri stili

### 3. POSIZIONE NEL DOM
- Il bottone salva è dentro un container (`inventory-details-left-mobile`)
- Potrebbe essere coperto da:
  - Overlay
  - Altri elementi con z-index più alto
  - Elementi padre con `pointer-events: none`

### 4. TIMING SETUP
- `setupSaveButton()` viene chiamato con `setTimeout(100ms)` quando si apre un vino
- Potrebbe essere troppo tardi o troppo presto
- Il bottone indietro viene setup tramite `MutationObserver` che è più robusto

---

## Fix Necessari

### FIX 1: Aggiungere selettori CSS multipli (come bottone indietro)
```css
#inventory-save-btn-mobile,
.mobileRoot .mViewer .inventory-save-btn-mobile,
.mobileRoot .mViewer:not([hidden]) .inventory-save-btn-mobile,
.mobileRoot .mApp.state-viewer .mViewer .inventory-save-btn-mobile,
.mobileRoot .mViewer #inventory-save-btn-mobile {
    /* stili con !important */
    pointer-events: auto !important;
    z-index: 9999 !important; /* aumentare a 9999 come bottone indietro */
}
```

### FIX 2: Aggiungere regola esplicita per state-viewer
```css
.mobileRoot .mApp.state-viewer #viewerPanel:not([hidden]) .inventory-save-btn-mobile {
    pointer-events: auto !important;
}
```

### FIX 3: Aumentare z-index nel JavaScript
- Cambiare da `z-index: 9998` a `z-index: 9999` (stesso del bottone indietro)

### FIX 4: Verificare container padre
- Verificare che `inventory-details-left-mobile` non abbia `pointer-events: none`
- Verificare che non ci siano overlay che coprono il bottone

### FIX 5: Setup più robusto (opzionale)
- Considerare `MutationObserver` anche per il bottone salva
- O verificare che il bottone esista prima di fare setup

---

## Conclusioni

**I fix del bottone indietro NON bastano completamente** perché:

1. ✅ La logica JavaScript è simile (OK)
2. ❌ Il CSS è incompleto (mancano selettori multipli e regole state-viewer)
3. ⚠️ Z-index più basso (potrebbe essere coperto)
4. ⚠️ Posizione nel DOM diversa (dentro form/details invece che header)

**SERVE:**
- Aggiungere selettori CSS multipli
- Aggiungere regola esplicita per state-viewer
- Aumentare z-index a 9999
- Verificare che container padre non blocchi eventi

