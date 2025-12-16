"""
API endpoints per chat AI - Cuore della web app
Reuse logica telegram bot senza componente Telegram
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging

from app.services.ai_service import ai_service
from app.core.database import db_manager
from app.core.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    metadata: dict
    buttons: Optional[List[Dict[str, Any]]] = None  # Pulsanti interattivi per selezione vini


@router.post("/message", response_model=ChatResponse)
async def send_message(
    chat_message: ChatMessage,
    current_user: dict = Depends(get_current_user)
):
    """
    Processa messaggio chat e restituisce risposta AI.
    Questo è il cuore della web app - riusa tutta la logica del telegram bot.
    Richiede autenticazione JWT.
    """
    user_id = current_user["user_id"]
    telegram_id = current_user.get("telegram_id")
    user = current_user["user"]
    
    # Per AI service, usa telegram_id se disponibile, altrimenti user_id come fallback
    # L'AI service si aspetta telegram_id per compatibilità con bot esistente
    ai_telegram_id = telegram_id if telegram_id else user_id
    
    logger.info(f"[CHAT] Messaggio ricevuto da user_id={user_id}, telegram_id={telegram_id}: {chat_message.message[:50]}...")
    
    try:
        # Processa messaggio con AI service
        result = await ai_service.process_message(
            user_message=chat_message.message,
            telegram_id=ai_telegram_id,
            conversation_history=None  # TODO: recuperare da database se conversation_id fornito
        )
        
        # Verifica che result sia valido
        if not result or not isinstance(result, dict):
            logger.error(f"[CHAT] AI service ha restituito risultato non valido: {result}")
            result = {
                "message": "⚠️ Errore temporaneo dell'AI. Riprova tra qualche minuto.",
                "metadata": {"error": "invalid_response"},
                "buttons": None
            }
        
        # TODO: Salvare messaggio e risposta nel database per storia conversazione
        
        return ChatResponse(
            message=result.get("message", "⚠️ Nessuna risposta disponibile"),
            conversation_id=chat_message.conversation_id,
            metadata=result.get("metadata", {}),
            buttons=result.get("buttons")  # Includi pulsanti se presenti
        )
    except Exception as e:
        logger.error(f"[CHAT] Errore processamento messaggio: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Errore interno: {str(e)}"
        )


@router.get("/health")
async def chat_health():
    """Health check per servizio chat"""
    return {
        "status": "healthy",
        "service": "chat",
        "ai_configured": ai_service.client is not None
    }

