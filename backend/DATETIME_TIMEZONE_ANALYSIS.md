# Analisi Problemi DateTime Timezone con asyncpg

## Problema
Quando si passa un `datetime` Python con timezone (timezone-aware) come parametro a una query SQL tramite asyncpg, può verificarsi l'errore:
```
asyncpg.exceptions.DataError: invalid input for query argument $X: datetime.datetime(...) (can't subtract offset-naive and offset-aware datetimes)
```

## Soluzione
Rimuovere il timezone prima di passare il datetime al database usando `.replace(tzinfo=None)`.

## Punti Critici Verificati

### ✅ 1. `notifications_service.py` - `save_notification()`
**Status**: ✅ CORRETTO
**File**: `app/core/notifications_service.py:282`
**Codice**:
```python
expires_at = (datetime.now(timezone.utc) + timedelta(days=3)).replace(tzinfo=None)
```
**Nota**: Il timezone viene rimosso prima di passare al database.

---

### ✅ 2. `notifications_service.py` - `generate_daily_report()`
**Status**: ✅ OK
**File**: `app/core/notifications_service.py:87-90`
**Codice**:
```python
now_utc = datetime.now(timezone.utc)
now_italian = now_utc - timedelta(hours=1)
report_date = (now_italian - timedelta(days=1)).date()  # Convertito in .date()
```
**Nota**: Viene convertito in `.date()`, quindi non viene passato come datetime al database.

---

### ✅ 3. `database.py` - `update_user_password()` e `update_user_email_password()`
**Status**: ✅ OK
**File**: `app/core/database.py:544, 568`
**Codice**:
```python
user.updated_at = datetime.utcnow()  # datetime.utcnow() restituisce datetime naive
```
**Nota**: `datetime.utcnow()` restituisce un datetime **naive** (senza timezone), quindi è sicuro.

---

### ✅ 4. `daily_report_scheduler.py` - `get_italian_time()`
**Status**: ✅ OK
**File**: `app/services/daily_report_scheduler.py:22-24`
**Codice**:
```python
now_utc = datetime.now(timezone.utc)
return now_utc - timedelta(hours=1)  # Restituisce datetime con timezone
```
**Nota**: Questo datetime viene usato solo per calcolare `.date()`, non viene mai passato direttamente al database come parametro.

---

### ✅ 5. Query SQL con `CURRENT_TIMESTAMP`
**Status**: ✅ OK
**File**: Vari (es. `notifications_service.py:330, 375, 397`)
**Codice**:
```sql
WHERE expires_at > CURRENT_TIMESTAMP
SET read_at = CURRENT_TIMESTAMP
```
**Nota**: `CURRENT_TIMESTAMP` è gestito direttamente dal database PostgreSQL, non viene passato come parametro Python.

---

### ✅ 6. Column defaults con `datetime.utcnow`
**Status**: ✅ OK
**File**: `app/core/database.py:29-30, 63-64`
**Codice**:
```python
created_at = Column(DateTime, default=datetime.utcnow)
updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```
**Nota**: `datetime.utcnow` (senza parentesi) viene usato come callable da SQLAlchemy, che gestisce correttamente il datetime naive.

---

## Regole da Seguire

1. **Quando usare `datetime.now(timezone.utc)`**:
   - Se serve solo la data → convertire in `.date()` prima di passare al database
   - Se serve il datetime → usare `.replace(tzinfo=None)` prima di passare al database
   - ✅ OK se usato solo per calcoli intermedi

2. **Quando usare `datetime.utcnow()`**:
   - ✅ Sempre sicuro perché restituisce datetime naive
   - Può essere passato direttamente al database

3. **Query SQL con `CURRENT_TIMESTAMP`**:
   - ✅ Sempre sicuro, gestito dal database

4. **Column defaults**:
   - ✅ `default=datetime.utcnow` è sicuro (senza parentesi, usato come callable)
   - ✅ `onupdate=datetime.utcnow` è sicuro

## Checklist per Nuovo Codice

Prima di inserire/aggiornare un datetime nel database tramite asyncpg:

- [ ] Se il datetime ha timezone → usare `.replace(tzinfo=None)`
- [ ] Se serve solo la data → usare `.date()`
- [ ] Preferire `datetime.utcnow()` a `datetime.now(timezone.utc)` quando possibile
- [ ] Usare `CURRENT_TIMESTAMP` nelle query SQL quando appropriato

## Test

Per verificare che un datetime sia naive (senza timezone):
```python
from datetime import datetime, timezone

d = datetime.now(timezone.utc)
print(d.tzinfo is not None)  # True → ha timezone

d_naive = d.replace(tzinfo=None)
print(d_naive.tzinfo is not None)  # False → naive, sicuro per asyncpg
```

