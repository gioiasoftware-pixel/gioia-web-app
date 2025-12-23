"""
Movement Agent - Specializzato per registrazione movimenti inventario.
"""
from .base_agent import BaseAgent
from app.core.database import db_manager
from app.core.processor_client import processor_client
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class MovementAgent(BaseAgent):
    """Agent specializzato per movimenti inventario"""
    
    def __init__(self):
        instructions = """
        Sei un assistente specializzato nella gestione movimenti inventario vini.
        
        Quando l'utente registra un movimento:
        1. Identifica il tipo di movimento (consumo/rifornimento)
        2. Identifica il vino (nome o ID)
        3. Identifica la quantità
        4. Valida che il vino esista nell'inventario
        5. Verifica che la quantità sia ragionevole
        6. Fornisci feedback chiaro all'utente
        
        IMPORTANTE:
        - Riconosci movimenti da messaggi naturali come:
          * "Ho venduto 3 bottiglie di Barolo"
          * "Consumato 2 Chianti"
          * "Ricevuto 10 bottiglie di Brunello"
          * "Aggiunto 5 Barolo"
        - Chiedi conferma se il vino non è univoco
        - Valida sempre i dati prima di suggerire la registrazione
        - Avvisa se le scorte diventano basse dopo il movimento
        - Mantieni un tono professionale e chiaro
        """
        
        super().__init__(
            name="MovementAgent",
            instructions=instructions,
            model="gpt-4o-mini"
        )
    
    async def process_with_context(
        self,
        message: str,
        user_id: int,
        thread_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Processa movimento con validazione"""
        # Aggiungi contesto inventario
        context = await self._get_movement_context(user_id)
        enhanced_message = f"{message}\n\nContesto inventario:\n{context}"
        
        result = await self.process(
            message=enhanced_message,
            thread_id=thread_id,
            user_id=user_id,
            context={"user_id": user_id, "inventory_context": context}
        )
        
        return result
    
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

