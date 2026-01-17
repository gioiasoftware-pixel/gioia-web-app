"""
Wine Card Helper - Utility condivisa per generare HTML wine cards.
Usato da tutti gli agent quando devono mostrare informazioni vini.
"""
from typing import Dict, Any, Optional, List


class WineCardHelper:
    """Helper per generare HTML wine cards"""
    
    @staticmethod
    def escape_html(text: str) -> str:
        """Escape HTML per sicurezza."""
        if not text:
            return ""
        return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#x27;")
    
    @staticmethod
    def generate_wine_card_html(
        wine,
        is_new: bool = False,
        error_info: Optional[Dict[str, Any]] = None,
        badge: Optional[str] = None
    ) -> str:
        """
        Genera HTML per card informazioni vino.
        Stile gio-ia: bianco con accenti granaccia.
        
        Args:
            wine: Oggetto vino (deve avere almeno .name, .id, e altri attributi opzionali)
            is_new: Se True, aggiunge dicitura "Vino aggiunto" nell'header
            error_info: Dict opzionale con info errore (message, requested_quantity, available_quantity)
            badge: Badge personalizzato (se None, usa is_new o error_info)
        """
        wine_id = getattr(wine, 'id', None)
        wine_id_attr = f' data-wine-id="{wine_id}"' if wine_id else ''
        html = f'<div class="wine-card"{wine_id_attr}>'
        html += '<div class="wine-card-header">'
        
        # Badge per nuovo vino, errore o personalizzato
        if badge:
            html += f'<div class="wine-card-badge">{badge}</div>'
        elif is_new:
            html += '<div class="wine-card-badge">✅ Vino aggiunto</div>'
        elif error_info:
            html += '<div class="wine-card-badge error-badge">⚠️ Quantità insufficiente</div>'
        
        html += f'<div><h3 class="wine-card-title">{WineCardHelper.escape_html(wine.name)}</h3>'
        if hasattr(wine, 'producer') and wine.producer:
            html += f'<div class="wine-card-producer">{WineCardHelper.escape_html(wine.producer)}</div>'
        html += '</div>'
        html += '</div>'
        
        html += '<div class="wine-card-body">'
        
        # Se c'è errore, mostra messaggio prima della quantità
        if error_info:
            requested = error_info.get('requested_quantity', 0)
            available = error_info.get('available_quantity', getattr(wine, 'quantity', 0) or 0)
            html += '<div class="wine-card-error-message">'
            html += f'<span class="error-text">Richiesto: {requested} bottiglie</span>'
            html += f'<span class="error-text">Disponibili: {available} bottiglie</span>'
            html += '</div>'
        
        # Quantità
        if hasattr(wine, 'quantity') and wine.quantity is not None:
            html += '<div class="wine-card-field">'
            html += '<span class="wine-card-field-label">Quantità disponibile</span>'
            quantity_class = "quantity-low" if error_info else "quantity"
            html += f'<span class="wine-card-field-value {quantity_class}">{wine.quantity} bottiglie</span>'
            html += '</div>'
        
        # Prezzo vendita
        if hasattr(wine, 'selling_price') and wine.selling_price:
            html += '<div class="wine-card-field">'
            html += '<span class="wine-card-field-label">Prezzo Vendita</span>'
            html += f'<span class="wine-card-field-value price">€{wine.selling_price:.2f}</span>'
            html += '</div>'
        
        # Prezzo acquisto
        if hasattr(wine, 'cost_price') and wine.cost_price:
            html += '<div class="wine-card-field">'
            html += '<span class="wine-card-field-label">Prezzo Acquisto</span>'
            html += f'<span class="wine-card-field-value">€{wine.cost_price:.2f}</span>'
            html += '</div>'
        
        # Annata
        if hasattr(wine, 'vintage') and wine.vintage:
            html += '<div class="wine-card-field">'
            html += '<span class="wine-card-field-label">Annata</span>'
            html += f'<span class="wine-card-field-value">{wine.vintage}</span>'
            html += '</div>'
        
        # Regione
        if hasattr(wine, 'region') and wine.region:
            html += '<div class="wine-card-field">'
            html += '<span class="wine-card-field-label">Regione</span>'
            html += f'<span class="wine-card-field-value">{WineCardHelper.escape_html(wine.region)}</span>'
            html += '</div>'
        
        # Paese
        if hasattr(wine, 'country') and wine.country:
            html += '<div class="wine-card-field">'
            html += '<span class="wine-card-field-label">Paese</span>'
            html += f'<span class="wine-card-field-value">{WineCardHelper.escape_html(wine.country)}</span>'
            html += '</div>'
        
        # Tipo
        if hasattr(wine, 'wine_type') and wine.wine_type:
            html += '<div class="wine-card-field">'
            html += '<span class="wine-card-field-label">Tipo</span>'
            html += f'<span class="wine-card-field-value">{WineCardHelper.escape_html(wine.wine_type)}</span>'
            html += '</div>'
        
        html += '</div>'
        html += '</div>'
        
        return html
    
    @staticmethod
    def generate_wines_list_html(
        wines: List,
        title: str = "Vini trovati",
        query: Optional[str] = None,
        show_buttons: bool = False,
        movement_type: Optional[str] = None,
        quantity: Optional[int] = None
    ) -> str:
        """
        Genera HTML per lista vini con wine cards multiple.
        
        Args:
            wines: Lista di oggetti vino
            title: Titolo della lista
            query: Query di ricerca (opzionale, per mostrare cosa si stava cercando)
            show_buttons: Se True, mostra pulsanti per ogni vino (per conferme movimenti)
            movement_type: Tipo movimento ("consumo" o "rifornimento") se show_buttons=True
            quantity: Quantità movimento se show_buttons=True
        """
        if not wines:
            return '<div class="wines-list-card"><div class="wines-list-header"><h3 class="wines-list-title">Nessun vino trovato</h3></div></div>'
        
        html = '<div class="wines-list-card">'
        html += '<div class="wines-list-header">'
        html += f'<h3 class="wines-list-title">{WineCardHelper.escape_html(title)}</h3>'
        if query:
            movement_label = ""
            if movement_type and quantity:
                movement_label = f" ({quantity} bottiglie - {movement_type})"
            html += f'<span class="wines-list-query">per "{WineCardHelper.escape_html(query)}"{movement_label}</span>'
        html += '</div>'
        
        html += '<div class="wines-list-body">'
        
        # Mostra fino a 10 vini nella lista
        display_wines = wines[:10]
        for wine in display_wines:
            html += '<div class="wines-list-item">'
            
            # Contenuto informativo del vino
            html += '<div class="wines-list-item-content">'
            html += f'<span class="wines-list-item-name">{WineCardHelper.escape_html(wine.name)}</span>'
            if hasattr(wine, 'producer') and wine.producer:
                html += f'<span class="wines-list-item-producer">{WineCardHelper.escape_html(wine.producer)}</span>'
            if hasattr(wine, 'vintage') and wine.vintage:
                html += f'<span class="wines-list-item-vintage">{wine.vintage}</span>'
            if hasattr(wine, 'quantity') and wine.quantity is not None:
                html += f'<span class="wines-list-item-qty">{wine.quantity} bott.</span>'
            html += '</div>'
            
            # Pulsante integrato nella card (se richiesto)
            if show_buttons and movement_type and quantity:
                button_text = f"{wine.name}"
                if hasattr(wine, 'producer') and wine.producer:
                    button_text += f" ({wine.producer})"
                if hasattr(wine, 'vintage') and wine.vintage:
                    button_text += f" {wine.vintage}"
                html += f'<button class="wines-list-item-button chat-button" '
                html += f'data-wine-id="{wine.id}" data-wine-text="{WineCardHelper.escape_html(button_text)}" '
                html += f'data-movement-type="{movement_type}" data-quantity="{quantity}">'
                html += f'{WineCardHelper.escape_html(button_text)}'
                html += '</button>'
            
            html += '</div>'  # Chiude wines-list-item
        
        html += '</div>'
        html += '</div>'
        
        return html
    
    @staticmethod
    def generate_multiple_wine_cards(wines: List, badges: Optional[List[str]] = None) -> str:
        """
        Genera multiple wine cards complete (una per vino).
        Utile per mostrare più vini con tutti i dettagli.
        
        Args:
            wines: Lista di oggetti vino
            badges: Lista opzionale di badge personalizzati (indice corrisponde a wines)
        """
        if not wines:
            return ""
        
        html = ""
        for idx, wine in enumerate(wines):
            badge = badges[idx] if badges and idx < len(badges) else None
            html += WineCardHelper.generate_wine_card_html(wine, badge=badge)
            html += "<br>"  # Spazio tra cards
        
        return html
    
    @staticmethod
    def generate_inventory_overview_card_html() -> str:
        """
        Genera una card di selezione per richieste generiche di inventario.
        """
        html = '<div class="wine-card report-card inventory-overview-card">'
        html += '<div class="wine-card-header">'
        html += '<div class="wine-card-badge">Inventario</div>'
        html += '<div><h3 class="wine-card-title">Scegli il tipo di info</h3>'
        html += '<div class="wine-card-producer">Seleziona la card informativa che ti serve</div>'
        html += '</div>'
        html += '</div>'

        html += '<div class="wine-card-body">'
        html += '<div class="chat-buttons">'
        html += '<button class="chat-button" data-chat-message="[inventory_stats]" data-chat-label="Statistiche inventario">Statistiche inventario</button>'
        html += '<button class="chat-button" data-chat-message="[inventory_list]" data-chat-label="Lista completa vini">Lista completa vini</button>'
        html += '<button class="chat-button" data-chat-message="[inventory_movements]" data-chat-label="Report movimenti">Report movimenti</button>'
        html += '</div>'
        html += '</div>'

        html += '</div>'
        return html

    @staticmethod
    def generate_report_card_html(
        total_wines: int,
        total_bottles: int,
        total_value: float,
        types_distribution: Dict[str, int],
        low_stock_wines: List,
        out_of_stock_wines: List,
        badge: Optional[str] = "Statistiche"
    ) -> str:
        """
        Genera una wine card dedicata per report inventario.
        
        Args:
            total_wines: Numero totale vini
            total_bottles: Numero totale bottiglie
            total_value: Valore totale inventario
            types_distribution: Dict {tipo: quantità} per distribuzione per tipo
            low_stock_wines: Lista vini a bassa scorta
            out_of_stock_wines: Lista vini esauriti
            badge: Badge opzionale
        
        Returns:
            HTML string con report card
        """
        html = '<div class="wine-card report-card">'
        
        # Header
        html += '<div class="wine-card-header">'
        if badge:
            html += f'<div class="wine-card-badge">{WineCardHelper.escape_html(badge)}</div>'
        html += '<div><h3 class="wine-card-title">📦 Statistiche Inventario</h3>'
        html += '<div class="wine-card-producer">Statistiche generate automaticamente</div>'
        html += '</div>'
        html += '<div class="movements-header-actions">'
        html += '<button class="movements-download-btn" data-inventory-stats-download="true">Scarica PDF</button>'
        html += '</div>'
        html += '</div>'  # Chiude wine-card-header
        
        # Body con statistiche
        html += '<div class="wine-card-body">'
        
        # Statistiche Generali
        html += '<div class="wine-card-field report-statistics">'
        html += '<span class="wine-card-field-label">Statistiche Generali</span>'
        html += '<div class="report-stats-grid">'
        html += f'<div class="report-stat-item"><span class="stat-label">Vini totali:</span><span class="stat-value">{total_wines}</span></div>'
        html += f'<div class="report-stat-item"><span class="stat-label">Bottiglie totali:</span><span class="stat-value">{total_bottles}</span></div>'
        html += f'<div class="report-stat-item"><span class="stat-label">Valore stimato:</span><span class="stat-value">€{total_value:,.2f}</span></div>'
        html += '</div>'
        html += '</div>'
        
        # Distribuzione per Tipo
        if types_distribution:
            html += '<div class="wine-card-field report-distribution">'
            html += '<span class="wine-card-field-label">Distribuzione per Tipo</span>'
            html += '<div class="report-types-list">'
            for wine_type, count in sorted(types_distribution.items(), key=lambda x: x[1], reverse=True):
                html += '<div class="report-type-item">'
                html += f'<span class="type-name">{WineCardHelper.escape_html(wine_type)}</span>'
                html += f'<span class="type-count">{count}</span>'
                html += '</div>'
            html += '</div>'
            html += '</div>'
        
        # Vini a Bassa Scorta
        if low_stock_wines:
            html += '<div class="wine-card-field report-low-stock">'
            html += f'<span class="wine-card-field-label">⚠️ Vini a Bassa Scorta ({len(low_stock_wines)})</span>'
            html += '<div class="report-wines-list">'
            for wine in low_stock_wines[:10]:  # Max 10
                html += '<div class="report-wine-item">'
                html += f'<span class="wine-name">{WineCardHelper.escape_html(wine.name)}</span>'
                html += f'<span class="wine-quantity">{wine.quantity or 0}</span>'
                html += '</div>'
            if len(low_stock_wines) > 10:
                html += f'<div class="report-more">... e altri {len(low_stock_wines) - 10} vini</div>'
            html += '</div>'
            html += '</div>'
        
        # Vini Esauriti
        if out_of_stock_wines:
            html += '<div class="wine-card-field report-out-of-stock">'
            html += f'<span class="wine-card-field-label">❌ Vini Esauriti ({len(out_of_stock_wines)})</span>'
            html += '<div class="report-wines-list">'
            for wine in out_of_stock_wines[:10]:  # Max 10
                html += '<div class="report-wine-item">'
                html += f'<span class="wine-name">{WineCardHelper.escape_html(wine.name)}</span>'
                html += '</div>'
            if len(out_of_stock_wines) > 10:
                html += f'<div class="report-more">... e altri {len(out_of_stock_wines) - 10} vini</div>'
            html += '</div>'
            html += '</div>'
        
        html += '</div>'  # Chiude wine-card-body
        html += '</div>'  # Chiude wine-card
        
        return html



