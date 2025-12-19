"""
Database async per web app - Gestione utenti e inventario vini
Reuse da telegram-ai-bot con adattamenti per web app
"""
import os
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, text as sql_text, Column, Integer, BigInteger, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Base per i modelli SQLAlchemy
Base = declarative_base()

# MODELLI
class User(Base):
    """Modello per gli utenti"""
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    telegram_id = Column(BigInteger, unique=True, nullable=True, index=True)  # Nullable per utenti web-only (può essere None)
    username = Column(String(100))
    first_name = Column(String(100))
    last_name = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Dati onboarding
    business_name = Column(String(200))
    business_type = Column(String(100))
    location = Column(String(200))
    phone = Column(String(50))
    email = Column(String(200), unique=True, index=True)  # Email univoca per login
    password_hash = Column(String(255))  # Hash password per login web
    onboarding_completed = Column(Boolean, default=False)


class Wine(Base):
    """Modello per l'inventario vini (per fallback)"""
    __tablename__ = 'wines'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    name = Column(String(200), nullable=False)
    producer = Column(String(200))
    vintage = Column(Integer)
    grape_variety = Column(String(200))
    region = Column(String(200))
    country = Column(String(100))
    wine_type = Column(String(50))
    classification = Column(String(100))
    quantity = Column(Integer, default=0)
    min_quantity = Column(Integer, default=0)
    cost_price = Column(Float)
    selling_price = Column(Float)
    alcohol_content = Column(Float)
    description = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Configurazione database
def get_database_url() -> str:
    """Ottiene DATABASE_URL dalla configurazione."""
    settings = get_settings()
    database_url = settings.DATABASE_URL
    
    # Converte URL Railway in formato SQLAlchemy
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    # Converti a asyncpg per async
    if not database_url.startswith("postgresql+asyncpg://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    return database_url


# ENGINE ASYNC
database_url = get_database_url()
engine = create_async_engine(
    database_url,
    pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
    max_overflow=0,
    pool_pre_ping=True,
    echo=False,
)

# SESSION FACTORY ASYNC
AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession
)


async def get_db() -> AsyncSession:
    """Dependency per ottenere sessione database."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


class DatabaseManager:
    """Gestore database async per web app"""
    
    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        """
        Trova utente per User ID.
        """
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            return result.scalar_one_or_none()
    
    async def get_user_by_telegram_id(self, telegram_id: int) -> Optional[User]:
        """
        DEPRECATO: Usa get_user_by_id invece.
        Mantenuto solo per retrocompatibilità.
        """
        return await self.get_user_by_id(telegram_id)
    
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Trova utente per email (normalizza sempre in lowercase)"""
        email_normalized = email.lower().strip()
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.email == email_normalized)
            )
            user = result.scalar_one_or_none()
            if user:
                logger.debug(f"[DB] Utente trovato per email: {email_normalized}, user_id={user.id}")
            else:
                logger.debug(f"[DB] Nessun utente trovato per email: {email_normalized}")
            return user
    
    async def get_user_wines(self, user_id: int) -> List[Wine]:
        """Ottiene vini utente da tabelle dinamiche"""
        async with AsyncSessionLocal() as session:
            user = await self.get_user_by_id(user_id)
            if not user or not user.business_name:
                logger.warning(f"[DB] User user_id={user_id} non trovato o business_name mancante")
                return []
            
            # Usa user.id per nome tabella
            table_name = f'"{user.id}/{user.business_name} INVENTARIO"'
            
            try:
                query = sql_text(f"""
                    SELECT * FROM {table_name} 
                    WHERE user_id = :user_id
                    ORDER BY name
                """)
                
                result = await session.execute(query, {"user_id": user.id})
                rows = result.fetchall()
                
                # Converti le righe in oggetti Wine
                wines = []
                for row in rows:
                    wine_dict = {
                        'id': row.id,
                        'user_id': row.user_id,
                        'name': row.name,
                        'producer': row.producer,
                        'vintage': row.vintage,
                        'grape_variety': row.grape_variety,
                        'region': row.region,
                        'country': row.country,
                        'wine_type': row.wine_type,
                        'classification': row.classification,
                        'quantity': row.quantity,
                        'min_quantity': row.min_quantity if hasattr(row, 'min_quantity') else 0,
                        'cost_price': row.cost_price,
                        'selling_price': row.selling_price,
                        'alcohol_content': row.alcohol_content,
                        'description': row.description,
                        'notes': row.notes,
                        'created_at': row.created_at,
                        'updated_at': row.updated_at
                    }
                    
                    wine = Wine()
                    for key, value in wine_dict.items():
                        setattr(wine, key, value)
                    wines.append(wine)
                
                logger.info(f"[DB] Recuperati {len(wines)} vini da tabella dinamica per user_id={user_id}, business_name={user.business_name}")
                return wines
                
            except Exception as e:
                logger.error(f"[DB] Errore leggendo inventario da tabella dinamica {table_name}: {e}", exc_info=True)
                # Fallback: prova vecchia tabella wines
                try:
                    result = await session.execute(
                        select(Wine).where(Wine.user_id == user.id)
                    )
                    return list(result.scalars().all())
                except Exception as fallback_error:
                    logger.error(f"Errore anche nel fallback vecchia tabella wines: {fallback_error}", exc_info=True)
                    return []
    
    async def get_wine_by_id(self, user_id: int, wine_id: int) -> Optional[Wine]:
        """
        Recupera un vino specifico per ID dalla tabella dinamica.
        """
        async with AsyncSessionLocal() as session:
            user = await self.get_user_by_id(user_id)
            if not user or not user.business_name:
                logger.warning(f"[DB] User user_id={user_id} non trovato o business_name mancante")
                return None
            
            table_name = f'"{user.id}/{user.business_name} INVENTARIO"'
            
            try:
                query = sql_text(f"""
                    SELECT * FROM {table_name} 
                    WHERE id = :wine_id AND user_id = :user_id
                    LIMIT 1
                """)
                
                result = await session.execute(query, {"wine_id": wine_id, "user_id": user.id})
                row = result.fetchone()
                
                if not row:
                    logger.warning(f"[DB] Vino id={wine_id} non trovato per user_id={user_id}")
                    return None
                
                # Converti la riga in oggetto Wine
                wine_dict = {
                    'id': row.id,
                    'user_id': row.user_id,
                    'name': row.name,
                    'producer': row.producer,
                    'vintage': row.vintage,
                    'grape_variety': row.grape_variety,
                    'region': row.region,
                    'country': row.country,
                    'wine_type': row.wine_type,
                    'classification': row.classification,
                    'quantity': row.quantity,
                    'min_quantity': row.min_quantity if hasattr(row, 'min_quantity') else 0,
                    'cost_price': row.cost_price,
                    'selling_price': row.selling_price,
                    'alcohol_content': row.alcohol_content,
                    'description': row.description,
                    'notes': row.notes,
                    'created_at': row.created_at,
                    'updated_at': row.updated_at
                }
                
                wine = Wine()
                for key, value in wine_dict.items():
                    setattr(wine, key, value)
                
                logger.info(f"[DB] Recuperato vino id={wine_id} per user_id={user_id}: {wine.name}")
                return wine
                
            except Exception as e:
                logger.error(f"[DB] Errore recuperando vino id={wine_id} da tabella dinamica {table_name}: {e}", exc_info=True)
                return None
    
    async def search_wines(self, user_id: int, search_term: str, limit: int = 10) -> List[Wine]:
        """
        Cerca vini con ricerca fuzzy avanzata (async).
        Reuse completo da telegram-ai-bot
        """
        async with AsyncSessionLocal() as session:
            user = await self.get_user_by_id(user_id)
            if not user or not user.business_name:
                logger.warning(f"[DB] User user_id={user_id} non trovato o business_name mancante")
                return []
            
            table_name = f'"{user.id}/{user.business_name} INVENTARIO"'
            
            try:
                # Normalizzazione avanzata: rimuovi caratteri speciali problematici e normalizza spazi
                import re
                search_term_normalized = search_term.strip()
                
                # Rimuovi parentesi e contenuto tra parentesi (spesso ridondante)
                search_term_normalized = re.sub(r'\([^)]*\)', '', search_term_normalized)
                
                # Normalizza tutti i tipi di apostrofi a spazio o rimozione
                apostrofi_varianti = ["'", "'", "`", "´", "ʼ"]
                for apostrofo in apostrofi_varianti:
                    search_term_normalized = search_term_normalized.replace(apostrofo, ' ')
                
                # Normalizza spazi multipli a singolo spazio
                search_term_normalized = re.sub(r'\s+', ' ', search_term_normalized)
                
                search_term_clean = search_term_normalized.strip().lower()
                
                accent_from = "àáâäèéêëìíîïòóôöùúûüÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜ"
                accent_to = "aaaaeeeeiiiioooouuuuAAAAEEEEIIIIOOOOUUUU"
                
                def strip_accents(s: str) -> str:
                    # str.maketrans() richiede che tutte le chiavi siano di lunghezza 1
                    accent_chars = 'àáâäèéêëìíîïòóôöùúûüÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜ'
                    ascii_chars = 'aaaaeeeeiiiioooouuuuAAAAEEEEIIIIOOOOUUUU'
                    trans = str.maketrans(accent_chars, ascii_chars)
                    return s.translate(trans)
                
                search_term_unaccent = strip_accents(search_term_clean)
                
                def normalize_plural_for_search(term: str) -> list[str]:
                    variants = [term]
                    if len(term) > 2:
                        if term.endswith('i'):
                            base = term[:-1]
                            variants.append(base + 'o')
                            variants.append(base)
                        elif term.endswith('e'):
                            base = term[:-1]
                            variants.append(base + 'a')
                            variants.append(base + 'o')
                            variants.append(base)
                    return list(set(variants))
                
                search_variants = normalize_plural_for_search(search_term_clean)
                stop_words = {'del', 'della', 'dello', 'dei', 'degli', 'delle', 'di', 'da', 'dal', 'dalla', 
                             'dallo', 'dai', 'dagli', 'dalle', 'la', 'le', 'il', 'lo', 'gli', 'i', 'un', 
                             'una', 'uno', 'e', 'o', 'a', 'in', 'su', 'per', 'con', 'tra', 'fra'}
                
                all_words = [w.strip() for w in search_term_clean.split()]
                search_words = [w for w in all_words if len(w) > 2 and w not in stop_words]
                
                is_likely_producer = any(word in search_term_clean for word in [' del ', ' di ', ' da ', 'ca ', 'ca\'', 'castello', 'tenuta', 'azienda'])
                
                search_numeric = None
                search_float = None
                try:
                    search_numeric = int(search_term_clean)
                except ValueError:
                    try:
                        search_float = float(search_term_clean.replace(',', '.'))
                    except ValueError:
                        pass
                
                search_pattern = f"%{search_term_clean}%"
                search_pattern_unaccent = f"%{search_term_unaccent}%"
                
                # Ricerca estesa su tutti i campi rilevanti
                query_conditions = [
                    # Campi principali (priorità alta)
                    "name ILIKE :search_pattern",
                    "producer ILIKE :search_pattern",
                    "grape_variety ILIKE :search_pattern",
                    # Campi secondari (regione, tipo, paese, fornitore)
                    "region ILIKE :search_pattern",
                    "wine_type ILIKE :search_pattern",
                    "country ILIKE :search_pattern",
                    "supplier ILIKE :search_pattern",
                    "classification ILIKE :search_pattern",
                    # Versioni senza accenti per tutti i campi
                    "translate(lower(name), :accent_from, :accent_to) ILIKE :search_pattern_unaccent",
                    "translate(lower(producer), :accent_from, :accent_to) ILIKE :search_pattern_unaccent",
                    "translate(lower(grape_variety), :accent_from, :accent_to) ILIKE :search_pattern_unaccent",
                    "translate(lower(region), :accent_from, :accent_to) ILIKE :search_pattern_unaccent",
                    "translate(lower(wine_type), :accent_from, :accent_to) ILIKE :search_pattern_unaccent",
                    "translate(lower(country), :accent_from, :accent_to) ILIKE :search_pattern_unaccent",
                    "translate(lower(supplier), :accent_from, :accent_to) ILIKE :search_pattern_unaccent",
                    "translate(lower(classification), :accent_from, :accent_to) ILIKE :search_pattern_unaccent"
                ]
                
                variant_params = {}
                for idx, variant in enumerate(search_variants[1:], start=1):
                    variant_pattern = f"%{variant}%"
                    variant_unaccent = strip_accents(variant)
                    variant_pattern_unaccent = f"%{variant_unaccent}%"
                    query_conditions.extend([
                        f"name ILIKE :search_variant_{idx}",
                        f"producer ILIKE :search_variant_{idx}",
                        f"grape_variety ILIKE :search_variant_{idx}",
                        f"region ILIKE :search_variant_{idx}",
                        f"wine_type ILIKE :search_variant_{idx}",
                        f"supplier ILIKE :search_variant_{idx}",
                        f"translate(lower(name), :accent_from, :accent_to) ILIKE :search_variant_unaccent_{idx}",
                        f"translate(lower(producer), :accent_from, :accent_to) ILIKE :search_variant_unaccent_{idx}",
                        f"translate(lower(grape_variety), :accent_from, :accent_to) ILIKE :search_variant_unaccent_{idx}",
                        f"translate(lower(region), :accent_from, :accent_to) ILIKE :search_variant_unaccent_{idx}",
                        f"translate(lower(wine_type), :accent_from, :accent_to) ILIKE :search_variant_unaccent_{idx}",
                        f"translate(lower(supplier), :accent_from, :accent_to) ILIKE :search_variant_unaccent_{idx}"
                    ])
                    variant_params[f"search_variant_{idx}"] = variant_pattern
                    variant_params[f"search_variant_unaccent_{idx}"] = variant_pattern_unaccent
                
                query_params = {
                    "user_id": user.id,
                    "search_pattern": search_pattern,
                    "search_pattern_unaccent": search_pattern_unaccent,
                    "accent_from": accent_from,
                    "accent_to": accent_to,
                    "limit": limit * 2
                }
                
                # Aggiungi ricerca per parole singole anche su campi secondari
                for i, word in enumerate(search_words):
                    word_pattern = f"%{word}%"
                    word_unaccent = strip_accents(word)
                    word_pattern_unaccent = f"%{word_unaccent}%"
                    query_conditions.extend([
                        f"region ILIKE :word_{i}",
                        f"wine_type ILIKE :word_{i}",
                        f"country ILIKE :word_{i}",
                        f"supplier ILIKE :word_{i}",
                        f"classification ILIKE :word_{i}",
                        f"translate(lower(region), :accent_from, :accent_to) ILIKE :word_unaccent_{i}",
                        f"translate(lower(wine_type), :accent_from, :accent_to) ILIKE :word_unaccent_{i}",
                        f"translate(lower(country), :accent_from, :accent_to) ILIKE :word_unaccent_{i}",
                        f"translate(lower(supplier), :accent_from, :accent_to) ILIKE :word_unaccent_{i}",
                        f"translate(lower(classification), :accent_from, :accent_to) ILIKE :word_unaccent_{i}"
                    ])
                    query_params[f"word_{i}"] = word_pattern
                    query_params[f"word_unaccent_{i}"] = word_pattern_unaccent
                    word_variants = normalize_plural_for_search(word)
                    for j, variant in enumerate(word_variants[1:], start=1):
                        param_key = f"word_{i}_var_{j}"
                        query_params[param_key] = f"%{variant}%"
                
                query_params.update(variant_params)
                
                if search_numeric is not None:
                    query_conditions.append("vintage = :search_numeric")
                    query_params["search_numeric"] = search_numeric
                
                if search_float is not None:
                    query_conditions.append("(ABS(cost_price - :search_float) < 0.01 OR ABS(selling_price - :search_float) < 0.01)")
                    query_params["search_float"] = search_float
                
                priority_case = """
                    CASE 
                        WHEN name ILIKE :search_pattern THEN 1
                        WHEN translate(lower(name), :accent_from, :accent_to) ILIKE :search_pattern_unaccent THEN 1
                        WHEN producer ILIKE :search_pattern THEN 1
                        WHEN translate(lower(producer), :accent_from, :accent_to) ILIKE :search_pattern_unaccent THEN 1
                        WHEN grape_variety ILIKE :search_pattern THEN 1
                        WHEN translate(lower(grape_variety), :accent_from, :accent_to) ILIKE :search_pattern_unaccent THEN 1
                        ELSE 2
                    END
                """
                
                query = sql_text(f"""
                    SELECT *, 
                        {priority_case} as match_priority
                    FROM {table_name} 
                    WHERE user_id = :user_id
                    AND ({' OR '.join(query_conditions)})
                    ORDER BY match_priority ASC, name ASC
                    LIMIT :limit
                """)
                
                result = await session.execute(query, query_params)
                rows = result.fetchall()
                
                wines = []
                for row in rows:
                    wine_dict = {
                        'id': row.id,
                        'user_id': row.user_id,
                        'name': row.name,
                        'producer': row.producer,
                        'vintage': row.vintage,
                        'grape_variety': row.grape_variety,
                        'region': row.region,
                        'country': row.country,
                        'wine_type': row.wine_type,
                        'classification': row.classification,
                        'quantity': row.quantity,
                        'min_quantity': row.min_quantity if hasattr(row, 'min_quantity') else 0,
                        'cost_price': row.cost_price,
                        'selling_price': row.selling_price,
                        'alcohol_content': row.alcohol_content,
                        'description': row.description,
                        'notes': row.notes,
                        'created_at': row.created_at,
                        'updated_at': row.updated_at
                    }
                    
                    wine = Wine()
                    for key, value in wine_dict.items():
                        setattr(wine, key, value)
                    wines.append(wine)
                
                wines = wines[:limit]
                logger.info(f"[DB] Trovati {len(wines)} vini per ricerca '{search_term}' per user_id={user_id}, business_name={user.business_name}")
                return wines
                
            except Exception as e:
                logger.error(f"[DB] Errore ricerca vini da tabella dinamica {table_name}: {e}", exc_info=True)
                return []
    
    # get_user_by_email già definito sopra (riga 122), questa è una duplicazione - rimossa
    
    async def create_user(
        self,
        email: str,
        password_hash: str,
        business_name: str,
        telegram_id: Optional[int] = None
    ) -> User:
        """Crea nuovo utente"""
        async with AsyncSessionLocal() as session:
            # Normalizza email in lowercase per consistenza
            email_normalized = email.lower().strip()
            user = User(
                email=email_normalized,
                password_hash=password_hash,
                business_name=business_name,
                telegram_id=telegram_id,
                onboarding_completed=False
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            logger.info(f"[DB] Utente creato: email={email_normalized}, telegram_id={telegram_id}, user_id={user.id}")
            return user
    
    async def update_user_password(
        self,
        user_id: int,
        password_hash: str
    ) -> bool:
        """Aggiorna password utente"""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            if not user:
                return False
            
            user.password_hash = password_hash
            user.updated_at = datetime.utcnow()
            await session.commit()
            logger.info(f"Password aggiornata per user_id={user_id}")
            return True
    
    async def update_user_email_password(
        self,
        user_id: int,
        email: str,
        password_hash: str
    ) -> bool:
        """
        Aggiorna email e password per utente esistente.
        """
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            if not user:
                return False
            
            user.email = email
            user.password_hash = password_hash
            user.updated_at = datetime.utcnow()
            session.add(user)
            await session.commit()
            logger.info(f"Email e password aggiornate per user_id={user_id}")
            return True
    
    async def check_user_has_dynamic_tables(self, user_id: int) -> tuple[bool, Optional[str]]:
        """
        Verifica se l'utente ha già tabelle dinamiche nel database.
        """
        async with AsyncSessionLocal() as session:
            try:
                check_tables_query = sql_text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    AND table_name LIKE :pattern
                    LIMIT 1
                """)
                
                # Cerca tabelle usando user_id
                user = await self.get_user_by_id(user_id)
                if not user:
                    return False, None
                pattern = f"{user.id}/% INVENTARIO"
                result = await session.execute(
                    check_tables_query,
                    {"pattern": pattern}
                )
                table_row = result.fetchone()
                
                if table_row:
                    table_name = table_row[0]
                    parts = table_name.split("/")
                    if len(parts) == 2:
                        business_name_part = parts[1].replace(" INVENTARIO", "")
                        return True, business_name_part
                    return True, None
                
                return False, None
            except Exception as e:
                logger.error(f"Errore verifica tabelle dinamiche: {e}", exc_info=True)
                return False, None
    
    async def log_chat_message(self, user_id: int, role: str, content: str, conversation_id: Optional[int] = None) -> bool:
        """
        Registra un messaggio di chat nella tabella dinamica LOG interazione.
        
        Args:
            user_id: ID utente
            role: 'user' o 'assistant'
            content: Contenuto del messaggio
            conversation_id: ID conversazione (opzionale, per chat multiple)
        
        Returns:
            True se salvato con successo, False altrimenti
        """
        async with AsyncSessionLocal() as session:
            user = await self.get_user_by_id(user_id)
            if not user or not user.business_name:
                logger.warning(f"[DB] User user_id={user_id} non trovato o business_name mancante per log_chat_message")
                return False
            
            table_name = f'"{user.id}/{user.business_name} LOG interazione"'
            try:
                # Normalizza ruolo su tipi ammessi (stesso sistema Telegram bot)
                interaction_type = 'chat_user' if role == 'user' or role == 'chat_user' else 'chat_assistant'
                
                # Verifica se la colonna conversation_id esiste, altrimenti non la usa
                # (per retrocompatibilità con tabelle esistenti)
                has_conversation_id = False
                try:
                    check_column_query = sql_text(f"""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name = :table_name 
                        AND column_name = 'conversation_id'
                    """)
                    result = await session.execute(check_column_query, {"table_name": table_name.replace('"', '')})
                    has_conversation_id = result.fetchone() is not None
                except:
                    pass
                
                if has_conversation_id and conversation_id:
                    insert_query = sql_text(f"""
                        INSERT INTO {table_name}
                        (user_id, interaction_type, interaction_data, conversation_id, created_at)
                        VALUES (:user_id, :interaction_type, :interaction_data, :conversation_id, CURRENT_TIMESTAMP)
                    """)
                    await session.execute(insert_query, {
                        "user_id": user.id,
                        "interaction_type": interaction_type,
                        "interaction_data": content[:8000] if content else None,
                        "conversation_id": conversation_id
                    })
                else:
                    # Fallback per tabelle senza conversation_id
                    insert_query = sql_text(f"""
                        INSERT INTO {table_name}
                        (user_id, interaction_type, interaction_data, created_at)
                        VALUES (:user_id, :interaction_type, :interaction_data, CURRENT_TIMESTAMP)
                    """)
                    await session.execute(insert_query, {
                        "user_id": user.id,
                        "interaction_type": interaction_type,
                        "interaction_data": content[:8000] if content else None
                    })
                
                await session.commit()
                logger.debug(f"[DB] Messaggio chat salvato: role={role}, user_id={user_id}, conversation_id={conversation_id}, content_len={len(content) if content else 0}")
                return True
            except Exception as e:
                logger.error(f"[DB] Errore salvando chat log in {table_name}: {e}", exc_info=True)
                await session.rollback()
                return False
    
    async def get_recent_chat_messages(self, user_id: int, limit: int = 10, conversation_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Recupera ultimi messaggi chat (utente/assistant) dalla tabella LOG interazione.
        
        Args:
            user_id: ID utente
            limit: Numero massimo di messaggi da recuperare
            conversation_id: ID conversazione (opzionale, filtra per conversazione specifica)
        
        Returns:
            Lista di dict con 'role' ('user' o 'assistant'), 'content' e 'created_at'
            Ordinati dal più vecchio al più recente (cronologico)
        """
        async with AsyncSessionLocal() as session:
            user = await self.get_user_by_id(user_id)
            if not user or not user.business_name:
                logger.warning(f"[DB] User user_id={user_id} non trovato o business_name mancante per get_recent_chat_messages")
                return []
            
            table_name = f'"{user.id}/{user.business_name} LOG interazione"'
            try:
                # Verifica se la colonna conversation_id esiste
                has_conversation_id = False
                try:
                    check_column_query = sql_text(f"""
                        SELECT column_name 
                        FROM information_schema.columns 
                        WHERE table_name = :table_name 
                        AND column_name = 'conversation_id'
                    """)
                    result = await session.execute(check_column_query, {"table_name": table_name.replace('"', '')})
                    has_conversation_id = result.fetchone() is not None
                except:
                    pass
                
                if has_conversation_id and conversation_id:
                    query = sql_text(f"""
                        SELECT interaction_type, interaction_data, created_at
                        FROM {table_name}
                        WHERE user_id = :user_id
                          AND interaction_type IN ('chat_user','chat_assistant')
                          AND conversation_id = :conversation_id
                        ORDER BY created_at DESC
                        LIMIT :limit
                    """)
                    result = await session.execute(query, {"user_id": user.id, "conversation_id": conversation_id, "limit": limit})
                else:
                    # Fallback per tabelle senza conversation_id o se conversation_id non specificato
                    query = sql_text(f"""
                        SELECT interaction_type, interaction_data, created_at
                        FROM {table_name}
                        WHERE user_id = :user_id
                          AND interaction_type IN ('chat_user','chat_assistant')
                        ORDER BY created_at DESC
                        LIMIT :limit
                    """)
                    result = await session.execute(query, {"user_id": user.id, "limit": limit})
                
                rows = result.fetchall()
                
                history = []
                for row in rows:
                    role = 'user' if row.interaction_type == 'chat_user' else 'assistant'
                    history.append({
                        "role": role,
                        "content": row.interaction_data or "",
                        "created_at": row.created_at
                    })
                
                # Ritorna in ordine cronologico (dal più vecchio al più recente)
                history.reverse()
                logger.debug(f"[DB] Recuperati {len(history)} messaggi chat per user_id={user_id}, conversation_id={conversation_id}")
                return history
            except Exception as e:
                logger.error(f"[DB] Errore leggendo chat history da {table_name}: {e}", exc_info=True)
                return []
    
    async def create_conversation(self, user_id: int, telegram_id: Optional[int] = None, title: Optional[str] = None) -> Optional[int]:
        """
        Crea una nuova conversazione.
        
        Args:
            user_id: ID utente
            telegram_id: ID Telegram (opzionale, deprecato - mantenuto solo per retrocompatibilità)
            title: Titolo conversazione (opzionale, default: "Nuova chat")
        
        Returns:
            ID conversazione creata o None se errore
        """
        async with AsyncSessionLocal() as session:
            try:
                insert_query = sql_text("""
                    INSERT INTO conversations (user_id, telegram_id, title, created_at, updated_at, last_message_at)
                    VALUES (:user_id, :telegram_id, :title, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id
                """)
                result = await session.execute(insert_query, {
                    "user_id": user_id,
                    "telegram_id": telegram_id,  # Mantenuto per retrocompatibilità con schema DB
                    "title": title or "Nuova chat"
                })
                conversation_id = result.scalar()
                await session.commit()
                logger.info(f"[DB] Creata conversazione id={conversation_id} per user_id={user_id}")
                return conversation_id
            except Exception as e:
                logger.error(f"[DB] Errore creando conversazione: {e}", exc_info=True)
                await session.rollback()
                return None
    
    async def get_user_conversations(self, user_id: int, telegram_id: Optional[int] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Recupera lista conversazioni dell'utente ordinate per ultimo messaggio.
        
        Args:
            user_id: ID utente
            telegram_id: ID Telegram (opzionale, deprecato - mantenuto solo per retrocompatibilità)
            limit: Numero massimo di conversazioni
        
        Returns:
            Lista di dict con id, title, created_at, updated_at, last_message_at
        """
        async with AsyncSessionLocal() as session:
            try:
                # Usa sempre user_id per filtrare conversazioni
                query = sql_text("""
                    SELECT id, title, created_at, updated_at, last_message_at
                    FROM conversations
                    WHERE user_id = :user_id
                    ORDER BY last_message_at DESC
                    LIMIT :limit
                """)
                result = await session.execute(query, {"user_id": user_id, "limit": limit})
                
                rows = result.fetchall()
                conversations = []
                for row in rows:
                    conversations.append({
                        "id": row.id,
                        "title": row.title,
                        "created_at": row.created_at.isoformat() if row.created_at else None,
                        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
                        "last_message_at": row.last_message_at.isoformat() if row.last_message_at else None
                    })
                
                logger.debug(f"[DB] Recuperate {len(conversations)} conversazioni per user_id={user_id}")
                return conversations
            except Exception as e:
                logger.error(f"[DB] Errore recuperando conversazioni: {e}", exc_info=True)
                return []
    
    async def update_conversation_title(self, conversation_id: int, title: str) -> bool:
        """
        Aggiorna il titolo di una conversazione.
        
        Args:
            conversation_id: ID conversazione
            title: Nuovo titolo
        
        Returns:
            True se aggiornato con successo
        """
        async with AsyncSessionLocal() as session:
            try:
                update_query = sql_text("""
                    UPDATE conversations
                    SET title = :title, updated_at = CURRENT_TIMESTAMP
                    WHERE id = :conversation_id
                """)
                await session.execute(update_query, {"conversation_id": conversation_id, "title": title})
                await session.commit()
                logger.debug(f"[DB] Aggiornato titolo conversazione id={conversation_id}")
                return True
            except Exception as e:
                logger.error(f"[DB] Errore aggiornando titolo conversazione: {e}", exc_info=True)
                await session.rollback()
                return False
    
    async def update_conversation_last_message(self, conversation_id: int) -> bool:
        """
        Aggiorna il timestamp dell'ultimo messaggio di una conversazione.
        
        Args:
            conversation_id: ID conversazione
        
        Returns:
            True se aggiornato con successo
        """
        async with AsyncSessionLocal() as session:
            try:
                update_query = sql_text("""
                    UPDATE conversations
                    SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE id = :conversation_id
                """)
                await session.execute(update_query, {"conversation_id": conversation_id})
                await session.commit()
                return True
            except Exception as e:
                logger.error(f"[DB] Errore aggiornando last_message_at conversazione: {e}", exc_info=True)
                await session.rollback()
                return False
    
    async def delete_conversation(self, conversation_id: int, user_id: int) -> bool:
        """
        Cancella una conversazione e tutti i suoi messaggi.
        
        Args:
            conversation_id: ID conversazione
            user_id: ID utente (per sicurezza, verifica che la conversazione appartenga all'utente)
        
        Returns:
            True se cancellata con successo
        """
        async with AsyncSessionLocal() as session:
            try:
                # Verifica che la conversazione appartenga all'utente
                check_query = sql_text("""
                    SELECT id FROM conversations
                    WHERE id = :conversation_id AND user_id = :user_id
                """)
                result = await session.execute(check_query, {"conversation_id": conversation_id, "user_id": user_id})
                if not result.fetchone():
                    logger.warning(f"[DB] Conversazione {conversation_id} non trovata o non appartiene a user_id={user_id}")
                    return False
                
                # Cancella la conversazione (i messaggi nella tabella LOG interazione rimangono ma senza conversation_id)
                delete_query = sql_text("""
                    DELETE FROM conversations
                    WHERE id = :conversation_id AND user_id = :user_id
                """)
                await session.execute(delete_query, {"conversation_id": conversation_id, "user_id": user_id})
                await session.commit()
                logger.info(f"[DB] Cancellata conversazione id={conversation_id} per user_id={user_id}")
                return True
            except Exception as e:
                logger.error(f"[DB] Errore cancellando conversazione: {e}", exc_info=True)
                await session.rollback()
                return False


# Istanza globale
db_manager = DatabaseManager()

