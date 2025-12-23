"""
Chart Helper - Utility per generare HTML per grafici vini in chat.
Genera HTML con canvas e dati JSON per renderizzazione frontend.
"""
from typing import Dict, Any, List, Optional
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class ChartHelper:
    """Helper per generare HTML grafici vini"""
    
    @staticmethod
    def escape_html(text: str) -> str:
        """Escape HTML per sicurezza."""
        if not text:
            return ""
        return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#x27;")
    
    @staticmethod
    def generate_chart_html(
        wine_name: str,
        movements_data: Dict[str, Any],
        period: str = "week",
        chart_id: Optional[str] = None
    ) -> str:
        """
        Genera HTML per grafico vino con canvas e dati JSON.
        Il frontend renderizzerà il grafico usando AnchoredFlowStockChart.
        
        Args:
            wine_name: Nome del vino
            movements_data: Dati movimenti da /api/viewer/movements
            period: Periodo preset ("day", "week", "month", "quarter", "year")
            chart_id: ID univoco per il canvas (auto-generato se None)
        
        Returns:
            HTML string con canvas e dati JSON
        """
        if not chart_id:
            import uuid
            chart_id = f"wine-chart-{uuid.uuid4().hex[:8]}"
        
        movements = movements_data.get("movements", [])
        current_stock = movements_data.get("current_stock", 0)
        opening_stock = movements_data.get("opening_stock", 0)
        
        # Prepara dati per il grafico (stesso formato che si aspetta AnchoredFlowStockChart)
        chart_data = {
            "wine_name": wine_name,
            "current_stock": current_stock,
            "opening_stock": opening_stock,
            "movements": movements,
            "period": period,
            "total_consumi": movements_data.get("total_consumi", 0),
            "total_rifornimenti": movements_data.get("total_rifornimenti", 0),
            "first_movement_date": movements_data.get("first_movement_date"),
            "last_movement_date": movements_data.get("last_movement_date")
        }
        
        # Genera HTML con canvas e script per renderizzazione
        html = f"""
<div class="wine-chart-container" data-chart-id="{chart_id}">
    <div class="wine-chart-header">
        <h4 class="wine-chart-title">📊 Andamento: {ChartHelper.escape_html(wine_name)}</h4>
        <div class="wine-chart-stats">
            <span class="wine-chart-stat">Stock attuale: <strong>{current_stock}</strong> bottiglie</span>
            <span class="wine-chart-stat">Rifornimenti: <strong>{chart_data['total_rifornimenti']}</strong></span>
            <span class="wine-chart-stat">Consumi: <strong>{chart_data['total_consumi']}</strong></span>
        </div>
    </div>
    <div class="wine-chart-canvas-wrapper">
        <canvas class="wine-chart-canvas" width="800" height="400"></canvas>
    </div>
    <script type="application/json" class="wine-chart-data">{json.dumps(chart_data, default=str)}</script>
</div>
"""
        return html
    
    @staticmethod
    def generate_wine_card_with_chart(
        wine,
        movements_data: Dict[str, Any],
        period: str = "week",
        badge: Optional[str] = None
    ) -> str:
        """
        Genera wine card completa con grafico integrato nello stesso container.
        Il grafico viene integrato come parte della wine card per uniformità visiva.
        
        Args:
            wine: Oggetto vino
            movements_data: Dati movimenti per il grafico
            period: Periodo preset per il grafico
            badge: Badge opzionale per la wine card
        
        Returns:
            HTML string con wine card e grafico integrati
        """
        from .wine_card_helper import WineCardHelper
        
        wine_id = getattr(wine, 'id', None)
        wine_id_attr = f' data-wine-id="{wine_id}"' if wine_id else ''
        
        # Inizia la wine card
        html = f'<div class="wine-card"{wine_id_attr}>'
        html += '<div class="wine-card-header">'
        
        # Badge
        if badge:
            html += f'<div class="wine-card-badge">{WineCardHelper.escape_html(badge)}</div>'
        
        html += f'<div><h3 class="wine-card-title">{WineCardHelper.escape_html(wine.name)}</h3>'
        if hasattr(wine, 'producer') and wine.producer:
            html += f'<div class="wine-card-producer">{WineCardHelper.escape_html(wine.producer)}</div>'
        html += '</div>'
        html += '</div>'  # Chiude wine-card-header
        
        # Body con informazioni vino
        html += '<div class="wine-card-body">'
        
        # Quantità
        if hasattr(wine, 'quantity') and wine.quantity is not None:
            html += '<div class="wine-card-field">'
            html += '<span class="wine-card-field-label">Quantità disponibile</span>'
            html += f'<span class="wine-card-field-value quantity">{wine.quantity} bottiglie</span>'
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
        
        html += '</div>'  # Chiude wine-card-body
        
        # Sezione grafico integrata nella wine card
        movements = movements_data.get("movements", [])
        current_stock = movements_data.get("current_stock", 0)
        
        if movements and len(movements) > 0:
            chart_data = {
                "wine_name": wine.name,
                "current_stock": current_stock,
                "opening_stock": movements_data.get("opening_stock", 0),
                "movements": movements,
                "period": period,
                "total_consumi": movements_data.get("total_consumi", 0),
                "total_rifornimenti": movements_data.get("total_rifornimenti", 0),
                "first_movement_date": movements_data.get("first_movement_date"),
                "last_movement_date": movements_data.get("last_movement_date")
            }
            
            import uuid
            chart_id = f"wine-chart-{uuid.uuid4().hex[:8]}"
            
            # Sezione grafico con stesso stile della wine card
            html += '<div class="wine-card-chart-section">'
            html += '<div class="wine-card-field wine-card-chart-header">'
            html += '<span class="wine-card-field-label">📊 Andamento Storico</span>'
            html += '<div class="wine-card-chart-stats">'
            html += f'<span class="wine-card-chart-stat-item">Stock: <strong>{current_stock}</strong></span>'
            html += f'<span class="wine-card-chart-stat-item">Riforniti: <strong>{chart_data["total_rifornimenti"]}</strong></span>'
            html += f'<span class="wine-card-chart-stat-item">Consumati: <strong>{chart_data["total_consumi"]}</strong></span>'
            html += '</div>'
            html += '</div>'
            html += f'<div class="wine-card-chart-wrapper" data-chart-id="{chart_id}">'
            html += '<canvas class="wine-card-chart-canvas" width="800" height="400"></canvas>'
            html += f'<script type="application/json" class="wine-chart-data">{json.dumps(chart_data, default=str)}</script>'
            html += '</div>'
            html += '</div>'  # Chiude wine-card-chart-section
        
        html += '</div>'  # Chiude wine-card
        
        return html

