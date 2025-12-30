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
from app.services.response_validator import ResponseValidator

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


async def check_and_process_pending_movements(
    user_message: str,
    user_id: int,
    conversation_id: Optional[int]
) -> Optional[Dict[str, Any]]:
    """
    Controlla se ci sono movimenti pendenti e se il messaggio è una conferma di disambiguazione.
    Se sì, processa il movimento confermato e continua con i movimenti rimanenti.
    
    Args:
        user_message: Messaggio dell'utente
        user_id: ID utente
        conversation_id: ID conversazione
    
    Returns:
        Dict con risultato del processing o None se non ci sono movimenti pendenti
    """
    if not conversation_id:
        return None
    
    try:
        # Recupera movimenti pendenti
        pending_movements = await db_manager.get_pending_movements(conversation_id, user_id)
        if not pending_movements or len(pending_movements) == 0:
            return None
        
        logger.info(f"[CHAT] 🔍 Trovati {len(pending_movements)} movimenti pendenti per conversazione {conversation_id}")
        
        # Il primo movimento pendente è quello che richiedeva disambiguazione
        # Il messaggio dell'utente dovrebbe contenere la conferma per questo movimento
        first_pending = pending_movements[0]
        wine_name_original = first_pending.get("wine_name", "").lower()
        
        # Controlla se il messaggio contiene il nome del vino (conferma disambiguazione)
        user_message_lower = user_message.lower()
        # Il messaggio potrebbe essere il nome completo del vino selezionato
        # Oppure potrebbe essere un messaggio che contiene il nome del vino
        
        # Se il messaggio è molto corto o corrisponde al pattern di un nome vino, è probabile una conferma
        is_likely_confirmation = (
            len(user_message) < 100 and  # Messaggio corto (probabilmente solo nome vino)
            (wine_name_original in user_message_lower or 
             any(word in user_message_lower for word in wine_name_original.split() if len(word) > 3))
        )
        
        if not is_likely_confirmation:
            logger.info(f"[CHAT] Messaggio non sembra una conferma di disambiguazione, processamento normale")
            return None
        
        # Processa il movimento confermato usando MovementAgent
        logger.info(f"[CHAT] ✅ Rilevata conferma disambiguazione, processo movimento: {first_pending}")
        from app.services.agents.movement_agent import MovementAgent
        movement_agent = MovementAgent()
        
        movement_type = first_pending.get("type", "consumo")
        quantity = first_pending.get("quantity", 1)
        # Usa il messaggio dell'utente come nome vino confermato (potrebbe essere il nome completo)
        confirmed_wine_name = user_message.strip()
        
        # Prepara messaggio per MovementAgent con il vino confermato
        type_text = "consumo" if movement_type == "consumo" else "rifornimento"
        movement_message = f"Registra {type_text} di {quantity} bottiglie di {confirmed_wine_name}"
        
        # Processa il movimento confermato
        movement_result = await movement_agent.process_with_context(
            message=movement_message,
            user_id=user_id,
            thread_id=None
        )
        
        # Rimuovi il movimento processato dalla lista pendenti
        remaining_movements = pending_movements[1:] if len(pending_movements) > 1 else []
        
        # Processa i movimenti rimanenti uno per uno
        results_parts = [movement_result.get("message", "")]
        has_html = movement_result.get("is_html", False)
        buttons = movement_result.get("buttons")
        needs_more_disambiguation = False
        
        for idx, remaining_movement in enumerate(remaining_movements):
            remaining_type = remaining_movement.get("type", "consumo")
            remaining_wine_name = remaining_movement.get("wine_name", "")
            remaining_quantity = remaining_movement.get("quantity", 1)
            
            remaining_type_text = "consumo" if remaining_type == "consumo" else "rifornimento"
            remaining_message = f"Registra {remaining_type_text} di {remaining_quantity} bottiglie di {remaining_wine_name}"
            
            logger.info(f"[CHAT] Processamento movimento rimanente {idx+1}/{len(remaining_movements)}: {remaining_type} {remaining_quantity}x {remaining_wine_name}")
            
            remaining_result = await movement_agent.process_with_context(
                message=remaining_message,
                user_id=user_id,
                thread_id=None
            )
            
            if remaining_result.get("success"):
                results_parts.append(remaining_result.get("message", ""))
            else:
                # Se richiede disambiguazione, salva i movimenti ancora rimanenti e fermati
                if remaining_result.get("is_html") or "<div class=\"wines-list-card\">" in str(remaining_result.get("message", "")):
                    # Salva i movimenti ancora da processare (questo e tutti quelli dopo)
                    yet_remaining = remaining_movements[idx:]
                    await db_manager.save_pending_movements(
                        conversation_id=conversation_id,
                        user_id=user_id,
                        pending_movements=yet_remaining
                    )
                    logger.info(f"[CHAT] 💾 Salvati {len(yet_remaining)} movimenti ancora pendenti (richiede disambiguazione)")
                    results_parts.append(remaining_result.get("message", ""))
                    has_html = True
                    buttons = remaining_result.get("buttons")
                    needs_more_disambiguation = True
                    break
                else:
                    # Errore normale, aggiungi e continua
                    results_parts.append(remaining_result.get("message", ""))
        
        # Se abbiamo processato tutti i movimenti senza altre disambiguazioni, cancella i pendenti
        if not needs_more_disambiguation:
            await db_manager.clear_pending_movements(conversation_id, user_id)
            logger.info(f"[CHAT] ✅ Tutti i movimenti processati, cancellati movimenti pendenti")
        
        # Combina tutti i risultati
        combined_message = "\n\n".join(results_parts)
        
        return {
            "message": combined_message,
            "metadata": {
                "type": "multi_movement_continuation",
                "confirmed_movement": first_pending,
                "remaining_count": len(remaining_movements)
            },
            "is_html": has_html,
            "buttons": buttons
        }
    
    except Exception as e:
        logger.error(f"[CHAT] ❌ Errore processando movimenti pendenti: {e}", exc_info=True)
        # In caso di errore, continua con processamento normale
        return None


async def process_text_message(
    user_message: str,
    user_id: int,
    conversation_id: Optional[int] = None,
    source: str = "text"  # "text" o "audio"
) -> ChatResponse:
    """
    Funzione helper condivisa per processare messaggi testuali.
    Usata sia da /message che da /audio (dopo trascrizione).
    
    Args:
        user_message: Testo del messaggio
        user_id: ID utente
        conversation_id: ID conversazione (opzionale, creata se None)
        source: Origine messaggio ("text" o "audio")
    
    Returns:
        ChatResponse con risposta AI
    """
    logger.info(f"[CHAT] Processamento messaggio {source} da user_id={user_id}: {user_message[:50]}...")
    
    # Gestione conversation_id: crea nuova conversazione se non specificata
    if not conversation_id:
        # Crea nuova conversazione
        conversation_id = await db_manager.create_conversation(
            user_id=user_id,
            telegram_id=None,
            title=user_message[:50] + "..." if len(user_message) > 50 else user_message
        )
        if not conversation_id:
            logger.warning(f"[CHAT] Errore creando nuova conversazione per user_id={user_id}")
            conversation_id = None
    
    # Salva messaggio utente PRIMA di processare (così viene sempre salvato)
    try:
        message_to_log = f"🎤 {user_message}" if source == "audio" else user_message
        await db_manager.log_chat_message(user_id, "user", message_to_log, conversation_id=conversation_id)
    except Exception as e:
        logger.warning(f"[CHAT] Errore salvataggio messaggio utente: {e}")
    
    # Step 0: Controlla se ci sono movimenti pendenti e se questo è una conferma
    pending_result = await check_and_process_pending_movements(
        user_message=user_message,
        user_id=user_id,
        conversation_id=conversation_id
    )
    
    if pending_result:
        # Movimenti pendenti processati, salva la risposta e ritorna il risultato
        logger.info(f"[CHAT] ✅ Movimenti pendenti processati, ritorno risultato")
        try:
            ai_response_message = pending_result.get("message", "")
            if ai_response_message:
                await db_manager.log_chat_message(user_id, "assistant", ai_response_message, conversation_id=conversation_id)
                if conversation_id:
                    await db_manager.update_conversation_last_message(conversation_id, user_id)
        except Exception as e:
            logger.warning(f"[CHAT] Errore salvataggio risposta movimenti pendenti: {e}")
        
        return ChatResponse(
            message=pending_result.get("message", "Movimento processato"),
            conversation_id=conversation_id,
            metadata=pending_result.get("metadata", {}),
            buttons=pending_result.get("buttons"),
            is_html=pending_result.get("is_html", False)
        )
    
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
    
    # Sistema ibrido: prova prima V1, se non funziona passa a V2
    logger.info(f"[CHAT] 🔄 Provo prima con AIServiceV1...")
    result = await ai_service_v1.process_message(
        user_message=user_message,
        user_id=user_id,
        conversation_history=conversation_history
    )
    
    # Valuta se la risposta è valida usando ResponseValidator
    if ai_service_v2 is not None and ResponseValidator.should_fallback_to_v2(result):
        logger.info(f"[CHAT] ⚠️ Risposta V1 non soddisfacente, passo a AIServiceV2 (multi-agent)")
        result = await ai_service_v2.process_message(
            user_message=user_message,
            user_id=user_id,
            conversation_history=conversation_history,
            conversation_id=conversation_id
        )
    else:
        logger.info(f"[CHAT] ✅ Risposta V1 valida, uso quella")
    
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
    
    # Aggiungi metadata per indicare origine
    metadata = result.get("metadata", {})
    metadata["source"] = source
    if source == "audio":
        metadata["transcribed_text"] = user_message
    
    return ChatResponse(
        message=result.get("message", "⚠️ Nessuna risposta disponibile"),
        conversation_id=conversation_id,
        metadata=metadata,
        buttons=result.get("buttons"),
        is_html=result.get("is_html", False)
    )


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
    
    try:
        return await process_text_message(
            user_message=chat_message.message,
            user_id=user_id,
            conversation_id=chat_message.conversation_id,
            source="text"
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
    Processa messaggio audio: converte in testo e passa all'AI seguendo il percorso originale.
    
    Flow migliorato:
    1. Riceve file audio
    2. AudioAgent converte audio -> testo (Whisper)
    3. Passa testo trascritto a process_text_message (stesso percorso dei messaggi testuali)
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
        
        # Step 1: Trascrivi audio -> testo usando AudioAgent
        logger.info(f"[CHAT_AUDIO] 🎤 Trascrizione audio in corso...")
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
        logger.info(f"[CHAT_AUDIO] ✅ Trascrizione completata: '{transcribed_text[:50]}...'")
        
        # Step 2: Passa il testo trascritto al percorso originale (stesso di /message)
        # Questo garantisce che l'audio segua esattamente lo stesso flusso dei messaggi testuali
        logger.info(f"[CHAT_AUDIO] 🔄 Passo testo trascritto al percorso originale (V1 -> V2 se necessario)")
        return await process_text_message(
            user_message=transcribed_text,
            user_id=user_id,
            conversation_id=conversation_id,
            source="audio"
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

