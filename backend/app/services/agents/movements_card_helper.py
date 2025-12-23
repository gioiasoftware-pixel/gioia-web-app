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
        
        if not wines:
            return f'<div class="wine-card"><div class="wine-card-body"><p>Nessun movimento trovato per {period_description}.</p></div></div>'
        
        html = '<div class="wine-card movements-period-card">'
        
        # Header
        html += '<div class="wine-card-header">'
        html += f'<div class="wine-card-badge">{WineCardHelper.escape_html(badge)}</div>'
        html += f'<div><h3 class="wine-card-title">Movimenti - {WineCardHelper.escape_html(period_description)}</h3>'
        html += '<div class="wine-card-producer">Riepilogo movimenti periodo</div>'
        html += '</div>'
        html += '</div>'  # Chiude wine-card-header
        
        # Body con statistiche
        html += '<div class="wine-card-body">'
        
        # Statistiche Generali
        html += '<div class="wine-card-field movements-statistics">'
        html += '<span class="wine-card-field-label">Riepilogo Generale</span>'
        html += '<div class="movements-stats-grid">'
        html += f'<div class="movement-stat-item"><span class="stat-label">Vini con movimenti:</span><span class="stat-value">{len(wines)}</span></div>'
        html += f'<div class="movement-stat-item"><span class="stat-label">Totale consumi:</span><span class="stat-value">{total_consumi} bottiglie</span></div>'
        html += f'<div class="movement-stat-item"><span class="stat-label">Totale rifornimenti:</span><span class="stat-value">{total_rifornimenti} bottiglie</span></div>'
        html += '</div>'
        html += '</div>'
        
        # Dettaglio per Vino
        html += '<div class="wine-card-field movements-wines-list">'
        html += '<span class="wine-card-field-label">Dettaglio per Vino</span>'
        html += '<div class="movements-wines-container">'
        
        for wine_data in wines[:20]:  # Max 20 vini
            wine_name = wine_data["wine_name"]
            movements = wine_data["movements"]
            consumi = wine_data["total_consumi"]
            rifornimenti = wine_data["total_rifornimenti"]
            current_stock = wine_data["current_stock"]
            
            html += '<div class="movement-wine-item">'
            html += f'<div class="movement-wine-header">'
            html += f'<span class="movement-wine-name">{WineCardHelper.escape_html(wine_name)}</span>'
            html += f'<span class="movement-wine-stock">Stock: {current_stock}</span>'
            html += '</div>'
            
            html += '<div class="movement-wine-stats">'
            if consumi > 0:
                html += f'<span class="movement-stat consumption">Consumati: {consumi}</span>'
            if rifornimenti > 0:
                html += f'<span class="movement-stat replenishment">Riforniti: {rifornimenti}</span>'
            html += '</div>'
            
            # Lista movimenti (max 5)
            if movements:
                html += '<div class="movement-wine-details">'
                for mov in movements[:5]:
                    mov_type = mov.get("type", "movimento")
                    mov_qty = mov.get("quantity", 0)
                    mov_time = mov.get("time", "")
                    mov_date = mov.get("date", "")
                    # Estrai solo la data se c'è anche l'ora
                    if " " in mov_date:
                        mov_date = mov_date.split()[0]
                    
                    movement_class = "consumption" if "consumo" in mov_type.lower() or "consum" in mov_type.lower() else "replenishment"
                    html += f'<div class="movement-detail {movement_class}">'
                    html += f'<span class="movement-type">{WineCardHelper.escape_html(mov_type)}</span>'
                    html += f'<span class="movement-quantity">{abs(int(mov_qty))} bottiglie</span>'
                    if mov_date:
                        html += f'<span class="movement-date">{mov_date}</span>'
                    html += '</div>'
                if len(movements) > 5:
                    html += f'<div class="movement-more">... e altri {len(movements) - 5} movimenti</div>'
                html += '</div>'
            
            html += '</div>'  # Chiude movement-wine-item
        
        if len(wines) > 20:
            html += f'<div class="movements-more">... e altri {len(wines) - 20} vini con movimenti</div>'
        
        html += '</div>'  # Chiude movements-wines-container
        html += '</div>'  # Chiude movements-wines-list
        
        html += '</div>'  # Chiude wine-card-body
        html += '</div>'  # Chiude wine-card
        
        return html

