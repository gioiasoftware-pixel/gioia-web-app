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
        Genera wine card completa con grafico integrato.
        
        Args:
            wine: Oggetto vino
            movements_data: Dati movimenti per il grafico
            period: Periodo preset per il grafico
            badge: Badge opzionale per la wine card
        
        Returns:
            HTML string con wine card e grafico
        """
        from .wine_card_helper import WineCardHelper
        
        # Genera wine card standard
        wine_card_html = WineCardHelper.generate_wine_card_html(wine, badge=badge)
        
        # Genera grafico
        chart_html = ChartHelper.generate_chart_html(
            wine_name=wine.name,
            movements_data=movements_data,
            period=period
        )
        
        # Combina
        return wine_card_html + "<br>" + chart_html

