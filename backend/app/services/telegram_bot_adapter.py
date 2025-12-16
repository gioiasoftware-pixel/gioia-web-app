"""
Adapter per riusare logica telegram bot nella web app.
Crea un bridge tra database_async del telegram bot e db_manager della web app.
"""
import logging
import os
import sys
from pathlib import Path
from typing import Optional, List

logger = logging.getLogger(__name__)

# Aggiungi path telegram bot src
current_file = Path(__file__)
root_dir = current_file.parent.parent.parent.parent.parent
telegram_bot_src = root_dir / "telegram-ai-bot" / "src"

if telegram_bot_src.exists():
    sys.path.insert(0, str(telegram_bot_src))
    logger.info(f"[ADAPTER] Path telegram bot aggiunto: {telegram_bot_src}")
else:
    logger.warning(f"[ADAPTER] Path telegram bot non trovato: {telegram_bot_src}")

# Importa db_manager dalla web app
from app.core.database import db_manager as web_db_manager


class AsyncDBManagerAdapter:
    """
    Adapter che fa da bridge tra async_db_manager del telegram bot
    e db_manager della web app.
    """
    
    async def get_user_by_telegram_id(self, telegram_id: int):
        """Wrapper per get_user_by_telegram_id"""
        return await web_db_manager.get_user_by_telegram_id(telegram_id)
    
    async def get_user_wines(self, telegram_id: int):
        """Wrapper per get_user_wines"""
        return await web_db_manager.get_user_wines(telegram_id)
    
    async def search_wines(self, telegram_id: int, search_term: str, limit: int = 10):
        """Wrapper per search_wines"""
        return await web_db_manager.search_wines(telegram_id, search_term, limit)


# Crea istanza adapter
adapter_db_manager = AsyncDBManagerAdapter()


def setup_telegram_bot_imports():
    """
    Configura gli import del telegram bot per usare l'adapter.
    Deve essere chiamato PRIMA di importare ai.py dal telegram bot.
    """
    # Monkey patch: sostituisci async_db_manager nel modulo database_async
    # quando viene importato dal telegram bot
    try:
        # Importa database_async dal telegram bot
        import database_async
        # Sostituisci async_db_manager con il nostro adapter
        database_async.async_db_manager = adapter_db_manager
        logger.info("[ADAPTER] async_db_manager sostituito con adapter")
        
        # Assicurati che DATABASE_URL sia configurata (necessaria per alcune funzioni)
        if not hasattr(database_async, 'DATABASE_URL') or not database_async.DATABASE_URL:
            from app.core.config import get_settings
            settings = get_settings()
            database_async.DATABASE_URL = settings.DATABASE_URL.replace(
                "postgresql://", "postgresql+asyncpg://", 1
            ) if settings.DATABASE_URL else None
            logger.info("[ADAPTER] DATABASE_URL configurata")
            
    except ImportError as e:
        logger.warning(f"[ADAPTER] Impossibile importare database_async: {e}")


# Setup automatico quando questo modulo viene importato
setup_telegram_bot_imports()
