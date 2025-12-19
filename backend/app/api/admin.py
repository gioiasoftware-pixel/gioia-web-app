"""
API endpoints per admin panel.
Gestisce utenti, tabelle dinamiche e integrazione con Processor.
"""
import logging
import os
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query, Body, UploadFile, File, Form
from pydantic import BaseModel, EmailStr, ConfigDict
from sqlalchemy import select, text as sql_text, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, User, db_manager
from app.core.auth import get_current_user
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
    """
    user: User = current_user.get("user")
    if not user or not user.email:
        raise HTTPException(status_code=403, detail="Accesso negato")
    
    if user.email.lower() != ADMIN_EMAIL.lower():
        raise HTTPException(status_code=403, detail="Accesso negato: solo admin")
    
    return current_user


# Modelli Pydantic
class UserResponse(BaseModel):
    id: int
    email: Optional[str]
    business_name: Optional[str]
    username: Optional[str]
    telegram_id: Optional[int]
    created_at: Optional[str]
    updated_at: Optional[str]
    onboarding_completed: bool

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
    business_name: Optional[str] = None
    password: Optional[str] = None


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
    """
    return f'"{user_id}/{business_name} {table_type}"'


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
            
            return PaginatedUsersResponse(
                data=[UserResponse.model_validate(u) for u in users],
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
            try:
                # Tabella INVENTARIO
                table_inventario = get_user_table_name(user.id, user.business_name, "INVENTARIO")
                count_query = sql_text(f"""
                    SELECT COUNT(*) FROM {table_inventario}
                    WHERE user_id = :user_id
                """)
                result = await session.execute(count_query, {"user_id": user.id})
                stats.total_wines = result.scalar() or 0
                
                # Tabella LOG interazione
                table_log = get_user_table_name(user.id, user.business_name, "LOG interazione")
                count_query = sql_text(f"""
                    SELECT COUNT(*) FROM {table_log}
                    WHERE user_id = :user_id
                """)
                result = await session.execute(count_query, {"user_id": user.id})
                stats.total_logs = result.scalar() or 0
                
                # Tabella Consumi e rifornimenti
                table_consumi = get_user_table_name(user.id, user.business_name, "Consumi e rifornimenti")
                count_query = sql_text(f"""
                    SELECT COUNT(*) FROM {table_consumi}
                    WHERE user_id = :user_id
                """)
                result = await session.execute(count_query, {"user_id": user.id})
                stats.total_consumi = result.scalar() or 0
                
                # Tabella Storico vino
                table_storico = get_user_table_name(user.id, user.business_name, "Storico vino")
                count_query = sql_text(f"""
                    SELECT COUNT(*) FROM {table_storico}
                    WHERE user_id = :user_id
                """)
                result = await session.execute(count_query, {"user_id": user.id})
                stats.total_storico = result.scalar() or 0
                
                # Ultima attività (max updated_at da tutte le tabelle)
                last_activity_query = sql_text(f"""
                    SELECT MAX(updated_at) FROM (
                        SELECT updated_at FROM {table_inventario} WHERE user_id = :user_id
                        UNION ALL
                        SELECT created_at FROM {table_log} WHERE user_id = :user_id
                        UNION ALL
                        SELECT created_at FROM {table_consumi} WHERE user_id = :user_id
                        UNION ALL
                        SELECT created_at FROM {table_storico} WHERE user_id = :user_id
                    ) AS all_activities
                """)
                result = await session.execute(last_activity_query, {"user_id": user.id})
                last_activity = result.scalar()
                if last_activity:
                    stats.last_activity = last_activity.isoformat()
                    
            except Exception as e:
                logger.warning(f"Errore calcolo statistiche per user_id={user_id}: {e}")
        
        return UserWithStatsResponse(
            user=UserResponse.model_validate(user),
            stats=stats
        )


@router.post("/users")
async def create_user(
    username: str = Form(...),
    email: EmailStr = Form(...),
    password: str = Form(...),
    business_name: str = Form(...),
    file: Optional[UploadFile] = File(None),
    file_type: Optional[str] = Form("csv"),
    admin_user: dict = Depends(is_admin_user)
):
    """
    Crea nuovo utente tramite Processor (onboarding).
    Supporta upload file opzionale.
    """
    from app.core.auth import hash_password
    
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
            telegram_id=None
        )
        
        # Se c'è un file, invialo a Processor per onboarding
        if file:
            try:
                file_content = await file.read()
                file_name = file.filename or f"onboarding_{user.id}.{file_type}"
                
                # Chiama Processor per processare il file
                result = await processor_client.process_inventory(
                    user_id=user.id,
                    business_name=business_name,
                    file_type=file_type or "csv",
                    file_content=file_content,
                    file_name=file_name,
                    mode="add"
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
        if data.email:
            # Verifica email non duplicata
            existing = await db_manager.get_user_by_email(data.email)
            if existing and existing.id != user_id:
                raise HTTPException(status_code=400, detail="Email già registrata")
            user.email = data.email.lower().strip()
        
        if data.business_name:
            user.business_name = data.business_name
        
        if data.password:
            user.password_hash = hash_password(data.password)
        
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
