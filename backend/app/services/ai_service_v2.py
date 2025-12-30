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
        conversation_history: Optional[list] = None,
        conversation_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Processa messaggio usando sistema multi-agent.
        
        Flow:
        1. Router analizza messaggio e determina agent appropriato
        2. Valida routing e applica fallback se necessario
        3. Instrada al agent specializzato
        4. Agent processa con contesto inventario
        5. Ritorna risposta formattata
        
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
            
            # Step 2: Valida e normalizza agent name
            agent_name = self._validate_and_normalize_agent(agent_name, user_message)
            
            logger.info(f"[AI_SERVICE_V2] 📍 Router instradato a: {agent_name} (validato)")
            
            # Step 3: Ottieni istanza agent
            agent_instance = self._get_agent_by_name(agent_name)
            
            if not agent_instance:
                # Agent non disponibile (es. extraction), fallback a query
                if agent_name == "extraction":
                    logger.info(f"[AI_SERVICE_V2] ⚠️ Extraction agent non disponibile, uso query agent")
                else:
                    logger.warning(f"[AI_SERVICE_V2] ⚠️ Agent '{agent_name}' non disponibile, uso query agent")
                agent_instance = self.query
                agent_name = "query"  # Aggiorna per metadata
            
            # Step 4: Instrada al agent appropriato
            logger.info(f"[AI_SERVICE_V2] 🔄 Invio messaggio a {agent_name}")
            # Passa conversation_id se disponibile (per MultiMovementAgent)
            if hasattr(agent_instance, 'process_with_context'):
                # Alcuni agent hanno conversation_id come parametro opzionale
                import inspect
                sig = inspect.signature(agent_instance.process_with_context)
                if 'conversation_id' in sig.parameters:
                    result = await agent_instance.process_with_context(
                        message=user_message,
                        user_id=user_id,
                        conversation_id=conversation_id
                    )
                else:
                    result = await agent_instance.process_with_context(
                        message=user_message,
                        user_id=user_id
                    )
            else:
                result = await agent_instance.process_with_context(
                    message=user_message,
                    user_id=user_id
                )
            
            # Log risultato
            if result.get("success"):
                logger.info(f"[AI_SERVICE_V2] ✅ {agent_name} completato con successo")
            else:
                logger.warning(f"[AI_SERVICE_V2] ⚠️ {agent_name} completato con errori: {result.get('error', 'unknown')}")
            
            # Step 5: Formatta risposta
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
                    "is_html": result.get("is_html", False)  # Usa is_html da result se disponibile
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
    
    def _validate_and_normalize_agent(self, agent_name: str, user_message: str) -> str:
        """
        Valida e normalizza il nome agent, applicando logica di fallback intelligente.
        
        Args:
            agent_name: Nome agent restituito dal router
            user_message: Messaggio originale dell'utente per analisi aggiuntiva
        
        Returns:
            Nome agent validato e normalizzato
        """
        agent_name = agent_name.strip().lower()
        
        # Rimuovi caratteri speciali
        agent_name = agent_name.replace(".", "").replace("!", "").replace("?", "").strip()
        
        # Validazione agent disponibili
        valid_agents = {
            "extraction", "query", "movement", "multi_movement", 
            "analytics", "wine_management", "report", "notification", "conversation"
        }
        
        if agent_name in valid_agents:
            return agent_name
        
        # Fallback intelligente basato sul messaggio
        message_lower = user_message.lower()
        logger.warning(f"[AI_SERVICE_V2] ⚠️ Agent '{agent_name}' non valido, applico fallback intelligente")
        
        # Logica di fallback basata su keywords
        if any(kw in message_lower for kw in ["carica", "importa", "file", "csv", "excel"]):
            return "extraction"
        elif any(kw in message_lower for kw in ["consumo", "venduto", "rifornito", "acquistato", "aggiunto", "tolto", "registra"]):
            # Distingui tra singolo e multiplo
            if any(kw in message_lower for kw in [" e ", ",", "più"]):
                return "multi_movement"
            return "movement"
        elif any(kw in message_lower for kw in ["aggiungi vino", "crea vino", "modifica vino", "elimina vino", "nuovo vino"]):
            return "wine_management"
        elif any(kw in message_lower for kw in ["report", "riepilogo dettagliato"]):
            return "report"
        elif any(kw in message_lower for kw in ["statistiche", "analisi", "trend"]) and any(kw in message_lower for kw in [" del ", " della ", " di "]):
            # Statistiche con nome vino specifico
            return "notification"
        elif any(kw in message_lower for kw in ["statistiche", "analisi", "trend", "quanti vini"]):
            return "analytics"
        elif any(kw in message_lower for kw in ["esauriti", "scorte basse", "alert"]):
            return "notification"
        elif any(kw in message_lower for kw in ["cerca", "trova", "quale", "info", "dettagli", "lista", "mostra", "dimmi"]):
            return "query"
        elif any(kw in message_lower for kw in ["cosa abbiamo detto", "di cosa stavamo parlando", "riassumi conversazione"]):
            return "conversation"
        else:
            # Default: query agent (più generico)
            logger.info(f"[AI_SERVICE_V2] 🔄 Fallback a query agent (default)")
            return "query"
    
    def _get_agent_by_name(self, agent_name: str):
        """
        Ritorna istanza agent per nome.
        
        Args:
            agent_name: Nome agent
        
        Returns:
            Istanza agent o None se non trovato
        """
        agents_map = {
            "extraction": None,  # Non implementato
            "query": self.query,
            "movement": self.movement,
            "multi_movement": self.multi_movement,
            "analytics": self.analytics,
            "wine_management": self.wine_management,
            "report": self.report,
            "notification": self.notification,
            "conversation": self.conversation
        }
        return agents_map.get(agent_name)

