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

        # Se l'utente non ha telegram_id, usa user_id come fallback
        # Ma le tabelle dinamiche sono basate su telegram_id, quindi potrebbe non esistere
        if not telegram_id:
            logger.warning(f"[VIEWER] Utente user_id={user_id} non ha telegram_id, impossibile accedere a tabelle dinamiche")
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

        table_name = f'"{telegram_id}/{business_name} INVENTARIO"'

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
                logger.info(f"[VIEWER] Tabella {table_name} non esiste per telegram_id={telegram_id}, business_name={business_name}")
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
        telegram_id = user.telegram_id
        user_id = user.id
        business_name = user.business_name

        if not business_name or not telegram_id:
            raise HTTPException(
                status_code=404,
                detail="Inventario non disponibile"
            )

        table_name = f'"{telegram_id}/{business_name} INVENTARIO"'

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
                writer.writerow([
                    wine.name or "",
                    wine.producer or "",
                    wine.vintage or "",
                    wine.quantity or 0,
                    f"{float(wine.selling_price):.2f}" if wine.selling_price else "0.00",
                    wine.wine_type or "",
                    wine.supplier or ""
                ])

            csv_content = output.getvalue()
            output.close()

            logger.info(
                f"[VIEWER] CSV export completato: rows={len(wines_rows)}, "
                f"user_id={user_id}, telegram_id={telegram_id}, business_name={business_name}"
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
