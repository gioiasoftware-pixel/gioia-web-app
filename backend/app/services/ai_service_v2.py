"""
Nuovo servizio AI che usa sistema multi-agent.
Integra RouterAgent, QueryAgent, MovementAgent, MultiMovementAgent e AnalyticsAgent.
"""
from .agents.router_agent import RouterAgent
from .agents.query_agent import QueryAgent
from .agents.movement_agent import MovementAgent
from .agents.multi_movement_agent import MultiMovementAgent
from .agents.analytics_agent import AnalyticsAgent
from .agents.wine_management_agent import WineManagementAgent
from .agents.validation_agent import ValidationAgent
from .agents.notification_agent import NotificationAgent
from .agents.conversation_agent import ConversationAgent
from .agents.report_agent import ReportAgent
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class AIServiceV2:
    """Servizio AI con sistema multi-agent"""
    
    def __init__(self):
        """Inizializza tutti gli agent"""
        logger.info("🚀 Inizializzazione sistema multi-agent...")
        
        try:
            self.router = RouterAgent()
            self.query = QueryAgent()
            self.movement = MovementAgent()
            # MultiMovementAgent usa MovementAgent per ogni movimento singolo
            self.multi_movement = MultiMovementAgent(movement_agent=self.movement)
            self.analytics = AnalyticsAgent()
            self.wine_management = WineManagementAgent()
            self.validation = ValidationAgent()
            self.notification = NotificationAgent()
            self.conversation = ConversationAgent()
            self.report = ReportAgent()
            
            logger.info("✅ Sistema multi-agent inizializzato con successo")
        except Exception as e:
            logger.error(f"❌ Errore inizializzazione sistema multi-agent: {e}", exc_info=True)
            raise
    
    async def process_message(
        self,
        user_message: str,
        user_id: int,
        conversation_history: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Processa messaggio usando sistema multi-agent.
        
        Flow:
        1. Router analizza messaggio e determina agent appropriato
        2. Instrada al agent specializzato
        3. Agent processa con contesto inventario
        4. Ritorna risposta formattata
        
        Args:
            user_message: Messaggio dell'utente
            user_id: ID utente
            conversation_history: Storia conversazione (non usata ancora, per compatibilità)
        
        Returns:
            Dict con risposta e metadati
        """
        if not user_message or not user_message.strip():
            return {
                "message": "⚠️ Messaggio vuoto ricevuto. Prova a scrivere qualcosa!",
                "metadata": {"error": "empty_message", "type": "error"}
            }
        
        try:
            # Step 1: Router determina agent appropriato
            logger.info(f"[AI_SERVICE_V2] Processing message: {user_message[:50]}...")
            agent_name = await self.router.route(user_message)
            logger.info(f"[AI_SERVICE_V2] 📍 Router instradato a: {agent_name}")
            
            # Step 2: Instrada al agent appropriato
            # Nota: Extraction agent lasciato da parte per ora come richiesto
            if agent_name == "query":
                result = await self.query.process_with_context(
                    message=user_message,
                    user_id=user_id
                )
            elif agent_name == "movement":
                # Movimento singolo: usa MovementAgent
                result = await self.movement.process_with_context(
                    message=user_message,
                    user_id=user_id
                )
            elif agent_name == "multi_movement":
                # Movimenti multipli: usa MultiMovementAgent che coordina MovementAgent
                logger.info(f"[AI_SERVICE_V2] 📦 Rilevati movimenti multipli, uso MultiMovementAgent")
                result = await self.multi_movement.process_with_context(
                    message=user_message,
                    user_id=user_id
                )
            elif agent_name == "analytics":
                result = await self.analytics.process_with_context(
                    message=user_message,
                    user_id=user_id
                )
            elif agent_name == "wine_management":
                result = await self.wine_management.process_with_context(
                    message=user_message,
                    user_id=user_id
                )
            elif agent_name == "report":
                result = await self.report.process_with_context(
                    message=user_message,
                    user_id=user_id
                )
            elif agent_name == "notification":
                result = await self.notification.process_with_context(
                    message=user_message,
                    user_id=user_id
                )
            elif agent_name == "conversation":
                # ConversationAgent può richiedere storia conversazione
                # Per ora usa solo il messaggio corrente
                result = await self.conversation.process_with_context(
                    message=user_message,
                    user_id=user_id
                )
            elif agent_name == "extraction":
                # Extraction agent non implementato ancora, fallback a query
                logger.info(f"[AI_SERVICE_V2] ⚠️ Extraction agent non disponibile, uso query agent")
                result = await self.query.process_with_context(
                    message=user_message,
                    user_id=user_id
                )
            else:
                # Fallback a query agent
                logger.warning(f"[AI_SERVICE_V2] ⚠️ Agent '{agent_name}' non riconosciuto, uso query")
                result = await self.query.process_with_context(
                    message=user_message,
                    user_id=user_id
                )
            
            # Step 3: Formatta risposta
            if result.get("success"):
                return {
                    "message": result["message"],
                    "metadata": {
                        "type": "agent_response",
                        "agent": result.get("agent", agent_name),
                        "model": result.get("model"),
                        "thread_id": result.get("thread_id")
                    },
                    "buttons": None,  # Per compatibilità con API esistente
                    "is_html": False  # Per compatibilità con API esistente
                }
            else:
                error_msg = result.get("error", "Errore sconosciuto")
                logger.error(f"[AI_SERVICE_V2] ❌ Errore agent {agent_name}: {error_msg}")
                return {
                    "message": f"⚠️ Si è verificato un errore: {error_msg}",
                    "metadata": {
                        "type": "error",
                        "agent": agent_name,
                        "error": error_msg
                    },
                    "buttons": None,
                    "is_html": False
                }
        
        except Exception as e:
            logger.error(f"[AI_SERVICE_V2] ❌ Errore processamento messaggio: {e}", exc_info=True)
            return {
                "message": "⚠️ Si è verificato un errore durante il processamento. Riprova più tardi.",
                "metadata": {
                    "type": "error",
                    "error": str(e)
                },
                "buttons": None,
                "is_html": False
            }

