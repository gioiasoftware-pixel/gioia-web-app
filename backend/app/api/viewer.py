"""
API endpoints per viewer inventario
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from typing import Optional
import logging
import csv
import io
from datetime import datetime
from sqlalchemy import select, text as sql_text

from app.core.auth import get_current_user
from app.core.database import db_manager, AsyncSessionLocal, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/viewer", tags=["viewer"])


@router.get("/snapshot")
async def get_viewer_snapshot(current_user: dict = Depends(get_current_user)):
    """
    Snapshot inventario con facets per filtri.
    Usa autenticazione JWT standard (Bearer token).
    """
    try:
        user = current_user["user"]
        telegram_id = user.telegram_id
        user_id = user.id
        business_name = user.business_name

        if not business_name:
            return {
                "rows": [],
                "facets": {
                    "type": {},
                    "vintage": {},
                    "winery": {},
                    "supplier": {}
                },
                "meta": {
                    "total_rows": 0,
                    "last_update": datetime.utcnow().isoformat()
                }
            }

        # Usa user_id invece di telegram_id per nome tabella
        table_name = f'"{user_id}/{business_name} INVENTARIO"'

        async with AsyncSessionLocal() as session:
            # Verifica che la tabella esista (nome senza virgolette per information_schema)
            table_name_check = table_name.strip('"')
            check_table_query = sql_text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = :table_name
                )
            """)
            result = await session.execute(
                check_table_query,
                {"table_name": table_name_check}
            )
            table_exists = result.scalar()

            if not table_exists:
                logger.info(f"[VIEWER] Tabella {table_name} non esiste per user_id={user_id}, business_name={business_name}")
                # Restituisci risposta vuota ma valida - l'utente non ha ancora inventario
                return {
                    "rows": [],
                    "facets": {
                        "type": {},
                        "vintage": {},
                        "winery": {},
                        "supplier": {}
                    },
                    "meta": {
                        "total_rows": 0,
                        "last_update": datetime.utcnow().isoformat(),
                        "message": "Nessun inventario trovato. Carica un file CSV per iniziare."
                    }
                }

            # Recupera tutti i vini
            query_wines = sql_text(f"""
                SELECT 
                    id,
                    name,
                    producer,
                    vintage,
                    quantity,
                    selling_price,
                    wine_type,
                    min_quantity,
                    updated_at,
                    supplier
                FROM {table_name}
                WHERE user_id = :user_id
                ORDER BY name, vintage
            """)

            result = await session.execute(query_wines, {"user_id": user_id})
            wines_rows = result.fetchall()

            # Formatta vini per risposta
            rows = []
            for wine in wines_rows:
                rows.append({
                    "id": wine.id,  # ID necessario per modifiche
                    "name": wine.name or "-",
                    "winery": wine.producer or "-",
                    "vintage": wine.vintage,
                    "qty": wine.quantity or 0,
                    "price": float(wine.selling_price) if wine.selling_price else 0.0,
                    "type": wine.wine_type or "Altro",
                    "supplier": wine.supplier or "-",
                    "critical": wine.quantity is not None and wine.min_quantity is not None and wine.quantity <= wine.min_quantity
                })

            # Calcola facets (aggregazioni per filtri)
            facets = {
                "type": {},
                "vintage": {},
                "winery": {},
                "supplier": {}
            }

            for wine in wines_rows:
                # Tipo
                wine_type = wine.wine_type or "Altro"
                facets["type"][wine_type] = facets["type"].get(wine_type, 0) + 1

                # Annata
                if wine.vintage:
                    vintage_str = str(wine.vintage)
                    facets["vintage"][vintage_str] = facets["vintage"].get(vintage_str, 0) + 1

                # Cantina (producer)
                if wine.producer:
                    facets["winery"][wine.producer] = facets["winery"].get(wine.producer, 0) + 1

                # Fornitore
                if wine.supplier:
                    facets["supplier"][wine.supplier] = facets["supplier"].get(wine.supplier, 0) + 1

            # Meta info
            last_update = None
            if wines_rows:
                # Trova ultimo updated_at
                last_update_row = max(
                    wines_rows,
                    key=lambda w: w.updated_at if w.updated_at else datetime.min
                )
                last_update = (
                    last_update_row.updated_at.isoformat()
                    if last_update_row.updated_at
                    else datetime.utcnow().isoformat()
                )
            else:
                last_update = datetime.utcnow().isoformat()

            response = {
                "rows": rows,
                "facets": facets,
                "meta": {
                    "total_rows": len(rows),
                    "last_update": last_update
                }
            }

            logger.info(
                f"[VIEWER] Snapshot restituito: rows={len(rows)}, "
                f"user_id={user_id}, telegram_id={telegram_id}, business_name={business_name}, "
                f"facets_type={len(facets.get('type', {}))}, facets_vintage={len(facets.get('vintage', {}))}, "
                f"facets_winery={len(facets.get('winery', {}))}, facets_supplier={len(facets.get('supplier', {}))}"
            )
            return response

    except Exception as e:
        logger.error(
            f"[VIEWER] Errore snapshot inventario: {e}",
            exc_info=True
        )
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")


@router.get("/export.csv")
async def export_viewer_csv(current_user: dict = Depends(get_current_user)):
    """
    Export CSV inventario.
    Usa autenticazione JWT standard (Bearer token).
    """
    try:
        user = current_user["user"]
        user_id = current_user["user_id"]
        business_name = user.business_name

        if not business_name:
            raise HTTPException(
                status_code=404,
                detail="Inventario non disponibile"
            )

        table_name = f'"{user_id}/{business_name} INVENTARIO"'

        async with AsyncSessionLocal() as session:
            # Verifica che la tabella esista (nome senza virgolette per information_schema)
            table_name_check = table_name.strip('"')
            check_table_query = sql_text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = :table_name
                )
            """)
            result = await session.execute(
                check_table_query,
                {"table_name": table_name_check}
            )
            table_exists = result.scalar()

            if not table_exists:
                raise HTTPException(
                    status_code=404,
                    detail="Inventario non disponibile"
                )

            # Recupera tutti i vini
            query_wines = sql_text(f"""
                SELECT 
                    name,
                    producer,
                    vintage,
                    quantity,
                    selling_price,
                    wine_type,
                    supplier
                FROM {table_name}
                WHERE user_id = :user_id
                ORDER BY name, vintage
            """)

            result = await session.execute(query_wines, {"user_id": user_id})
            wines_rows = result.fetchall()

            # Crea CSV
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Header
            writer.writerow([
                "Nome",
                "Cantina",
                "Annata",
                "Quantità",
                "Prezzo (€)",
                "Tipologia",
                "Fornitore"
            ])

            # Rows
            for wine in wines_rows:
                # Formatta il prezzo con virgola come separatore decimale (formato italiano)
                # per evitare che Excel lo interpreti come orario
                if wine.selling_price:
                    price_str = f"{float(wine.selling_price):.2f}".replace('.', ',')
                else:
                    price_str = "0,00"
                
                writer.writerow([
                    wine.name or "",
                    wine.producer or "",
                    wine.vintage or "",
                    wine.quantity or 0,
                    price_str,
                    wine.wine_type or "",
                    wine.supplier or ""
                ])

            csv_content = output.getvalue()
            output.close()

            logger.info(
                f"[VIEWER] CSV export completato: rows={len(wines_rows)}, "
                f"user_id={user_id}, business_name={business_name}"
            )

            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f'attachment; filename="inventario_{business_name}_{datetime.utcnow().strftime("%Y%m%d")}.csv"'
                }
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"[VIEWER] Errore export CSV: {e}",
            exc_info=True
        )
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")


@router.get("/movements")
async def get_wine_movements(
    wine_name: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Recupera movimenti (consumi/rifornimenti) per un vino specifico.
    Usa autenticazione JWT standard (Bearer token).
    """
    try:
        user = current_user["user"]
        user_id = current_user["user_id"]
        business_name = user.business_name

        if not business_name:
            raise HTTPException(
                status_code=404,
                detail="Inventario non disponibile"
            )

        # Leggi da "Storico vino" (fonte unica di verità) invece di "Consumi e rifornimenti"
        table_storico = f'"{user_id}/{business_name} Storico vino"'

        async with AsyncSessionLocal() as session:
            # Verifica che la tabella esista
            table_name_check = table_storico.strip('"')
            check_table_query = sql_text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = :table_name
                )
            """)
            result = await session.execute(
                check_table_query,
                {"table_name": table_name_check}
            )
            table_exists = result.scalar()

            if not table_exists:
                logger.info(f"[VIEWER] Tabella Storico vino {table_storico} non esiste per user_id={user_id}, business_name={business_name}")
                return {
                    "wine_name": wine_name,
                    "current_stock": 0,
                    "opening_stock": 0,
                    "movements": []
                }

            # Cerca storico vino
            import json
            query_storico = sql_text(f"""
                SELECT 
                    current_stock,
                    history,
                    first_movement_date,
                    last_movement_date,
                    total_consumi,
                    total_rifornimenti
                FROM {table_storico}
                WHERE user_id = :user_id
                AND (
                    LOWER(TRIM(wine_name)) = LOWER(TRIM(:wine_name_exact))
                    OR LOWER(wine_name) LIKE LOWER(:wine_name_pattern)
                )
                ORDER BY 
                    CASE 
                        WHEN LOWER(TRIM(wine_name)) = LOWER(TRIM(:wine_name_exact)) THEN 1
                        ELSE 2
                    END
                LIMIT 1
            """)

            result = await session.execute(
                query_storico,
                {
                    "user_id": user_id,
                    "wine_name_exact": wine_name,
                    "wine_name_pattern": f"%{wine_name}%"
                }
            )
            storico_row = result.fetchone()

            if not storico_row:
                # Nessun movimento per questo vino
                return {
                    "wine_name": wine_name,
                    "current_stock": 0,
                    "opening_stock": 0,
                    "movements": []
                }

            # Estrai history (JSONB)
            history = storico_row[1] if storico_row[1] else []
            if isinstance(history, str):
                history = json.loads(history)

            # Converti history in formato per frontend
            movements = []
            for entry in history:
                movements.append({
                    "at": entry.get("date"),
                    "type": entry.get("type"),
                    "quantity_change": entry.get("quantity") if entry.get("type") == "rifornimento" else -entry.get("quantity", 0),
                    "quantity_before": entry.get("quantity_before", 0),
                    "quantity_after": entry.get("quantity_after", 0)
                })

            # Ordina per data
            movements.sort(key=lambda x: x["at"] if x["at"] else "")

            # Stock finale = current_stock dalla tabella (fonte unica di verità)
            current_stock = storico_row[0] or 0

            # Opening stock = primo movimento quantity_before (o 0 se non c'è)
            opening_stock = movements[0]["quantity_before"] if movements else 0

            logger.info(
                f"[VIEWER] Movimenti recuperati da Storico vino: wine_name='{wine_name}', count={len(movements)}, "
                f"current_stock={current_stock}, user_id={user_id}, business_name={business_name}"
            )

            return {
                "wine_name": wine_name,
                "current_stock": current_stock,
                "opening_stock": opening_stock,
                "movements": movements,
                "total_consumi": storico_row[4] or 0,
                "total_rifornimenti": storico_row[5] or 0,
                "first_movement_date": storico_row[2].isoformat() if storico_row[2] else None,
                "last_movement_date": storico_row[3].isoformat() if storico_row[3] else None
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"[VIEWER] Errore recupero movimenti: {e}",
            exc_info=True
        )
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

