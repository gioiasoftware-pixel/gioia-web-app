"""
Multi Movement Agent - Coordina movimenti inventario multipli.
Quando l'utente registra più movimenti in un singolo messaggio,
questo agent estrae tutti i movimenti e li processa sequenzialmente
usando MovementAgent per ogni movimento singolo.
"""
from .base_agent import BaseAgent
from .movement_agent import MovementAgent
from app.core.database import db_manager
from app.core.processor_client import processor_client
from typing import Dict, Any, Optional, List
import logging
import json

logger = logging.getLogger(__name__)

class MultiMovementAgent(BaseAgent):
    """Agent specializzato per coordinare movimenti multipli"""
    
    def __init__(self, movement_agent: MovementAgent):
        """
        Inizializza MultiMovementAgent.
        
        Args:
            movement_agent: Istanza di MovementAgent da usare per ogni movimento singolo
        """
        instructions = """
        Sei un coordinatore specializzato per gestire movimenti inventario multipli.
        
        Quando ricevi un messaggio con più movimenti (es: "ho venduto 3 Barolo e 2 Chianti"),
        devi:
        1. Identificare TUTTI i movimenti nel messaggio
        2. Per ogni movimento, estrarre:
           - Tipo di movimento (consumo/rifornimento)
           - Nome del vino
           - Quantità
        3. Organizzare i movimenti in una lista strutturata
        4. Processare ogni movimento singolarmente
        
        IMPORTANTE:
        - Riconosci movimenti multipli da messaggi come:
          * "Ho venduto 3 Barolo e 2 Chianti"
          * "Ricevuto 10 Brunello, 5 Amarone e 3 Chianti"
          * "Consumati 2 Barolo, 1 Chianti e 4 Brunello"
        - Supporta congiunzioni: "e", ",", "più"
        - Distingui tra consumo e rifornimento nel contesto
        - Estrai sempre quantità numeriche precise
        
        Rispondi con un JSON che contiene una lista di movimenti estratti:
        {
            "movements": [
                {
                    "type": "consumo" | "rifornimento",
                    "wine_name": "Nome vino",
                    "quantity": numero
                },
                ...
            ]
        }
        """
        
        super().__init__(
            name="MultiMovementAgent",
            instructions=instructions,
            model="gpt-4o"
        )
        
        self.movement_agent = movement_agent
    
    async def process_with_context(
        self,
        message: str,
        user_id: int,
        thread_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processa messaggio con movimenti multipli.
        
        Flow:
        1. Analizza messaggio e estrae tutti i movimenti
        2. Per ogni movimento, chiama MovementAgent per processarlo
        3. Combina i risultati e fornisce feedback unificato
        
        Args:
            message: Messaggio dell'utente contenente movimenti multipli
            user_id: ID utente
            thread_id: ID thread (opzionale)
        
        Returns:
            Dict con risposta combinata e metadati
        """
        try:
            # Step 1: Estrai movimenti multipli dal messaggio
            logger.info(f"[MULTI_MOVEMENT] Estrazione movimenti multipli da: {message[:100]}...")
            movements = await self._extract_movements(message, user_id)
            
            if not movements or len(movements) == 0:
                return {
                    "success": False,
                    "error": "Non sono riuscito a identificare movimenti multipli nel messaggio. Prova a essere più specifico.",
                    "agent": self.name
                }
            
            if len(movements) == 1:
                # Se è un solo movimento, fallback a MovementAgent diretto
                logger.info(f"[MULTI_MOVEMENT] Rilevato solo 1 movimento, reindirizzamento a MovementAgent")
                return await self.movement_agent.process_with_context(
                    message=message,
                    user_id=user_id,
                    thread_id=thread_id
                )
            
            logger.info(f"[MULTI_MOVEMENT] ✅ Estratti {len(movements)} movimenti, avvio processamento sequenziale")
            
            # Step 2: Processa ogni movimento usando MovementAgent
            results = []
            errors = []
            
            for idx, movement in enumerate(movements, 1):
                movement_type = movement.get("type", "")
                wine_name = movement.get("wine_name", "")
                quantity = movement.get("quantity", 0)
                
                logger.info(f"[MULTI_MOVEMENT] Processamento movimento {idx}/{len(movements)}: {movement_type} {quantity}x {wine_name}")
                
                # Prepara messaggio specifico per MovementAgent
                movement_message = self._prepare_movement_message(movement_type, wine_name, quantity)
                
                # Processa movimento singolo
                try:
                    movement_result = await self.movement_agent.process_with_context(
                        message=movement_message,
                        user_id=user_id,
                        thread_id=thread_id
                    )
                    
                    if movement_result.get("success"):
                        results.append({
                            "movement": movement,
                            "result": movement_result,
                            "status": "success"
                        })
                    else:
                        error_msg = movement_result.get("error", "Errore sconosciuto")
                        errors.append({
                            "movement": movement,
                            "error": error_msg,
                            "status": "error"
                        })
                        logger.warning(f"[MULTI_MOVEMENT] ❌ Movimento {idx} fallito: {error_msg}")
                
                except Exception as e:
                    error_msg = str(e)
                    errors.append({
                        "movement": movement,
                        "error": error_msg,
                        "status": "error"
                    })
                    logger.error(f"[MULTI_MOVEMENT] ❌ Errore processamento movimento {idx}: {e}", exc_info=True)
            
            # Step 3: Combina risultati
            combined_message = self._combine_results(results, errors)
            
            return {
                "success": len(errors) == 0,
                "message": combined_message,
                "metadata": {
                    "type": "multi_movement",
                    "total": len(movements),
                    "successful": len(results),
                    "failed": len(errors),
                    "results": results,
                    "errors": errors
                },
                "agent": self.name,
                "is_html": False
            }
        
        except Exception as e:
            logger.error(f"[MULTI_MOVEMENT] ❌ Errore processamento movimenti multipli: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Errore durante il processamento dei movimenti multipli: {str(e)}",
                "agent": self.name
            }
    
    async def _extract_movements(
        self,
        message: str,
        user_id: int
    ) -> List[Dict[str, Any]]:
        """
        Estrae tutti i movimenti dal messaggio usando AI.
        
        Returns:
            Lista di dict con movimenti estratti
        """
        try:
            # Aggiungi contesto inventario per migliorare l'estrazione
            context = await self._get_inventory_context(user_id)
            enhanced_message = f"""
Messaggio utente: {message}

Contesto inventario:
{context}

Analizza il messaggio e estrai TUTTI i movimenti (consumo/rifornimento).
Rispondi SOLO con un JSON valido nel formato:
{{
    "movements": [
        {{"type": "consumo", "wine_name": "Nome vino", "quantity": numero}},
        ...
    ]
}}
"""
            
            # Usa l'AI per estrarre movimenti
            result = await self.process(
                message=enhanced_message,
                user_id=user_id
            )
            
            if not result.get("success"):
                logger.error(f"[MULTI_MOVEMENT] ❌ Errore estrazione movimenti: {result.get('error')}")
                return []
            
            response_text = result.get("message", "").strip()
            
            # Estrai JSON dalla risposta (potrebbe essere racchiuso in markdown code block)
            json_text = self._extract_json_from_response(response_text)
            
            if not json_text:
                logger.warning(f"[MULTI_MOVEMENT] ⚠️ Nessun JSON trovato nella risposta: {response_text}")
                return []
            
            # Parse JSON
            data = json.loads(json_text)
            movements = data.get("movements", [])
            
            # Valida movimenti estratti
            validated_movements = []
            for mov in movements:
                if isinstance(mov, dict) and all(k in mov for k in ["type", "wine_name", "quantity"]):
                    if mov["type"] in ["consumo", "rifornimento"] and mov["quantity"] > 0:
                        validated_movements.append(mov)
            
            logger.info(f"[MULTI_MOVEMENT] ✅ Estratti {len(validated_movements)} movimenti validi")
            return validated_movements
        
        except json.JSONDecodeError as e:
            logger.error(f"[MULTI_MOVEMENT] ❌ Errore parsing JSON: {e}")
            return []
        except Exception as e:
            logger.error(f"[MULTI_MOVEMENT] ❌ Errore estrazione movimenti: {e}", exc_info=True)
            return []
    
    def _extract_json_from_response(self, response: str) -> Optional[str]:
        """Estrae JSON da risposta che potrebbe contenere markdown code blocks"""
        response = response.strip()
        
        # Cerca JSON in code block
        if "```json" in response:
            start = response.find("```json") + 7
            end = response.find("```", start)
            if end > start:
                return response[start:end].strip()
        elif "```" in response:
            start = response.find("```") + 3
            end = response.find("```", start)
            if end > start:
                return response[start:end].strip()
        
        # Cerca JSON object diretto
        start = response.find("{")
        end = response.rfind("}") + 1
        if start >= 0 and end > start:
            return response[start:end].strip()
        
        return None
    
    def _prepare_movement_message(
        self,
        movement_type: str,
        wine_name: str,
        quantity: int
    ) -> str:
        """Prepara messaggio strutturato per MovementAgent"""
        type_text = "consumo" if movement_type == "consumo" else "rifornimento"
        return f"Registra {type_text} di {quantity} bottiglie di {wine_name}"
    
    async def _get_inventory_context(self, user_id: int) -> str:
        """Ottiene contesto inventario per migliorare estrazione"""
        try:
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return "Inventario vuoto."
            
            context = f"Inventario contiene {len(wines)} vini:\n"
            for wine in wines[:20]:  # Primi 20 vini
                wine_info = f"- {wine.name}"
                if wine.producer:
                    wine_info += f" ({wine.producer})"
                if wine.vintage:
                    wine_info += f" {wine.vintage}"
                context += wine_info + "\n"
            
            if len(wines) > 20:
                context += f"... e altri {len(wines) - 20} vini.\n"
            
            return context
        except Exception as e:
            logger.error(f"[MULTI_MOVEMENT] Errore recupero contesto inventario: {e}")
            return "Errore nel recupero informazioni inventario."
    
    def _combine_results(
        self,
        results: List[Dict[str, Any]],
        errors: List[Dict[str, Any]]
    ) -> str:
        """Combina risultati dei movimenti in un messaggio unificato"""
        parts = []
        
        if results:
            parts.append(f"✅ **Movimenti registrati con successo ({len(results)}):**\n")
            for idx, res in enumerate(results, 1):
                mov = res["movement"]
                type_text = "Consumo" if mov["type"] == "consumo" else "Rifornimento"
                parts.append(f"{idx}. {type_text} di {mov['quantity']} bottiglie di {mov['wine_name']}")
        
        if errors:
            parts.append(f"\n❌ **Movimenti non registrati ({len(errors)}):**\n")
            for idx, err in enumerate(errors, 1):
                mov = err["movement"]
                type_text = "Consumo" if mov["type"] == "consumo" else "Rifornimento"
                error_msg = err.get("error", "Errore sconosciuto")
                parts.append(f"{idx}. {type_text} di {mov['quantity']} bottiglie di {mov['wine_name']}: {error_msg}")
        
        return "\n".join(parts) if parts else "Nessun movimento processato."

    def _format_context(self, context: Dict[str, Any]) -> str:
        """Formatta contesto per l'agent"""
        user_id = context.get("user_id")
        return f"Contesto utente: User ID {user_id}"

