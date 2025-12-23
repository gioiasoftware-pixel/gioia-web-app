"""
Movement Agent - Specializzato per registrazione movimenti inventario.
Delega ad AIServiceV1 che ha già tutta la logica per gestire i movimenti.
"""
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class MovementAgent:
    """
    Agent specializzato per movimenti inventario.
    Delega ad AIServiceV1 che ha già tutta la logica per gestire i movimenti
    tramite function calling (non usa Assistants API).
    """
    
    def __init__(self):
        # Non inizializza BaseAgent, non usa Assistants API
        self.name = "MovementAgent"
        # Importa AIServiceV1 per delegare
        from app.services.ai_service import AIService
        self.ai_service_v1 = AIService()
    
    async def process_with_context(
        self,
        message: str,
        user_id: int,
        thread_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processa movimento delegando ad AIServiceV1.
        AIServiceV1 ha già tutta la logica per gestire i movimenti tramite function calling.
        """
        # Valida quantità negativa nel messaggio (prevenzione base)
        import re
        quantity_matches = re.findall(r'-?\d+', message)
        for qty_str in quantity_matches:
            qty = int(qty_str)
            if qty < 0:
                return {
                    "success": False,
                    "error": f"❌ Errore: La quantità non può essere negativa ({qty}). Per registrare un consumo, usa una quantità positiva (es: 'consumato 5 Barolo').",
                    "agent": self.name
                }
        
        # Delega ad AIServiceV1 che gestisce i movimenti con function calling
        logger.info(f"[MOVEMENT] Delega movimento ad AIServiceV1: {message[:50]}...")
        result = await self.ai_service_v1.process_message(
            user_message=message,
            user_id=user_id,
            conversation_history=None  # Non usiamo storia conversazione per movimenti
        )
        
        # Converti formato risultato da AIServiceV1 al formato agent
        return {
            "success": True,  # AIServiceV1 gestisce errori internamente
            "message": result.get("message", ""),
            "agent": self.name,
            "is_html": result.get("is_html", False),
            "buttons": result.get("buttons"),
            "metadata": result.get("metadata", {})
        }
    
    async def _get_movement_context(self, user_id: int) -> str:
        """Ottiene contesto per validazione movimenti"""
        try:
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return "L'inventario è vuoto. Non è possibile registrare movimenti."
            
            # Crea lista vini per riferimento
            context = f"Inventario contiene {len(wines)} vini.\n"
            context += "Vini disponibili per riferimento:\n"
            for wine in wines[:10]:  # Primi 10
                wine_info = f"- {wine.name}"
                if wine.producer:
                    wine_info += f" ({wine.producer})"
                if wine.quantity is not None:
                    wine_info += f" - Disponibili: {wine.quantity} bottiglie"
                context += wine_info + "\n"
            
            if len(wines) > 10:
                context += f"... e altri {len(wines) - 10} vini.\n"
            
            return context
        except Exception as e:
            logger.error(f"Errore recupero contesto inventario: {e}")
            return "Errore nel recupero informazioni inventario."
    
    def _format_context(self, context: Dict[str, Any]) -> str:
        """Formatta contesto per l'agent"""
        user_id = context.get("user_id")
        inventory_context = context.get("inventory_context", "")
        
        return f"""
Contesto utente:
- User ID: {user_id}
- Inventario disponibile: {inventory_context}

Nota: Quando identifichi un movimento valido, fornisci un messaggio chiaro
con i dettagli del movimento (tipo, vino, quantità) che verrà processato dal sistema.
"""

