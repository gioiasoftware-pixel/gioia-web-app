"""
API endpoints per chat AI - Cuore della web app
Reuse logica telegram bot senza componente Telegram
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging

from app.services.ai_service import AIService as AIServiceV1
from app.core.database import db_manager
from app.core.auth import get_current_user
from app.core.config import get_settings
from app.services.request_complexity_analyzer import RequestComplexityAnalyzer

logger = logging.getLogger(__name__)

# Inizializza entrambi i servizi per sistema ibrido
settings = get_settings()
ai_service_v1 = AIServiceV1()
logger.info("✅ AIServiceV1 (tradizionale) inizializzato")

ai_service_v2 = None
if settings.USE_AGENT_SYSTEM:
    try:
        from app.services.ai_service_v2 import AIServiceV2
        ai_service_v2 = AIServiceV2()
        logger.info("✅ AIServiceV2 (multi-agent) inizializzato")
        logger.info("✅ Sistema ibrido attivo: richieste semplici -> V1, complesse -> V2")
    except Exception as e:
        logger.error(f"❌ Errore inizializzazione AIServiceV2: {e}", exc_info=True)
        logger.warning("⚠️ Sistema ibrido disabilitato, uso solo V1")
        ai_service_v2 = None
else:
    logger.info("✅ Sistema ibrido disabilitato (USE_AGENT_SYSTEM=False), uso solo V1")

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
        
        # Sistema ibrido: analizza complessità e scegli servizio appropriato
        complexity = RequestComplexityAnalyzer.analyze(chat_message.message)
        
        if complexity == "simple" and ai_service_v2 is not None:
            # Richiesta semplice: usa V1 (più veloce e diretto)
            logger.info(f"[CHAT] 📊 Richiesta semplice -> AIServiceV1 (tradizionale)")
            result = await ai_service_v1.process_message(
                user_message=chat_message.message,
                user_id=user_id,
                conversation_history=conversation_history
            )
        elif ai_service_v2 is not None:
            # Richiesta complessa: usa V2 (multi-agent)
            logger.info(f"[CHAT] 📊 Richiesta complessa -> AIServiceV2 (multi-agent)")
            result = await ai_service_v2.process_message(
                user_message=chat_message.message,
                user_id=user_id,
                conversation_history=conversation_history
            )
        else:
            # Fallback: V2 non disponibile, usa sempre V1
            logger.info(f"[CHAT] 📊 Fallback -> AIServiceV1 (V2 non disponibile)")
            result = await ai_service_v1.process_message(
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


@router.post("/audio", response_model=ChatResponse)
async def send_audio_message(
    audio: UploadFile = File(...),
    conversation_id: Optional[int] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Processa messaggio audio: converte in testo e passa all'AI.
    
    Flow:
    1. Riceve file audio
    2. AudioAgent converte audio -> testo (Whisper)
    3. Passa testo all'orchestratore (RouterAgent/AIService)
    4. Ritorna risposta AI
    """
    user_id = current_user["user_id"]
    
    logger.info(f"[CHAT_AUDIO] Audio ricevuto da user_id={user_id}: {audio.filename}")
    
    try:
        # Inizializza AudioAgent
        from app.services.agents.audio_agent import AudioAgent
        audio_agent = AudioAgent()
        
        # Leggi file audio
        audio_content = await audio.read()
        filename = audio.filename or "audio.webm"
        
        # Step 1: Trascrivi audio -> testo
        transcription_result = await audio_agent.transcribe_audio(
            audio_file=audio_content,
            filename=filename,
            language="it"  # Italiano di default
        )
        
        if not transcription_result["success"]:
            error_msg = transcription_result.get("error", "Errore trascrizione")
            logger.error(f"[CHAT_AUDIO] ❌ Trascrizione fallita: {error_msg}")
            raise HTTPException(
                status_code=400,
                detail=error_msg
            )
        
        transcribed_text = transcription_result["text"]
        logger.info(f"[CHAT_AUDIO] ✅ Trascrizione: '{transcribed_text[:50]}...'")
        
        # Step 2: Gestione conversation_id
        if not conversation_id:
            conversation_id = await db_manager.create_conversation(
                user_id=user_id,
                telegram_id=None,
                title=f"🎤 {transcribed_text[:50]}{'...' if len(transcribed_text) > 50 else ''}"
            )
            if not conversation_id:
                conversation_id = None
        
        # Step 3: Salva messaggio utente (con nota che è da audio)
        try:
            await db_manager.log_chat_message(
                user_id, 
                "user", 
                f"🎤 {transcribed_text}", 
                conversation_id=conversation_id
            )
        except Exception as e:
            logger.warning(f"[CHAT_AUDIO] Errore salvataggio messaggio: {e}")
        
        # Step 4: Recupera storia conversazione
        conversation_history = None
        try:
            conversation_history = await db_manager.get_recent_chat_messages(
                user_id,
                limit=10,
                conversation_id=conversation_id
            )
            if conversation_history:
                conversation_history = [
                    {"role": msg["role"], "content": msg["content"]}
                    for msg in conversation_history
                ]
        except Exception as e:
            logger.warning(f"[CHAT_AUDIO] Errore recupero storia: {e}")
        
        # Step 5: Sistema ibrido - analizza complessità e scegli servizio
        complexity = RequestComplexityAnalyzer.analyze(transcribed_text)
        
        if complexity == "simple" and ai_service_v2 is not None:
            # Richiesta semplice: usa V1
            logger.info(f"[CHAT/AUDIO] 📊 Richiesta semplice -> AIServiceV1")
            result = await ai_service_v1.process_message(
                user_message=transcribed_text,
                user_id=user_id,
                conversation_history=conversation_history
            )
        elif ai_service_v2 is not None:
            # Richiesta complessa: usa V2
            logger.info(f"[CHAT/AUDIO] 📊 Richiesta complessa -> AIServiceV2")
            result = await ai_service_v2.process_message(
                user_message=transcribed_text,
                user_id=user_id,
                conversation_history=conversation_history
            )
        else:
            # Fallback: V2 non disponibile
            logger.info(f"[CHAT/AUDIO] 📊 Fallback -> AIServiceV1")
            result = await ai_service_v1.process_message(
                user_message=transcribed_text,
                user_id=user_id,
                conversation_history=conversation_history
            )
        
        # Step 6: Salva risposta AI
        try:
            ai_response_message = result.get("message", "")
            if ai_response_message:
                await db_manager.log_chat_message(
                    user_id, 
                    "assistant", 
                    ai_response_message, 
                    conversation_id=conversation_id
                )
                if conversation_id:
                    await db_manager.update_conversation_last_message(conversation_id, user_id)
        except Exception as e:
            logger.warning(f"[CHAT_AUDIO] Errore salvataggio risposta: {e}")
        
        # Step 7: Ritorna risposta (aggiungi metadata per indicare che proviene da audio)
        metadata = result.get("metadata", {})
        metadata["source"] = "audio"
        metadata["transcribed_text"] = transcribed_text
        
        return ChatResponse(
            message=result.get("message", "⚠️ Nessuna risposta disponibile"),
            conversation_id=conversation_id,
            metadata=metadata,
            buttons=result.get("buttons"),
            is_html=result.get("is_html", False)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CHAT_AUDIO] ❌ Errore processamento audio: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Errore processamento audio: {str(e)}"
        )


@router.get("/health")
async def chat_health():
    """Health check per servizio chat"""
    ai_configured = False
    try:
        # Check se servizi sono configurati
        ai_configured = False
        if ai_service_v1 and hasattr(ai_service_v1, 'client'):
            ai_configured = ai_service_v1.client is not None
        if ai_service_v2 and hasattr(ai_service_v2, 'router'):
            ai_configured = ai_configured or (ai_service_v2.router is not None)
    except:
        pass
    
    return {
        "status": "healthy",
        "service": "chat",
        "ai_configured": ai_configured,
        "ai_system": "hybrid" if (ai_service_v2 is not None) else "function-calling",
        "audio_enabled": True
    }

