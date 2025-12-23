"""
Servizio per recuperare e formattare movimenti vino per periodo.
"""
import logging
from datetime import datetime, timedelta, date, timezone
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal, db_manager
import json

logger = logging.getLogger(__name__)


def parse_period(period_str: str) -> Tuple[Optional[date], Optional[date], str]:
    """
    Parsa una stringa di periodo e restituisce date inizio/fine.
    
    Args:
        period_str: Stringa che descrive il periodo (es: "oggi", "ieri", "ultimi 7 giorni", "01/01/2024")
    
    Returns:
        Tuple (start_date, end_date, description)
        Se start_date è None, significa periodo non riconosciuto
    """
    period_lower = period_str.lower().strip()
    
    # Ora italiana (UTC+1, semplificato)
    now_utc = datetime.now(timezone.utc)
    now_italian = now_utc - timedelta(hours=1)
    today = now_italian.date()
    
    # Oggi
    if period_lower in ["oggi", "today", "di oggi"]:
        return (today, today, "oggi")
    
    # Ieri
    if period_lower in ["ieri", "yesterday", "di ieri"]:
        yesterday = today - timedelta(days=1)
        return (yesterday, yesterday, "ieri")
    
    # Ultimi 7 giorni
    if any(keyword in period_lower for keyword in ["ultimi 7 giorni", "ultime 7 giorni", "ultima settimana", "last 7 days"]):
        start_date = today - timedelta(days=6)  # Include oggi (7 giorni totali)
        return (start_date, today, "ultimi 7 giorni")
    
    # Ultimi 30 giorni
    if any(keyword in period_lower for keyword in ["ultimi 30 giorni", "ultime 30 giorni", "ultimo mese", "last 30 days"]):
        start_date = today - timedelta(days=29)  # Include oggi (30 giorni totali)
        return (start_date, today, "ultimi 30 giorni")
    
    # Data specifica (formati: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY)
    import re
    date_patterns = [
        (r'(\d{1,2})/(\d{1,2})/(\d{4})', '%d/%m/%Y'),
        (r'(\d{4})-(\d{1,2})-(\d{1,2})', '%Y-%m-%d'),
        (r'(\d{1,2})-(\d{1,2})-(\d{4})', '%d-%m-%Y'),
    ]
    
    for pattern, fmt in date_patterns:
        match = re.search(pattern, period_str)
        if match:
            try:
                date_str = match.group(0)
                parsed_date = datetime.strptime(date_str, fmt).date()
                return (parsed_date, parsed_date, parsed_date.strftime("%d/%m/%Y"))
            except ValueError:
                continue
    
    # Periodo non riconosciuto
    return (None, None, period_str)


async def get_movements_for_period(
    user_id: int,
    start_date: date,
    end_date: date,
    period_description: str
) -> Dict[str, Any]:
    """
    Recupera tutti i movimenti per un periodo specifico.
    
    Args:
        user_id: ID utente
        start_date: Data inizio periodo
        end_date: Data fine periodo
        period_description: Descrizione periodo per display
    
    Returns:
        Dict con:
            - wines_with_movements: Lista vini con movimenti
            - total_consumi: Totale consumi nel periodo
            - total_rifornimenti: Totale rifornimenti nel periodo
            - period_description: Descrizione periodo
    """
    try:
        user = await db_manager.get_user_by_id(user_id)
        if not user or not user.business_name:
            logger.warning(f"[MOVEMENTS] User {user_id} non trovato o business_name mancante")
            return {
                "wines_with_movements": [],
                "total_consumi": 0,
                "total_rifornimenti": 0,
                "period_description": period_description
            }
        
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
                logger.info(f"[MOVEMENTS] Tabella Storico vino non esiste per user_id={user_id}")
                return {
                    "wines_with_movements": [],
                    "total_consumi": 0,
                    "total_rifornimenti": 0,
                    "period_description": period_description
                }
            
            # Recupera tutti i vini
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
                logger.info(f"[MOVEMENTS] Nessun vino nello storico per user_id={user_id}")
                return {
                    "wines_with_movements": [],
                    "total_consumi": 0,
                    "total_rifornimenti": 0,
                    "period_description": period_description
                }
            
            # Filtra movimenti nel periodo
            wines_with_movements = []
            total_consumi = 0
            total_rifornimenti = 0
            
            for row in storico_rows:
                wine_name = row[0]
                current_stock = row[1] or 0
                history_json = row[2]
                
                if not history_json:
                    continue
                
                try:
                    history = json.loads(history_json) if isinstance(history_json, str) else history_json
                    if not isinstance(history, list):
                        continue
                    
                    # Filtra movimenti nel periodo
                    period_movements = []
                    wine_consumi = 0
                    wine_rifornimenti = 0
                    
                    for movement in history:
                        if not isinstance(movement, dict):
                            continue
                        
                        movement_date_str = movement.get("date")
                        if not movement_date_str:
                            continue
                        
                        try:
                            # Parse data movimento
                            if " " in movement_date_str:
                                movement_date = datetime.strptime(movement_date_str.split()[0], "%Y-%m-%d").date()
                            else:
                                movement_date = datetime.strptime(movement_date_str, "%Y-%m-%d").date()
                            
                            # Verifica se è nel periodo
                            if start_date <= movement_date <= end_date:
                                period_movements.append(movement)
                                movement_type = movement.get("type", "").lower()
                                quantity = abs(int(movement.get("quantity", 0)))
                                
                                if "consumo" in movement_type or "consum" in movement_type:
                                    wine_consumi += quantity
                                    total_consumi += quantity
                                elif "rifornimento" in movement_type or "riforn" in movement_type:
                                    wine_rifornimenti += quantity
                                    total_rifornimenti += quantity
                        except Exception as e:
                            logger.debug(f"[MOVEMENTS] Errore parsing data movimento: {e}")
                            continue
                    
                    if period_movements:
                        wines_with_movements.append({
                            "wine_name": wine_name,
                            "current_stock": current_stock,
                            "movements": period_movements,
                            "total_consumi": wine_consumi,
                            "total_rifornimenti": wine_rifornimenti
                        })
                
                except Exception as e:
                    logger.warning(f"[MOVEMENTS] Errore parsing history per {wine_name}: {e}")
                    continue
            
            logger.info(f"[MOVEMENTS] Trovati {len(wines_with_movements)} vini con movimenti nel periodo {period_description}")
            return {
                "wines_with_movements": wines_with_movements,
                "total_consumi": total_consumi,
                "total_rifornimenti": total_rifornimenti,
                "period_description": period_description,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            }
    
    except Exception as e:
        logger.error(f"[MOVEMENTS] Errore recupero movimenti per user_id={user_id}: {e}", exc_info=True)
        return {
            "wines_with_movements": [],
            "total_consumi": 0,
            "total_rifornimenti": 0,
            "period_description": period_description
        }

