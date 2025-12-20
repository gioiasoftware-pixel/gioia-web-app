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


# ⚠️ TEMPORANEO: Password in chiaro per debug
# TODO: Quando implementiamo recupero password, tornare ad usare hash bcrypt
PASSWORD_PLAINTEXT_MODE = True  # Cambia a False per tornare ad hash

def hash_password(password: str) -> str:
    """
    'Hash' password - TEMPORANEAMENTE salva in chiaro per debug.
    Quando implementiamo recupero password, tornare ad usare bcrypt.
    """
    if PASSWORD_PLAINTEXT_MODE:
        # MODALITÀ DEBUG: salva password in chiaro
        logger.warning("[AUTH] ⚠️ MODALITÀ DEBUG: Password salvata in chiaro!")
        return password.strip()
    else:
        # MODALITÀ PRODUZIONE: hash con bcrypt
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        return hashed.decode('utf-8')


def verify_password(plain_password: str, stored_password: str) -> bool:
    """
    Verifica password - TEMPORANEAMENTE confronta in chiaro per debug.
    Quando implementiamo recupero password, tornare ad usare bcrypt.
    """
    try:
        if not stored_password:
            logger.warning("[AUTH] Password vuota nel database")
            return False
        
        if not plain_password:
            logger.warning("[AUTH] Password vuota inserita")
            return False
        
        # Pulisci entrambi i valori
        plain_password_clean = plain_password.strip()
        stored_password_clean = stored_password.strip()
        
        if PASSWORD_PLAINTEXT_MODE:
            # MODALITÀ DEBUG: confronto diretto
            result = plain_password_clean == stored_password_clean
            logger.debug(f"[AUTH] Verifica password (plaintext): result={result}, password_len={len(plain_password_clean)}")
            return result
        else:
            # MODALITÀ PRODUZIONE: verifica hash bcrypt
            # Verifica che l'hash sia nel formato corretto (deve iniziare con $2b$)
            if not stored_password_clean.startswith('$2b$'):
                logger.error(f"[AUTH] Hash password formato non valido: inizia con '{stored_password_clean[:20]}' invece di '$2b$'")
                return False
            
            # Verifica lunghezza hash (bcrypt hash dovrebbe essere ~60 caratteri)
            if len(stored_password_clean) < 60:
                logger.error(f"[AUTH] Hash password troppo corto: {len(stored_password_clean)} caratteri invece di ~60")
                return False
            
            result = bcrypt.checkpw(
                plain_password_clean.encode('utf-8'),
                stored_password_clean.encode('utf-8')
            )
            
            logger.debug(f"[AUTH] Verifica password (bcrypt): result={result}, password_len={len(plain_password_clean)}, hash_len={len(stored_password_clean)}")
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


def create_spectator_token(
    user_id: int,
    telegram_id: Optional[int],
    business_name: str,
    admin_user_id: int,
    expires_in_hours: int = 2
) -> str:
    """
    Crea JWT token temporaneo per spectator mode (admin impersona utente).
    
    Args:
        user_id: ID utente da impersonare
        telegram_id: ID Telegram utente (opzionale)
        business_name: Nome business utente
        admin_user_id: ID admin che sta impersonando
        expires_in_hours: Durata token (default 2 ore)
    """
    settings = get_settings()
    expire = datetime.utcnow() + timedelta(hours=expires_in_hours)
    
    payload = {
        "user_id": user_id,
        "telegram_id": telegram_id,
        "business_name": business_name,
        "exp": expire,
        "type": "spectator_access",
        "admin_user_id": admin_user_id,  # ID admin per tornare al control panel
        "is_spectator": True
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
            logger.debug(f"[AUTH] get_current_user: cercato user_id={user_id}, trovato={user is not None}")
            if user:
                logger.debug(f"[AUTH] get_current_user: user_id={user.id}, email={user.email}, business_name={user.business_name}")
    elif telegram_id:
        user = await db_manager.get_user_by_telegram_id(telegram_id)
        logger.debug(f"[AUTH] get_current_user: cercato telegram_id={telegram_id}, trovato={user is not None}")
    else:
        logger.warning("[AUTH] get_current_user: token malformato, manca user_id e telegram_id")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token malformato: manca user_id o telegram_id",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user:
        logger.warning(f"[AUTH] get_current_user: utente non trovato nel database, user_id={user_id}, telegram_id={telegram_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utente non trovato"
        )
    
    return {
        "user_id": user.id,
        "telegram_id": user.telegram_id,
        "business_name": user.business_name or business_name,
        "user": user,
        "is_spectator": payload.get("is_spectator", False),
        "admin_user_id": payload.get("admin_user_id") if payload.get("is_spectator") else None
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

