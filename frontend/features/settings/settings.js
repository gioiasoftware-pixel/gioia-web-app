/**
 * Settings Page Management
 * Gestisce la pagina delle impostazioni e il salvataggio delle preferenze
 */

// Preferenze di default
const DEFAULT_SETTINGS = {
    dailyReportTime: '10:00',
    reportRetentionDays: 3,
    lowStockThreshold: 5,
    theme: 'auto', // light, dark, auto
    density: 'normal', // compact, normal, comfortable
    fontSize: 'normal' // small, normal, large
};

/**
 * Carica le impostazioni da localStorage
 */
function loadSettings() {
    try {
        const stored = localStorage.getItem('gioia_settings');
        if (stored) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.warn('[SETTINGS] Errore caricamento impostazioni:', e);
    }
    return DEFAULT_SETTINGS;
}

/**
 * Salva le impostazioni in localStorage
 */
function saveSettings(settings) {
    try {
        localStorage.setItem('gioia_settings', JSON.stringify(settings));
        return true;
    } catch (e) {
        console.error('[SETTINGS] Errore salvataggio impostazioni:', e);
        return false;
    }
}

/**
 * Mostra badge "salvato" temporaneo
 */
function showSavedBadge(elementId) {
    const badge = document.getElementById(elementId);
    if (badge) {
        badge.style.display = 'inline';
        setTimeout(() => {
            badge.style.display = 'none';
        }, 2000);
    }
}

/**
 * Applica le impostazioni caricate all'interfaccia
 */
function applySettings(settings) {
    // Applica tema (applyTheme è definito in app.js come funzione globale)
    // Nota: il tema viene gestito da app.js, qui aggiorniamo solo il select se presente
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.value = settings.theme || 'auto';
    }

    // Applica densità
    document.documentElement.setAttribute('data-density', settings.density || 'normal');

    // Applica dimensione font
    document.documentElement.setAttribute('data-font-size', settings.fontSize || 'normal');
}

/**
 * Inizializza la pagina settings
 */
function initSettingsPage() {
    const settings = loadSettings();
    
    // Popola i campi con i valori salvati
    const dailyReportTime = document.getElementById('daily-report-time');
    if (dailyReportTime) {
        dailyReportTime.value = settings.dailyReportTime || DEFAULT_SETTINGS.dailyReportTime;
        dailyReportTime.addEventListener('change', () => {
            const newSettings = loadSettings();
            newSettings.dailyReportTime = dailyReportTime.value;
            saveSettings(newSettings);
            showSavedBadge('daily-report-time-saved');
        });
    }

    const reportRetentionDays = document.getElementById('report-retention-days');
    if (reportRetentionDays) {
        reportRetentionDays.value = settings.reportRetentionDays || DEFAULT_SETTINGS.reportRetentionDays;
        reportRetentionDays.addEventListener('change', () => {
            const newSettings = loadSettings();
            newSettings.reportRetentionDays = parseInt(reportRetentionDays.value, 10);
            saveSettings(newSettings);
            showSavedBadge('report-retention-days-saved');
        });
    }

    const lowStockThreshold = document.getElementById('low-stock-threshold');
    if (lowStockThreshold) {
        lowStockThreshold.value = settings.lowStockThreshold || DEFAULT_SETTINGS.lowStockThreshold;
        lowStockThreshold.addEventListener('change', () => {
            const newSettings = loadSettings();
            newSettings.lowStockThreshold = parseInt(lowStockThreshold.value, 10);
            saveSettings(newSettings);
            showSavedBadge('low-stock-threshold-saved');
        });
    }

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.value = settings.theme || DEFAULT_SETTINGS.theme;
        themeSelect.addEventListener('change', () => {
            const newSettings = loadSettings();
            newSettings.theme = themeSelect.value;
            saveSettings(newSettings);
            
            // Applica il tema immediatamente (applyTheme è definito in app.js)
            if (typeof applyTheme === 'function') {
                if (newSettings.theme === 'auto') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    applyTheme(prefersDark ? 'dark' : 'light', true);
                } else {
                    applyTheme(newSettings.theme, true);
                }
            }
            
            // Salva anche in gioia_theme per retrocompatibilità se non è 'auto'
            if (newSettings.theme !== 'auto') {
                try {
                    localStorage.setItem('gioia_theme', newSettings.theme);
                } catch (e) {
                    console.warn('[SETTINGS] Errore salvataggio tema legacy:', e);
                }
            }
            
            showSavedBadge('theme-select-saved');
        });
    }

    const densitySelect = document.getElementById('density-select');
    if (densitySelect) {
        densitySelect.value = settings.density || DEFAULT_SETTINGS.density;
        densitySelect.addEventListener('change', () => {
            const newSettings = loadSettings();
            newSettings.density = densitySelect.value;
            saveSettings(newSettings);
            document.documentElement.setAttribute('data-density', newSettings.density);
            showSavedBadge('density-select-saved');
        });
    }

    const fontSizeSelect = document.getElementById('font-size-select');
    if (fontSizeSelect) {
        fontSizeSelect.value = settings.fontSize || DEFAULT_SETTINGS.fontSize;
        fontSizeSelect.addEventListener('change', () => {
            const newSettings = loadSettings();
            newSettings.fontSize = fontSizeSelect.value;
            saveSettings(newSettings);
            document.documentElement.setAttribute('data-font-size', newSettings.fontSize);
            showSavedBadge('font-size-select-saved');
        });
    }

    // Applica le impostazioni all'interfaccia
    applySettings(settings);

    // Pulsante back
    const backBtn = document.getElementById('settings-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            closeSettingsPage();
        });
    }
}

/**
 * Apre la pagina settings
 */
function openSettingsPage() {
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel) {
        settingsPanel.hidden = false;
        initSettingsPage();
        
        // Nascondi altri pannelli
        const viewerPanel = document.getElementById('viewerPanel');
        if (viewerPanel) {
            viewerPanel.hidden = true;
        }
        
        // Chiudi sidebar se aperta (mobile)
        if (typeof window.ChatMobile !== 'undefined' && typeof window.ChatMobile.closeSidebar === 'function') {
            window.ChatMobile.closeSidebar();
        }
        
        // Chiudi pannello notifiche se aperto
        if (typeof window.NotificationsManager !== 'undefined') {
            window.NotificationsManager.closePanel('mobile');
            window.NotificationsManager.closePanel('desktop');
        }
    }
}

/**
 * Chiude la pagina settings
 */
function closeSettingsPage() {
    const settingsPanel = document.getElementById('settingsPanel');
    if (settingsPanel) {
        settingsPanel.hidden = true;
    }
}

/**
 * Ottiene una singola impostazione
 */
function getSetting(key) {
    const settings = loadSettings();
    return settings[key] || DEFAULT_SETTINGS[key];
}

// Export per uso globale
window.openSettingsPage = openSettingsPage;
window.closeSettingsPage = closeSettingsPage;
window.getSetting = getSetting;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;

