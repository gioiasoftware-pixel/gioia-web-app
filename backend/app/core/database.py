"""
Database async per web app - Gestione utenti e inventario vini
Reuse da telegram-ai-bot con adattamenti per web app
"""
import os
import logging
from datetime import datetime
from typing import Optional, List
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
    
    async def get_user_by_telegram_id(self, telegram_id: int) -> Optional[User]:
        """Trova utente per Telegram ID"""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.telegram_id == telegram_id)
            )
            return result.scalar_one_or_none()
    
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
    
    async def get_user_wines(self, telegram_id: int) -> List[Wine]:
        """Ottiene vini utente da tabelle dinamiche"""
        async with AsyncSessionLocal() as session:
            user = await self.get_user_by_telegram_id(telegram_id)
            if not user or not user.business_name:
                logger.warning(f"[DB] User telegram_id={telegram_id} non trovato o business_name mancante")
                return []
            
            table_name = f'"{telegram_id}/{user.business_name} INVENTARIO"'
            
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
                
                logger.info(f"[DB] Recuperati {len(wines)} vini da tabella dinamica per telegram_id={telegram_id}, business_name={user.business_name}")
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
    
    async def search_wines(self, telegram_id: int, search_term: str, limit: int = 10) -> List[Wine]:
        """
        Cerca vini con ricerca fuzzy avanzata (async).
        Reuse completo da telegram-ai-bot
        """
        async with AsyncSessionLocal() as session:
            user = await self.get_user_by_telegram_id(telegram_id)
            if not user or not user.business_name:
                logger.warning(f"[DB] User telegram_id={telegram_id} non trovato o business_name mancante")
                return []
            
            table_name = f'"{telegram_id}/{user.business_name} INVENTARIO"'
            
            try:
                search_term_clean = search_term.strip().lower()
                accent_from = "àáâäèéêëìíîïòóôöùúûüÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜ'ʼ'`´"
                accent_to = "aaaaeeeeiiiioooouuuuAAAAEEEEIIIIOOOOUUUU"
                
                def strip_accents(s: str) -> str:
                    # str.maketrans() richiede che tutte le chiavi siano di lunghezza 1
                    # Usa due stringhe invece di un dict
                    accent_chars = 'àáâäèéêëìíîïòóôöùúûüÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜ\'\'`´'
                    ascii_chars = 'aaaaeeeeiiiioooouuuuAAAAEEEEIIIIOOOOUUUU\'\'`\''
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
                
                query_conditions = [
                    "name ILIKE :search_pattern",
                    "producer ILIKE :search_pattern",
                    "grape_variety ILIKE :search_pattern",
                    "translate(lower(name), :accent_from, :accent_to) ILIKE :search_pattern_unaccent",
                    "translate(lower(producer), :accent_from, :accent_to) ILIKE :search_pattern_unaccent",
                    "translate(lower(grape_variety), :accent_from, :accent_to) ILIKE :search_pattern_unaccent"
                ]
                
                variant_params = {}
                for idx, variant in enumerate(search_variants[1:], start=1):
                    variant_pattern = f"%{variant}%"
                    variant_unaccent = strip_accents(variant)
                    variant_pattern_unaccent = f"%{variant_unaccent}%"
                    query_conditions.extend([
                        f"name ILIKE :search_variant_{idx}",
                        f"grape_variety ILIKE :search_variant_{idx}",
                        f"translate(lower(name), :accent_from, :accent_to) ILIKE :search_variant_unaccent_{idx}",
                        f"translate(lower(grape_variety), :accent_from, :accent_to) ILIKE :search_variant_unaccent_{idx}"
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
                
                for i, word in enumerate(search_words):
                    query_params[f"word_{i}"] = f"%{word}%"
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
                logger.info(f"[DB] Trovati {len(wines)} vini per ricerca '{search_term}' per telegram_id={telegram_id}, business_name={user.business_name}")
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
        telegram_id: int,
        email: str,
        password_hash: str
    ) -> bool:
        """
        Aggiorna email e password per utente Telegram esistente.
        Usato quando utente Telegram fa signup web.
        """
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User).where(User.telegram_id == telegram_id)
            )
            user = result.scalar_one_or_none()
            if not user:
                return False
            
            user.email = email
            user.password_hash = password_hash
            user.updated_at = datetime.utcnow()
            session.add(user)
            await session.commit()
            logger.info(f"Email e password aggiornate per telegram_id={telegram_id}")
            return True
    
    async def check_user_has_dynamic_tables(self, telegram_id: int) -> tuple[bool, Optional[str]]:
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
                
                pattern = f"{telegram_id}/% INVENTARIO"
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


# Istanza globale
db_manager = DatabaseManager()
