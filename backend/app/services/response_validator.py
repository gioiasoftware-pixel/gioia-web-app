"""
Valida risposte AI per determinare se sono corrette e comprensibili.
Usato per decidere se passare da AIServiceV1 a AIServiceV2.
"""
import re
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class ResponseValidator:
    """Valida risposte AI per determinare se sono soddisfacenti"""
    
    # Pattern che indicano che l'AI non ha capito o non sa rispondere
    UNCLEAR_PATTERNS = [
        r"non\s+ho\s+capito",
        r"non\s+capisco",
        r"non\s+sono\s+sicuro",
        r"non\s+riesco\s+a",
        r"non\s+posso\s+aiutarti",
        r"non\s+so\s+come",
        r"non\s+ho\s+informazioni",
        r"mi\s+dispiace.*non",
        r"non\s+trovo",
        r"non\s+ho\s+trovato",
        r"non\s+sono\s+in\s+grado",
        r"non\s+sono\s+riuscito",
        r"non\s+riesco.*trovare",
        r"non\s+riesco.*capire",
        r"potresti.*chiarire",
        r"puoi.*specificare",
        r"non\s+ho\s+compreso",
        r"non\s+sono\s+certo",
        r"non\s+è\s+chiaro",
        r"scusa.*non",
        r"mi\s+dispiace.*non\s+posso",
        r"errore",
        r"si\s+è\s+verificato\s+un\s+errore",
        r"qualcosa\s+è\s+andato\s+storto",
    ]
    
    # Pattern che indicano risposte troppo generiche o non utili
    GENERIC_PATTERNS = [
        r"^come\s+posso\s+aiutarti",
        r"^ciao",
        r"^salve",
        r"^benvenuto",
        r"^prego",
        r"^grazie",
    ]
    
    @classmethod
    def is_response_valid(cls, response: Dict[str, Any]) -> bool:
        """
        Valuta se una risposta è valida e comprensibile.
        
        Args:
            response: Dict con risposta da AIServiceV1
        
        Returns:
            True se la risposta è valida, False se dovrebbe passare a V2
        """
        if not response:
            logger.info("[RESPONSE_VALIDATOR] Risposta vuota, passa a V2")
            return False
        
        message = response.get("message", "").strip()
        if not message:
            logger.info("[RESPONSE_VALIDATOR] Messaggio vuoto, passa a V2")
            return False
        
        # Controlla se c'è un errore esplicito
        metadata = response.get("metadata", {})
        if metadata.get("error") or metadata.get("type") == "error":
            logger.info("[RESPONSE_VALIDATOR] Errore nella risposta, passa a V2")
            return False
        
        # Controlla pattern che indicano mancanza di comprensione
        message_lower = message.lower()
        for pattern in cls.UNCLEAR_PATTERNS:
            if re.search(pattern, message_lower, re.IGNORECASE):
                logger.info(f"[RESPONSE_VALIDATOR] Pattern 'non capisco' trovato: {pattern}, passa a V2")
                return False
        
        # Controlla risposte troppo generiche (solo se molto corte)
        if len(message) < 30:  # Risposta molto corta
            for pattern in cls.GENERIC_PATTERNS:
                if re.match(pattern, message_lower, re.IGNORECASE):
                    logger.info(f"[RESPONSE_VALIDATOR] Risposta troppo generica: {pattern}, passa a V2")
                    return False
        
        # Se contiene HTML (wine cards, ecc.), probabilmente è valida
        if response.get("is_html") or "<div" in message:
            logger.info("[RESPONSE_VALIDATOR] Risposta contiene HTML (probabilmente valida)")
            return True
        
        # Controlla se la risposta sembra essere solo un messaggio di errore generico
        if message.startswith("⚠️") and len(message) < 100:
            # Potrebbe essere un errore, ma se contiene dettagli specifici va bene
            if any(keyword in message_lower for keyword in ["errore", "non", "riprova", "temporaneo"]):
                logger.info("[RESPONSE_VALIDATOR] Messaggio di errore generico, passa a V2")
                return False
        
        # Risposta sembra valida
        logger.info("[RESPONSE_VALIDATOR] Risposta valida, mantieni V1")
        return True
    
    @classmethod
    def should_fallback_to_v2(cls, response: Dict[str, Any]) -> bool:
        """Alias per chiarezza: True se dovrebbe passare a V2"""
        return not cls.is_response_valid(response)

