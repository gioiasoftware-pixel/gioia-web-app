"""
Servizio AI per web app - Reuse logica da telegram-ai-bot
Adattato per REST API invece di Telegram handlers
"""
import logging
import os
import sys
from typing import Optional, Dict, Any
from openai import OpenAI, OpenAIError

# Aggiungi path al telegram bot per importare moduli
TELEGRAM_BOT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
    "telegram-ai-bot", "Telegram AI BOT 2"
)
if os.path.exists(TELEGRAM_BOT_PATH):
    sys.path.insert(0, TELEGRAM_BOT_PATH)

from app.core.config import get_settings
from app.core.database import db_manager
from app.core.processor_client import processor_client

logger = logging.getLogger(__name__)

# Disabilita proxy automatici
os.environ.pop('HTTP_PROXY', None)
os.environ.pop('HTTPS_PROXY', None)
os.environ.pop('http_proxy', None)
os.environ.pop('https_proxy', None)
os.environ.pop('ALL_PROXY', None)
os.environ.pop('all_proxy', None)


class AIService:
    """Servizio AI per web app - riusa logica telegram bot"""
    
    def __init__(self):
        settings = get_settings()
        self.openai_api_key = settings.OPENAI_API_KEY
        self.openai_model = settings.OPENAI_MODEL
        
        if not self.openai_api_key:
            logger.warning("OpenAI API key non configurata")
            self.client = None
        else:
            self.client = OpenAI(api_key=self.openai_api_key)
    
    async def process_message(
        self,
        user_message: str,
        telegram_id: int,
        conversation_history: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Processa messaggio utente e restituisce risposta AI.
        
        Args:
            user_message: Messaggio utente
            telegram_id: ID Telegram utente
            conversation_history: Storia conversazione (opzionale)
        
        Returns:
            Dict con:
                - message: Risposta AI
                - metadata: Metadati aggiuntivi (tipo risposta, vini trovati, ecc.)
        """
        if not self.client:
            return {
                "message": "⚠️ L'AI non è configurata. Contatta l'amministratore.",
                "metadata": {"error": "openai_not_configured"}
            }
        
        if not user_message or not user_message.strip():
            return {
                "message": "⚠️ Messaggio vuoto ricevuto. Prova a scrivere qualcosa!",
                "metadata": {"error": "empty_message"}
            }
        
        try:
            # Prova a importare get_ai_response dal telegram bot
            try:
                from ai import get_ai_response
                # Usa la funzione originale del bot
                response_text = await get_ai_response(
                    prompt=user_message,
                    telegram_id=telegram_id,
                    correlation_id=None
                )
                
                return {
                    "message": response_text,
                    "metadata": {
                        "type": "ai_response",
                        "model": self.openai_model
                    }
                }
            except ImportError as e:
                logger.warning(f"Impossibile importare get_ai_response dal bot: {e}")
                # Fallback: chiamata OpenAI diretta semplificata
                return await self._simple_ai_response(user_message, telegram_id)
        
        except OpenAIError as e:
            logger.error(f"Errore OpenAI: {e}")
            return {
                "message": "⚠️ Errore temporaneo dell'AI. Riprova tra qualche minuto.",
                "metadata": {"error": "openai_error", "details": str(e)}
            }
        except Exception as e:
            logger.error(f"Errore imprevisto in process_message: {e}", exc_info=True)
            return {
                "message": "⚠️ Errore temporaneo dell'AI. Riprova tra qualche minuto.",
                "metadata": {"error": "unexpected_error", "details": str(e)}
            }
    
    async def _simple_ai_response(
        self,
        user_message: str,
        telegram_id: int
    ) -> Dict[str, Any]:
        """
        Fallback: risposta AI semplificata senza logica complessa del bot.
        """
        # Recupera contesto utente
        user_context = ""
        try:
            user = await db_manager.get_user_by_telegram_id(telegram_id)
            if user:
                user_context = f"""
INFORMAZIONI UTENTE:
- Nome attività: {user.business_name or 'Non specificato'}
- Onboarding completato: {'Sì' if user.onboarding_completed else 'No'}
"""
        except Exception as e:
            logger.error(f"Errore accesso database: {e}")
        
        system_prompt = """Sei Gio.ia-bot, un assistente AI specializzato nella gestione inventario vini.
Sei gentile, professionale e parli in italiano.

Puoi aiutare gli utenti con:
- Consultazione inventario vini
- Ricerca vini per nome, produttore, regione, tipo
- Gestione movimenti inventario (consumi/rifornimenti)
- Report e statistiche

Rispondi sempre in italiano in modo chiaro e professionale."""
        
        try:
            response = self.client.chat.completions.create(
                model=self.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt + user_context},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.7
            )
            
            message_content = response.choices[0].message.content
            
            return {
                "message": message_content,
                "metadata": {
                    "type": "simple_ai_response",
                    "model": self.openai_model
                }
            }
        except Exception as e:
            logger.error(f"Errore chiamata OpenAI: {e}")
            raise


# Istanza globale
ai_service = AIService()
