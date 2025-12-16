"""
Script di test per verificare password hash
"""
import bcrypt

# Hash dal database
hash_from_db = '$2b$12$wIN5I3H27DScgqvAoBEosucpFo5uEbgZdMIfq4MgabjTa2TdNYLW6'

# Password che l'utente ha inserito
password = 'Rsfp03fka'

print(f"Hash dal DB: {hash_from_db}")
print(f"Password testata: {password}")
print(f"Lunghezza hash: {len(hash_from_db)}")
print(f"Prefisso hash: {hash_from_db[:10]}")

# Verifica password
try:
    result = bcrypt.checkpw(password.encode('utf-8'), hash_from_db.encode('utf-8'))
    print(f"\n✅ Risultato verifica: {result}")
    
    if result:
        print("✅ Password CORRETTA!")
    else:
        print("❌ Password NON corrisponde all'hash")
        
        # Prova a generare un nuovo hash con la stessa password per vedere se è diverso
        print("\n--- Test generazione nuovo hash ---")
        new_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        print(f"Nuovo hash generato: {new_hash.decode('utf-8')}")
        print(f"Hash dal DB:         {hash_from_db}")
        print(f"Gli hash sono diversi (normale, ogni hash è unico anche per stessa password)")
        
        # Verifica che il nuovo hash funzioni con la password
        verify_new = bcrypt.checkpw(password.encode('utf-8'), new_hash)
        print(f"Verifica nuovo hash: {verify_new}")
        
except Exception as e:
    print(f"\n❌ Errore durante verifica: {e}")
    import traceback
    traceback.print_exc()

