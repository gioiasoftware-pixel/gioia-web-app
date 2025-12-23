"""
Router Agent - Instrada richieste agli agent appropriati.
"""
from .base_agent import BaseAgent
import logging

logger = logging.getLogger(__name__)

class RouterAgent(BaseAgent):
    """Agent che analizza richieste e instrada agli agent appropriati"""
    
    def __init__(self):
        instructions = """
        Sei un router intelligente che analizza le richieste degli utenti e le instrada 
        all'agent specializzato più appropriato.
        
        Analizza il messaggio e determina quale agent deve gestirlo:
        
        1. **extraction**: Per elaborazione file inventario
           - Caricamento CSV, Excel, PDF
           - Estrazione dati da file
           - Validazione inventario
           - Keywords: "carica", "importa", "file", "csv", "excel", "pdf"
        
        2. **query**: Per ricerche e informazioni vini
           - Cerca vino per nome
           - Informazioni dettagliate vino
           - Filtri inventario
           - Lista inventario
           - Keywords: "cerca", "trova", "quale", "info", "dettagli", "lista", "mostra", "vini"
        
        3. **movement**: Per registrazione movimenti SINGOLI
           - UN SOLO consumo o rifornimento
           - Esempi: "ho venduto 3 Barolo", "consumato 2 Chianti", "ricevuto 10 Brunello"
           - Keywords: "consumo", "venduto", "rifornito", "acquistato", "aggiunto", "tolto", "registra"
        
        4. **multi_movement**: Per registrazione movimenti MULTIPLI
           - PIÙ movimenti in un singolo messaggio
           - Esempi: "ho venduto 3 Barolo e 2 Chianti", "ricevuto 10 Brunello, 5 Amarone e 3 Chianti"
           - Identifica quando ci sono:
             * Più vini menzionati (con "e", ",", "più")
             * Più quantità specificate per vini diversi
           - Keywords: "e", ",", "più", congiunzioni tra vini/quantità
        
        5. **analytics**: Per statistiche e report
           - Statistiche inventario
           - Report periodici
           - Analisi trend
           - Keywords: "statistiche", "report", "riepilogo", "analisi", "trend", "stat"
        
        IMPORTANTE: 
        - Per movimenti, distingui tra SINGOLO (movement) e MULTIPLO (multi_movement)
        - Se il messaggio contiene più di un movimento (più vini/quantità), usa multi_movement
        - Rispondi SOLO con il nome dell'agent (extraction, query, movement, multi_movement, analytics)
        - Non aggiungere altro testo, spiegazioni o commenti.
        """
        
        # Usa modello economico per routing
        model = "gpt-4o-mini"
        
        super().__init__(
            name="RouterAgent",
            instructions=instructions,
            model=model
        )
    
    async def route(self, message: str) -> str:
        """
        Instrada messaggio e ritorna nome agent appropriato.
        
        Returns:
            Nome agent: "extraction", "query", "movement", "analytics"
        """
        result = await self.process(message)
        
        if result["success"]:
            agent_name = result["message"].strip().lower()
            
            # Rimuovi eventuali caratteri speciali o spazi
            agent_name = agent_name.replace(".", "").replace("!", "").strip()
            
            # Validazione
            valid_agents = ["extraction", "query", "movement", "multi_movement", "analytics"]
            if agent_name in valid_agents:
                logger.info(f"✅ Router instradato a: {agent_name}")
                return agent_name
            else:
                logger.warning(f"⚠️ Router ritornato agent non valido: '{agent_name}', default: query")
                return "query"  # Default
        else:
            logger.error(f"❌ Router fallito, default: query")
            return "query"  # Default in caso di errore

