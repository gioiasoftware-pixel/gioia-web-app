"""
Servizio per gestione notifiche e report giornalieri.
Genera report automatici dei movimenti del giorno precedente.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal, db_manager
import json

logger = logging.getLogger(__name__)


async def migrate_notifications_table(session: AsyncSession):
    """
    Crea la tabella notifications se non esiste.
    """
    try:
        check_table_query = sql_text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'notifications'
            );
        """)
        result = await session.execute(check_table_query)
        table_exists = result.scalar()
        
        if table_exists:
            logger.info("[NOTIFICATIONS] Tabella 'notifications' già esistente, skip")
            return
        
        logger.info("[NOTIFICATIONS] Creazione tabella 'notifications'...")
        create_table_query = sql_text("""
            CREATE TABLE notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(50) NOT NULL DEFAULT 'daily_report',
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                report_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                read_at TIMESTAMP,
                metadata JSONB
            );
        """)
        await session.execute(create_table_query)
        
        # Crea indici
        create_index_1 = sql_text("CREATE INDEX idx_notifications_user_id ON notifications(user_id);")
        await session.execute(create_index_1)
        
        create_index_2 = sql_text("CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);")
        await session.execute(create_index_2)
        
        create_index_3 = sql_text("CREATE INDEX idx_notifications_expires_at ON notifications(expires_at);")
        await session.execute(create_index_3)
        
        create_index_4 = sql_text("CREATE INDEX idx_notifications_read_at ON notifications(read_at);")
        await session.execute(create_index_4)
        
        logger.info("[NOTIFICATIONS] ✅ Tabella 'notifications' creata con successo")
    except Exception as e:
        logger.error(f"[NOTIFICATIONS] Errore creando tabella notifications: {e}", exc_info=True)
        raise


async def generate_daily_report(user_id: int, report_date: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
    """
    Genera report giornaliero dei movimenti per un utente.
    
    Args:
        user_id: ID utente
        report_date: Data del report (default: ieri)
    
    Returns:
        Dict con report o None se errore
    """
    try:
        # Se non specificata, usa ieri
        if report_date is None:
            # Ora italiana (UTC+1 o UTC+2 per DST)
            # Per semplicità, usiamo UTC e sottraiamo 1 ora per ora italiana
            now_utc = datetime.now(timezone.utc)
            # Sottrai 1 ora per ora italiana (in produzione potresti usare pytz per DST)
            now_italian = now_utc - timedelta(hours=1)
            report_date = (now_italian - timedelta(days=1)).date()
        else:
            if isinstance(report_date, datetime):
                report_date = report_date.date()
        
        # Recupera utente e business_name
        user = await db_manager.get_user_by_id(user_id)
        if not user or not user.business_name:
            logger.warning(f"[NOTIFICATIONS] User {user_id} non trovato o business_name mancante")
            return None
        
        # Tabella Storico vino
        table_storico = f'"{user_id}/{user.business_name} Storico vino"'
        
        async with AsyncSessionLocal() as session:
            # Verifica che la tabella esista
            table_name_check = table_storico.strip('"')
            check_table_query = sql_text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = :table_name
                )
            """)
            result = await session.execute(check_table_query, {"table_name": table_name_check})
            table_exists = result.scalar()
            
            if not table_exists:
                logger.info(f"[NOTIFICATIONS] Tabella Storico vino non esiste per user_id={user_id}")
                return None
            
            # Recupera tutti i movimenti del giorno precedente
            # La tabella Storico vino ha un campo history (JSON) con i movimenti
            query_storico = sql_text(f"""
                SELECT 
                    wine_name,
                    current_stock,
                    history,
                    total_consumi,
                    total_rifornimenti
                FROM {table_storico}
                WHERE user_id = :user_id
            """)
            result = await session.execute(query_storico, {"user_id": user_id})
            storico_rows = result.fetchall()
            
            if not storico_rows:
                logger.info(f"[NOTIFICATIONS] Nessun vino nello storico per user_id={user_id}")
                return None
            
            # Filtra movimenti del giorno precedente
            report_movements = []
            total_consumi = 0
            total_rifornimenti = 0
            wines_with_movements = []
            
            for row in storico_rows:
                wine_name = row[0]
                current_stock = row[1] or 0
                history_json = row[2]
                total_consumi_wine = row[3] or 0
                total_rifornimenti_wine = row[4] or 0
                
                if not history_json:
                    continue
                
                try:
                    history = json.loads(history_json) if isinstance(history_json, str) else history_json
                    if not isinstance(history, list):
                        continue
                    
                    # Filtra movimenti del giorno precedente
                    day_movements = []
                    for movement in history:
                        if not isinstance(movement, dict):
                            continue
                        
                        movement_date_str = movement.get("date")
                        if not movement_date_str:
                            continue
                        
                        try:
                            # Parse data movimento (formato: "YYYY-MM-DD" o "YYYY-MM-DD HH:MM:SS")
                            if " " in movement_date_str:
                                movement_date = datetime.strptime(movement_date_str.split()[0], "%Y-%m-%d").date()
                            else:
                                movement_date = datetime.strptime(movement_date_str, "%Y-%m-%d").date()
                            
                            if movement_date == report_date:
                                day_movements.append(movement)
                                movement_type = movement.get("type", "").lower()
                                quantity = abs(int(movement.get("quantity", 0)))
                                
                                if "consumo" in movement_type or "consum" in movement_type:
                                    total_consumi += quantity
                                elif "rifornimento" in movement_type or "riforn" in movement_type:
                                    total_rifornimenti += quantity
                        except Exception as e:
                            logger.debug(f"[NOTIFICATIONS] Errore parsing data movimento: {e}")
                            continue
                    
                    if day_movements:
                        wines_with_movements.append({
                            "wine_name": wine_name,
                            "current_stock": current_stock,
                            "movements": day_movements,
                            "total_consumi": sum(abs(int(m.get("quantity", 0))) for m in day_movements if "consumo" in m.get("type", "").lower() or "consum" in m.get("type", "").lower()),
                            "total_rifornimenti": sum(abs(int(m.get("quantity", 0))) for m in day_movements if "rifornimento" in m.get("type", "").lower() or "riforn" in m.get("type", "").lower())
                        })
                        report_movements.extend(day_movements)
                
                except Exception as e:
                    logger.warning(f"[NOTIFICATIONS] Errore parsing history per {wine_name}: {e}")
                    continue
            
            if not wines_with_movements:
                logger.info(f"[NOTIFICATIONS] Nessun movimento trovato per {report_date} per user_id={user_id}")
                return None
            
            # Genera contenuto report
            report_date_str = report_date.strftime("%d/%m/%Y")
            title = f"📊 Report Movimenti - {report_date_str}"
            
            content_parts = [
                f"# Report Movimenti del {report_date_str}",
                "",
                "## Riepilogo Generale",
                f"- **Vini con movimenti:** {len(wines_with_movements)}",
                f"- **Totale consumi:** {total_consumi} bottiglie",
                f"- **Totale rifornimenti:** {total_rifornimenti} bottiglie",
                "",
                "## Dettaglio per Vino"
            ]
            
            for wine_data in wines_with_movements:
                wine_name = wine_data["wine_name"]
                movements = wine_data["movements"]
                consumi = wine_data["total_consumi"]
                rifornimenti = wine_data["total_rifornimenti"]
                current_stock = wine_data["current_stock"]
                
                content_parts.append(f"\n### {wine_name}")
                content_parts.append(f"- **Stock attuale:** {current_stock} bottiglie")
                if consumi > 0:
                    content_parts.append(f"- **Consumati:** {consumi} bottiglie")
                if rifornimenti > 0:
                    content_parts.append(f"- **Riforniti:** {rifornimenti} bottiglie")
                
                # Dettaglio movimenti
                if len(movements) > 0:
                    content_parts.append("\n**Movimenti:**")
                    for mov in movements[:5]:  # Max 5 movimenti per vino
                        mov_type = mov.get("type", "movimento")
                        mov_qty = mov.get("quantity", 0)
                        mov_time = mov.get("time", "")
                        content_parts.append(f"- {mov_type}: {abs(int(mov_qty))} bottiglie {mov_time}")
                    if len(movements) > 5:
                        content_parts.append(f"- ... e altri {len(movements) - 5} movimenti")
            
            content = "\n".join(content_parts)
            
            # Metadata
            metadata = {
                "report_date": report_date.isoformat(),
                "total_wines": len(wines_with_movements),
                "total_consumi": total_consumi,
                "total_rifornimenti": total_rifornimenti,
                "wines": wines_with_movements
            }
            
            return {
                "title": title,
                "content": content,
                "report_date": report_date,
                "metadata": metadata
            }
    
    except Exception as e:
        logger.error(f"[NOTIFICATIONS] Errore generazione report per user_id={user_id}: {e}", exc_info=True)
        return None


async def save_notification(user_id: int, title: str, content: str, report_date: datetime.date, metadata: Optional[Dict] = None) -> Optional[int]:
    """
    Salva una notifica nel database.
    
    Returns:
        ID notifica creata o None se errore
    """
    try:
        # La notifica scade dopo 3 giorni
        expires_at = datetime.now(timezone.utc) + timedelta(days=3)
        
        async with AsyncSessionLocal() as session:
            # Prepara metadata come JSON string
            metadata_json = json.dumps(metadata) if metadata else None
            
            insert_query = sql_text("""
                INSERT INTO notifications (user_id, type, title, content, report_date, expires_at, metadata)
                VALUES (:user_id, 'daily_report', :title, :content, :report_date, :expires_at, CAST(:metadata AS jsonb))
                RETURNING id
            """)
            result = await session.execute(insert_query, {
                "user_id": user_id,
                "title": title,
                "content": content,
                "report_date": report_date,
                "expires_at": expires_at,
                "metadata": metadata_json
            })
            notification_id = result.scalar()
            await session.commit()
            logger.info(f"[NOTIFICATIONS] Notifica {notification_id} salvata per user_id={user_id}")
            return notification_id
    except Exception as e:
        logger.error(f"[NOTIFICATIONS] Errore salvataggio notifica: {e}", exc_info=True)
        return None


async def get_user_notifications(user_id: int, limit: int = 50, unread_only: bool = False) -> List[Dict[str, Any]]:
    """
    Recupera notifiche per un utente.
    
    Args:
        user_id: ID utente
        limit: Numero massimo di notifiche
        unread_only: Se True, solo notifiche non lette
    
    Returns:
        Lista di notifiche
    """
    try:
        async with AsyncSessionLocal() as session:
            if unread_only:
                query = sql_text("""
                    SELECT id, type, title, content, report_date, created_at, expires_at, read_at, metadata
                    FROM notifications
                    WHERE user_id = :user_id 
                    AND read_at IS NULL
                    AND expires_at > CURRENT_TIMESTAMP
                    ORDER BY created_at DESC
                    LIMIT :limit
                """)
            else:
                query = sql_text("""
                    SELECT id, type, title, content, report_date, created_at, expires_at, read_at, metadata
                    FROM notifications
                    WHERE user_id = :user_id 
                    AND expires_at > CURRENT_TIMESTAMP
                    ORDER BY created_at DESC
                    LIMIT :limit
                """)
            
            result = await session.execute(query, {"user_id": user_id, "limit": limit})
            rows = result.fetchall()
            
            notifications = []
            for row in rows:
                notifications.append({
                    "id": row[0],
                    "type": row[1],
                    "title": row[2],
                    "content": row[3],
                    "report_date": row[4].isoformat() if row[4] else None,
                    "created_at": row[5].isoformat() if row[5] else None,
                    "expires_at": row[6].isoformat() if row[6] else None,
                    "read_at": row[7].isoformat() if row[7] else None,
                    "metadata": row[8] if row[8] else {}
                })
            
            return notifications
    except Exception as e:
        logger.error(f"[NOTIFICATIONS] Errore recupero notifiche per user_id={user_id}: {e}", exc_info=True)
        return []


async def mark_notification_read(notification_id: int, user_id: int) -> bool:
    """
    Marca una notifica come letta.
    """
    try:
        async with AsyncSessionLocal() as session:
            update_query = sql_text("""
                UPDATE notifications
                SET read_at = CURRENT_TIMESTAMP
                WHERE id = :notification_id AND user_id = :user_id
            """)
            result = await session.execute(update_query, {
                "notification_id": notification_id,
                "user_id": user_id
            })
            await session.commit()
            return result.rowcount > 0
    except Exception as e:
        logger.error(f"[NOTIFICATIONS] Errore marcatura notifica come letta: {e}", exc_info=True)
        return False


async def cleanup_expired_notifications():
    """
    Elimina notifiche scadute (oltre 3 giorni).
    """
    try:
        async with AsyncSessionLocal() as session:
            delete_query = sql_text("""
                DELETE FROM notifications
                WHERE expires_at < CURRENT_TIMESTAMP
            """)
            result = await session.execute(delete_query)
            deleted_count = result.rowcount
            await session.commit()
            if deleted_count > 0:
                logger.info(f"[NOTIFICATIONS] Eliminate {deleted_count} notifiche scadute")
            return deleted_count
    except Exception as e:
        logger.error(f"[NOTIFICATIONS] Errore cleanup notifiche scadute: {e}", exc_info=True)
        return 0

