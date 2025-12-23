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
            const token = localStorage.getItem('authToken');
            if (!token) {
                return;
            }
            
            const response = await fetch(`${window.API_BASE_URL}/api/notifications`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            this.notifications = data.notifications || [];
            this.unreadCount = data.unread_count || 0;
            
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
        // Mobile
        const listMobile = document.getElementById('notifications-list-mobile');
        if (listMobile) {
            this.renderNotificationsList(listMobile);
        }
        
        // Desktop
        const listDesktop = document.getElementById('notifications-list-desktop');
        if (listDesktop) {
            this.renderNotificationsList(listDesktop);
        }
    },
    
    /**
     * Renderizza lista notifiche in un container
     */
    renderNotificationsList(container) {
        if (!this.notifications || this.notifications.length === 0) {
            container.innerHTML = '<div class="notifications-empty">Nessuna notifica</div>';
            return;
        }
        
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
            
            return `
                <div class="notification-item ${readClass}" data-notification-id="${notification.id}">
                    <div class="notification-header">
                        <h3 class="notification-title">${this.escapeHtml(notification.title)}</h3>
                        <span class="notification-date">${date}</span>
                    </div>
                    <div class="notification-content">
                        ${this.formatNotificationContent(notification.content)}
                    </div>
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

