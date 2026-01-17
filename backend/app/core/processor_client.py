"""
Client per comunicare con il microservizio Gioia Processor.
Reuse completo da telegram-ai-bot
"""
import logging
import aiohttp
from typing import Optional, Dict, Any
from app.core.config import get_settings

logger = logging.getLogger(__name__)


class ProcessorClient:
    """Client per comunicare con il microservizio processor."""
    
    def __init__(self, base_url: str = None):
        settings = get_settings()
        self.base_url = base_url or settings.PROCESSOR_URL.rstrip('/')
        logger.info(f"[PROCESSOR_CLIENT] Inizializzato con URL: {self.base_url}")
    
    async def _make_request(
        self,
        method: str,
        endpoint: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Esegue una richiesta HTTP al processor."""
        url = f"{self.base_url}{endpoint}"
        
        try:
            timeout = aiohttp.ClientTimeout(total=30.0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.request(method, url, **kwargs) as response:
                    response.raise_for_status()
                    return await response.json()
        except aiohttp.ClientResponseError as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore {method} {endpoint}: HTTP {e.status} - {e.message}")
            if e.status == 404:
                return {"status": "error", "error": f"Endpoint non trovato: {endpoint}"}
            return {"status": "error", "error": f"HTTP {e.status}: {e.message[:200]}"}
        except aiohttp.ClientError as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore connessione {method} {endpoint}: {e}")
            return {"status": "error", "error": f"Errore connessione: {str(e)}"}
        except Exception as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore inaspettato {method} {endpoint}: {e}", exc_info=True)
            return {"status": "error", "error": f"Errore inaspettato: {str(e)}"}
    
    async def health_check(self) -> Dict[str, Any]:
        """Verifica stato del processor."""
        return await self._make_request("GET", "/health")
    
    async def create_tables(self, user_id: int, business_name: str) -> Dict[str, Any]:
        """Crea tabelle utente nel processor."""
        logger.info(f"[PROCESSOR_CLIENT] Chiamata create_tables: user_id={user_id}, business_name={business_name}")
        
        try:
            timeout = aiohttp.ClientTimeout(total=30.0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self.base_url}/create-tables",
                    data={
                        "user_id": user_id,  # Passa user_id come user_id per retrocompatibilità
                        "business_name": business_name
                    }
                ) as response:
                    response.raise_for_status()
                    result = await response.json()
                    logger.info(f"[PROCESSOR_CLIENT] create_tables successo: {result}")
                    return result
        except aiohttp.ClientResponseError as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore create_tables: HTTP {e.status} - {e.message}")
            if e.status == 404:
                return {"status": "error", "error": f"Endpoint /create-tables non trovato (404)"}
            return {"status": "error", "error": f"HTTP {e.status}: {e.message[:200]}"}
        except aiohttp.ClientError as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore connessione create_tables: {e}")
            return {"status": "error", "error": f"Errore connessione: {str(e)}"}
        except Exception as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore inaspettato create_tables: {e}", exc_info=True)
            return {"status": "error", "error": f"Errore inaspettato: {str(e)}"}
    
    async def process_inventory(
        self,
        user_id: int,
        business_name: str,
        file_type: str,
        file_content: bytes,
        file_name: str,
        client_msg_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
        mode: str = "add"
    ) -> Dict[str, Any]:
        """Invia file inventario al processor per elaborazione."""
        logger.info(
            f"[PROCESSOR_CLIENT] process_inventory: user_id={user_id}, "
            f"business_name={business_name}, file_type={file_type}, file_name={file_name}, "
            f"file_size={len(file_content)} bytes"
        )
        
        data = {
            "user_id": user_id,  # Passa user_id come user_id per retrocompatibilità
            "business_name": business_name,
            "file_type": file_type,
            "mode": mode
        }
        if client_msg_id:
            data["client_msg_id"] = client_msg_id
        if correlation_id:
            data["correlation_id"] = correlation_id
        
        try:
            timeout = aiohttp.ClientTimeout(total=60.0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                form_data = aiohttp.FormData()
                form_data.add_field('file', file_content, filename=file_name)
                for key, value in data.items():
                    form_data.add_field(key, str(value))
                
                async with session.post(
                    f"{self.base_url}/process-inventory",
                    data=form_data
                ) as response:
                    response.raise_for_status()
                    return await response.json()
        except aiohttp.ClientResponseError as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore process_inventory: HTTP {e.status} - {e.message}")
            return {"status": "error", "error": f"HTTP {e.status}: {e.message[:200]}"}
        except Exception as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore process_inventory: {e}", exc_info=True)
            return {"status": "error", "error": str(e)}
    
    async def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Ottiene stato di un job di elaborazione."""
        return await self._make_request("GET", f"/status/{job_id}")
    
    async def wait_for_job_completion(
        self,
        job_id: str,
        max_wait_seconds: int = 300,
        poll_interval: float = 2.0
    ) -> Dict[str, Any]:
        """Attende completamento di un job con polling."""
        import asyncio
        import time
        
        start_time = time.time()
        
        while time.time() - start_time < max_wait_seconds:
            status = await self.get_job_status(job_id)
            
            if status.get('status') == 'completed':
                return status
            elif status.get('status') == 'error' or status.get('status') == 'failed':
                return status
            
            await asyncio.sleep(poll_interval)
        
        return {
            "status": "timeout",
            "job_id": job_id,
            "error": f"Timeout dopo {max_wait_seconds} secondi"
        }
    
    async def process_movement(
        self,
        user_id: int,
        business_name: str,
        wine_name: str,
        movement_type: str,
        quantity: int
    ) -> Dict[str, Any]:
        """Processa un movimento inventario (consumo o rifornimento)."""
        logger.info(
            f"[PROCESSOR_CLIENT] process_movement: user_id={user_id}, "
            f"business_name={business_name}, wine_name={wine_name}, "
            f"movement_type={movement_type}, quantity={quantity}"
        )
        
        try:
            timeout = aiohttp.ClientTimeout(total=30.0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self.base_url}/process-movement",
                    data={
                        "user_id": user_id,
                        "business_name": business_name,
                        "wine_name": wine_name,
                        "movement_type": movement_type,
                        "quantity": quantity
                    }
                ) as response:
                    response.raise_for_status()
                    return await response.json()
        except aiohttp.ClientResponseError as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore process_movement: HTTP {e.status} - {e.message}")
            return {"status": "error", "error": f"HTTP {e.status}: {e.message[:200]}"}
        except Exception as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore process_movement: {e}", exc_info=True)
            return {"status": "error", "error": str(e)}
    
    async def update_wine_field(
        self,
        user_id: int,
        business_name: str,
        wine_id: int,
        field: str,
        value: str
    ) -> Dict[str, Any]:
        """Aggiorna un campo di un vino."""
        logger.info(
            f"[PROCESSOR_CLIENT] update_wine_field: user_id={user_id}, "
            f"wine_id={wine_id}, field={field}"
        )
        
        try:
            timeout = aiohttp.ClientTimeout(total=30.0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self.base_url}/admin/update-wine-field",
                    data={
                        "user_id": user_id,
                        "business_name": business_name,
                        "wine_id": wine_id,
                        "field": field,
                        "value": value
                    }
                ) as response:
                    response.raise_for_status()
                    return await response.json()
        except aiohttp.ClientResponseError as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore update_wine_field: HTTP {e.status} - {e.message}")
            return {"status": "error", "error": f"HTTP {e.status}: {e.message[:200]}"}
        except Exception as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore update_wine_field: {e}", exc_info=True)
            return {"status": "error", "error": str(e)}
    
    async def update_wine_field_with_movement(
        self,
        user_id: int,
        business_name: str,
        wine_id: int,
        new_quantity: int
    ) -> Dict[str, Any]:
        """
        Aggiorna campo quantity creando automaticamente un movimento nel log.
        Mantiene il flusso di tracciabilità come se fosse fatto in chat.
        """
        logger.info(
            f"[PROCESSOR_CLIENT] update_wine_field_with_movement: user_id={user_id}, "
            f"wine_id={wine_id}, new_quantity={new_quantity}"
        )
        
        try:
            timeout = aiohttp.ClientTimeout(total=30.0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(
                    f"{self.base_url}/admin/update-wine-field-with-movement",
                    data={
                        "user_id": user_id,
                        "business_name": business_name,
                        "wine_id": wine_id,
                        "field": "quantity",
                        "new_value": str(new_quantity)
                    }
                ) as response:
                    response.raise_for_status()
                    result = await response.json()
                    if result.get("status") == "success":
                        logger.info(
                            f"[PROCESSOR_CLIENT] update_wine_field_with_movement successo: "
                            f"wine_id={wine_id}, movement_created={result.get('movement_created', False)}, "
                            f"movement_type={result.get('movement_type', 'N/A')}"
                        )
                    return result
        except aiohttp.ClientResponseError as e:
            logger.error(
                f"[PROCESSOR_CLIENT] Errore update_wine_field_with_movement: HTTP {e.status} - {e.message}"
            )
            return {"status": "error", "error": f"HTTP {e.status}: {e.message[:200]}"}
        except Exception as e:
            logger.error(
                f"[PROCESSOR_CLIENT] Errore update_wine_field_with_movement: {e}",
                exc_info=True
            )
            return {"status": "error", "error": str(e)}
    
    async def delete_tables(self, user_id: int, business_name: str) -> Dict[str, Any]:
        """Elimina tabelle utente."""
        logger.info(f"[PROCESSOR_CLIENT] delete_tables: user_id={user_id}, business_name={business_name}")
        
        try:
            timeout = aiohttp.ClientTimeout(total=30.0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.delete(
                    f"{self.base_url}/tables/{user_id}",
                    params={"business_name": business_name}
                ) as response:
                    response.raise_for_status()
                    return await response.json()
        except aiohttp.ClientResponseError as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore delete_tables: HTTP {e.status} - {e.message}")
            return {"status": "error", "error": f"HTTP {e.status}: {e.message[:200]}"}
        except Exception as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore delete_tables: {e}", exc_info=True)
            return {"status": "error", "error": str(e)}
    
    async def admin_insert_inventory(
        self,
        user_id: int,
        business_name: str,
        file_content: bytes,
        file_name: str,
        mode: str = "replace"  # "add" o "replace" - default replace per onboarding
    ) -> Dict[str, Any]:
        """
        Inserisce inventario pulito direttamente nel database (come admin bot).
        NON passa attraverso la pipeline, inserisce direttamente i dati dal CSV.
        """
        logger.info(
            f"[PROCESSOR_CLIENT] admin_insert_inventory: user_id={user_id}, "
            f"business_name={business_name}, file_name={file_name}, "
            f"file_size={len(file_content)} bytes, mode={mode}"
        )
        
        try:
            timeout = aiohttp.ClientTimeout(total=60.0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                form_data = aiohttp.FormData()
                form_data.add_field('file', file_content, filename=file_name)
                form_data.add_field('user_id', str(user_id))
                form_data.add_field('business_name', business_name)
                form_data.add_field('mode', mode)
                
                async with session.post(
                    f"{self.base_url}/admin/insert-inventory",
                    data=form_data
                ) as response:
                    response.raise_for_status()
                    result = await response.json()
                    logger.info(f"[PROCESSOR_CLIENT] admin_insert_inventory successo: {result}")
                    return result
        except aiohttp.ClientResponseError as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore admin_insert_inventory: HTTP {e.status} - {e.message}")
            return {"status": "error", "error": f"HTTP {e.status}: {e.message[:200]}"}
        except Exception as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore admin_insert_inventory: {e}", exc_info=True)
            return {"status": "error", "error": str(e)}
    
    async def add_wine(
        self,
        user_id: int,
        business_name: str,
        wine_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Aggiunge un nuovo vino all'inventario.
        """
        logger.info(
            f"[PROCESSOR_CLIENT] add_wine: user_id={user_id}, "
            f"business_name={business_name}, wine_name={wine_data.get('name')}"
        )
        
        try:
            timeout = aiohttp.ClientTimeout(total=30.0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                # Prepara dati form
                form_data = aiohttp.FormData()
                form_data.add_field('user_id', str(user_id))
                form_data.add_field('business_name', business_name)
                
                # Aggiungi tutti i campi del vino
                for key, value in wine_data.items():
                    if value is not None:
                        form_data.add_field(key, str(value))
                
                async with session.post(
                    f"{self.base_url}/admin/add-wine",
                    data=form_data
                ) as response:
                    response.raise_for_status()
                    result = await response.json()
                    
                    logger.info(
                        f"[PROCESSOR_CLIENT] add_wine completato: wine_id={result.get('wine_id')}, "
                        f"wine_name={wine_data.get('name')}"
                    )
                    
                    return result
        except aiohttp.ClientResponseError as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore add_wine: HTTP {e.status} - {e.message}")
            return {"status": "error", "error": f"HTTP {e.status}: {e.message[:200]}"}
        except Exception as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore add_wine: {e}", exc_info=True)
            return {"status": "error", "error": str(e)}
    
    async def get_daily_report_pdf(
        self,
        user_id: int,
        report_date: str = None  # Formato YYYY-MM-DD, default: ieri
    ) -> Optional[bytes]:
        """
        Recupera PDF report giornaliero per un utente.
        
        Args:
            user_id: ID utente
            report_date: Data report in formato YYYY-MM-DD (default: ieri)
        
        Returns:
            Bytes del PDF o None se errore
        """
        try:
            url = f"{self.base_url}/api/reports/daily/{user_id}"
            if report_date:
                url += f"?report_date={report_date}"
            
            timeout = aiohttp.ClientTimeout(total=30.0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url) as response:
                    if response.status == 404:
                        logger.debug(f"[PROCESSOR_CLIENT] Report PDF non trovato per user_id={user_id}, date={report_date}")
                        return None
                    response.raise_for_status()
                    pdf_data = await response.read()
                    logger.info(f"[PROCESSOR_CLIENT] PDF recuperato: {len(pdf_data)} bytes per user_id={user_id}")
                    return pdf_data
        except aiohttp.ClientResponseError as e:
            if e.status == 404:
                logger.debug(f"[PROCESSOR_CLIENT] Report PDF non trovato: {e}")
                return None
            logger.error(f"[PROCESSOR_CLIENT] Errore get_daily_report_pdf: HTTP {e.status} - {e.message}")
            return None
        except Exception as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore get_daily_report_pdf: {e}", exc_info=True)
            return None

    async def get_movements_report_pdf_range(
        self,
        user_id: int,
        start_date: str,
        end_date: str
    ) -> Optional[bytes]:
        """
        Recupera PDF report movimenti per un range di date.

        Args:
            user_id: ID utente
            start_date: Data inizio (YYYY-MM-DD)
            end_date: Data fine (YYYY-MM-DD)
        """
        try:
            url = f"{self.base_url}/api/reports/movements/{user_id}"
            url += f"?start_date={start_date}&end_date={end_date}"

            timeout = aiohttp.ClientTimeout(total=30.0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url) as response:
                    if response.status == 404:
                        logger.debug(
                            f"[PROCESSOR_CLIENT] Report movimenti range non trovato per user_id={user_id}, "
                            f"start_date={start_date}, end_date={end_date}"
                        )
                        return None
                    response.raise_for_status()
                    pdf_data = await response.read()
                    logger.info(
                        f"[PROCESSOR_CLIENT] PDF movimenti range recuperato: {len(pdf_data)} bytes "
                        f"per user_id={user_id}, start_date={start_date}, end_date={end_date}"
                    )
                    return pdf_data
        except aiohttp.ClientResponseError as e:
            if e.status == 404:
                logger.debug(f"[PROCESSOR_CLIENT] Report movimenti range non trovato: {e}")
                return None
            logger.error(f"[PROCESSOR_CLIENT] Errore get_movements_report_pdf_range: HTTP {e.status} - {e.message}")
            return None
        except Exception as e:
            logger.error(f"[PROCESSOR_CLIENT] Errore get_movements_report_pdf_range: {e}", exc_info=True)
            return None


# Istanza globale del client
processor_client = ProcessorClient()

