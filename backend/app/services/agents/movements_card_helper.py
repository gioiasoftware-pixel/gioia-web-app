"""
Helper per generare wine cards per movimenti di periodo.
"""
from typing import Dict, Any, List
from .wine_card_helper import WineCardHelper


class MovementsCardHelper:
    """Helper per generare HTML cards per movimenti periodo"""
    
    @staticmethod
    def generate_movements_period_card_html(
        movements_data: Dict[str, Any],
        badge: str = "📊 Movimenti"
    ) -> str:
        """
        Genera una wine card per mostrare movimenti di un periodo.
        
        Args:
            movements_data: Dict con:
                - wines_with_movements: Lista vini con movimenti
                - total_consumi: Totale consumi
                - total_rifornimenti: Totale rifornimenti
                - period_description: Descrizione periodo
            badge: Badge opzionale
        
        Returns:
            HTML string con movements card
        """
        wines = movements_data.get("wines_with_movements", [])
        total_consumi = movements_data.get("total_consumi", 0)
        total_rifornimenti = movements_data.get("total_rifornimenti", 0)
        period_description = movements_data.get("period_description", "")
        start_date = movements_data.get("start_date", "")
        end_date = movements_data.get("end_date", "")
        
        if not wines:
            return f'<div class="wine-card"><div class="wine-card-body"><p>Nessun movimento trovato per {period_description}.</p></div></div>'
        
        html = '<div class="wine-card movements-period-card"'
        html += f' data-start-date="{WineCardHelper.escape_html(start_date)}"'
        html += f' data-end-date="{WineCardHelper.escape_html(end_date)}"'
        html += f' data-period-label="{WineCardHelper.escape_html(period_description)}"'
        html += '>'
        
        # Header con icona e badge
        html += '<div class="wine-card-header movements-header">'
        html += f'<div class="movements-header-top">'
        html += f'<div class="movements-header-icon">📊</div>'
        html += f'<div class="movements-header-title-section">'
        html += f'<h3 class="wine-card-title movements-title">Movimenti - {WineCardHelper.escape_html(period_description)}</h3>'
        html += f'<div class="wine-card-producer movements-subtitle">Riepilogo completo dei movimenti</div>'
        html += '</div>'
        html += '<div class="movements-header-actions">'
        html += (
            '<button class="movements-download-btn" data-movements-download="true" '
            f'data-start-date="{WineCardHelper.escape_html(start_date)}" '
            f'data-end-date="{WineCardHelper.escape_html(end_date)}" '
            f'data-period-label="{WineCardHelper.escape_html(period_description)}">'
            'Scarica PDF</button>'
        )
        html += '</div>'
        html += '</div>'
        html += f'<div class="wine-card-badge movements-badge">{WineCardHelper.escape_html(badge)}</div>'
        html += '</div>'  # Chiude wine-card-header
        
        # Body con statistiche
        html += '<div class="wine-card-body movements-body">'
        
        # Statistiche Generali con icone e stile migliorato
        html += '<div class="movements-statistics">'
        html += '<div class="movements-stats-grid">'
        html += f'<div class="movement-stat-card stat-card-wines">'
        html += '<div class="stat-card-icon">🍷</div>'
        html += '<div class="stat-card-content">'
        html += f'<span class="stat-value">{len(wines)}</span>'
        html += '<span class="stat-label">Vini con movimenti</span>'
        html += '</div>'
        html += '</div>'
        
        html += f'<div class="movement-stat-card stat-card-consumi">'
        html += '<div class="stat-card-icon">📉</div>'
        html += '<div class="stat-card-content">'
        html += f'<span class="stat-value">{total_consumi}</span>'
        html += '<span class="stat-label">Bottiglie consumate</span>'
        html += '</div>'
        html += '</div>'
        
        html += f'<div class="movement-stat-card stat-card-rifornimenti">'
        html += '<div class="stat-card-icon">📈</div>'
        html += '<div class="stat-card-content">'
        html += f'<span class="stat-value">{total_rifornimenti}</span>'
        html += '<span class="stat-label">Bottiglie rifornite</span>'
        html += '</div>'
        html += '</div>'
        html += '</div>'
        html += '</div>'
        
        # Dettaglio per Vino
        html += '<div class="movements-wines-list">'
        html += '<div class="movements-section-header">'
        html += '<span class="wine-card-field-label movements-section-title">📋 Dettaglio per Vino</span>'
        html += '</div>'
        html += '<div class="movements-wines-container">'
        
        for wine_data in wines[:20]:  # Max 20 vini
            wine_name = wine_data["wine_name"]
            movements = wine_data["movements"]
            consumi = wine_data["total_consumi"]
            rifornimenti = wine_data["total_rifornimenti"]
            current_stock = wine_data["current_stock"]
            
            html += '<div class="movement-wine-item">'
            html += f'<div class="movement-wine-header">'
            html += f'<div class="movement-wine-name-section">'
            html += f'<span class="movement-wine-icon">🍷</span>'
            html += f'<span class="movement-wine-name">{WineCardHelper.escape_html(wine_name)}</span>'
            html += '</div>'
            html += f'<div class="movement-wine-stock-badge">'
            html += f'<span class="stock-label">Stock</span>'
            html += f'<span class="stock-value">{current_stock}</span>'
            html += '</div>'
            html += '</div>'
            
            html += '<div class="movement-wine-stats">'
            if consumi > 0:
                html += f'<div class="movement-stat-badge consumption">'
                html += f'<span class="movement-stat-icon">📉</span>'
                html += f'<span class="movement-stat-text"><strong>{consumi}</strong> consumate</span>'
                html += '</div>'
            if rifornimenti > 0:
                html += f'<div class="movement-stat-badge replenishment">'
                html += f'<span class="movement-stat-icon">📈</span>'
                html += f'<span class="movement-stat-text"><strong>{rifornimenti}</strong> rifornite</span>'
                html += '</div>'
            html += '</div>'
            
            # Lista movimenti (max 5)
            if movements:
                html += '<div class="movement-wine-details">'
                for mov in movements[:5]:
                    mov_type = mov.get("type", "movimento")
                    mov_qty = mov.get("quantity", 0)
                    mov_date = mov.get("date", "")
                    # Estrai solo la data se c'è anche l'ora
                    if "T" in mov_date:
                        mov_date = mov_date.split("T")[0]
                    elif " " in mov_date:
                        mov_date = mov_date.split()[0]
                    
                    # Formatta la data in formato italiano
                    try:
                        from datetime import datetime
                        if mov_date:
                            date_obj = datetime.strptime(mov_date, "%Y-%m-%d")
                            mov_date_formatted = date_obj.strftime("%d/%m/%Y")
                        else:
                            mov_date_formatted = mov_date
                    except:
                        mov_date_formatted = mov_date
                    
                    movement_class = "consumption" if "consumo" in mov_type.lower() or "consum" in mov_type.lower() else "replenishment"
                    movement_icon = "📉" if movement_class == "consumption" else "📈"
                    html += f'<div class="movement-detail {movement_class}">'
                    html += f'<div class="movement-detail-left">'
                    html += f'<span class="movement-detail-icon">{movement_icon}</span>'
                    html += f'<span class="movement-type">{WineCardHelper.escape_html(mov_type.capitalize())}</span>'
                    html += '</div>'
                    html += f'<div class="movement-detail-right">'
                    html += f'<span class="movement-quantity">{abs(int(mov_qty))} bott.</span>'
                    if mov_date_formatted:
                        html += f'<span class="movement-date">{mov_date_formatted}</span>'
                    html += '</div>'
                    html += '</div>'
                if len(movements) > 5:
                    html += f'<div class="movement-more">+ {len(movements) - 5} altri movimenti</div>'
                html += '</div>'
            
            html += '</div>'  # Chiude movement-wine-item
        
        if len(wines) > 20:
            html += f'<div class="movements-more">... e altri {len(wines) - 20} vini con movimenti</div>'
        
        html += '</div>'  # Chiude movements-wines-container
        html += '</div>'  # Chiude movements-wines-list
        
        html += '</div>'  # Chiude wine-card-body
        html += '</div>'  # Chiude wine-card
        
        return html

