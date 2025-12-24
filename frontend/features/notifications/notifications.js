/**
 * Gestione notifiche - Componente condiviso per mobile e desktop
 */

const NotificationsManager = {
    unreadCount: 0,
    notifications: [],
    
    /**
     * Inizializza il sistema notifiche
     */
    async init() {
        console.log('[NOTIFICATIONS] Inizializzazione sistema notifiche...');
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Carica notifiche iniziali
        await this.loadNotifications();
        
        // Aggiorna badge
        this.updateBadge();
        
        // Polling ogni 5 minuti per nuove notifiche
        setInterval(() => {
            this.loadNotifications();
        }, 5 * 60 * 1000);
        
        console.log('[NOTIFICATIONS] ✅ Sistema notifiche inizializzato');
    },
    
    /**
     * Attach event listeners per pulsanti notifiche
     */
    attachEventListeners() {
        // Mobile
        const notificationsBtnMobile = document.getElementById('notifications-btn-mobile');
        if (notificationsBtnMobile) {
            notificationsBtnMobile.addEventListener('click', () => {
                this.togglePanel('mobile');
            });
        }
        
        const notificationsCloseMobile = document.getElementById('notifications-close-mobile');
        if (notificationsCloseMobile) {
            notificationsCloseMobile.addEventListener('click', () => {
                this.closePanel('mobile');
            });
        }
        
        // Desktop
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => {
                this.togglePanel('desktop');
            });
        }
        
        const notificationsCloseDesktop = document.getElementById('notifications-close-desktop');
        if (notificationsCloseDesktop) {
            notificationsCloseDesktop.addEventListener('click', () => {
                this.closePanel('desktop');
            });
        }
    },
    
    /**
     * Carica notifiche dal server
     */
    async loadNotifications() {
        try {
            // Prova entrambe le chiavi possibili per il token
            const token = localStorage.getItem('authToken') || localStorage.getItem('auth_token');
            if (!token) {
                console.log('[NOTIFICATIONS] Nessun token trovato, skip caricamento');
                return;
            }
            
            console.log('[NOTIFICATIONS] Caricamento notifiche...');
            const response = await fetch(`${window.API_BASE_URL}/api/notifications`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log('[NOTIFICATIONS] Dati ricevuti:', data);
            
            // Salva gli ID delle notifiche PDF esistenti prima di aggiornare
            const existingPdfKeys = new Set();
            if (window._notificationPdfs) {
                Object.keys(window._notificationPdfs).forEach(key => {
                    existingPdfKeys.add(key);
                });
            }
            
            this.notifications = data.notifications || [];
            this.unreadCount = data.unread_count || 0;
            
            // Pulisci PDF di notifiche che non esistono più (scadute o eliminate)
            if (window._notificationPdfs) {
                const currentNotificationIds = new Set(
                    this.notifications
                        .filter(n => n.metadata?.type === 'pdf_report')
                        .map(n => `pdf_${n.id}`)
                );
                
                // Rimuovi solo i PDF che non sono più presenti nelle notifiche correnti
                Object.keys(window._notificationPdfs).forEach(key => {
                    if (!currentNotificationIds.has(key)) {
                        delete window._notificationPdfs[key];
                        console.log(`[NOTIFICATIONS] Rimosso PDF scaduto/eliminato: ${key}`);
                    }
                });
            }
            
            console.log(`[NOTIFICATIONS] ${this.notifications.length} notifiche caricate, ${this.unreadCount} non lette`);
            
            // Aggiorna UI
            this.updateBadge();
            this.renderNotifications();
        } catch (error) {
            console.error('[NOTIFICATIONS] Errore caricamento notifiche:', error);
        }
    },
    
    /**
     * Aggiorna badge notifiche non lette
     */
    updateBadge() {
        // Mobile
        const badgeMobile = document.getElementById('notifications-badge-mobile');
        if (badgeMobile) {
            if (this.unreadCount > 0) {
                badgeMobile.style.display = 'flex';
                badgeMobile.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount.toString();
            } else {
                badgeMobile.style.display = 'none';
            }
        }
        
        // Desktop
        const badge = document.getElementById('notifications-badge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.style.display = 'flex';
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount.toString();
            } else {
                badge.style.display = 'none';
            }
        }
    },
    
    /**
     * Renderizza notifiche nel pannello
     */
    renderNotifications() {
        console.log('[NOTIFICATIONS] Renderizzazione notifiche...');
        
        // Mobile
        const listMobile = document.getElementById('notifications-list-mobile');
        if (listMobile) {
            console.log('[NOTIFICATIONS] Container mobile trovato');
            this.renderNotificationsList(listMobile);
        } else {
            console.warn('[NOTIFICATIONS] Container mobile non trovato (notifications-list-mobile)');
        }
        
        // Desktop
        const listDesktop = document.getElementById('notifications-list-desktop');
        if (listDesktop) {
            console.log('[NOTIFICATIONS] Container desktop trovato');
            this.renderNotificationsList(listDesktop);
        } else {
            console.warn('[NOTIFICATIONS] Container desktop non trovato (notifications-list-desktop)');
        }
    },
    
    /**
     * Renderizza lista notifiche in un container
     */
    renderNotificationsList(container) {
        if (!container) {
            console.warn('[NOTIFICATIONS] Container non trovato per renderizzazione');
            return;
        }
        
        console.log(`[NOTIFICATIONS] Renderizzazione ${this.notifications?.length || 0} notifiche in container:`, container.id);
        
        // Rimuovi eventuali placeholder/loading
        const loadingElements = container.querySelectorAll('.notifications-loading');
        loadingElements.forEach(el => el.remove());
        
        if (!this.notifications || this.notifications.length === 0) {
            container.innerHTML = '<div class="notifications-empty">Nessuna notifica</div>';
            console.log('[NOTIFICATIONS] Nessuna notifica da visualizzare, mostrato messaggio vuoto');
            return;
        }
        
        console.log('[NOTIFICATIONS] Creazione HTML per notifiche...');
        container.innerHTML = this.notifications.map(notification => {
            const isRead = notification.read_at !== null;
            const readClass = isRead ? 'notification-read' : '';
            const date = notification.created_at ? new Date(notification.created_at).toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }) : '';
            
            // Controlla se è un PDF report
            const metadata = notification.metadata || {};
            const isPdfReport = metadata.type === 'pdf_report';
            
            let contentHtml = '';
            if (isPdfReport && metadata.pdf_base64) {
                // Notifica PDF
                // Salva pdf_base64 in un oggetto globale invece di data attribute (può essere troppo lungo)
                // Inizializza l'oggetto globale se non esiste
                if (!window._notificationPdfs) {
                    window._notificationPdfs = {};
                }
                const pdfKey = `pdf_${notification.id}`;
                // Salva il PDF solo se non è già presente (mantiene PDF già caricato se la lista viene re-renderizzata)
                if (!window._notificationPdfs[pdfKey]) {
                    window._notificationPdfs[pdfKey] = metadata.pdf_base64;
                }
                
                contentHtml = `
                    <div class="notification-pdf-container">
                        <p class="notification-pdf-info">📄 Report PDF disponibile</p>
                        <button class="notification-view-pdf" data-notification-id="${notification.id}" data-pdf-key="${pdfKey}">
                            Visualizza PDF
                        </button>
                        <button class="notification-download-pdf" data-notification-id="${notification.id}" data-pdf-key="${pdfKey}" data-filename="report_${metadata.report_date || 'report'}.pdf">
                            Scarica PDF
                        </button>
                    </div>
                `;
            } else {
                // Notifica normale (markdown)
                contentHtml = `<div class="notification-content">${this.formatNotificationContent(notification.content)}</div>`;
            }
            
            return `
                <div class="notification-item ${readClass}" data-notification-id="${notification.id}">
                    <div class="notification-header">
                        <h3 class="notification-title">${this.escapeHtml(notification.title)}</h3>
                        <span class="notification-date">${date}</span>
                    </div>
                    ${contentHtml}
                    ${!isRead ? `<button class="notification-mark-read" data-notification-id="${notification.id}">Segna come letta</button>` : ''}
                </div>
            `;
        }).join('');
        
        // Attach event listeners per "Segna come letta"
        container.querySelectorAll('.notification-mark-read').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const notificationId = parseInt(e.target.dataset.notificationId);
                await this.markAsRead(notificationId);
            });
        });
        
        // Attach event listeners per "Visualizza PDF"
        container.querySelectorAll('.notification-view-pdf').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pdfKey = e.target.dataset.pdfKey;
                const pdfBase64 = window._notificationPdfs?.[pdfKey];
                if (!pdfBase64) {
                    console.error('[NOTIFICATIONS] PDF non trovato per key:', pdfKey);
                    alert('Errore: PDF non disponibile');
                    return;
                }
                this.viewPdf(pdfBase64);
            });
        });
        
        // Attach event listeners per "Scarica PDF"
        container.querySelectorAll('.notification-download-pdf').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pdfKey = e.target.dataset.pdfKey;
                const pdfBase64 = window._notificationPdfs?.[pdfKey];
                if (!pdfBase64) {
                    console.error('[NOTIFICATIONS] PDF non trovato per key:', pdfKey);
                    alert('Errore: PDF non disponibile');
                    return;
                }
                const filename = e.target.dataset.filename || 'report.pdf';
                this.downloadPdf(pdfBase64, filename);
            });
        });
    },
    
    /**
     * Visualizza PDF in un modal
     */
    viewPdf(pdfBase64) {
        if (!pdfBase64 || typeof pdfBase64 !== 'string') {
            console.error('[NOTIFICATIONS] PDF base64 non valido:', pdfBase64);
            alert('Errore: PDF non disponibile o formato non valido');
            return;
        }
        
        try {
            // Rimuovi eventuali spazi bianchi o caratteri non validi
            const cleanBase64 = pdfBase64.trim().replace(/\s/g, '');
            
            // Verifica che sia base64 valido
            if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
                throw new Error('Stringa base64 contiene caratteri non validi');
            }
            
            // Crea blob URL dal base64
            const pdfBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
        
        // Crea modal per visualizzare PDF
        const modal = document.createElement('div');
        modal.className = 'pdf-viewer-modal';
        modal.innerHTML = `
            <div class="pdf-viewer-overlay"></div>
            <div class="pdf-viewer-container">
                <div class="pdf-viewer-header">
                    <h3>Report PDF</h3>
                    <button class="pdf-viewer-close">&times;</button>
                </div>
                <div class="pdf-viewer-content">
                    <iframe src="${url}" class="pdf-viewer-iframe"></iframe>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Chiudi modal
        const closeBtn = modal.querySelector('.pdf-viewer-close');
        const overlay = modal.querySelector('.pdf-viewer-overlay');
        
        const closeModal = () => {
            document.body.removeChild(modal);
            URL.revokeObjectURL(url);
        };
        
        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);
        
        // Chiudi con ESC
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
        } catch (error) {
            console.error('[NOTIFICATIONS] Errore visualizzazione PDF:', error);
            alert(`Errore nel caricamento del PDF: ${error.message}`);
        }
    },
    
    /**
     * Scarica PDF
     */
    downloadPdf(pdfBase64, filename) {
        if (!pdfBase64 || typeof pdfBase64 !== 'string') {
            console.error('[NOTIFICATIONS] PDF base64 non valido per download:', pdfBase64);
            alert('Errore: PDF non disponibile o formato non valido');
            return;
        }
        
        try {
            // Rimuovi eventuali spazi bianchi o caratteri non validi
            const cleanBase64 = pdfBase64.trim().replace(/\s/g, '');
            
            // Verifica che sia base64 valido
            if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
                throw new Error('Stringa base64 contiene caratteri non validi');
            }
            
            const pdfBytes = Uint8Array.from(atob(cleanBase64), c => c.charCodeAt(0));
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('[NOTIFICATIONS] Errore download PDF:', error);
            alert(`Errore nel download del PDF: ${error.message}`);
        }
    },
    
    /**
     * Formatta contenuto notifica (markdown semplice)
     */
    formatNotificationContent(content) {
        if (!content) return '';
        
        // Converti markdown semplice in HTML
        let html = this.escapeHtml(content);
        
        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Liste
        html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        // Line breaks
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        
        return `<p>${html}</p>`;
    },
    
    /**
     * Escape HTML per sicurezza
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * Marca notifica come letta
     */
    async markAsRead(notificationId) {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                return;
            }
            
            const response = await fetch(`${window.API_BASE_URL}/api/notifications/${notificationId}/read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            // Aggiorna stato locale
            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.read_at = new Date().toISOString();
            }
            
            // Ricarica notifiche per aggiornare UI
            await this.loadNotifications();
        } catch (error) {
            console.error('[NOTIFICATIONS] Errore marcatura notifica come letta:', error);
        }
    },
    
    /**
     * Toggle pannello notifiche
     */
    togglePanel(layout) {
        const panel = document.getElementById(`notifications-panel-${layout}`);
        if (!panel) return;
        
        if (panel.style.display === 'none' || !panel.style.display) {
            this.openPanel(layout);
        } else {
            this.closePanel(layout);
        }
    },
    
    /**
     * Apri pannello notifiche
     */
    openPanel(layout) {
        const panel = document.getElementById(`notifications-panel-${layout}`);
        if (!panel) return;
        
        panel.style.display = 'block';
        
        // Ricarica notifiche quando si apre
        this.loadNotifications();
    },
    
    /**
     * Chiudi pannello notifiche
     */
    closePanel(layout) {
        const panel = document.getElementById(`notifications-panel-${layout}`);
        if (!panel) return;
        
        panel.style.display = 'none';
    }
};

// Esponi su window per accesso globale
window.NotificationsManager = NotificationsManager;

// Auto-inizializza quando il DOM è pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        NotificationsManager.init();
    });
} else {
    NotificationsManager.init();
}

