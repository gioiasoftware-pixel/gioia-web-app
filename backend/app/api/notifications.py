"""
API endpoint per gestione notifiche.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.api.auth import get_current_user
from app.core.notifications_service import (
    get_user_notifications,
    mark_notification_read,
    generate_daily_report,
    save_notification
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    content: str
    report_date: Optional[str]
    created_at: Optional[str]
    expires_at: Optional[str]
    read_at: Optional[str]
    metadata: dict


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int


@router.get("", response_model=NotificationListResponse)
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    Recupera notifiche per l'utente corrente.
    """
    try:
        user_id = current_user["user_id"]
        notifications = await get_user_notifications(
            user_id=user_id,
            limit=limit,
            unread_only=unread_only
        )
        
        # Conta notifiche non lette
        all_notifications = await get_user_notifications(
            user_id=user_id,
            limit=1000,
            unread_only=False
        )
        unread_count = sum(1 for n in all_notifications if n.get("read_at") is None)
        
        return {
            "notifications": notifications,
            "unread_count": unread_count
        }
    except Exception as e:
        logger.error(f"[NOTIFICATIONS_API] Errore recupero notifiche: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Errore recupero notifiche")


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Marca una notifica come letta.
    """
    try:
        user_id = current_user["id"]
        success = await mark_notification_read(notification_id, user_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Notifica non trovata")
        
        return {"success": True, "message": "Notifica marcata come letta"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[NOTIFICATIONS_API] Errore marcatura notifica: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Errore marcatura notifica")


@router.post("/generate-test")
async def generate_test_report(
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint di test per generare un report manualmente.
    Solo per sviluppo/test.
    """
    try:
        user_id = current_user["id"]
        
        # Genera report per ieri
        report_data = await generate_daily_report(user_id)
        
        if not report_data:
            return {
                "success": False,
                "message": "Nessun movimento trovato per il giorno precedente"
            }
        
        # Salva notifica
        notification_id = await save_notification(
            user_id=user_id,
            title=report_data["title"],
            content=report_data["content"],
            report_date=report_data["report_date"],
            metadata=report_data["metadata"]
        )
        
        if notification_id:
            return {
                "success": True,
                "message": "Report generato con successo",
                "notification_id": notification_id
            }
        else:
            return {
                "success": False,
                "message": "Errore salvataggio notifica"
            }
    except Exception as e:
        logger.error(f"[NOTIFICATIONS_API] Errore generazione test report: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Errore generazione report")

