"""
Validation Agent - Specializzato per validazione dati e prevenzione errori.
Controlla qualità dati prima di operazioni critiche.
"""
from .base_agent import BaseAgent
from app.core.database import db_manager
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)

class ValidationAgent(BaseAgent):
    """Agent specializzato per validazione e controllo qualità"""
    
    def __init__(self):
        instructions = """
        Sei un validatore esperto di dati inventario vini.
        
        Il tuo compito è validare dati prima di operazioni critiche:
        1. Movimenti inventario (consumi/rifornimenti)
        2. Creazione/modifica vini
        3. Operazioni di eliminazione
        4. Dati anomali o sospetti
        
        Controlli da eseguire:
        - Quantità non negative
        - Vini esistenti nell'inventario
        - Stock sufficiente per consumi
        - Quantità ragionevoli (outlier detection)
        - Coerenza logica (prezzi, date, annate)
        - Formati validi (email, URL, date)
        - Range validi (prezzi, quantità, annate)
        - Relazioni tra campi (regione-paese, tipo-vitigno)
        
        IMPORTANTE:
        - Identifica sempre potenziali errori PRIMA che vengano salvati
        - Suggerisci correzioni quando possibile
        - Chiedi conferma per operazioni rischiose
        - Fornisci feedback chiaro e costruttivo
        - Mantieni un tono professionale ma utile
        """
        
        super().__init__(
            name="ValidationAgent",
            instructions=instructions,
            model="gpt-4o-mini"  # Modello economico per validazioni
        )
    
    async def validate_movement(
        self,
        wine_id: int,
        movement_type: str,
        quantity: int,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Valida un movimento prima della registrazione.
        
        Args:
            wine_id: ID vino
            movement_type: Tipo movimento (consumo/rifornimento)
            quantity: Quantità
            user_id: ID utente
        
        Returns:
            Dict con:
                - valid: bool
                - warnings: List[str] (avvisi non bloccanti)
                - errors: List[str] (errori bloccanti)
                - suggestions: List[str] (suggerimenti)
        """
        try:
            # Recupera vino
            wine = await db_manager.get_wine_by_id(user_id, wine_id)
            if not wine:
                return {
                    "valid": False,
                    "errors": [f"Vino con ID {wine_id} non trovato nell'inventario"],
                    "warnings": [],
                    "suggestions": []
                }
            
            warnings = []
            errors = []
            suggestions = []
            
            # Validazione quantità
            if quantity <= 0:
                errors.append("La quantità deve essere maggiore di zero")
            elif quantity > 1000:
                warnings.append(f"Quantità molto alta ({quantity}). Verifica che sia corretta.")
                suggestions.append("Se è un errore di battitura, correggi la quantità")
            
            # Validazione stock per consumi
            if movement_type == "consumo":
                current_stock = wine.quantity or 0
                if quantity > current_stock:
                    errors.append(
                        f"Stock insufficiente: hai {current_stock} bottiglie disponibili, "
                        f"stai cercando di consumare {quantity}"
                    )
                    suggestions.append(f"Verifica la quantità o registra prima un rifornimento")
                elif quantity > current_stock * 0.8:
                    warnings.append(
                        f"Consumo elevato: stai consumando {quantity} su {current_stock} bottiglie disponibili "
                        f"({(quantity/current_stock*100):.1f}%)"
                    )
            
            # Validazione coerenza temporale (se implementato)
            # Potrebbe controllare movimenti futuri o date inconsistenti
            
            valid = len(errors) == 0
            
            return {
                "valid": valid,
                "errors": errors,
                "warnings": warnings,
                "suggestions": suggestions,
                "wine_name": wine.name,
                "current_stock": wine.quantity or 0
            }
        
        except Exception as e:
            logger.error(f"[VALIDATION] Errore validazione movimento: {e}", exc_info=True)
            return {
                "valid": False,
                "errors": [f"Errore durante la validazione: {str(e)}"],
                "warnings": [],
                "suggestions": []
            }
    
    async def validate_wine_data(
        self,
        wine_data: Dict[str, Any],
        user_id: int,
        is_update: bool = False,
        wine_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Valida dati vino prima di creazione/modifica.
        
        Args:
            wine_data: Dict con dati vino
            user_id: ID utente
            is_update: True se è un aggiornamento
            wine_id: ID vino (se update)
        
        Returns:
            Dict con validazione
        """
        try:
            warnings = []
            errors = []
            suggestions = []
            
            # Validazione nome (obbligatorio)
            name = wine_data.get("name", "").strip()
            if not name:
                errors.append("Il nome del vino è obbligatorio")
            
            # Validazione quantità
            quantity = wine_data.get("quantity")
            if quantity is not None:
                if quantity < 0:
                    errors.append("La quantità non può essere negativa")
                elif quantity > 10000:
                    warnings.append(f"Quantità molto alta ({quantity}). Verifica che sia corretta.")
            
            # Validazione prezzi
            selling_price = wine_data.get("selling_price")
            cost_price = wine_data.get("cost_price")
            
            if selling_price is not None and selling_price < 0:
                errors.append("Il prezzo di vendita non può essere negativo")
            if cost_price is not None and cost_price < 0:
                errors.append("Il prezzo di acquisto non può essere negativo")
            
            if selling_price is not None and cost_price is not None:
                if selling_price < cost_price:
                    warnings.append(
                        f"Prezzo vendita (€{selling_price}) inferiore al prezzo acquisto (€{cost_price}). "
                        f"Verifica che sia corretto."
                    )
            
            # Validazione annata
            vintage = wine_data.get("vintage")
            if vintage:
                try:
                    vintage_int = int(vintage)
                    current_year = 2024  # Potrebbe essere dinamico
                    if vintage_int < 1900 or vintage_int > current_year + 1:
                        warnings.append(
                            f"Annata {vintage_int} sembra anomala. Verifica che sia corretta."
                        )
                except (ValueError, TypeError):
                    warnings.append(f"Annata '{vintage}' non è un numero valido")
            
            # Controllo duplicati (solo per creazione)
            if not is_update and name:
                wines = await db_manager.get_user_wines(user_id)
                for wine in wines:
                    if wine.name.lower().strip() == name.lower().strip():
                        producer_match = False
                        if wine_data.get("producer") and wine.producer:
                            producer_match = wine.producer.lower().strip() == wine_data.get("producer", "").lower().strip()
                        
                        vintage_match = False
                        if wine_data.get("vintage") and wine.vintage:
                            vintage_match = str(wine.vintage) == str(wine_data.get("vintage", ""))
                        
                        if producer_match or vintage_match:
                            warnings.append(
                                f"Possibile duplicato: esiste già un vino '{wine.name}' "
                                f"{f'({wine.producer})' if wine.producer else ''} "
                                f"{f'{wine.vintage}' if wine.vintage else ''}"
                            )
                            suggestions.append("Verifica se vuoi aggiornare il vino esistente o creare un nuovo vino")
                        break
            
            valid = len(errors) == 0
            
            return {
                "valid": valid,
                "errors": errors,
                "warnings": warnings,
                "suggestions": suggestions
            }
        
        except Exception as e:
            logger.error(f"[VALIDATION] Errore validazione dati vino: {e}", exc_info=True)
            return {
                "valid": False,
                "errors": [f"Errore durante la validazione: {str(e)}"],
                "warnings": [],
                "suggestions": []
            }
    
    async def process_with_context(
        self,
        message: str,
        user_id: int,
        thread_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processa richiesta di validazione con contesto.
        Questo metodo può essere chiamato per validazioni generiche via chat.
        """
        try:
            context = await self._get_validation_context(user_id)
            enhanced_message = f"{message}\n\nContesto inventario:\n{context}"
            
            result = await self.process(
                message=enhanced_message,
                thread_id=thread_id,
                user_id=user_id,
                context={"user_id": user_id, "validation_context": context}
            )
            
            return result
        
        except Exception as e:
            logger.error(f"[VALIDATION] Errore processamento: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Errore durante la validazione: {str(e)}",
                "agent": self.name
            }
    
    async def _get_validation_context(self, user_id: int) -> str:
        """Ottiene contesto per validazioni"""
        try:
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return "Inventario vuoto."
            
            # Statistiche per validazione
            total_wines = len(wines)
            wines_with_low_stock = [w for w in wines if (w.quantity or 0) < 5]
            wines_with_missing_data = [
                w for w in wines 
                if not w.producer or not w.vintage or not w.selling_price
            ]
            
            context = f"""
Inventario: {total_wines} vini totali
- Vini a bassa scorta: {len(wines_with_low_stock)}
- Vini con dati mancanti: {len(wines_with_missing_data)}

Usa queste informazioni per validare operazioni e suggerire miglioramenti.
"""
            return context
        
        except Exception as e:
            logger.error(f"Errore recupero contesto validazione: {e}")
            return "Errore nel recupero informazioni inventario."
    
    def _format_context(self, context: Dict[str, Any]) -> str:
        """Formatta contesto per l'agent"""
        user_id = context.get("user_id")
        validation_context = context.get("validation_context", "")
        
        return f"""
Contesto validazione:
- User ID: {user_id}
- Stato inventario:
{validation_context}

Nota: Identifica sempre potenziali problemi PRIMA che vengano salvati e suggerisci correzioni.
"""

