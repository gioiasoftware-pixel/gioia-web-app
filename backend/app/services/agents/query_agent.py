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
        """
        # Controlla se è una richiesta di filtraggio per tipo vino
        message_lower = message.lower()
        wine_type_filters = {
            "rossi": "Rosso", "rosso": "Rosso", "red": "Rosso",
            "bianchi": "Bianco", "bianco": "Bianco", "white": "Bianco",
            "rosati": "Rosato", "rosato": "Rosato", "rosé": "Rosato",
            "spumanti": "Spumante", "spumante": "Spumante", "sparkling": "Spumante"
        }
        
        filtered_wines = None
        for keyword, wine_type in wine_type_filters.items():
            if keyword in message_lower:
                # Filtra vini per tipo
                all_wines = await db_manager.get_user_wines(user_id)
                # Filtra con confronto più robusto (case-insensitive, controlla match esatto o parziale)
                filtered_wines = [
                    w for w in all_wines 
                    if w.wine_type and (
                        wine_type.lower() in w.wine_type.lower() or 
                        w.wine_type.lower() in wine_type.lower()
                    )
                ]
                logger.info(f"[QUERY] Filtro tipo '{wine_type}' (keyword: '{keyword}') applicato: {len(filtered_wines)}/{len(all_wines)} vini trovati")
                # Log esempio per debug
                if filtered_wines:
                    logger.info(f"[QUERY] Esempi vini filtrati: {[w.name for w in filtered_wines[:3]]}")
                break
        
        if filtered_wines is not None:
            # Mostra vini filtrati con wine cards
            if filtered_wines:
                wine_cards_html = WineCardHelper.generate_wines_list_html(
                    wines=filtered_wines,
                    title=f"Vini trovati ({len(filtered_wines)})",
                    show_buttons=True
                )
                return {
                    "success": True,
                    "message": wine_cards_html,
                    "agent": self.name,
                    "is_html": True
                }
            else:
                return {
                    "success": True,
                    "message": "Nessun vino trovato con i filtri specificati.",
                    "agent": self.name
                }
        
        # Per altre query, usa il sistema normale
        # Aggiungi contesto inventario al messaggio (limitato a non mostrare tutto)
        context = await self._get_inventory_context(user_id, limit=10)
        enhanced_message = f"{message}\n\nContesto inventario (esempi):\n{context}\n\nIMPORTANTE: Se l'utente chiede di mostrare/filtrare vini, usa i dati forniti per rispondere con precisione. Non mostrare tutti i vini se non richiesto esplicitamente."
        
        result = await self.process(
            message=enhanced_message,
            thread_id=thread_id,
            user_id=user_id,
            context={"user_id": user_id, "inventory_context": context}
        )
        
        return result
    
    async def _get_inventory_context(self, user_id: int, limit: int = 5) -> str:
        """Ottiene contesto inventario per l'agent (limitato per non mostrare tutto)"""
        try:
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return "L'inventario è vuoto."
            
            # Crea summary inventario limitato
            context = f"Inventario contiene {len(wines)} vini totali.\n"
            context += f"Esempi di vini (primi {limit}):\n"
            for wine in wines[:limit]:
                wine_info = f"- {wine.name}"
                if wine.producer:
                    wine_info += f" ({wine.producer})"
                if wine.vintage:
                    wine_info += f" {wine.vintage}"
                if wine.wine_type:
                    wine_info += f" [{wine.wine_type}]"
                if wine.quantity is not None:
                    wine_info += f" - {wine.quantity} bottiglie"
                context += wine_info + "\n"
            
            if len(wines) > limit:
                context += f"... e altri {len(wines) - limit} vini.\n"
            
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

