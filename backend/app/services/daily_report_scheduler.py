"""
Scheduler per recuperare PDF report giornalieri da processor e salvarli nelle notifiche.
Esegue alle 10 AM ora italiana.
"""
import logging
import asyncio
import base64
from datetime import datetime, time, timedelta, timezone
from typing import List
from app.core.database import db_manager
from app.core.notifications_service import save_notification, cleanup_expired_notifications
from app.core.processor_client import processor_client

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
    Recupera PDF report giornalieri da processor e li salva nelle notifiche.
    I PDF sono già stati generati alle 5 AM da processor.
    """
    try:
        logger.info("[SCHEDULER] Avvio recupero PDF report giornalieri da processor...")
        
        # Data del giorno precedente
        italian_time = get_italian_time()
        yesterday_date = (italian_time - timedelta(days=1)).date()
        report_date_str = yesterday_date.strftime("%Y-%m-%d")
        
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
        
        logger.info(f"[SCHEDULER] Trovati {len(users)} utenti attivi, recupero PDF da processor...")
        
        success_count = 0
        error_count = 0
        skipped_count = 0
        
        for user in users:
            user_id = user.id
            business_name = user.business_name
            try:
                # Recupera PDF da processor
                pdf_data = await processor_client.get_daily_report_pdf(
                    user_id=user_id,
                    report_date=report_date_str
                )
                
                if pdf_data:
                    # Converti PDF in base64 per salvare nel metadata
                    pdf_base64 = base64.b64encode(pdf_data).decode('utf-8')
                    
                    # Salva notifica con PDF
                    report_date_formatted = yesterday_date.strftime("%d/%m/%Y")
                    notification_id = await save_notification(
                        user_id=user_id,
                        title=f"📊 Report Movimenti - {report_date_formatted}",
                        content="",  # Contenuto vuoto, il PDF è nel metadata
                        report_date=yesterday_date,
                        metadata={
                            "type": "pdf_report",
                            "pdf_base64": pdf_base64,
                            "pdf_size": len(pdf_data),
                            "business_name": business_name,
                            "report_date": report_date_str
                        }
                    )
                    
                    if notification_id:
                        success_count += 1
                        logger.info(
                            f"[SCHEDULER] PDF report salvato per user_id={user_id}, "
                            f"notification_id={notification_id}, size={len(pdf_data)} bytes"
                        )
                    else:
                        error_count += 1
                        logger.warning(f"[SCHEDULER] Errore salvataggio notifica per user_id={user_id}")
                else:
                    skipped_count += 1
                    logger.debug(
                        f"[SCHEDULER] PDF non trovato per user_id={user_id}, date={report_date_str} "
                        "(probabilmente nessun movimento o PDF non ancora generato)"
                    )
            
            except Exception as e:
                error_count += 1
                logger.error(f"[SCHEDULER] Errore recupero PDF per user_id={user_id}: {e}", exc_info=True)
                continue
        
        logger.info(
            f"[SCHEDULER] ✅ Recupero PDF completato: {success_count} successi, "
            f"{skipped_count} saltati, {error_count} errori"
        )
        
        # Cleanup notifiche scadute
        try:
            deleted_count = await cleanup_expired_notifications()
            if deleted_count > 0:
                logger.info(f"[SCHEDULER] Eliminate {deleted_count} notifiche scadute")
        except Exception as e:
            logger.error(f"[SCHEDULER] Errore cleanup notifiche: {e}", exc_info=True)
    
    except Exception as e:
        logger.error(f"[SCHEDULER] Errore durante recupero PDF report giornalieri: {e}", exc_info=True)


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

