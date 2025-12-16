"""
API endpoints per test/connessione Processor
"""
from fastapi import APIRouter
from app.core.processor_client import processor_client
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/processor", tags=["processor"])


@router.get("/health")
async def processor_health():
    """Verifica connessione al Processor"""
    result = await processor_client.health_check()
    return result
