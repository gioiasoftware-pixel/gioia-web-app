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
        # Usa getattr per gestire attributi che potrebbero non esistere
        wine_dict = {
            "id": wine.id,
            "name": wine.name,
            "producer": getattr(wine, 'producer', None),
            "quantity": getattr(wine, 'quantity', 0),
            "selling_price": float(wine.selling_price) if getattr(wine, 'selling_price', None) else None,
            "cost_price": float(wine.cost_price) if getattr(wine, 'cost_price', None) else None,
            "vintage": getattr(wine, 'vintage', None),
            "region": getattr(wine, 'region', None),
            "country": getattr(wine, 'country', None),
            "wine_type": getattr(wine, 'wine_type', None),
            "supplier": getattr(wine, 'supplier', None),  # Potrebbe non esistere nel modello Wine
            "grape_variety": getattr(wine, 'grape_variety', None),
            "classification": getattr(wine, 'classification', None),
            "alcohol_content": getattr(wine, 'alcohol_content', None),
            "description": getattr(wine, 'description', None),
            "notes": getattr(wine, 'notes', None),
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
        
        # Escludi 'name' dall'aggiornamento (non modificabile)
        if 'name' in update_data:
            logger.warning(f"Campo 'name' escluso dall'aggiornamento per wine_id={wine_id} (non modificabile)")
            del update_data['name']
        
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
            # Gestione speciale per quantity: usa endpoint con movimento
            if field == 'quantity':
                try:
                    # Valida che quantity sia un intero
                    quantity_int = int(value) if value is not None else None
                    if quantity_int is None or quantity_int < 0:
                        errors.append(f"{field}: Quantità deve essere un intero >= 0")
                        continue
                    
                    result = await processor_client.update_wine_field_with_movement(
                        telegram_id=telegram_id,
                        business_name=business_name,
                        wine_id=wine_id,
                        new_quantity=quantity_int
                    )
                    
                    if result.get("status") == "success" or result.get("success"):
                        updated_fields.append(field)
                        if result.get("movement_created"):
                            logger.info(
                                f"Quantità aggiornata con movimento per wine_id={wine_id}: "
                                f"{result.get('quantity_before')} → {result.get('quantity_after')} "
                                f"({result.get('movement_type')})"
                            )
                    else:
                        error_msg = result.get("error", "Errore sconosciuto")
                        errors.append(f"{field}: {error_msg}")
                except ValueError:
                    errors.append(f"{field}: Valore non valido (deve essere un numero intero)")
                except Exception as e:
                    logger.error(f"Errore aggiornamento quantity per wine_id={wine_id}: {e}", exc_info=True)
                    errors.append(f"{field}: {str(e)}")
            else:
                # Altri campi: usa endpoint normale
                try:
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
                except Exception as e:
                    logger.error(f"Errore aggiornamento campo {field} per wine_id={wine_id}: {e}", exc_info=True)
                    errors.append(f"{field}: {str(e)}")
        
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
