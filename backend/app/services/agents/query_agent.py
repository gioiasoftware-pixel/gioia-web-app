"""
Query Agent - Specializzato per ricerche e query inventario.
"""
from .base_agent import BaseAgent
from .wine_card_helper import WineCardHelper
from app.core.database import db_manager
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class QueryAgent(BaseAgent):
    """Agent specializzato per query inventario"""
    
    def __init__(self):
        instructions = """
        Sei un assistente specializzato nella ricerca e analisi di inventari vini.
        
        Quando l'utente cerca un vino:
        1. Usa ricerca intelligente per trovare corrispondenze
        2. Se multipli risultati, presenta opzioni con dettagli chiari
        3. Se nessun risultato, suggerisci alternative simili
        4. Mantieni contesto della conversazione
        
        Sei esperto in:
        - Ricerca vini per nome, produttore, annata
        - Filtri complessi (regione, tipo, prezzo, ecc.)
        - Confronti tra vini
        - Analisi comparative
        - Suggerimenti intelligenti
        
        IMPORTANTE:
        - Fornisci risposte dettagliate e utili
        - Se non trovi risultati, suggerisci alternative
        - Mantieni un tono professionale ma amichevole
        - Usa formattazione markdown per rendere le risposte leggibili
        """
        
        super().__init__(
            name="QueryAgent",
            instructions=instructions,
            model="gpt-4o-mini"  # Modello economico per query
        )
        self.user_id_context = None
    
    async def process_with_context(
        self,
        message: str,
        user_id: int,
        thread_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processa query con contesto inventario.
        
        Per ora usa il sistema esistente per le ricerche,
        poi può essere migliorato con tools integrati.
        """
        # Aggiungi contesto inventario al messaggio
        context = await self._get_inventory_context(user_id)
        enhanced_message = f"{message}\n\nContesto inventario:\n{context}"
        
        result = await self.process(
            message=enhanced_message,
            thread_id=thread_id,
            user_id=user_id,
            context={"user_id": user_id, "inventory_context": context}
        )
        
        return result
    
    async def _get_inventory_context(self, user_id: int) -> str:
        """Ottiene contesto inventario per l'agent"""
        try:
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return "L'inventario è vuoto."
            
            # Crea summary inventario
            context = f"Inventario contiene {len(wines)} vini.\n"
            context += "Esempi di vini:\n"
            for wine in wines[:5]:  # Primi 5 come esempio
                wine_info = f"- {wine.name}"
                if wine.producer:
                    wine_info += f" ({wine.producer})"
                if wine.vintage:
                    wine_info += f" {wine.vintage}"
                if wine.quantity is not None:
                    wine_info += f" - {wine.quantity} bottiglie"
                context += wine_info + "\n"
            
            if len(wines) > 5:
                context += f"... e altri {len(wines) - 5} vini.\n"
            
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
- Inventario: {inventory_context}
"""

