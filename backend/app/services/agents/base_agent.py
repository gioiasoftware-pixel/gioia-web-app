"""
Base Agent - Classe base per tutti gli agent specializzati.
Usa OpenAI Assistants API per creare agent con memoria e contesto.
"""
import os
import logging
from typing import Dict, Any, Optional, List
from openai import OpenAI
import time

logger = logging.getLogger(__name__)

class BaseAgent:
    """Classe base per tutti gli agent specializzati"""
    
    def __init__(
        self,
        name: str,
        instructions: str,
        model: str = "gpt-4o-mini",
        tools: Optional[List[Dict[str, Any]]] = None
    ):
        """
        Inizializza un agent.
        
        Args:
            name: Nome dell'agent
            instructions: Istruzioni per l'agent (prompt specializzato)
            model: Modello OpenAI da usare
            tools: Lista di tools disponibili per l'agent
        """
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY non configurata")
        
        # OpenAI Assistants API v2 richiede header specifico
        self.client = OpenAI(
            api_key=api_key,
            default_headers={"OpenAI-Beta": "assistants=v2"}
        )
        self.name = name
        self.model = model
        self.instructions = instructions
        self.tools = tools or []
        self.assistant_id = None
        self._create_assistant()
    
    def _create_assistant(self):
        """Crea assistant su OpenAI Assistants API"""
        try:
            # Nota: temperature non è supportato in assistants.create() - viene gestito a livello di thread/run
            assistant = self.client.beta.assistants.create(
                name=self.name,
                instructions=self.instructions,
                model=self.model,
                tools=self.tools
            )
            self.assistant_id = assistant.id
            logger.info(f"✅ Created assistant '{self.name}' with ID: {self.assistant_id}")
        except Exception as e:
            logger.error(f"❌ Error creating assistant '{self.name}': {e}", exc_info=True)
            raise
    
    async def process(
        self,
        message: str,
        thread_id: Optional[str] = None,
        user_id: Optional[int] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Processa un messaggio con l'agent.
        
        Args:
            message: Messaggio dell'utente
            thread_id: ID del thread (per mantenere contesto)
            user_id: ID utente (per contesto database)
            context: Contesto aggiuntivo (es. dati inventario)
        
        Returns:
            Dict con risposta e metadati
        """
        if not self.assistant_id:
            raise ValueError(f"Assistant {self.name} non inizializzato")
        
        # Crea thread se non esiste
        if not thread_id:
            thread = self.client.beta.threads.create()
            thread_id = thread.id
            logger.debug(f"Created new thread: {thread_id} for agent {self.name}")
        
        # Aggiungi contesto se fornito
        if context:
            context_message = self._format_context(context)
            self.client.beta.threads.messages.create(
                thread_id=thread_id,
                role="user",
                content=context_message
            )
        
        # Aggiungi messaggio utente
        self.client.beta.threads.messages.create(
            thread_id=thread_id,
            role="user",
            content=message
        )
        
        # Esegui run
        run = self.client.beta.threads.runs.create(
            thread_id=thread_id,
            assistant_id=self.assistant_id
        )
        
        # Attendi completamento (polling)
        run = self._wait_for_run_completion(thread_id, run.id)
        
        if run.status == "completed":
            # Recupera messaggi
            messages = self.client.beta.threads.messages.list(
                thread_id=thread_id,
                order="asc"
            )
            
            # Estrai ultima risposta
            response_text = ""
            for message in messages.data:
                if message.role == "assistant":
                    for content in message.content:
                        if content.type == "text":
                            response_text = content.text.value
                            break
                    if response_text:
                        break
            
            return {
                "success": True,
                "message": response_text,
                "thread_id": thread_id,
                "agent": self.name,
                "model": self.model
            }
        else:
            error_msg = f"Run failed with status: {run.status}"
            if run.last_error:
                error_msg += f" - {run.last_error.message}"
            logger.error(f"❌ {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "thread_id": thread_id,
                "agent": self.name
            }
    
    def _wait_for_run_completion(self, thread_id: str, run_id: str, timeout: int = 60):
        """Attende completamento run con polling"""
        start_time = time.time()
        
        while True:
            run = self.client.beta.threads.runs.retrieve(
                thread_id=thread_id,
                run_id=run_id
            )
            
            if run.status in ["completed", "failed", "cancelled", "expired"]:
                return run
            
            if time.time() - start_time > timeout:
                raise TimeoutError(f"Run {run_id} timeout dopo {timeout}s")
            
            time.sleep(1)  # Poll ogni secondo
    
    def _format_context(self, context: Dict[str, Any]) -> str:
        """Formatta contesto per l'agent"""
        # Implementazione base, può essere sovrascritta
        return f"Contesto aggiuntivo: {context}"
    
    def delete_assistant(self):
        """Elimina assistant (utile per cleanup)"""
        if self.assistant_id:
            try:
                self.client.beta.assistants.delete(self.assistant_id)
                logger.info(f"Deleted assistant {self.name}")
            except Exception as e:
                logger.error(f"Error deleting assistant {self.name}: {e}")

