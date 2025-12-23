"""
Wine Management Agent - Specializzato per gestione completa CRUD vini.
Gestisce creazione, modifica, eliminazione e arricchimento dati vini.
"""
from .base_agent import BaseAgent
from app.core.database import db_manager
from app.core.processor_client import processor_client
from typing import Dict, Any, Optional, List
import logging
import re

logger = logging.getLogger(__name__)

class WineManagementAgent(BaseAgent):
    """Agent specializzato per gestione completa vini"""
    
    def __init__(self):
        instructions = """
        Sei un assistente specializzato nella gestione completa dell'inventario vini.
        
        Quando l'utente vuole gestire vini (creare, modificare, eliminare):
        1. Analizza la richiesta in linguaggio naturale
        2. Estrai dati strutturati (nome, produttore, annata, quantità, prezzi, ecc.)
        3. Valida i dati prima di procedere
        4. Verifica duplicati nell'inventario esistente
        5. Arricchisci dati mancanti quando possibile
        6. Fornisci feedback chiaro e dettagliato
        
        Sei esperto in:
        - Creazione vini da descrizioni naturali
        - Modifica intelligente di vini esistenti
        - Rilevamento e gestione duplicati
        - Arricchimento automatico dati mancanti
        - Validazione completa prima del salvataggio
        - Suggerimenti miglioramenti
        
        IMPORTANTE:
        - Riconosci richieste come:
          * "Aggiungi un Barolo 2018 della cantina Fontanafredda, 24 bottiglie, prezzo 45€"
          * "Modifica il prezzo del Chianti a 25€"
          * "Elimina il vino con ID 123"
          * "Aggiorna la quantità del Barolo a 50 bottiglie"
        - Prima di creare/modificare, verifica sempre duplicati
        - Chiedi conferma per operazioni importanti (eliminazioni, modifiche grandi)
        - Fornisci sempre feedback dettagliato delle operazioni
        - Mantieni un tono professionale e chiaro
        """
        
        super().__init__(
            name="WineManagementAgent",
            instructions=instructions,
            model="gpt-4o"  # Modello potente per estrazione dati complessa
        )
    
    async def process_with_context(
        self,
        message: str,
        user_id: int,
        thread_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processa richiesta gestione vino con contesto inventario.
        
        Args:
            message: Messaggio utente con richiesta gestione vino
            user_id: ID utente
            thread_id: ID thread (opzionale)
        
        Returns:
            Dict con risposta e metadati
        """
        try:
            # Aggiungi contesto inventario
            context = await self._get_wine_management_context(user_id)
            enhanced_message = f"{message}\n\nContesto inventario:\n{context}"
            
            # Analizza intenzione (creare, modificare, eliminare)
            intention = await self._analyze_intention(message)
            logger.info(f"[WINE_MANAGEMENT] Intenzione rilevata: {intention}")
            
            # Processa con AI per estrazione dati e validazione
            result = await self.process(
                message=enhanced_message,
                thread_id=thread_id,
                user_id=user_id,
                context={"user_id": user_id, "intention": intention, "inventory_context": context}
            )
            
            return result
        
        except Exception as e:
            logger.error(f"[WINE_MANAGEMENT] Errore processamento: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Errore durante la gestione del vino: {str(e)}",
                "agent": self.name
            }
    
    async def _analyze_intention(self, message: str) -> str:
        """Analizza intenzione del messaggio (create, update, delete)"""
        message_lower = message.lower()
        
        # Keywords per creazione
        create_keywords = ["aggiungi", "crea", "nuovo", "inserisci", "add", "create", "new", "inserire"]
        # Keywords per modifica
        update_keywords = ["modifica", "aggiorna", "cambia", "update", "change", "modify", "edit"]
        # Keywords per eliminazione
        delete_keywords = ["elimina", "rimuovi", "cancella", "delete", "remove", "cancellare"]
        
        if any(keyword in message_lower for keyword in create_keywords):
            return "create"
        elif any(keyword in message_lower for keyword in delete_keywords):
            return "delete"
        elif any(keyword in message_lower for keyword in update_keywords):
            return "update"
        else:
            return "unknown"
    
    async def _get_wine_management_context(self, user_id: int) -> str:
        """Ottiene contesto inventario per gestione vini"""
        try:
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return "L'inventario è vuoto. Puoi iniziare ad aggiungere vini."
            
            # Crea summary inventario con focus su duplicati potenziali
            context = f"Inventario contiene {len(wines)} vini.\n\n"
            context += "Vini esistenti (per controllo duplicati):\n"
            
            # Raggruppa per nome per evidenziare possibili duplicati
            wines_by_name = {}
            for wine in wines:
                name_key = wine.name.lower().strip()
                if name_key not in wines_by_name:
                    wines_by_name[name_key] = []
                wines_by_name[name_key].append(wine)
            
            # Mostra vini con possibili duplicati
            for name_key, wine_list in list(wines_by_name.items())[:20]:
                if len(wine_list) > 1:
                    context += f"⚠️ {wine_list[0].name} (possibile duplicato: {len(wine_list)} versioni)\n"
                else:
                    wine = wine_list[0]
                    wine_info = f"- {wine.name}"
                    if wine.producer:
                        wine_info += f" ({wine.producer})"
                    if wine.vintage:
                        wine_info += f" {wine.vintage}"
                    if wine.quantity is not None:
                        wine_info += f" - {wine.quantity} bottiglie"
                    context += wine_info + "\n"
            
            if len(wines) > 20:
                context += f"\n... e altri {len(wines) - 20} vini.\n"
            
            return context
        
        except Exception as e:
            logger.error(f"Errore recupero contesto inventario: {e}")
            return "Errore nel recupero informazioni inventario."
    
    def _format_context(self, context: Dict[str, Any]) -> str:
        """Formatta contesto per l'agent"""
        user_id = context.get("user_id")
        intention = context.get("intention", "unknown")
        inventory_context = context.get("inventory_context", "")
        
        return f"""
Contesto gestione vino:
- User ID: {user_id}
- Intenzione: {intention}
- Inventario disponibile:
{inventory_context}

Nota: Quando identifichi una richiesta valida di gestione vino, fornisci un messaggio chiaro
con i dettagli dell'operazione che verrà eseguita. Per operazioni critiche (eliminazioni),
chiedi sempre conferma esplicita all'utente.
"""

