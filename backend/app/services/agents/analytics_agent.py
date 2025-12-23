"""
Analytics Agent - Specializzato per statistiche e report inventario.
"""
from .base_agent import BaseAgent
from app.core.database import db_manager
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class AnalyticsAgent(BaseAgent):
    """Agent specializzato per analytics inventario"""
    
    def __init__(self):
        instructions = """
        Sei un analista esperto di inventari vini.
        
        Quando l'utente richiede statistiche o report:
        1. Analizza i dati inventario forniti
        2. Genera statistiche dettagliate
        3. Crea report strutturati
        4. Fornisci insights utili
        5. Suggerisci ottimizzazioni
        
        Sei esperto in:
        - Statistiche inventario (totale vini, bottiglie, valore)
        - Analisi per categoria (tipo, regione, produttore)
        - Identificazione vini a bassa scorta
        - Analisi valore inventario
        - Trend e pattern
        - Suggerimenti ottimizzazione
        
        IMPORTANTE:
        - Fornisci statistiche precise e dettagliate
        - Usa formattazione markdown per tabelle e liste
        - Evidenzia informazioni importanti
        - Suggerisci azioni pratiche
        - Mantieni un tono professionale
        """
        
        super().__init__(
            name="AnalyticsAgent",
            instructions=instructions,
            model="gpt-4o-mini"
        )
    
    async def process_with_context(
        self,
        message: str,
        user_id: int,
        thread_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Processa richiesta analytics con dati inventario"""
        # Aggiungi dati inventario completi
        analytics_data = await self._get_analytics_data(user_id)
        enhanced_message = f"{message}\n\nDati inventario:\n{analytics_data}"
        
        result = await self.process(
            message=enhanced_message,
            thread_id=thread_id,
            user_id=user_id,
            context={"user_id": user_id, "analytics_data": analytics_data}
        )
        
        return result
    
    async def _get_analytics_data(self, user_id: int) -> str:
        """Ottiene dati inventario per analytics"""
        try:
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return "L'inventario è vuoto."
            
            # Calcola statistiche
            total_wines = len(wines)
            total_bottles = sum(w.quantity or 0 for w in wines)
            total_value = sum((w.selling_price or 0) * (w.quantity or 0) for w in wines)
            
            # Conta per tipo
            types_count = {}
            for wine in wines:
                wine_type = wine.wine_type or "Altro"
                types_count[wine_type] = types_count.get(wine_type, 0) + 1
            
            # Vini a bassa scorta (quantità < 5)
            low_stock = [w for w in wines if (w.quantity or 0) < 5]
            
            # Costruisci report dati
            data = f"""
Statistiche inventario:
- Totale vini: {total_wines}
- Totale bottiglie: {total_bottles}
- Valore stimato: €{total_value:.2f}

Distribuzione per tipo:
"""
            for wine_type, count in types_count.items():
                data += f"- {wine_type}: {count} vini\n"
            
            if low_stock:
                data += f"\nVini a bassa scorta ({len(low_stock)}):\n"
                for wine in low_stock[:10]:
                    data += f"- {wine.name}: {wine.quantity or 0} bottiglie\n"
            
            # Dettagli vini (esempio)
            data += "\nEsempi vini inventario:\n"
            for wine in wines[:20]:
                wine_info = f"- {wine.name}"
                if wine.producer:
                    wine_info += f" ({wine.producer})"
                if wine.vintage:
                    wine_info += f" {wine.vintage}"
                if wine.wine_type:
                    wine_info += f" [{wine.wine_type}]"
                if wine.quantity is not None:
                    wine_info += f" - Qty: {wine.quantity}"
                if wine.selling_price:
                    wine_info += f" - €{wine.selling_price:.2f}"
                data += wine_info + "\n"
            
            if len(wines) > 20:
                data += f"... e altri {len(wines) - 20} vini.\n"
            
            return data
        except Exception as e:
            logger.error(f"Errore recupero dati analytics: {e}")
            return "Errore nel recupero dati inventario."
    
    def _format_context(self, context: Dict[str, Any]) -> str:
        """Formatta contesto per l'agent"""
        user_id = context.get("user_id")
        analytics_data = context.get("analytics_data", "")
        
        return f"""
Contesto utente:
- User ID: {user_id}
- Dati inventario per analisi:
{analytics_data}
"""

