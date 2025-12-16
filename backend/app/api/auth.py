"""
API endpoints per autenticazione
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
import logging

from app.core.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password
)
from app.core.database import db_manager, AsyncSessionLocal, User
from app.core.processor_client import processor_client
from sqlalchemy import select
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    business_name: str  # Nome del tuo locale
    telegram_id: Optional[int] = None  # Opzionale: per utenti Telegram esistenti


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    telegram_id: Optional[int]
    business_name: Optional[str] = None
    onboarding_completed: bool


class UserInfo(BaseModel):
    user_id: int
    telegram_id: Optional[int]
    business_name: Optional[str]
    email: Optional[str]
    username: Optional[str]
    first_name: Optional[str]
    onboarding_completed: bool


@router.post("/signup", response_model=LoginResponse)
async def signup(signup_request: SignupRequest):
    """
    Registrazione nuovo utente.
    
    Se telegram_id fornito e utente esiste già con onboarding completato:
    - Aggiorna solo email e password nella riga esistente
    
    Altrimenti:
    - Crea nuovo utente
    - Se telegram_id fornito, lo associa all'utente
    """
    email = signup_request.email.lower().strip()
    password = signup_request.password
    business_name = signup_request.business_name.strip()
    telegram_id = signup_request.telegram_id
    
    # Validazione password
    if len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="La password deve essere di almeno 8 caratteri"
        )
    
    # Verifica se email già esistente
    existing_user_by_email = await db_manager.get_user_by_email(email)
    if existing_user_by_email:
        raise HTTPException(
            status_code=400,
            detail="Email già registrata"
        )
    
    # Hash password
    password_hash = hash_password(password)
    logger.info(f"[AUTH] Password hashata durante signup: hash_length={len(password_hash)}, hash_prefix={password_hash[:10]}...")
    
    # Caso speciale: telegram_id fornito e utente Telegram esiste già con onboarding completato
    if telegram_id:
        existing_user_by_telegram = await db_manager.get_user_by_telegram_id(telegram_id)
        
        if existing_user_by_telegram:
            if existing_user_by_telegram.onboarding_completed:
                # Utente Telegram esistente con onboarding completato
                # Aggiorna solo email e password
                success = await db_manager.update_user_email_password(
                    telegram_id=telegram_id,
                    email=email,
                    password_hash=password_hash
                )
                
                if not success:
                    raise HTTPException(
                        status_code=500,
                        detail="Errore aggiornamento utente esistente"
                    )
                
                user = await db_manager.get_user_by_telegram_id(telegram_id)
                logger.info(f"[AUTH] Email/password aggiunte a utente Telegram esistente: telegram_id={telegram_id}, email={email}, user_id={user.id}")
                
                # Genera token
                token = create_access_token(
                    user_id=user.id,
                    telegram_id=user.telegram_id,
                    business_name=user.business_name or business_name,
                    remember_me=False
                )
                
                return LoginResponse(
                    access_token=token,
                    token_type="bearer",
                    user_id=user.id,
                    telegram_id=user.telegram_id,
                    business_name=user.business_name,
                    onboarding_completed=user.onboarding_completed
                )
            else:
                # Utente Telegram esiste ma onboarding non completato
                # Aggiorna email/password e business_name se non presente
                async with AsyncSessionLocal() as session:
                    result = await session.execute(
                        select(User).where(User.telegram_id == telegram_id)
                    )
                    user_to_update = result.scalar_one_or_none()
                    if user_to_update:
                        if not user_to_update.business_name:
                            user_to_update.business_name = business_name
                        user_to_update.email = email.lower().strip()  # Normalizza email
                        user_to_update.password_hash = password_hash
                        user_to_update.updated_at = datetime.utcnow()
                        session.add(user_to_update)
                        await session.commit()
                        await session.refresh(user_to_update)
                        user = user_to_update
                    else:
                        raise HTTPException(status_code=500, detail="Errore aggiornamento utente")
                
                logger.info(f"[AUTH] Utente Telegram aggiornato con email/password: telegram_id={telegram_id}, user_id={user.id}, business_name={user.business_name}")
                
                token = create_access_token(
                    user_id=user.id,
                    telegram_id=user.telegram_id,
                    business_name=user.business_name,
                    remember_me=False
                )
                
                return LoginResponse(
                    access_token=token,
                    token_type="bearer",
                    user_id=user.id,
                    telegram_id=user.telegram_id,
                    business_name=user.business_name,
                    onboarding_completed=user.onboarding_completed
                )
    
    # Caso normale: crea nuovo utente
    user = await db_manager.create_user(
        email=email,
        password_hash=password_hash,
        business_name=business_name,
        telegram_id=telegram_id
    )
    
    logger.info(f"[AUTH] Nuovo utente creato: email={email}, user_id={user.id}, telegram_id={telegram_id}, business_name={user.business_name}")
    
    # Genera token
    token = create_access_token(
        user_id=user.id,
        telegram_id=user.telegram_id,
        business_name=user.business_name,
        remember_me=False
    )
    
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        telegram_id=user.telegram_id,
        business_name=user.business_name,
        onboarding_completed=user.onboarding_completed
    )


@router.post("/login", response_model=LoginResponse)
async def login(login_request: LoginRequest):
    """
    Login utente con email e password.
    Supporta "ricordami" per token con scadenza più lunga.
    """
    email = login_request.email.lower().strip()
    password = login_request.password
    remember_me = login_request.remember_me
    
    logger.info(f"[AUTH] Tentativo login: email={email}")
    
    # Trova utente per email (get_user_by_email già normalizza in lowercase)
    user = await db_manager.get_user_by_email(email)
    if not user:
        logger.warning(f"[AUTH] Login fallito: email non trovata: {email}")
        raise HTTPException(
            status_code=401,
            detail="Email o password non corretti"
        )
    
    logger.info(f"[AUTH] Utente trovato: user_id={user.id}, email_db={user.email}, has_password={bool(user.password_hash)}")
    
    # Verifica password
    if not user.password_hash:
        logger.warning(f"[AUTH] Utente {user.id} non ha password_hash")
        raise HTTPException(
            status_code=401,
            detail="Account non configurato. Completa la registrazione."
        )
    
    # Verifica password con logging dettagliato
    password_hash_clean = user.password_hash.strip() if user.password_hash else None
    password_clean = password.strip()
    
    logger.info(f"[AUTH] Verifica password:")
    logger.info(f"  - password_hash_length={len(password_hash_clean) if password_hash_clean else 0}")
    logger.info(f"  - hash_prefix={password_hash_clean[:15] if password_hash_clean else 'None'}...")
    logger.info(f"  - hash_suffix=...{password_hash_clean[-10:] if password_hash_clean and len(password_hash_clean) > 10 else 'None'}")
    logger.info(f"  - password_length={len(password_clean)}")
    logger.info(f"  - password_starts_with={password_clean[:3] if len(password_clean) >= 3 else 'N/A'}...")
    
    # Verifica formato hash
    if password_hash_clean and not password_hash_clean.startswith('$2b$'):
        logger.error(f"[AUTH] Hash password formato non valido! Inizia con: '{password_hash_clean[:20]}'")
        raise HTTPException(
            status_code=500,
            detail="Errore configurazione password. Contatta l'amministratore."
        )
    
    password_valid = verify_password(password_clean, password_hash_clean)
    logger.info(f"[AUTH] Risultato verifica password: {password_valid}")
    
    if not password_valid:
        logger.warning(f"[AUTH] Login fallito: password non corretta per email={email}, user_id={user.id}")
        raise HTTPException(
            status_code=401,
            detail="Email o password non corretti"
        )
    
    # Genera token JWT
    business_name = user.business_name or "Unknown"
    token = create_access_token(
        user_id=user.id,
        telegram_id=user.telegram_id,
        business_name=business_name,
        remember_me=remember_me
    )
    
    logger.info(f"[AUTH] Login effettuato: email={email}, user_id={user.id}, telegram_id={user.telegram_id}, remember_me={remember_me}")
    
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        telegram_id=user.telegram_id,
        business_name=user.business_name,
        onboarding_completed=user.onboarding_completed
    )


@router.get("/me", response_model=UserInfo)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Ottiene informazioni utente corrente autenticato.
    """
    user = current_user["user"]
    
    return UserInfo(
        user_id=user.id,
        telegram_id=user.telegram_id,
        business_name=user.business_name,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        onboarding_completed=user.onboarding_completed
    )
