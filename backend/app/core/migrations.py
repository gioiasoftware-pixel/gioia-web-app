"""
Sistema di migrazione automatica database.
Esegue migrazioni all'avvio dell'applicazione se necessario.
"""
import logging
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal, db_manager

logger = logging.getLogger(__name__)


async def run_migrations():
    """
    Esegue tutte le migrazioni necessarie all'avvio.
    Verifica se le tabelle/colonne esistono prima di crearle/modificarle.
    """
    import sys
    
    print("[MIGRATIONS] Avvio migrazioni database...", file=sys.stderr)
    logger.info("[MIGRATIONS] Avvio migrazioni database...")
    
    try:
        print("[MIGRATIONS] Creazione sessione database...", file=sys.stderr)
        async with AsyncSessionLocal() as session:
            # Migrazione 1: Crea tabella conversations se non esiste
            print("[MIGRATIONS] Esecuzione migrazione tabella conversations...", file=sys.stderr)
            await migrate_conversations_table(session)
            
            # Migrazione 2: Aggiungi colonna conversation_id alle tabelle LOG interazione esistenti
            print("[MIGRATIONS] Esecuzione migrazione tabelle LOG interazione...", file=sys.stderr)
            await migrate_log_interaction_tables(session)
            
            # Migrazione 3: Crea tabella notifications se non esiste
            print("[MIGRATIONS] Esecuzione migrazione tabella notifications...", file=sys.stderr)
            from app.core.notifications_service import migrate_notifications_table
            await migrate_notifications_table(session)
            
            print("[MIGRATIONS] Commit modifiche database...", file=sys.stderr)
            await session.commit()
            
            print("[MIGRATIONS] ✅ Migrazioni completate con successo", file=sys.stderr)
            logger.info("[MIGRATIONS] ✅ Migrazioni completate con successo")
    except Exception as e:
        error_msg = f"[MIGRATIONS] ❌ Errore durante migrazioni: {e}"
        print(error_msg, file=sys.stderr)
        logger.error(error_msg, exc_info=True)
        raise


async def migrate_conversations_table(session: AsyncSession):
    """
    Crea la tabella conversations se non esiste.
    """
    try:
        # Verifica se la tabella esiste già
        check_table_query = sql_text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'conversations'
            );
        """)
        result = await session.execute(check_table_query)
        table_exists = result.scalar()
        
        if table_exists:
            logger.info("[MIGRATIONS] Tabella 'conversations' già esistente, skip")
            return
        
        # Crea la tabella
        logger.info("[MIGRATIONS] Creazione tabella 'conversations'...")
        create_table_query = sql_text("""
            CREATE TABLE conversations (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                telegram_id BIGINT,
                title VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        await session.execute(create_table_query)
        
        # Crea indici (uno per volta perché asyncpg non supporta multiple commands in prepared statement)
        create_index_1 = sql_text("CREATE INDEX idx_conversations_user_id ON conversations(user_id);")
        await session.execute(create_index_1)
        
        create_index_2 = sql_text("CREATE INDEX idx_conversations_telegram_id ON conversations(telegram_id);")
        await session.execute(create_index_2)
        
        create_index_3 = sql_text("CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);")
        await session.execute(create_index_3)
        
        logger.info("[MIGRATIONS] ✅ Tabella 'conversations' creata con successo")
    except Exception as e:
        logger.error(f"[MIGRATIONS] Errore creando tabella conversations: {e}", exc_info=True)
        raise


async def migrate_log_interaction_tables(session: AsyncSession):
    """
    Aggiunge la colonna conversation_id alle tabelle LOG interazione esistenti.
    Le tabelle sono dinamiche: "{user_id}/{business_name} LOG interazione"
    """
    try:
        # Recupera tutti gli utenti con business_name
        get_users_query = sql_text("""
            SELECT id, telegram_id, business_name 
            FROM users 
            WHERE business_name IS NOT NULL AND business_name != ''
        """)
        result = await session.execute(get_users_query)
        users = result.fetchall()
        
        if not users:
            logger.info("[MIGRATIONS] Nessun utente con business_name trovato, skip migrazione LOG interazione")
            return
        
        logger.info(f"[MIGRATIONS] Trovati {len(users)} utenti, verifica tabelle LOG interazione...")
        
        tables_updated = 0
        tables_skipped = 0
        
        for user in users:
            user_id = user.id  # Usa user_id direttamente
            business_name = user.business_name
            # Cerca tabella con pattern user_id (nuovo formato)
            table_name = f'"{user_id}/{business_name} LOG interazione"'
            
            try:
                # Verifica se la tabella esiste (prima cerca con user_id)
                check_table_query = sql_text(f"""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = :table_name
                    );
                """)
                result = await session.execute(check_table_query, {"table_name": table_name.replace('"', '')})
                table_exists = result.scalar()
                
                # Se non esiste con user_id, prova con telegram_id per retrocompatibilità
                if not table_exists and user.telegram_id:
                    old_table_name = f'"{user.telegram_id}/{business_name} LOG interazione"'
                    result = await session.execute(check_table_query, {"table_name": old_table_name.replace('"', '')})
                    table_exists = result.scalar()
                    if table_exists:
                        table_name = old_table_name
                        logger.info(f"[MIGRATIONS] Trovata tabella con formato legacy (telegram_id) per user_id={user_id}, useremo quella")
                
                if not table_exists:
                    logger.debug(f"[MIGRATIONS] Tabella LOG interazione non esiste per user_id={user_id}, skip")
                    tables_skipped += 1
                    continue
                
                # Verifica se la colonna conversation_id esiste già
                check_column_query = sql_text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = :table_name
                        AND column_name = 'conversation_id'
                    );
                """)
                result = await session.execute(check_column_query, {"table_name": table_name.replace('"', '')})
                column_exists = result.scalar()
                
                if column_exists:
                    logger.debug(f"[MIGRATIONS] Colonna conversation_id già presente in {table_name}, skip")
                    tables_skipped += 1
                    continue
                
                # Aggiungi la colonna conversation_id
                logger.info(f"[MIGRATIONS] Aggiunta colonna conversation_id a {table_name}...")
                add_column_query = sql_text(f"""
                    ALTER TABLE {table_name}
                    ADD COLUMN conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL;
                """)
                await session.execute(add_column_query)
                
                # Crea indice per performance
                create_index_query = sql_text(f"""
                    CREATE INDEX IF NOT EXISTS idx_{table_name.replace('"', '').replace('/', '_').replace(' ', '_')}_conversation_id 
                    ON {table_name}(conversation_id);
                """)
                await session.execute(create_index_query)
                
                tables_updated += 1
                logger.debug(f"[MIGRATIONS] ✅ Colonna conversation_id aggiunta a {table_name}")
                
            except Exception as e:
                logger.warning(f"[MIGRATIONS] Errore aggiornando tabella {table_name}: {e}")
                # Continua con le altre tabelle anche se una fallisce
                continue
        
        logger.info(f"[MIGRATIONS] ✅ Migrazione LOG interazione completata: {tables_updated} tabelle aggiornate, {tables_skipped} saltate")
        
    except Exception as e:
        logger.error(f"[MIGRATIONS] Errore durante migrazione tabelle LOG interazione: {e}", exc_info=True)
        # Non sollevare eccezione per non bloccare l'avvio se alcune tabelle falliscono
        logger.warning("[MIGRATIONS] Continuo comunque l'avvio dell'applicazione...")
