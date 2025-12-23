"""
Conversation Agent - Specializzato per gestione contesto conversazionale.
Migliora comprensione e gestione ambiguità nelle conversazioni.
"""
from .base_agent import BaseAgent
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)

class ConversationAgent(BaseAgent):
    """Agent specializzato per gestione conversazione e contesto"""
    
    def __init__(self):
        instructions = """
        Sei un assistente esperto nella gestione di conversazioni naturali.
        
        Il tuo compito è:
        1. Mantenere contesto conversazionale
        2. Gestire ambiguità e riferimenti impliciti
        3. Chiarire richieste ambigue
        4. Gestire correzioni utente
        5. Riassumere conversazioni lunghe
        
        Sei esperto in:
        - Riconoscere riferimenti a messaggi precedenti ("quello", "il vino di prima")
        - Identificare pronomi e riferimenti impliciti
        - Gestire correzioni ("no, intendevo...")
        - Chiarire ambiguità con domande mirate
        - Riassumere punti chiave di conversazioni lunghe
        
        IMPORTANTE:
        - Analizza sempre il contesto della conversazione fornito
        - Identifica riferimenti a entità menzionate precedentemente
        - Chiedi chiarimenti quando necessario, ma in modo naturale
        - Mantieni un tono conversazionale e amichevole
        - Aiuta l'utente a esprimere chiaramente le sue intenzioni
        - NON chiamare funzioni o tools: rispondi solo basandoti sul contesto conversazionale fornito
        - Se l'utente chiede informazioni su movimenti, rifornimenti, o dati inventario, rispondi in base al contesto della conversazione
        - Non cercare di accedere a funzioni esterne, usa solo il contesto fornito nel messaggio
        """
        
        super().__init__(
            name="ConversationAgent",
            instructions=instructions,
            model="gpt-4o"  # Modello potente per gestione contesto complessa
        )
    
    async def clarify_ambiguity(
        self,
        message: str,
        conversation_history: List[Dict[str, Any]],
        user_id: int
    ) -> Dict[str, Any]:
        """
        Chiarisce ambiguità in un messaggio usando storia conversazione.
        
        Args:
            message: Messaggio ambiguo dell'utente
            conversation_history: Storia conversazione (lista di messaggi)
            user_id: ID utente
        
        Returns:
            Dict con:
                - clarified: bool (se è stato chiarito)
                - clarified_message: str (messaggio chiarito)
                - questions: List[str] (domande per chiarimento se necessario)
        """
        try:
            # Prepara contesto conversazione
            context = self._format_conversation_context(conversation_history)
            enhanced_message = f"""
Messaggio utente: {message}

Storia conversazione:
{context}

Analizza il messaggio e:
1. Identifica eventuali riferimenti a entità menzionate precedentemente
2. Chiarisci ambiguità usando il contesto
3. Se necessario, formula domande per chiarimento

Rispondi con:
- Messaggio chiarito (se possibile)
- Domande per chiarimento (se necessario)
"""
            
            result = await self.process(
                message=enhanced_message,
                user_id=user_id,
                context={"conversation_history": conversation_history}
            )
            
            if result.get("success"):
                return {
                    "clarified": True,
                    "clarified_message": result.get("message", message),
                    "questions": []
                }
            else:
                return {
                    "clarified": False,
                    "clarified_message": message,
                    "questions": []
                }
        
        except Exception as e:
            logger.error(f"[CONVERSATION] Errore chiarimento ambiguità: {e}", exc_info=True)
            return {
                "clarified": False,
                "clarified_message": message,
                "questions": []
            }
    
    def _format_conversation_context(self, conversation_history: List[Dict[str, Any]]) -> str:
        """Formatta storia conversazione per contesto"""
        if not conversation_history:
            return "Nessuna conversazione precedente."
        
        context = "Storia conversazione recente:\n"
        for msg in conversation_history[-10:]:  # Ultimi 10 messaggi
            role = msg.get("role", "unknown")
            content = msg.get("content", "")[:200]  # Limita lunghezza
            context += f"- {role}: {content}\n"
        
        return context
    
    async def summarize_conversation(
        self,
        conversation_history: List[Dict[str, Any]],
        user_id: int
    ) -> Dict[str, Any]:
        """
        Riassume una conversazione lunga.
        
        Args:
            conversation_history: Storia conversazione completa
            user_id: ID utente
        
        Returns:
            Dict con riassunto
        """
        try:
            if len(conversation_history) < 5:
                return {
                    "success": False,
                    "message": "Conversazione troppo breve per un riassunto."
                }
            
            context = self._format_conversation_context(conversation_history)
            enhanced_message = f"""
Riassumi questa conversazione evidenziando:
1. Argomenti principali discussi
2. Decisioni prese
3. Azioni eseguite
4. Punti chiave da ricordare

Conversazione:
{context}
"""
            
            result = await self.process(
                message=enhanced_message,
                user_id=user_id,
                context={"conversation_history": conversation_history}
            )
            
            return result
        
        except Exception as e:
            logger.error(f"[CONVERSATION] Errore riassunto conversazione: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Errore durante il riassunto: {str(e)}"
            }
    
    async def process_with_context(
        self,
        message: str,
        user_id: int,
        thread_id: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Processa richiesta conversazionale con contesto.
        """
        try:
            # Se c'è storia conversazione, usa per chiarire ambiguità
            if conversation_history:
                clarification = await self.clarify_ambiguity(message, conversation_history, user_id)
                if clarification.get("clarified"):
                    message = clarification["clarified_message"]
            
            # Processa con AI
            context = self._format_conversation_context(conversation_history or [])
            enhanced_message = f"{message}\n\nContesto conversazione:\n{context}"
            
            result = await self.process(
                message=enhanced_message,
                thread_id=thread_id,
                user_id=user_id,
                context={
                    "user_id": user_id,
                    "conversation_history": conversation_history or []
                }
            )
            
            return result
        
        except Exception as e:
            logger.error(f"[CONVERSATION] Errore processamento: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Errore durante la gestione conversazione: {str(e)}",
                "agent": self.name
            }
    
    def _format_context(self, context: Dict[str, Any]) -> str:
        """Formatta contesto per l'agent"""
        user_id = context.get("user_id")
        conversation_history = context.get("conversation_history", [])
        conv_context = self._format_conversation_context(conversation_history)
        
        return f"""
Contesto conversazione:
- User ID: {user_id}
- Storia conversazione:
{conv_context}

Nota: Usa sempre il contesto della conversazione per interpretare riferimenti impliciti
e chiarire ambiguità. Mantieni un tono naturale e conversazionale.
"""

