"""
API endpoint per ricevere log dal frontend e registrarli sul backend.
Questi log appariranno nei log HTTP di Railway.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging
from datetime import datetime
from app.core.database import AsyncSessionLocal
from app.services.app_settings import get_app_setting

router = APIRouter(prefix="/api/debug", tags=["debug"])

# Logger specifico per log frontend
frontend_logger = logging.getLogger("frontend-client")


class FrontendLog(BaseModel):
    """Modello per log dal frontend."""
    message: str
    level: str = "info"  # info, warn, error, debug
    context: Optional[str] = None  # Contesto aggiuntivo (es. "SIDEBAR", "VIEWER")
    timestamp: Optional[str] = None


class DebugLoggingStatus(BaseModel):
    enabled: bool


@router.get("/logging", response_model=DebugLoggingStatus)
async def get_debug_logging_status():
    """
    Ritorna lo stato del logging frontend (debug overlay).
    """
    try:
        async with AsyncSessionLocal() as session:
            value = await get_app_setting(session, "debug_logging_enabled")
        return {"enabled": value == "true"}
    except Exception as e:
        frontend_logger.error(f"Errore lettura debug logging status: {e}")
        return {"enabled": False}


@router.post("/log")
async def receive_frontend_log(log_data: FrontendLog):
    """
    Riceve log dal frontend e li registra sul backend.
    Questi log appariranno nei log HTTP di Railway.
    """
    try:
        # Prepara messaggio formattato
        context_str = f"[{log_data.context}]" if log_data.context else ""
        formatted_message = f"{context_str} {log_data.message}"
        
        # Usa il livello appropriato
        log_level = log_data.level.lower()
        
        if log_level == "error":
            frontend_logger.error(formatted_message)
        elif log_level == "warn" or log_level == "warning":
            frontend_logger.warning(formatted_message)
        elif log_level == "debug":
            frontend_logger.debug(formatted_message)
        else:  # info o default
            frontend_logger.info(formatted_message)
        
        return {"status": "logged", "message": formatted_message}
    
    except Exception as e:
        # Log anche l'errore stesso
        frontend_logger.error(f"Errore nel logging frontend: {e}")
        raise HTTPException(status_code=500, detail=f"Errore nel logging: {str(e)}")
