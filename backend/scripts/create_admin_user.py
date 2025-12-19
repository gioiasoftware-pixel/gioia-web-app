"""
Script per creare utente admin nel database.
Esegui questo script una volta per creare l'utente admin iniziale.
"""
import asyncio
import os
import sys
from pathlib import Path

# Aggiungi il path del backend al PYTHONPATH
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from app.core.database import AsyncSessionLocal, User, db_manager
from app.core.auth import hash_password
from sqlalchemy import select

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "gio.ia.software@gmail.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Lagioiadilavorare2025")


async def create_admin_user():
    """Crea utente admin se non esiste già."""
    async with AsyncSessionLocal() as session:
        # Verifica se utente esiste già
        existing_user = await db_manager.get_user_by_email(ADMIN_EMAIL)
        
        if existing_user:
            print(f"✅ Utente admin già esistente: {ADMIN_EMAIL} (ID: {existing_user.id})")
            
            # Aggiorna password se necessario
            if not existing_user.password_hash:
                print(f"⚠️  Utente senza password, aggiornamento password...")
                existing_user.password_hash = hash_password(ADMIN_PASSWORD)
                session.add(existing_user)
                await session.commit()
                print(f"✅ Password aggiornata per utente admin")
            else:
                print(f"✅ Utente admin ha già una password configurata")
            
            return existing_user
        
        # Crea nuovo utente admin
        print(f"📝 Creazione nuovo utente admin: {ADMIN_EMAIL}")
        
        password_hash = hash_password(ADMIN_PASSWORD)
        admin_user = await db_manager.create_user(
            email=ADMIN_EMAIL,
            password_hash=password_hash,
            business_name="Gio.ia Admin",
            telegram_id=None
        )
        
        print(f"✅ Utente admin creato con successo!")
        print(f"   - ID: {admin_user.id}")
        print(f"   - Email: {admin_user.email}")
        print(f"   - Business Name: {admin_user.business_name}")
        print(f"   - Password: {'*' * len(ADMIN_PASSWORD)}")
        
        return admin_user


if __name__ == "__main__":
    print("🔐 Creazione utente admin...")
    print(f"   Email: {ADMIN_EMAIL}")
    print(f"   Password: {'*' * len(ADMIN_PASSWORD)}")
    print()
    
    try:
        admin_user = asyncio.run(create_admin_user())
        print()
        print("✅ Script completato con successo!")
        print()
        print("Puoi ora fare login con:")
        print(f"   Email: {ADMIN_EMAIL}")
        print(f"   Password: {ADMIN_PASSWORD}")
    except Exception as e:
        print(f"❌ Errore durante la creazione utente admin: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

