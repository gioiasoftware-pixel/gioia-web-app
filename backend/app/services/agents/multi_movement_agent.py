"""
Multi Movement Agent - Coordina movimenti inventario multipli.
Quando l'utente registra più movimenti in un singolo messaggio,
questo agent estrae tutti i movimenti e li processa sequenzialmente
usando MovementAgent per ogni movimento singolo.
"""
from .movement_agent import MovementAgent
from app.core.database import db_manager
from typing import Dict, Any, Optional, List
import logging
import json
import html
import re

logger = logging.getLogger(__name__)

class MultiMovementAgent:
    """
    Agent specializzato per coordinare movimenti multipli.
    Non usa Assistants API, delega ogni movimento singolo a MovementAgent.
    """
    
    def __init__(self, movement_agent: MovementAgent):
        """
        Inizializza MultiMovementAgent.
        
        Args:
            movement_agent: Istanza di MovementAgent da usare per ogni movimento singolo
        """
        self.name = "MultiMovementAgent"
        self.movement_agent = movement_agent
    
    async def process_with_context(
        self,
        message: str,
        user_id: int,
        thread_id: Optional[str] = None,
        conversation_id: Optional[int] = None
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
            conversation_id: ID conversazione (opzionale, per salvare movimenti pendenti)
        
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
            has_ambiguity = False  # Flag per tracciare se c'è almeno una disambiguazione
            
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
                        # Estrai messaggio di errore (potrebbe essere in 'error' o 'message')
                        error_msg = movement_result.get("error") or movement_result.get("message", "Errore sconosciuto")
                        
                        # Controlla se l'errore contiene HTML con wine cards (ambiguità vino)
                        if movement_result.get("is_html") or "<div class=\"wines-list-card\">" in str(error_msg):
                            # È un errore con wine cards HTML (ambiguità vino)
                            has_ambiguity = True
                            errors.append({
                                "movement": movement,
                                "error": str(error_msg),  # Mantieni HTML originale
                                "status": "error",
                                "is_html": True,  # Marca come HTML
                                "raw_error": error_msg
                            })
                            logger.info(f"[MULTI_MOVEMENT] ⚠️ Movimento {idx} richiede selezione vino (HTML con wine cards)")
                            
                            # Salva i movimenti rimanenti per continuare dopo la disambiguazione
                            remaining_movements = movements[idx:]  # Tutti i movimenti da questo in poi
                            if remaining_movements and conversation_id:
                                try:
                                    await db_manager.save_pending_movements(
                                        conversation_id=conversation_id,
                                        user_id=user_id,
                                        pending_movements=remaining_movements
                                    )
                                    logger.info(f"[MULTI_MOVEMENT] 💾 Salvati {len(remaining_movements)} movimenti rimanenti per conversazione {conversation_id}")
                                except Exception as e:
                                    logger.error(f"[MULTI_MOVEMENT] ❌ Errore salvando movimenti pendenti: {e}", exc_info=True)
                            # Interrompi il loop quando incontriamo una disambiguazione (processeremo i rimanenti dopo)
                            break
                        else:
                            # Errore normale, pulisci HTML
                            error_msg_clean = self._clean_error_message(str(error_msg))
                            errors.append({
                                "movement": movement,
                                "error": error_msg_clean,
                                "status": "error",
                                "is_html": False,
                                "raw_error": error_msg
                            })
                            logger.warning(f"[MULTI_MOVEMENT] ❌ Movimento {idx} fallito: {error_msg_clean}")
                
                except Exception as e:
                    error_msg = str(e)
                    error_msg_clean = self._clean_error_message(error_msg)
                    errors.append({
                        "movement": movement,
                        "error": error_msg_clean,
                        "status": "error",
                        "raw_error": error_msg  # Mantieni errore originale per logging
                    })
                    logger.error(f"[MULTI_MOVEMENT] ❌ Errore processamento movimento {idx}: {error_msg_clean} (raw: {error_msg})", exc_info=True)
            
            # Step 3: Combina risultati
            combined_message, has_html = self._combine_results(results, errors)
            
            return {
                "success": len(errors) == 0 and len(results) > 0,  # Success solo se almeno un movimento è riuscito e nessun errore
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
                "is_html": has_html  # Marca come HTML se ci sono wine cards
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
        Estrae tutti i movimenti dal messaggio usando parsing diretto.
        Delega ad AIServiceV1 per estrazione se parsing fallisce.
        
        Returns:
            Lista di dict con movimenti estratti
        """
        try:
            # Prova prima parsing diretto con regex
            movements = self._parse_movements_direct(message)
            
            if movements:
                logger.info(f"[MULTI_MOVEMENT] ✅ Parsing diretto: {len(movements)} movimenti trovati")
                return movements
            
            # Se parsing diretto fallisce, delega ad AIServiceV1 che può gestire movimenti multipli
            # usando function calling (non Assistants API)
            logger.info(f"[MULTI_MOVEMENT] Parsing diretto fallito, delega ad AIServiceV1")
            from app.services.ai_service import AIService
            ai_service_v1 = AIService()
            result = await ai_service_v1.process_message(
                user_message=message,
                user_id=user_id,
                conversation_history=None
            )
            
            # Se AIServiceV1 ha processato con successo, considera come movimento singolo processato
            # (AIServiceV1 gestisce già movimenti multipli internamente)
            if result.get("message"):
                # Ritorna lista vuota per indicare che è già stato processato da AIServiceV1
                # Il risultato verrà gestito dal chiamante
                return []
            
            return []
        
        except Exception as e:
            logger.error(f"[MULTI_MOVEMENT] ❌ Errore estrazione movimenti: {e}", exc_info=True)
            return []
    
    def _parse_movements_direct(self, message: str) -> List[Dict[str, Any]]:
        """
        Tenta parsing diretto dei movimenti usando regex.
        Funziona per pattern semplici come "3 Barolo e 2 Chianti".
        """
        movements = []
        message_lower = message.lower()
        
        # Determina tipo movimento
        # Parole chiave per RIFORNIMENTO (aumento giacenza = merce entra in magazzino)
        rifornimento_keywords = [
            "rifornito", "ricevuto", "aggiunto", "acquistato", "comprado", 
            "scaricato",  # scaricato dal camion nel magazzino
            "entrato", "arrivato", "inserito", "immesso", "messo",
            "inventariato", "preso in carico"
        ]
        # Parole chiave per CONSUMO (diminuzione giacenza = merce esce dal magazzino)
        consumo_keywords = [
            "consumato", "venduto", "bevuto", "usato", "tolto", "rimosso",
            "prelevato", "ritirato", "dato via", "consegnato", "spedito",
            "uscite", "uscito", "consegnato a", "venduto a", "caricato"  # caricato sul camion dal magazzino
        ]
        
        movement_type = "consumo"  # Default
        # Controlla prima rifornimento (priorità più alta se presenti entrambi)
        if any(word in message_lower for word in rifornimento_keywords):
            movement_type = "rifornimento"
        elif any(word in message_lower for word in consumo_keywords):
            movement_type = "consumo"
        
        # Pattern per trovare quantità + nome vino
        # Es: "3 Barolo", "5 bottiglie di Chianti", "10 Brunello"
        pattern = r'(\d+)\s+(?:bottiglie?\s+di\s+)?([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)*)'
        matches = re.finditer(pattern, message, re.IGNORECASE)
        
        for match in matches:
            quantity = int(match.group(1))
            wine_name = match.group(2).strip()
            
            # Pulisci nome vino (rimuovi parole comuni)
            wine_name = re.sub(r'\b(e|di|del|della|dei|delle|il|la|lo|i|gli|le)\b', '', wine_name, flags=re.IGNORECASE).strip()
            
            if wine_name and quantity > 0:
                movements.append({
                    "type": movement_type,
                    "wine_name": wine_name,
                    "quantity": quantity
                })
        
        return movements
    
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
    ) -> tuple[str, bool]:
        """
        Combina risultati dei movimenti in un messaggio unificato.
        
        Returns:
            Tuple (messaggio, has_html): Messaggio combinato e flag se contiene HTML
        """
        import re
        
        parts = []
        has_html = False
        
        if results:
            # Aggiungi risultati di successo (potrebbero essere HTML se MovementAgent ha ritornato wine cards)
            for res in results:
                mov_result = res.get("result", {})
                if mov_result.get("is_html"):
                    # Risultato contiene HTML (es. wine card movimento)
                    parts.append(mov_result.get("message", ""))
                    has_html = True
                else:
                    # Risultato testo normale
                    mov = res["movement"]
                    type_text = "Consumo" if mov["type"] == "consumo" else "Rifornimento"
                    parts.append(f"✅ {type_text} di {mov['quantity']} bottiglie di {mov['wine_name']} registrato con successo")
        
        if errors:
            # Aggiungi errori (alcuni potrebbero essere HTML con wine cards per selezione)
            html_errors = []
            text_errors = []
            
            for err in errors:
                if err.get("is_html"):
                    # Errore con HTML (wine cards per selezione vino)
                    html_errors.append(err.get("error", ""))
                    has_html = True
                else:
                    # Errore testo normale
                    mov = err["movement"]
                    type_text = "Consumo" if mov["type"] == "consumo" else "Rifornimento"
                    error_msg = err.get("error", "Errore sconosciuto")
                    text_errors.append(f"❌ {type_text} di {mov['quantity']} bottiglie di {mov['wine_name']}: {error_msg}")
            
            # Aggiungi errori HTML (wine cards) prima degli errori testo
            if html_errors:
                parts.extend(html_errors)
            
            if text_errors:
                parts.append(f"\n**Errori ({len(text_errors)}):**")
                parts.extend(text_errors)
        
        if has_html:
            # Se c'è HTML, unisci tutto (HTML può contenere già <br> tra le parti)
            combined = "<br>".join(parts) if parts else "Nessun movimento processato."
        else:
            # Se è tutto testo, unisci con newline
            combined = "\n".join(parts) if parts else "Nessun movimento processato."
        
        return combined, has_html
    
    def _clean_error_message(self, error_msg: str) -> str:
        """
        Pulisce messaggio di errore rimuovendo HTML grezzo e estraendo solo il testo utile.
        
        Args:
            error_msg: Messaggio di errore che potrebbe contenere HTML
        
        Returns:
            Messaggio di errore pulito e leggibile
        """
        if not error_msg:
            return "Errore sconosciuto"
        
        # Decodifica entità HTML come &#x27; -> '
        error_msg = html.unescape(error_msg)
        
        # Rimuovi tag HTML
        error_msg = re.sub(r'<[^>]+>', '', error_msg)
        
        # Rimuovi prefissi comuni tipo "register_replenishment:" o "register_consumption:"
        error_msg = re.sub(r'^(register_replenishment|register_consumption|movement_agent):\s*', '', error_msg, flags=re.IGNORECASE)
        
        # Cerca pattern comuni di errore e estrai solo il messaggio utile
        # Es: "Errore: Vino 'X' non trovato"
        error_patterns = [
            r"Errore:\s*(.+)",
            r"error:\s*(.+)",
            r"Vino\s+['\"](.+?)['\"]\s+non\s+trovato",
            r"(.+?non\s+trovato)",
            r"(.+?non\s+esiste)",
            r"(.+?non\s+disponibile)",
        ]
        
        for pattern in error_patterns:
            match = re.search(pattern, error_msg, re.IGNORECASE)
            if match:
                extracted = match.group(1) if match.lastindex else match.group(0)
                # Se contiene "Vino 'X' non trovato", formatta meglio
                if "non trovato" in extracted or "non esiste" in extracted:
                    # Cerca nome vino tra apici
                    wine_match = re.search(r"['\"](.+?)['\"]", extracted)
                    if wine_match:
                        wine_name = wine_match.group(1)
                        return f"Vino '{wine_name}' non trovato nell'inventario"
                    return extracted.strip()
        
        # Rimuovi spazi multipli e pulisci
        error_msg = re.sub(r'\s+', ' ', error_msg).strip()
        
        # Limita lunghezza
        if len(error_msg) > 200:
            error_msg = error_msg[:200] + "..."
        
        return error_msg if error_msg else "Errore sconosciuto"

    def _format_context(self, context: Dict[str, Any]) -> str:
        """Formatta contesto per l'agent (non più usato, mantenuto per compatibilità)"""
        user_id = context.get("user_id")
        return f"Contesto utente: User ID {user_id}"

