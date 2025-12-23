"""
Analyzer per determinare complessità richiesta e routing appropriato.

Sistema ibrido:
- Richieste semplici -> AIServiceV1 (sistema tradizionale, più veloce)
- Richieste complesse -> AIServiceV2 (sistema multi-agent, più potente)
"""
import re
import logging
from typing import Literal

logger = logging.getLogger(__name__)


class RequestComplexityAnalyzer:
    """Analizza complessità richieste per routing ottimale"""
    
    # Pattern per richieste semplici (gestite da AIServiceV1)
    SIMPLE_PATTERNS = {
        # Movimenti singoli diretti
        "single_movement": [
            r"ho\s+(consumato|bevuto|venduto|acquistato|rifornito|aggiunto)\s+\d+\s+",
            r"\d+\s+(bottiglia|bottiglie)\s+(di|di\s+un|di\s+una)\s+",
            r"(consumo|vendo|vendi|acquisto|rifornisci|aggiungi)\s+\d+\s+",
            r"movimento\s+(consumo|rifornimento)\s+\d+\s+",
        ],
        # Query semplici dirette
        "simple_query": [
            r"mostrami\s+(tutti\s+)?i\s+vini",
            r"quanti\s+vini\s+(ho|hai)",
            r"quante\s+bottiglie\s+(ho|hai)\s+(di|del|dello|della|dei|delle)",
            r"cerca\s+(vini|vino)\s+",
            r"lista\s+vini",
            r"inventario",
        ],
        # Domande dirette semplici
        "simple_question": [
            r"^quanto\s+costa",
            r"^quante\s+bottiglie",
            r"^che\s+vino\s+è",
            r"^dove\s+si\s+trova",
        ],
    }
    
    # Pattern per richieste complesse (gestite da AIServiceV2)
    COMPLEX_PATTERNS = {
        # Movimenti multipli
        "multiple_movements": [
            r"\d+\s+.*\s+e\s+\d+\s+",  # "1 barolo e 2 chianti"
            r",\s*\d+\s+",  # Lista separata da virgole
            r"(consumato|bevuto|venduto|acquistato|rifornito).*e.*",  # "consumato X e Y"
        ],
        # Gestione vini complessa (CRUD)
        "wine_management": [
            r"(aggiungi|crea|nuovo)\s+vino",
            r"modifica\s+(il\s+)?(prezzo|quantità|vino|annata|prodotto)",
            r"(elimina|cancella|rimuovi)\s+vino",
            r"aggiorna\s+vino",
        ],
        # Analisi e report
        "analytics": [
            r"statistiche|statistica",
            r"report|riepilogo",
            r"analisi|analizza",
            r"andamento|trend|grafico",
            r"storico|storia",
        ],
        # Notifiche e alert
        "notifications": [
            r"(quali|dimmi)\s+(vini\s+)?(sono\s+)?(esauriti|finite|terminati)",
            r"alert|notifica|promemoria",
            r"scorte\s+basse",
            r"in\s+riserva",
        ],
        # Richieste conversazionali complesse
        "conversation": [
            r"riassumi|riepiloga",
            r"cosa\s+abbiamo\s+detto",
            r"storia\s+della\s+conversazione",
        ],
    }
    
    @classmethod
    def analyze(cls, message: str) -> Literal["simple", "complex"]:
        """
        Analizza messaggio e determina se è semplice o complesso.
        
        Args:
            message: Messaggio utente
        
        Returns:
            "simple" per richieste semplici (AIServiceV1)
            "complex" per richieste complesse (AIServiceV2)
        """
        if not message or not message.strip():
            return "simple"
        
        message_lower = message.lower().strip()
        message_clean = re.sub(r'\s+', ' ', message_lower)  # Normalizza spazi
        
        # Conta movimenti multipli (indice di complessità)
        movement_indicators = len(re.findall(r'\d+\s+(bottiglia|bottiglie)', message_clean))
        wine_mentions = len(re.findall(r'(vino|vini|barolo|chianti|brunello)', message_clean, re.IGNORECASE))
        
        # Check pattern complessi PRIMA (priorità)
        for category, patterns in cls.COMPLEX_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, message_clean, re.IGNORECASE):
                    logger.info(f"[COMPLEXITY] Richiesta complessa (pattern: {category}): {message[:50]}...")
                    return "complex"
        
        # Movimenti multipli impliciti (più di un numero + vino)
        if movement_indicators > 1 or (movement_indicators > 0 and wine_mentions > 1):
            logger.info(f"[COMPLEXITY] Richiesta complessa (movimenti multipli): {message[:50]}...")
            return "complex"
        
        # Check pattern semplici
        for category, patterns in cls.SIMPLE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, message_clean, re.IGNORECASE):
                    logger.info(f"[COMPLEXITY] Richiesta semplice (pattern: {category}): {message[:50]}...")
                    return "simple"
        
        # Default: se contiene numeri + verbi d'azione specifici, probabilmente semplice
        if re.search(r'\d+\s+.*(consumo|vendo|acquisto|rifornisci)', message_clean, re.IGNORECASE):
            logger.info(f"[COMPLEXITY] Richiesta semplice (movimento singolo implicito): {message[:50]}...")
            return "simple"
        
        # Default a "complex" per sicurezza (meglio usare agent per richieste ambigue)
        logger.info(f"[COMPLEXITY] Richiesta complessa (default): {message[:50]}...")
        return "complex"
    
    @classmethod
    def is_simple(cls, message: str) -> bool:
        """Helper: True se richiesta semplice, False se complessa"""
        return cls.analyze(message) == "simple"


