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
        1. Analizza SOLO i dati statistici forniti (totali, aggregazioni, distribuzioni)
        2. Genera statistiche dettagliate e aggregate
        3. Fornisci insights utili basati sulle statistiche
        4. Suggerisci ottimizzazioni
        
        IMPORTANTE - REGOLE CRITICHE:
        - NON mostrare liste di vini individuali o esempi di vini
        - Mostra SOLO statistiche aggregate (totali, medie, distribuzioni)
        - Rispondi alle domande specifiche dell'utente con numeri e statistiche
        - Se l'utente chiede "quante bottiglie ho", rispondi con il numero totale
        - Usa formattazione markdown per tabelle statistiche
        - Evidenzia numeri chiave (totali, medie, distribuzioni)
        - Mantieni un tono professionale
        
        FORMATO RISPOSTA:
        - Inizia con la risposta diretta alla domanda (es: "Hai X bottiglie in totale")
        - Poi fornisci statistiche dettagliate in formato markdown
        - NON includere liste di vini individuali
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
        """Ottiene SOLO statistiche aggregate per analytics (NO lista vini)"""
        try:
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return "L'inventario è vuoto.\n\nStatistiche: 0 vini, 0 bottiglie, €0.00"
            
            # Calcola statistiche aggregate
            total_wines = len(wines)
            total_bottles = sum(w.quantity or 0 for w in wines)
            total_value = sum((w.selling_price or 0) * (w.quantity or 0) for w in wines)
            avg_price = sum((w.selling_price or 0) for w in wines if w.selling_price) / len([w for w in wines if w.selling_price]) if [w for w in wines if w.selling_price] else 0
            
            # Conta per tipo
            types_count = {}
            types_bottles = {}
            for wine in wines:
                wine_type = wine.wine_type or "Altro"
                types_count[wine_type] = types_count.get(wine_type, 0) + 1
                types_bottles[wine_type] = types_bottles.get(wine_type, 0) + (wine.quantity or 0)
            
            # Vini a bassa scorta (quantità < 5)
            low_stock_count = len([w for w in wines if (w.quantity or 0) < 5])
            
            # Costruisci SOLO statistiche aggregate (NO lista vini)
            data = f"""STATISTICHE INVENTARIO (SOLO AGGREGATI, NON LISTA VINI):

Totali:
- Totale vini diversi: {total_wines}
- Totale bottiglie: {total_bottles}
- Valore stimato inventario: €{total_value:,.2f}
- Prezzo medio per bottiglia: €{avg_price:.2f}

Distribuzione per tipo vino:
"""
            for wine_type, count in sorted(types_count.items(), key=lambda x: x[1], reverse=True):
                bottles = types_bottles.get(wine_type, 0)
                data += f"- {wine_type}: {count} vini ({bottles} bottiglie)\n"
            
            data += f"\nAltri indicatori:\n"
            data += f"- Vini a bassa scorta (<5 bottiglie): {low_stock_count}\n"
            data += f"- Vini con quantità disponibile: {len([w for w in wines if (w.quantity or 0) > 0])}\n"
            data += f"- Vini esauriti (0 bottiglie): {len([w for w in wines if (w.quantity or 0) == 0])}\n"
            
            data += "\nIMPORTANTE: Rispondi SOLO con statistiche aggregate. NON mostrare liste di vini individuali."
            
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

