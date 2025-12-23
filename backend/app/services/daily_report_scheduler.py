"""
Scheduler per generare report giornalieri automatici.
Esegue alle 10 AM ora italiana.
"""
import logging
import asyncio
from datetime import datetime, time, timedelta, timezone
from typing import List
from app.core.database import db_manager
from app.core.notifications_service import generate_daily_report, save_notification, cleanup_expired_notifications

logger = logging.getLogger(__name__)


def get_italian_time():
    """
    Ottiene l'ora corrente in Italia (UTC+1 o UTC+2 per DST).
    Per semplicità, usiamo UTC+1 (in produzione usare pytz per DST).
    """
    now_utc = datetime.now(timezone.utc)
    # Sottrai 1 ora per ora italiana (in produzione usare pytz per gestire DST)
    return now_utc - timedelta(hours=1)


async def generate_daily_reports_for_all_users():
    """
    Genera report giornalieri per tutti gli utenti attivi.
    """
    try:
        logger.info("[SCHEDULER] Avvio generazione report giornalieri...")
        
        # Recupera tutti gli utenti con business_name (utenti attivi)
        from app.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            from sqlalchemy import text as sql_text
            query = sql_text("""
                SELECT id, business_name 
                FROM users 
                WHERE business_name IS NOT NULL AND business_name != ''
                AND onboarding_completed = TRUE
            """)
            result = await session.execute(query)
            users = result.fetchall()
        
        if not users:
            logger.info("[SCHEDULER] Nessun utente attivo trovato")
            return
        
        logger.info(f"[SCHEDULER] Trovati {len(users)} utenti attivi, generazione report...")
        
        success_count = 0
        error_count = 0
        
        for user in users:
            user_id = user.id
            try:
                # Genera report per il giorno precedente
                report_data = await generate_daily_report(user_id)
                
                if report_data:
                    # Salva notifica
                    notification_id = await save_notification(
                        user_id=user_id,
                        title=report_data["title"],
                        content=report_data["content"],
                        report_date=report_data["report_date"],
                        metadata=report_data["metadata"]
                    )
                    
                    if notification_id:
                        success_count += 1
                        logger.info(f"[SCHEDULER] Report generato per user_id={user_id}, notification_id={notification_id}")
                    else:
                        error_count += 1
                        logger.warning(f"[SCHEDULER] Errore salvataggio notifica per user_id={user_id}")
                else:
                    logger.debug(f"[SCHEDULER] Nessun movimento trovato per user_id={user_id}, skip")
            
            except Exception as e:
                error_count += 1
                logger.error(f"[SCHEDULER] Errore generazione report per user_id={user_id}: {e}", exc_info=True)
                continue
        
        logger.info(f"[SCHEDULER] ✅ Generazione report completata: {success_count} successi, {error_count} errori")
        
        # Cleanup notifiche scadute
        try:
            deleted_count = await cleanup_expired_notifications()
            if deleted_count > 0:
                logger.info(f"[SCHEDULER] Eliminate {deleted_count} notifiche scadute")
        except Exception as e:
            logger.error(f"[SCHEDULER] Errore cleanup notifiche: {e}", exc_info=True)
    
    except Exception as e:
        logger.error(f"[SCHEDULER] Errore durante generazione report giornalieri: {e}", exc_info=True)


async def scheduler_loop():
    """
    Loop principale dello scheduler.
    Controlla ogni minuto se è ora di generare i report (10 AM ora italiana).
    """
    logger.info("[SCHEDULER] Scheduler avviato, controllo ogni minuto per le 10 AM ora italiana")
    
    last_run_date = None
    
    while True:
        try:
            italian_time = get_italian_time()
            current_time = italian_time.time()
            current_date = italian_time.date()
            
            # Controlla se è tra le 10:00 e le 10:01 e non abbiamo già eseguito oggi
            target_time = time(10, 0)
            if (current_time >= target_time and 
                current_time < time(10, 1) and 
                last_run_date != current_date):
                
                logger.info(f"[SCHEDULER] È ora di generare i report giornalieri (ora italiana: {italian_time})")
                await generate_daily_reports_for_all_users()
                last_run_date = current_date
            
            # Attendi 1 minuto prima del prossimo controllo
            await asyncio.sleep(60)
        
        except Exception as e:
            logger.error(f"[SCHEDULER] Errore nel loop scheduler: {e}", exc_info=True)
            # Attendi 60 secondi prima di riprovare
            await asyncio.sleep(60)


def start_scheduler():
    """
    Avvia lo scheduler in background.
    """
    try:
        logger.info("[SCHEDULER] Avvio scheduler report giornalieri...")
        loop = asyncio.get_event_loop()
        loop.create_task(scheduler_loop())
        logger.info("[SCHEDULER] ✅ Scheduler avviato con successo")
    except Exception as e:
        logger.error(f"[SCHEDULER] Errore avvio scheduler: {e}", exc_info=True)

