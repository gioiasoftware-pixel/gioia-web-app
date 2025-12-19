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
    conversation_id: Optional[int] = None  # Cambiato da str a int


class ChatResponse(BaseModel):
    message: str
    conversation_id: Optional[int] = None  # Cambiato da str a int
    metadata: dict
    buttons: Optional[List[Dict[str, Any]]] = None  # Pulsanti interattivi per selezione vini
    is_html: Optional[bool] = False  # Indica se il messaggio contiene HTML da renderizzare


class ConversationResponse(BaseModel):
    id: int
    title: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    last_message_at: Optional[str] = None


class CreateConversationResponse(BaseModel):
    conversation_id: int
    title: str


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
    user = current_user["user"]
    
    logger.info(f"[CHAT] Messaggio ricevuto da user_id={user_id}: {chat_message.message[:50]}...")
    
    try:
        # Gestione conversation_id: crea nuova conversazione se non specificata
        conversation_id = chat_message.conversation_id
        if not conversation_id:
            # Crea nuova conversazione
            conversation_id = await db_manager.create_conversation(
                user_id=user_id,
                telegram_id=None,  # Non più necessario per web app
                title=chat_message.message[:50] + "..." if len(chat_message.message) > 50 else chat_message.message
            )
            if not conversation_id:
                logger.warning(f"[CHAT] Errore creando nuova conversazione per user_id={user_id}")
                # Continua comunque senza conversation_id (retrocompatibilità)
                conversation_id = None
        
        # Recupera storia conversazione (ultimi 10 messaggi) per questa conversazione
        conversation_history = None
        try:
            conversation_history = await db_manager.get_recent_chat_messages(
                user_id, 
                limit=10, 
                conversation_id=conversation_id
            )
            if conversation_history:
                # Converti in formato OpenAI (solo role e content)
                conversation_history = [
                    {"role": msg["role"], "content": msg["content"]}
                    for msg in conversation_history
                ]
                logger.info(f"[CHAT] Recuperati {len(conversation_history)} messaggi dalla conversazione id={conversation_id}")
        except Exception as e:
            logger.warning(f"[CHAT] Errore recupero storia conversazione: {e}")
            conversation_history = None
        
        # Salva messaggio utente PRIMA di processare
        try:
            await db_manager.log_chat_message(user_id, "user", chat_message.message, conversation_id=conversation_id)
        except Exception as e:
            logger.warning(f"[CHAT] Errore salvataggio messaggio utente: {e}")
        
        # Processa messaggio con AI service
        result = await ai_service.process_message(
            user_message=chat_message.message,
            user_id=user_id,
            conversation_history=conversation_history
        )
        
        # Verifica che result sia valido
        if not result or not isinstance(result, dict):
            logger.error(f"[CHAT] AI service ha restituito risultato non valido: {result}")
            result = {
                "message": "⚠️ Errore temporaneo dell'AI. Riprova tra qualche minuto.",
                "metadata": {"error": "invalid_response"},
                "buttons": None
            }
        
        # Salva risposta AI DOPO la generazione
        try:
            ai_response_message = result.get("message", "")
            if ai_response_message:
                await db_manager.log_chat_message(user_id, "assistant", ai_response_message, conversation_id=conversation_id)
                # Aggiorna timestamp ultimo messaggio conversazione
                if conversation_id:
                    await db_manager.update_conversation_last_message(conversation_id, user_id)
        except Exception as e:
            logger.warning(f"[CHAT] Errore salvataggio risposta AI: {e}")
        
        return ChatResponse(
            message=result.get("message", "⚠️ Nessuna risposta disponibile"),
            conversation_id=conversation_id,  # Restituisce conversation_id (nuovo o esistente)
            metadata=result.get("metadata", {}),
            buttons=result.get("buttons"),  # Includi pulsanti se presenti
            is_html=result.get("is_html", False)  # Indica se contiene HTML
        )
    except Exception as e:
        logger.error(f"[CHAT] Errore processamento messaggio: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Errore interno: {str(e)}"
        )


@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    current_user: dict = Depends(get_current_user)
):
    """
    Recupera lista conversazioni dell'utente corrente.
    Ordinate per ultimo messaggio (più recenti prima).
    """
    user_id = current_user["user_id"]
    
    try:
        conversations = await db_manager.get_user_conversations(
            user_id=user_id,
            telegram_id=None,  # Non più necessario per web app
            limit=50
        )
        return conversations
    except Exception as e:
        logger.error(f"[CHAT] Errore recuperando conversazioni: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Errore recuperando conversazioni")


@router.post("/conversations", response_model=CreateConversationResponse)
async def create_conversation(
    title: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Crea una nuova conversazione.
    """
    user_id = current_user["user_id"]
    telegram_id = current_user.get("telegram_id")
    
    try:
        conversation_id = await db_manager.create_conversation(
            user_id=user_id,
            telegram_id=telegram_id,
            title=title or "Nuova chat"
        )
        
        if not conversation_id:
            raise HTTPException(status_code=500, detail="Errore creando conversazione")
        
        return CreateConversationResponse(
            conversation_id=conversation_id,
            title=title or "Nuova chat"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CHAT] Errore creando conversazione: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Errore creando conversazione")


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: int,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Recupera messaggi di una conversazione specifica.
    """
    user_id = current_user["user_id"]
    
    try:
        messages = await db_manager.get_recent_chat_messages(
            user_id=user_id,
            limit=limit,
            conversation_id=conversation_id
        )
        return {"messages": messages}
    except Exception as e:
        logger.error(f"[CHAT] Errore recuperando messaggi conversazione: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Errore recuperando messaggi")


@router.put("/conversations/{conversation_id}/title")
async def update_conversation_title(
    conversation_id: int,
    title: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Aggiorna il titolo di una conversazione.
    """
    user_id = current_user["user_id"]
    
    try:
        success = await db_manager.update_conversation_title(conversation_id, title, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Conversazione non trovata")
        return {"success": True, "title": title}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CHAT] Errore aggiornando titolo conversazione: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Errore aggiornando titolo")


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Cancella una conversazione.
    """
    try:
        user_id = current_user["user_id"]
        success = await db_manager.delete_conversation(conversation_id, user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Conversazione non trovata")
        return {"success": True, "message": "Conversazione cancellata"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CHAT] Errore cancellando conversazione: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Errore cancellando conversazione")


@router.get("/health")
async def chat_health():
    """Health check per servizio chat"""
    return {
        "status": "healthy",
        "service": "chat",
        "ai_configured": ai_service.client is not None
    }

