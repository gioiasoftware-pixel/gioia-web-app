"""
API endpoints per admin panel.
Gestisce utenti, tabelle dinamiche e integrazione con Processor.
"""
import logging
import os
import secrets
import re
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from fastapi import APIRouter, HTTPException, Depends, Query, Body, UploadFile, File, Form, status
from pydantic import BaseModel, EmailStr, ConfigDict
from sqlalchemy import select, text as sql_text, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, User, db_manager
from app.core.auth import get_current_user, create_spectator_token
from app.core.processor_client import processor_client
from app.core.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

# Email admin (da configurazione o default)
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "gio.ia.software@gmail.com")


def is_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency per verificare che l'utente sia admin.
    Verifica che l'email corrisponda all'admin email configurata.
    Null-safe e robusto per evitare AttributeError.
    """
    # Verifica che current_user esista
    if not current_user:
        logger.warning("[ADMIN] is_admin_user: current_user è None")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    
    # Estrai user object
    user: User = current_user.get("user")
    if not user:
        logger.warning(f"[ADMIN] is_admin_user: user è None, current_user keys: {current_user.keys()}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found in token")
    
    # Verifica email esistente e non vuota
    if not user.email or not isinstance(user.email, str) or not user.email.strip():
        logger.warning(f"[ADMIN] is_admin_user: user_id={user.id} non ha email valida (email={user.email})")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accesso negato: email non valida")
    
    # Normalizza email per confronto
    admin_email = (ADMIN_EMAIL or "").strip().lower()
    user_email = user.email.strip().lower()
    
    # Log per debug
    logger.debug(f"[ADMIN] is_admin_user: user_id={user.id}, user_email={user_email}, admin_email={admin_email}")
    
    # Verifica corrispondenza
    if user_email != admin_email:
        logger.warning(f"[ADMIN] is_admin_user: accesso negato per user_id={user.id}, email={user_email}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Accesso negato: solo admin")
    
    logger.debug(f"[ADMIN] is_admin_user: accesso consentito per user_id={user.id}, email={user_email}")
    return current_user


# Modelli Pydantic
class UserResponse(BaseModel):
    id: int
    email: Optional[str] = None
    business_name: Optional[str] = None
    username: Optional[str] = None
    telegram_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    business_type: Optional[str] = None
    location: Optional[str] = None
    phone: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    onboarding_completed: bool = False

    class Config:
        from_attributes = True


class PaginatedUsersResponse(BaseModel):
    data: List[UserResponse]
    total: int
    page: int
    limit: int


class UserStatsResponse(BaseModel):
    total_wines: int = 0
    total_logs: int = 0
    total_consumi: int = 0
    total_storico: int = 0
    last_activity: Optional[str] = None
    # Ultimo job processing
    last_job_message: Optional[str] = None  # file_name o messaggio del job
    last_job_date: Optional[str] = None  # data creazione job
    # Ultimo errore
    last_error: Optional[str] = None  # messaggio errore
    last_error_date: Optional[str] = None  # data errore
    # Tempo passato in app
    time_today_seconds: Optional[int] = None  # secondi passati in app oggi
    time_total_seconds: Optional[int] = None  # secondi totali passati in app


class UserWithStatsResponse(BaseModel):
    user: UserResponse
    stats: UserStatsResponse


class TableRowResponse(BaseModel):
    model_config = ConfigDict(extra='allow')
    id: int
    user_id: int


class PaginatedTableResponse(BaseModel):
    data: List[Dict[str, Any]]
    total: int
    page: int
    limit: int


class OnboardingRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    business_name: str


class UpdateUserRequest(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    business_name: Optional[str] = None
    password: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    business_type: Optional[str] = None
    location: Optional[str] = None
    phone: Optional[str] = None


class CreateTableRowRequest(BaseModel):
    model_config = ConfigDict(extra='allow')


class UpdateTableRowRequest(BaseModel):
    model_config = ConfigDict(extra='allow')


class DashboardKPIResponse(BaseModel):
    total_users: int = 0
    active_jobs: int = 0
    errors_24h: int = 0
    files_uploaded_7d: int = 0


def get_user_table_name(user_id: int, business_name: str, table_type: str) -> str:
    """
    Genera nome tabella dinamica utente.
    Formato: "{user_id}/{business_name} {table_type}"
    Identico a Processor per compatibilità.
    """
    if not business_name:
        business_name = "Upload Manuale"
    
    table_name = f'"{user_id}/{business_name} {table_type}"'
    return table_name


async def get_user_table_info(user_id: int) -> tuple[Optional[User], Optional[str]]:
    """
    Ottiene utente e business_name per costruire nomi tabelle.
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user or not user.business_name:
            return None, None
        return user, user.business_name


# Endpoint Users
@router.get("/users", response_model=PaginatedUsersResponse)
async def get_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    admin_user: dict = Depends(is_admin_user)
):
    """
    Lista utenti con paginazione e ricerca.
    """
    try:
        async with AsyncSessionLocal() as session:
            # Query base per count
            count_query = select(func.count(User.id))
            
            # Query base per dati
            data_query = select(User)
            
            # Filtro ricerca (applicato a entrambe le query)
            if search:
                search_term = f"%{search.lower()}%"
                # Gestisci valori None nei campi
                search_filter = (
                    (User.email.isnot(None) & func.lower(User.email).like(search_term)) |
                    (User.business_name.isnot(None) & func.lower(User.business_name).like(search_term)) |
                    (User.username.isnot(None) & func.lower(User.username).like(search_term))
                )
                count_query = count_query.where(search_filter)
                data_query = data_query.where(search_filter)
            
            # Esegui count
            total_result = await session.execute(count_query)
            total = total_result.scalar() or 0
            
            # Paginazione per dati
            offset = (page - 1) * limit
            data_query = data_query.order_by(User.created_at.desc()).offset(offset).limit(limit)
            
            # Esegui query dati
            result = await session.execute(data_query)
            users = result.scalars().all()
            
            # Converti a UserResponse con gestione errori robusta
            user_responses = []
            for u in users:
                try:
                    # Normalizza dati prima della validazione
                    user_dict = {
                        "id": u.id,
                        "email": u.email if u.email else None,
                        "business_name": u.business_name if u.business_name else None,
                        "username": u.username if u.username else None,
                        "telegram_id": u.telegram_id if u.telegram_id else None,
                        "created_at": u.created_at.isoformat() if u.created_at else None,
                        "updated_at": u.updated_at.isoformat() if u.updated_at else None,
                        "onboarding_completed": bool(u.onboarding_completed) if u.onboarding_completed is not None else False
                    }
                    user_responses.append(UserResponse.model_validate(user_dict))
                except Exception as e:
                    logger.error(f"Errore validazione UserResponse per user_id={u.id}: {e}", exc_info=True)
                    # Includi comunque l'utente con dati minimi per non perdere dati
                    user_responses.append(UserResponse(
                        id=u.id,
                        email=None,
                        business_name=None,
                        username=None,
                        telegram_id=None,
                        created_at=None,
                        updated_at=None,
                        onboarding_completed=False
                    ))
            
            return PaginatedUsersResponse(
                data=user_responses,
                total=total,
                page=page,
                limit=limit
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore recupero lista utenti: {e}", exc_info=True)
        import traceback
        logger.error(f"Traceback completo: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")


@router.get("/users/{user_id}", response_model=UserWithStatsResponse)
async def get_user(
    user_id: int,
    admin_user: dict = Depends(is_admin_user)
):
    """
    Dettaglio utente con statistiche.
    """
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                raise HTTPException(status_code=404, detail="Utente non trovato")
            
            # Calcola statistiche dalle tabelle dinamiche
            stats = UserStatsResponse()
            
            if user.business_name:
                # Inizializza variabili tabelle per last_activity
                table_inventario = None
                table_log = None
                table_consumi = None
                table_storico = None
                
                # Tabella INVENTARIO
                try:
                    table_inventario = get_user_table_name(user.id, user.business_name, "INVENTARIO")
                    count_query = sql_text(f"""
                        SELECT COUNT(*) FROM {table_inventario}
                        WHERE user_id = :user_id
                    """)
                    result = await session.execute(count_query, {"user_id": user.id})
                    stats.total_wines = result.scalar() or 0
                except Exception as e:
                    logger.debug(f"Tabella INVENTARIO non trovata o errore per user_id={user_id}: {e}")
                    stats.total_wines = 0
                
                # Tabella LOG interazione
                try:
                    table_log = get_user_table_name(user.id, user.business_name, "LOG interazione")
                    count_query = sql_text(f"""
                        SELECT COUNT(*) FROM {table_log}
                        WHERE user_id = :user_id
                    """)
                    result = await session.execute(count_query, {"user_id": user.id})
                    stats.total_logs = result.scalar() or 0
                except Exception as e:
                    logger.debug(f"Tabella LOG interazione non trovata o errore per user_id={user_id}: {e}")
                    stats.total_logs = 0
                
                # Tabella Consumi e rifornimenti
                try:
                    table_consumi = get_user_table_name(user.id, user.business_name, "Consumi e rifornimenti")
                    count_query = sql_text(f"""
                        SELECT COUNT(*) FROM {table_consumi}
                        WHERE user_id = :user_id
                    """)
                    result = await session.execute(count_query, {"user_id": user.id})
                    stats.total_consumi = result.scalar() or 0
                except Exception as e:
                    logger.debug(f"Tabella Consumi e rifornimenti non trovata o errore per user_id={user_id}: {e}")
                    stats.total_consumi = 0
                
                # Tabella Storico vino
                try:
                    table_storico = get_user_table_name(user.id, user.business_name, "Storico vino")
                    count_query = sql_text(f"""
                        SELECT COUNT(*) FROM {table_storico}
                        WHERE user_id = :user_id
                    """)
                    result = await session.execute(count_query, {"user_id": user.id})
                    stats.total_storico = result.scalar() or 0
                except Exception as e:
                    logger.debug(f"Tabella Storico vino non trovata o errore per user_id={user_id}: {e}")
                    stats.total_storico = 0
                
                # Ultima attività (max updated_at/created_at da tutte le tabelle)
                # Include anche i log per avere una visione completa delle interazioni
                if table_inventario or table_log or table_consumi or table_storico:
                    try:
                        # Calcola last_activity da tutte le tabelle disponibili
                        # Include anche i log per avere una visione completa
                        union_parts = []
                        if table_inventario:
                            union_parts.append(f"SELECT updated_at AS activity_date FROM {table_inventario} WHERE user_id = :user_id AND updated_at IS NOT NULL")
                        if table_log:
                            union_parts.append(f"SELECT created_at AS activity_date FROM {table_log} WHERE user_id = :user_id AND created_at IS NOT NULL")
                        if table_consumi:
                            union_parts.append(f"SELECT movement_date AS activity_date FROM {table_consumi} WHERE user_id = :user_id AND movement_date IS NOT NULL")
                        if table_storico:
                            union_parts.append(f"SELECT GREATEST(COALESCE(created_at, '1970-01-01'::timestamp), COALESCE(updated_at, '1970-01-01'::timestamp)) AS activity_date FROM {table_storico} WHERE user_id = :user_id AND (created_at IS NOT NULL OR updated_at IS NOT NULL)")
                        
                        if union_parts:
                            # Costruisci query con CTE per evitare problemi con alias in subquery
                            union_query = ' UNION ALL '.join(union_parts)
                            last_activity_query = sql_text(f"""
                                WITH all_activities AS (
                                    {union_query}
                                )
                                SELECT MAX(activity_date) FROM all_activities
                            """)
                            result = await session.execute(last_activity_query, {"user_id": user.id})
                            last_activity = result.scalar()
                            if last_activity:
                                stats.last_activity = last_activity.isoformat()
                            else:
                                # Se non c'è attività nelle tabelle dinamiche, usa created_at dell'utente come fallback
                                stats.last_activity = user.created_at.isoformat() if user.created_at else None
                        else:
                            # Nessuna tabella disponibile, usa created_at dell'utente
                            stats.last_activity = user.created_at.isoformat() if user.created_at else None
                    except Exception as e:
                        # last_activity è opzionale, non blocchiamo la risposta se fallisce
                        # Le tabelle potrebbero non esistere ancora o non avere dati
                        logger.debug(f"Errore calcolo last_activity per user_id={user_id} (non critico): {e}")
                        # Fallback a created_at dell'utente
                        stats.last_activity = user.created_at.isoformat() if user.created_at else None
                
                # Recupera ultimo job processing
                # processing_jobs usa telegram_id, quindi usiamo user.telegram_id o user.id come fallback
                try:
                    telegram_id_for_job = user.telegram_id if user.telegram_id else user.id
                    last_job_query = sql_text("""
                        SELECT file_name, created_at, status, error_message
                        FROM processing_jobs
                        WHERE telegram_id = :telegram_id
                        ORDER BY created_at DESC
                        LIMIT 1
                    """)
                    result = await session.execute(
                        last_job_query, 
                        {"telegram_id": telegram_id_for_job}
                    )
                    last_job = result.fetchone()
                    if last_job:
                        stats.last_job_message = last_job[0] or "Nessun file"
                        stats.last_job_date = last_job[1].isoformat() if last_job[1] else None
                        
                        # Se l'ultimo job ha un errore, usa quello come ultimo errore
                        if last_job[2] == 'error' and last_job[3]:
                            stats.last_error = last_job[3]
                            stats.last_error_date = last_job[1].isoformat() if last_job[1] else None
                except Exception as e:
                    logger.debug(f"Errore recupero ultimo job per user_id={user_id} (non critico): {e}")
                
                # Se non abbiamo ancora un errore, cerca l'ultimo job con errore
                if not stats.last_error:
                    try:
                        telegram_id_for_job = user.telegram_id if user.telegram_id else user.id
                        last_error_query = sql_text("""
                            SELECT error_message, created_at
                            FROM processing_jobs
                            WHERE telegram_id = :telegram_id
                            AND status = 'error'
                            AND error_message IS NOT NULL
                            ORDER BY created_at DESC
                            LIMIT 1
                        """)
                        result = await session.execute(
                            last_error_query,
                            {"telegram_id": telegram_id_for_job}
                        )
                        last_error = result.fetchone()
                        if last_error:
                            stats.last_error = last_error[0]
                            stats.last_error_date = last_error[1].isoformat() if last_error[1] else None
                    except Exception as e:
                        logger.debug(f"Errore recupero ultimo errore per user_id={user_id} (non critico): {e}")
                
                # Calcola tempo passato in app
                # Tempo totale: differenza tra prima e ultima attività
                # Tempo oggi: differenza tra prima e ultima attività di oggi
                if table_inventario or table_log or table_consumi or table_storico:
                    try:
                        # Costruisci query per prima e ultima attività
                        union_parts_min = []
                        union_parts_max = []
                        if table_inventario:
                            union_parts_min.append(f"SELECT MIN(updated_at) AS activity_date FROM {table_inventario} WHERE user_id = :user_id")
                            union_parts_max.append(f"SELECT MAX(updated_at) AS activity_date FROM {table_inventario} WHERE user_id = :user_id")
                        if table_log:
                            union_parts_min.append(f"SELECT MIN(created_at) AS activity_date FROM {table_log} WHERE user_id = :user_id")
                            union_parts_max.append(f"SELECT MAX(created_at) AS activity_date FROM {table_log} WHERE user_id = :user_id")
                        if table_consumi:
                            union_parts_min.append(f"SELECT MIN(movement_date) AS activity_date FROM {table_consumi} WHERE user_id = :user_id")
                            union_parts_max.append(f"SELECT MAX(movement_date) AS activity_date FROM {table_consumi} WHERE user_id = :user_id")
                        if table_storico:
                            union_parts_min.append(f"SELECT MIN(created_at) AS activity_date FROM {table_storico} WHERE user_id = :user_id")
                            union_parts_max.append(f"SELECT MAX(updated_at) AS activity_date FROM {table_storico} WHERE user_id = :user_id")
                        
                        if union_parts_min and union_parts_max:
                            # Prima attività (minimo tra tutte le tabelle)
                            min_query = ' UNION ALL '.join(union_parts_min)
                            min_activity_query = sql_text(f"""
                                WITH all_min_activities AS (
                                    {min_query}
                                )
                                SELECT MIN(activity_date) FROM all_min_activities
                            """)
                            result = await session.execute(min_activity_query, {"user_id": user.id})
                            first_activity = result.scalar()
                            
                            # Ultima attività (massimo tra tutte le tabelle)
                            max_query = ' UNION ALL '.join(union_parts_max)
                            max_activity_query = sql_text(f"""
                                WITH all_max_activities AS (
                                    {max_query}
                                )
                                SELECT MAX(activity_date) FROM all_max_activities
                            """)
                            result = await session.execute(max_activity_query, {"user_id": user.id})
                            last_activity_for_time = result.scalar()
                            
                            # Calcola tempo totale (differenza in secondi)
                            if first_activity and last_activity_for_time:
                                time_diff = (last_activity_for_time - first_activity).total_seconds()
                                stats.time_total_seconds = int(time_diff) if time_diff > 0 else 0
                            
                            # Calcola tempo oggi (prima e ultima attività di oggi)
                            today_start = datetime.combine(date.today(), datetime.min.time())
                            today_end = datetime.combine(date.today(), datetime.max.time())
                            
                            # Query per attività di oggi
                            union_parts_today_min = []
                            union_parts_today_max = []
                            if table_inventario:
                                union_parts_today_min.append(f"SELECT MIN(updated_at) AS activity_date FROM {table_inventario} WHERE user_id = :user_id AND updated_at >= :today_start AND updated_at <= :today_end")
                                union_parts_today_max.append(f"SELECT MAX(updated_at) AS activity_date FROM {table_inventario} WHERE user_id = :user_id AND updated_at >= :today_start AND updated_at <= :today_end")
                            if table_log:
                                union_parts_today_min.append(f"SELECT MIN(created_at) AS activity_date FROM {table_log} WHERE user_id = :user_id AND created_at >= :today_start AND created_at <= :today_end")
                                union_parts_today_max.append(f"SELECT MAX(created_at) AS activity_date FROM {table_log} WHERE user_id = :user_id AND created_at >= :today_start AND created_at <= :today_end")
                            if table_consumi:
                                union_parts_today_min.append(f"SELECT MIN(movement_date) AS activity_date FROM {table_consumi} WHERE user_id = :user_id AND movement_date >= :today_start AND movement_date <= :today_end")
                                union_parts_today_max.append(f"SELECT MAX(movement_date) AS activity_date FROM {table_consumi} WHERE user_id = :user_id AND movement_date >= :today_start AND movement_date <= :today_end")
                            if table_storico:
                                union_parts_today_min.append(f"SELECT MIN(created_at) AS activity_date FROM {table_storico} WHERE user_id = :user_id AND created_at >= :today_start AND created_at <= :today_end")
                                union_parts_today_max.append(f"SELECT MAX(updated_at) AS activity_date FROM {table_storico} WHERE user_id = :user_id AND updated_at >= :today_start AND updated_at <= :today_end")
                            
                            if union_parts_today_min and union_parts_today_max:
                                min_today_query = ' UNION ALL '.join(union_parts_today_min)
                                min_today_activity_query = sql_text(f"""
                                    WITH all_min_today_activities AS (
                                        {min_today_query}
                                    )
                                    SELECT MIN(activity_date) FROM all_min_today_activities
                                """)
                                result = await session.execute(
                                    min_today_activity_query, 
                                    {"user_id": user.id, "today_start": today_start, "today_end": today_end}
                                )
                                first_activity_today = result.scalar()
                                
                                max_today_query = ' UNION ALL '.join(union_parts_today_max)
                                max_today_activity_query = sql_text(f"""
                                    WITH all_max_today_activities AS (
                                        {max_today_query}
                                    )
                                    SELECT MAX(activity_date) FROM all_max_today_activities
                                """)
                                result = await session.execute(
                                    max_today_activity_query,
                                    {"user_id": user.id, "today_start": today_start, "today_end": today_end}
                                )
                                last_activity_today = result.scalar()
                                
                                # Calcola tempo oggi (differenza in secondi)
                                if first_activity_today and last_activity_today:
                                    time_diff_today = (last_activity_today - first_activity_today).total_seconds()
                                    stats.time_today_seconds = int(time_diff_today) if time_diff_today > 0 else 0
                    except Exception as e:
                        logger.debug(f"Errore calcolo tempo in app per user_id={user_id} (non critico): {e}")
            
            # Converti user a UserResponse con gestione errori robusta
            # Debug: log user object attributes
            logger.info(f"[GET_USER] User object attributes: id={user.id}, email={user.email}, business_name={user.business_name}")
            logger.info(f"[GET_USER] User first_name={getattr(user, 'first_name', 'NOT_FOUND')}, last_name={getattr(user, 'last_name', 'NOT_FOUND')}")
            logger.info(f"[GET_USER] User business_type={getattr(user, 'business_type', 'NOT_FOUND')}, location={getattr(user, 'location', 'NOT_FOUND')}, phone={getattr(user, 'phone', 'NOT_FOUND')}")
            
            # Converti user a UserResponse con gestione errori robusta
            try:
                user_dict = {
                    "id": user.id,
                    "email": user.email if user.email else None,
                    "business_name": user.business_name if user.business_name else None,
                    "username": user.username if user.username else None,
                    "telegram_id": user.telegram_id if user.telegram_id else None,
                    "first_name": getattr(user, 'first_name', None),
                    "last_name": getattr(user, 'last_name', None),
                    "business_type": getattr(user, 'business_type', None),
                    "location": getattr(user, 'location', None),
                    "phone": getattr(user, 'phone', None),
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                    "updated_at": user.updated_at.isoformat() if user.updated_at else None,
                    "onboarding_completed": bool(user.onboarding_completed) if user.onboarding_completed is not None else False
                }
                user_response = UserResponse.model_validate(user_dict)
                logger.info(f"[GET_USER] UserResponse created: {user_response.model_dump_json()}")
            except Exception as e:
                logger.error(f"Errore validazione UserResponse per user_id={user_id}: {e}", exc_info=True)
                # Fallback con dati minimi
                user_response = UserResponse(
                    id=user.id,
                    email=user.email if user.email else None,
                    business_name=user.business_name if user.business_name else None,
                    username=user.username if user.username else None,
                    telegram_id=user.telegram_id if user.telegram_id else None,
                    first_name=getattr(user, 'first_name', None),
                    last_name=getattr(user, 'last_name', None),
                    business_type=getattr(user, 'business_type', None),
                    location=getattr(user, 'location', None),
                    phone=getattr(user, 'phone', None),
                    created_at=user.created_at.isoformat() if user.created_at else None,
                    updated_at=user.updated_at.isoformat() if user.updated_at else None,
                    onboarding_completed=bool(user.onboarding_completed) if user.onboarding_completed is not None else False
                )
            
            result = UserWithStatsResponse(
                user=user_response,
                stats=stats
            )
            logger.info(f"[GET_USER] Returning UserWithStatsResponse: {result.model_dump_json()}")
            return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore recupero dettaglio utente user_id={user_id}: {e}", exc_info=True)
        import traceback
        logger.error(f"Traceback completo: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")


@router.post("/users/{user_id}/spectator-token")
async def create_spectator_mode_token(
    user_id: int,
    admin_user: dict = Depends(is_admin_user)
):
    """
    Genera token JWT per spectator mode (admin impersona utente).
    Il token permette di accedere alla web app come se fossi l'utente.
    """
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                raise HTTPException(status_code=404, detail="Utente non trovato")
            
            # Genera token spectator mode (valido 2 ore)
            spectator_token = create_spectator_token(
                user_id=user.id,
                telegram_id=user.telegram_id,
                business_name=user.business_name or "Unknown",
                admin_user_id=admin_user["user_id"],
                expires_in_hours=2
            )
            
            # Ottieni URL web app da configurazione
            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
            
            return {
                "spectator_token": spectator_token,
                "web_app_url": frontend_url,
                "redirect_url": f"{frontend_url}?spectator_token={spectator_token}",
                "expires_in_hours": 2
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore generazione spectator token per user_id={user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")


@router.post("/users")
async def create_user(
    business_name: str = Form(...),  # Solo business_name è obbligatorio
    username: Optional[str] = Form(None),
    email: Optional[EmailStr] = Form(None),
    password: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    file_type: Optional[str] = Form("csv"),
    admin_user: dict = Depends(is_admin_user)
):
    """
    Crea nuovo utente tramite Processor (onboarding).
    Solo business_name è obbligatorio. Username, email e password sono opzionali.
    Supporta upload file opzionale.
    """
    from app.core.auth import hash_password
    
    # Genera email se non fornita (basata su business_name)
    if not email or email.strip() == '':
        # Crea slug da business_name per email
        business_slug = re.sub(r'[^a-z0-9]+', '-', business_name.lower().strip())
        business_slug = re.sub(r'^-+|-+$', '', business_slug)  # Rimuovi trattini iniziali/finali
        if not business_slug:
            business_slug = 'user'
        # Aggiungi timestamp per unicità
        timestamp = int(datetime.utcnow().timestamp())
        email = f"{business_slug}-{timestamp}@temp.gio.ia"
        logger.info(f"[CREATE_USER] Email generata automaticamente: {email}")
    
    # Genera password se non fornita
    if not password or password.strip() == '':
        # Genera password random sicura (16 caratteri)
        password = secrets.token_urlsafe(12)
        logger.info(f"[CREATE_USER] Password generata automaticamente")
    
    # Crea utente nel database prima di chiamare Processor
    async with AsyncSessionLocal() as session:
        # Verifica email già esistente
        existing = await db_manager.get_user_by_email(email)
        if existing:
            raise HTTPException(status_code=400, detail="Email già registrata")
        
        # Crea utente
        password_hash = hash_password(password)
        user = await db_manager.create_user(
            email=email,
            password_hash=password_hash,
            business_name=business_name,
            telegram_id=None,
            username=username if username and username.strip() else None
        )
        
        # Se c'è un file, invialo a Processor per onboarding
        # Usa admin_insert_inventory (come admin bot) invece di process_inventory
        # per inserimento diretto senza pipeline che potrebbe modificare i dati
        if file:
            try:
                # PRIMA crea le tabelle per assicurarsi che esistano
                # Questo garantisce che l'utente sia visibile nel database di Processor
                # e che le tabelle siano create prima dell'inserimento
                await processor_client.create_tables(
                    user_id=user.id,
                    business_name=business_name
                )
                
                file_content = await file.read()
                file_name = file.filename or f"onboarding_{user.id}.{file_type}"
                
                # POI inserisci l'inventario usando admin_insert_inventory (stesso comportamento admin bot)
                # mode="replace" per sostituire inventario esistente (se presente)
                result = await processor_client.admin_insert_inventory(
                    user_id=user.id,
                    business_name=business_name,
                    file_content=file_content,
                    file_name=file_name,
                    mode="replace"  # Replace per onboarding: sostituisce inventario esistente
                )
                
                return {
                    "user_id": user.id,
                    "message": "Utente creato e file processato",
                    "job_id": result.get("job_id"),
                    "status": result.get("status")
                }
            except Exception as e:
                logger.error(f"Errore processamento file onboarding: {e}", exc_info=True)
                return {
                    "user_id": user.id,
                    "message": "Utente creato ma errore processamento file",
                    "error": str(e)
                }
        else:
            # Crea solo le tabelle senza file
            try:
                result = await processor_client.create_tables(
                    user_id=user.id,
                    business_name=business_name
                )
                return {
                    "user_id": user.id,
                    "message": "Utente creato e tabelle inizializzate",
                    "tables_created": result.get("tables_created", [])
                }
            except Exception as e:
                logger.error(f"Errore creazione tabelle: {e}", exc_info=True)
                return {
                    "user_id": user.id,
                    "message": "Utente creato ma errore creazione tabelle",
                    "error": str(e)
                }


@router.get("/whoami")
async def whoami_admin(
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint di debug per verificare autenticazione e stato admin.
    Non richiede admin, solo autenticazione.
    """
    user: User = current_user.get("user")
    admin_email = (ADMIN_EMAIL or "").strip().lower()
    
    if not user:
        return {
            "authenticated": False,
            "error": "User not found in token",
            "current_user_keys": list(current_user.keys()) if current_user else None
        }
    
    user_email = (user.email or "").strip().lower() if user.email else None
    is_admin = user_email == admin_email if user_email else False
    
    return {
        "authenticated": True,
        "user_id": user.id,
        "email": user.email,
        "email_normalized": user_email,
        "business_name": user.business_name,
        "admin_email": admin_email,
        "is_admin": is_admin,
        "token_user_id": current_user.get("user_id"),
        "token_business_name": current_user.get("business_name")
    }


@router.get("/dashboard/kpi", response_model=DashboardKPIResponse)
async def get_dashboard_kpi(
    admin_user: dict = Depends(is_admin_user)
):
    """
    Ottiene KPI dashboard per admin panel.
    """
    async with AsyncSessionLocal() as session:
        try:
            # Count totale utenti
            count_users_query = select(func.count(User.id))
            result = await session.execute(count_users_query)
            total_users = result.scalar() or 0
            
            # Per ora, restituiamo valori mock per active_jobs, errors_24h, files_uploaded_7d
            # Questi verranno implementati quando avremo il nuovo database per KPI
            return DashboardKPIResponse(
                total_users=total_users,
                active_jobs=0,  # TODO: Implementare quando disponibile
                errors_24h=0,  # TODO: Implementare quando disponibile
                files_uploaded_7d=0  # TODO: Implementare quando disponibile
            )
        except Exception as e:
            logger.error(f"Errore calcolo KPI dashboard: {e}", exc_info=True)
            # Restituisci valori di default in caso di errore
            return DashboardKPIResponse()


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UpdateUserRequest,
    admin_user: dict = Depends(is_admin_user)
):
    """
    Modifica utente (email, business_name, password).
    """
    from app.core.auth import hash_password
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="Utente non trovato")
        
        # Aggiorna campi
        if data.email is not None:
            # Verifica email non duplicata
            existing = await db_manager.get_user_by_email(data.email)
            if existing and existing.id != user_id:
                raise HTTPException(status_code=400, detail="Email già registrata")
            user.email = data.email.lower().strip()
        
        if data.username is not None:
            user.username = data.username.strip() if data.username else None
        
        if data.business_name is not None:
            user.business_name = data.business_name.strip() if data.business_name else None
        
        if data.password is not None and data.password.strip() != '':
            user.password_hash = hash_password(data.password)
        
        if data.first_name is not None:
            user.first_name = data.first_name.strip() if data.first_name else None
        
        if data.last_name is not None:
            user.last_name = data.last_name.strip() if data.last_name else None
        
        if data.business_type is not None:
            user.business_type = data.business_type.strip() if data.business_type else None
        
        if data.location is not None:
            user.location = data.location.strip() if data.location else None
        
        if data.phone is not None:
            user.phone = data.phone.strip() if data.phone else None
        
        user.updated_at = datetime.utcnow()
        await session.commit()
        await session.refresh(user)
        
        return UserResponse.model_validate(user)


# Endpoint Tabelle Utente
@router.get("/users/{user_id}/tables/{table_name}", response_model=PaginatedTableResponse)
async def get_user_table(
    user_id: int,
    table_name: str,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    sort: Optional[str] = Query(None),
    admin_user: dict = Depends(is_admin_user)
):
    """
    Query tabella dinamica utente con paginazione.
    """
    user, business_name = await get_user_table_info(user_id)
    if not user or not business_name:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    # Decodifica nome tabella (rimuovi encoding URL)
    table_name_decoded = table_name.replace("%20", " ")
    
    # Costruisci nome tabella completo
    full_table_name = get_user_table_name(user.id, business_name, table_name_decoded)
    
    async with AsyncSessionLocal() as session:
        try:
            # Count totale
            count_query = sql_text(f"""
                SELECT COUNT(*) FROM {full_table_name}
                WHERE user_id = :user_id
            """)
            result = await session.execute(count_query, {"user_id": user.id})
            total = result.scalar() or 0
            
            # Query dati con paginazione
            offset = (page - 1) * limit
            order_by = "id DESC"
            if sort:
                # Supporta sort come "name ASC" o "created_at DESC"
                order_by = sort
            
            data_query = sql_text(f"""
                SELECT * FROM {full_table_name}
                WHERE user_id = :user_id
                ORDER BY {order_by}
                LIMIT :limit OFFSET :offset
            """)
            
            result = await session.execute(data_query, {
                "user_id": user.id,
                "limit": limit,
                "offset": offset
            })
            
            rows = result.fetchall()
            
            # Converti righe in dict
            data = []
            for row in rows:
                row_dict = {}
                for key, value in row._mapping.items():
                    # Converti datetime in string
                    if hasattr(value, 'isoformat'):
                        row_dict[key] = value.isoformat()
                    else:
                        row_dict[key] = value
                data.append(row_dict)
            
            return PaginatedTableResponse(
                data=data,
                total=total,
                page=page,
                limit=limit
            )
            
        except Exception as e:
            logger.error(f"Errore query tabella {full_table_name}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Errore query tabella: {str(e)}")


@router.patch("/users/{user_id}/tables/{table_name}/{row_id}")
async def update_table_row(
    user_id: int,
    table_name: str,
    row_id: int,
    data: UpdateTableRowRequest,
    admin_user: dict = Depends(is_admin_user)
):
    """
    Aggiorna riga in tabella dinamica utente.
    """
    user, business_name = await get_user_table_info(user_id)
    if not user or not business_name:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    table_name_decoded = table_name.replace("%20", " ")
    full_table_name = get_user_table_name(user.id, business_name, table_name_decoded)
    
    async with AsyncSessionLocal() as session:
        try:
            # Costruisci UPDATE dinamico
            update_fields = []
            params = {"row_id": row_id, "user_id": user.id}
            
            for key, value in data.model_dump(exclude_unset=True).items():
                if key not in ["id", "user_id"]:  # Non permettere modifica ID
                    update_fields.append(f"{key} = :{key}")
                    params[key] = value
            
            if not update_fields:
                raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
            
            # Aggiungi updated_at se esiste
            try:
                check_updated_at = sql_text(f"""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = :table_name AND column_name = 'updated_at'
                """)
                result = await session.execute(check_updated_at, {"table_name": full_table_name.replace('"', '')})
                if result.fetchone():
                    update_fields.append("updated_at = CURRENT_TIMESTAMP")
            except:
                pass
            
            update_query = sql_text(f"""
                UPDATE {full_table_name}
                SET {', '.join(update_fields)}
                WHERE id = :row_id AND user_id = :user_id
                RETURNING *
            """)
            
            result = await session.execute(update_query, params)
            row = result.fetchone()
            
            if not row:
                raise HTTPException(status_code=404, detail="Riga non trovata")
            
            await session.commit()
            
            # Converti risultato in dict
            row_dict = {}
            for key, value in row._mapping.items():
                if hasattr(value, 'isoformat'):
                    row_dict[key] = value.isoformat()
                else:
                    row_dict[key] = value
            
            return row_dict
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Errore update riga {row_id} in {full_table_name}: {e}", exc_info=True)
            await session.rollback()
            raise HTTPException(status_code=500, detail=f"Errore aggiornamento: {str(e)}")


@router.delete("/users/{user_id}/tables/{table_name}/{row_id}")
async def delete_table_row(
    user_id: int,
    table_name: str,
    row_id: int,
    admin_user: dict = Depends(is_admin_user)
):
    """
    Elimina riga da tabella dinamica utente.
    """
    user, business_name = await get_user_table_info(user_id)
    if not user or not business_name:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    table_name_decoded = table_name.replace("%20", " ")
    full_table_name = get_user_table_name(user.id, business_name, table_name_decoded)
    
    async with AsyncSessionLocal() as session:
        try:
            delete_query = sql_text(f"""
                DELETE FROM {full_table_name}
                WHERE id = :row_id AND user_id = :user_id
                RETURNING id
            """)
            
            result = await session.execute(delete_query, {
                "row_id": row_id,
                "user_id": user.id
            })
            
            deleted = result.fetchone()
            if not deleted:
                raise HTTPException(status_code=404, detail="Riga non trovata")
            
            await session.commit()
            return {"message": "Riga eliminata con successo", "id": row_id}
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Errore delete riga {row_id} da {full_table_name}: {e}", exc_info=True)
            await session.rollback()
            raise HTTPException(status_code=500, detail=f"Errore eliminazione: {str(e)}")


@router.post("/users/{user_id}/tables/{table_name}")
async def create_table_row(
    user_id: int,
    table_name: str,
    data: CreateTableRowRequest,
    admin_user: dict = Depends(is_admin_user)
):
    """
    Crea nuova riga in tabella dinamica utente.
    """
    user, business_name = await get_user_table_info(user_id)
    if not user or not business_name:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    table_name_decoded = table_name.replace("%20", " ")
    full_table_name = get_user_table_name(user.id, business_name, table_name_decoded)
    
    async with AsyncSessionLocal() as session:
        try:
            # Ottieni colonne della tabella
            columns_query = sql_text("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = :table_name
                ORDER BY ordinal_position
            """)
            result = await session.execute(columns_query, {"table_name": full_table_name.replace('"', '')})
            columns = {row[0]: row[1] for row in result.fetchall()}
            
            # Prepara INSERT
            insert_fields = ["user_id"]
            insert_values = [":user_id"]
            params = {"user_id": user.id}
            
            for key, value in data.model_dump(exclude_unset=True).items():
                if key in columns and key != "id":  # id è auto-increment
                    insert_fields.append(key)
                    insert_values.append(f":{key}")
                    params[key] = value
            
            # Aggiungi created_at se esiste
            if "created_at" in columns:
                insert_fields.append("created_at")
                insert_values.append("CURRENT_TIMESTAMP")
            
            insert_query = sql_text(f"""
                INSERT INTO {full_table_name} ({', '.join(insert_fields)})
                VALUES ({', '.join(insert_values)})
                RETURNING *
            """)
            
            result = await session.execute(insert_query, params)
            row = result.fetchone()
            
            if not row:
                raise HTTPException(status_code=500, detail="Errore creazione riga")
            
            await session.commit()
            
            # Converti risultato in dict
            row_dict = {}
            for key, value in row._mapping.items():
                if hasattr(value, 'isoformat'):
                    row_dict[key] = value.isoformat()
                else:
                    row_dict[key] = value
            
            return row_dict
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Errore creazione riga in {full_table_name}: {e}", exc_info=True)
            await session.rollback()
            raise HTTPException(status_code=500, detail=f"Errore creazione: {str(e)}")
