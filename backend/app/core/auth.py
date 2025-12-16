"""
Autenticazione JWT per web app
"""
import os
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import get_settings
from app.core.database import db_manager, AsyncSessionLocal
import bcrypt

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    """Hash password con bcrypt"""
    # Genera salt e hash password
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica password contro hash"""
    try:
        if not hashed_password:
            logger.warning("[AUTH] Hash password vuoto")
            return False
        
        if not plain_password:
            logger.warning("[AUTH] Password vuota")
            return False
        
        # Verifica che l'hash sia nel formato corretto (deve iniziare con $2b$)
        if not hashed_password.startswith('$2b$'):
            logger.error(f"[AUTH] Hash password formato non valido: inizia con '{hashed_password[:10]}' invece di '$2b$'")
            return False
        
        result = bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
        
        logger.debug(f"[AUTH] Verifica password: result={result}, hash_length={len(hashed_password)}")
        return result
    except Exception as e:
        logger.error(f"[AUTH] Errore verifica password: {e}", exc_info=True)
        return False

security = HTTPBearer()


def create_access_token(
    user_id: int,
    telegram_id: Optional[int],
    business_name: str,
    remember_me: bool = False
) -> str:
    """
    Crea JWT token per utente autenticato.
    
    Args:
        user_id: ID utente nel database
        telegram_id: ID Telegram (opzionale, può essere None per utenti web-only)
        business_name: Nome business
        remember_me: Se True, token valido più a lungo (30 giorni invece di 7)
    """
    settings = get_settings()
    
    # Se remember_me, token valido 30 giorni, altrimenti usa configurazione default
    if remember_me:
        expire_hours = 30 * 24  # 30 giorni
    else:
        expire_hours = settings.ACCESS_TOKEN_EXPIRE_HOURS
    
    expire = datetime.utcnow() + timedelta(hours=expire_hours)
    
    payload = {
        "user_id": user_id,
        "telegram_id": telegram_id,
        "business_name": business_name,
        "exp": expire,
        "type": "user_access",
        "remember_me": remember_me
    }
    
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )


def create_viewer_token(telegram_id: int, business_name: str, expires_in_hours: int = 24) -> str:
    """Crea JWT token temporaneo per viewer condivisibile."""
    settings = get_settings()
    expire = datetime.utcnow() + timedelta(hours=expires_in_hours)
    
    payload = {
        "telegram_id": telegram_id,
        "business_name": business_name,
        "exp": expire,
        "type": "viewer_share"
    }
    
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )


def validate_token(token: str) -> Optional[Dict]:
    """Valida JWT token e restituisce payload."""
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError as e:
        logger.warning(f"[AUTH] Token JWT non valido: {e}")
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """
    Dependency per ottenere utente corrente da JWT token.
    Protegge endpoint che richiedono autenticazione.
    """
    token = credentials.credentials
    payload = validate_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token non valido o scaduto",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if payload.get("type") != "user_access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tipo token non valido",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("user_id")
    telegram_id = payload.get("telegram_id")
    business_name = payload.get("business_name")
    
    if not user_id or not business_name:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token malformato",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verifica che utente esista nel database
    # Usa user_id se disponibile, altrimenti telegram_id per retrocompatibilità
    if user_id:
        from sqlalchemy import select
        from app.core.database import AsyncSessionLocal, User
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
    elif telegram_id:
        user = await db_manager.get_user_by_telegram_id(telegram_id)
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token malformato: manca user_id o telegram_id",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utente non trovato"
        )
    
    return {
        "user_id": user.id,
        "telegram_id": user.telegram_id,
        "business_name": user.business_name or business_name,
        "user": user
    }


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))
) -> Optional[Dict]:
    """
    Dependency opzionale per ottenere utente corrente.
    Non solleva eccezione se token mancante (per endpoint pubblici).
    """
    if not credentials:
        return None
    
    return await get_current_user(credentials)
