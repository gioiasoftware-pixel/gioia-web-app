"""
API endpoints per gestione vini
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, Dict, Any
import logging
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import db_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/wines", tags=["wines"])


class WineUpdate(BaseModel):
    name: Optional[str] = None
    producer: Optional[str] = None
    quantity: Optional[int] = None
    selling_price: Optional[float] = None
    cost_price: Optional[float] = None
    vintage: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    wine_type: Optional[str] = None
    supplier: Optional[str] = None
    grape_variety: Optional[str] = None
    classification: Optional[str] = None
    alcohol_content: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None


@router.get("/{wine_id}")
async def get_wine(
    wine_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Recupera i dati di un vino specifico.
    """
    try:
        user = current_user["user"]
        telegram_id = user.telegram_id
        
        if not telegram_id:
            raise HTTPException(status_code=400, detail="Utente non ha telegram_id")
        
        wine = await db_manager.get_wine_by_id(telegram_id, wine_id)
        
        if not wine:
            raise HTTPException(status_code=404, detail="Vino non trovato")
        
        # Converti wine object in dict
        wine_dict = {
            "id": wine.id,
            "name": wine.name,
            "producer": wine.producer,
            "quantity": wine.quantity,
            "selling_price": float(wine.selling_price) if wine.selling_price else None,
            "cost_price": float(wine.cost_price) if wine.cost_price else None,
            "vintage": wine.vintage,
            "region": wine.region,
            "country": wine.country,
            "wine_type": wine.wine_type,
            "supplier": wine.supplier,
            "grape_variety": wine.grape_variety,
            "classification": wine.classification,
            "alcohol_content": wine.alcohol_content,
            "description": wine.description,
            "notes": wine.notes,
        }
        
        return wine_dict
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore recupero vino {wine_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")


@router.put("/{wine_id}")
async def update_wine(
    wine_id: int,
    wine_update: WineUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Aggiorna i dati di un vino specifico.
    """
    try:
        user = current_user["user"]
        telegram_id = user.telegram_id
        
        if not telegram_id:
            raise HTTPException(status_code=400, detail="Utente non ha telegram_id")
        
        # Verifica che il vino esista
        wine = await db_manager.get_wine_by_id(telegram_id, wine_id)
        if not wine:
            raise HTTPException(status_code=404, detail="Vino non trovato")
        
        # Prepara dati da aggiornare (solo campi non None)
        update_data = wine_update.dict(exclude_unset=True)
        
        if not update_data:
            return {"message": "Nessun dato da aggiornare", "wine_id": wine_id}
        
        business_name = user.business_name
        if not business_name:
            raise HTTPException(status_code=400, detail="Utente non ha business_name")
        
        # Aggiorna vino tramite processor client (un campo alla volta)
        from app.core.processor_client import processor_client
        
        updated_fields = []
        errors = []
        
        for field, value in update_data.items():
            # Converti None in stringa vuota per il processor
            value_str = str(value) if value is not None else ""
            
            result = await processor_client.update_wine_field(
                telegram_id=telegram_id,
                business_name=business_name,
                wine_id=wine_id,
                field=field,
                value=value_str
            )
            
            if result.get("status") == "success" or result.get("success"):
                updated_fields.append(field)
            else:
                error_msg = result.get("error", "Errore sconosciuto")
                errors.append(f"{field}: {error_msg}")
        
        if errors:
            logger.warning(f"Alcuni campi non sono stati aggiornati per vino {wine_id}: {errors}")
        
        if updated_fields:
            return {
                "message": "Vino aggiornato con successo",
                "wine_id": wine_id,
                "updated_fields": updated_fields,
                "errors": errors if errors else None
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Errore durante l'aggiornamento: {', '.join(errors)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Errore aggiornamento vino {wine_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")
