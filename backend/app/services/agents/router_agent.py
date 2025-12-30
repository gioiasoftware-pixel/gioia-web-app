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
        
        Analizza il messaggio e determina quale agent deve gestirlo seguendo QUESTE REGOLE IN ORDINE DI PRIORITÀ:
        
        ==========================================
        PRIORITÀ 1: GESTIONE VINI (wine_management)
        ==========================================
        Usa "wine_management" SOLO per:
        - Creare nuovi vini da zero ("aggiungi vino", "crea vino", "nuovo vino")
        - Modificare vini esistenti ("modifica vino", "aggiorna vino", "cambia prezzo", "cambia quantità")
        - Eliminare vini ("elimina vino", "rimuovi vino", "cancella vino")
        - Gestire duplicati ("unifica vini", "duplicato")
        Keywords: "aggiungi vino", "crea vino", "modifica vino", "elimina vino", "aggiorna vino", "nuovo vino", "cambia", "unifica"
        
        ==========================================
        PRIORITÀ 2: MOVIMENTI (movement / multi_movement)
        ==========================================
        Usa "movement" per UN SOLO movimento:
        - Esempi: "ho venduto 3 Barolo", "consumato 2 Chianti", "ricevuto 10 Brunello"
        
        Usa "multi_movement" per PIÙ movimenti nello stesso messaggio:
        - Esempi: "ho venduto 3 Barolo e 2 Chianti", "ricevuto 10 Brunello, 5 Amarone e 3 Chianti"
        - Segnali: presenza di "e", ",", "più" tra vini/quantità diverse
        
        Keywords: "consumo", "venduto", "rifornito", "acquistato", "aggiunto", "tolto", "scaricato", "caricato", "rimosso", "registra", "consumato", "ricevuto"
        
        ==========================================
        PRIORITÀ 3: STATISTICHE VINO SPECIFICO (notification)
        ==========================================
        Usa "notification" SOLO per:
        - Statistiche/andamento di UN VINO SPECIFICO con nome esplicito
        - Esempi: "statistiche del Barolo", "andamento del Chianti", "grafico del Brunello", "trend del Amarone"
        - Segnali: nome vino + keywords statistiche ("statistiche", "andamento", "grafico", "trend", "storico", "movimenti")
        Keywords: "statistiche [nome vino]", "andamento [nome vino]", "grafico [nome vino]", "trend [nome vino]", "storico [nome vino]"
        
        ==========================================
        PRIORITÀ 4: RICERCHE E QUERY (query)
        ==========================================
        Usa "query" per:
        - Cercare vino per nome ("cerca Barolo", "trova Chianti", "dimmi del Brunello")
        - Informazioni dettagliate vino ("info su Barolo", "dettagli Chianti")
        - Filtri inventario ("mostra tutti i vini rossi", "vini sotto 20€")
        - Liste inventario ("lista vini", "mostra inventario", "quali vini ho")
        - Confronti tra vini ("confronta Barolo e Chianti")
        Keywords: "cerca", "trova", "quale", "info", "dettagli", "lista", "mostra", "vini", "dimmi", "quali"
        
        ==========================================
        PRIORITÀ 5: REPORT E ANALYTICS
        ==========================================
        Usa "report" per report formattati e complessi:
        - "report vendite", "report inventario completo", "riepilogo dettagliato", "report comparativo"
        - Report esportabili/formattati con struttura complessa
        
        Usa "analytics" per statistiche generali inventario (SENZA nome vino specifico):
        - "statistiche inventario", "quanti vini ho in totale", "valore inventario", "analisi trend"
        - Statistiche aggregate senza riferimento a vino specifico
        Keywords report: "report", "riepilogo dettagliato", "report vendite", "report inventario"
        Keywords analytics: "statistiche", "analisi", "trend", "stat", "quanti vini" (senza nome vino)
        
        ==========================================
        PRIORITÀ 6: ALERT E NOTIFICHE (notification)
        ==========================================
        Usa "notification" per alert e notifiche proattive:
        - "vini esauriti", "scorte basse", "alert", "promemoria", "avvisi"
        - Notifiche automatiche senza statistiche specifiche
        Keywords: "esauriti", "scorte basse", "alert", "promemoria", "avvisi", "notifiche"
        
        ==========================================
        PRIORITÀ 7: CONTESTO CONVERSAZIONALE (conversation)
        ==========================================
        Usa "conversation" SOLO per richieste ESPLICITE di gestione contesto:
        - "cosa abbiamo detto prima", "di cosa stavamo parlando", "riassumi la conversazione"
        - Chiarimenti ambiguità espliciti
        - NON usare per altre richieste che possono essere gestite da altri agent
        Keywords: "cosa abbiamo detto", "di cosa stavamo parlando", "riassumi conversazione"
        
        ==========================================
        PRIORITÀ 8: FILE/EXTRACTION (extraction)
        ==========================================
        Usa "extraction" per elaborazione file:
        - "carica file", "importa CSV", "elabora Excel", "carica inventario"
        Keywords: "carica", "importa", "file", "csv", "excel", "pdf"
        
        ==========================================
        REGOLE DI RISOLUZIONE CONFLITTI
        ==========================================
        1. Se il messaggio contiene nome vino specifico + keywords statistiche → "notification" (non analytics)
        2. Se il messaggio è "statistiche" senza nome vino → "analytics"
        3. Se il messaggio contiene "report" esplicito → "report" (non analytics)
        4. Se il messaggio è ricerca/info vino → "query" (non notification)
        5. Se il messaggio contiene gestione vini (crea/modifica/elimina) → "wine_management" (non query)
        6. Se il messaggio contiene movimenti → "movement" o "multi_movement" (non query)
        
        RISPOSTA:
        - Rispondi SOLO con il nome dell'agent in minuscolo
        - Nomi validi: extraction, query, movement, multi_movement, analytics, wine_management, report, notification, conversation
        - NON aggiungere spiegazioni, punti, spazi o altro testo
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
            valid_agents = [
                "extraction", "query", "movement", "multi_movement", "analytics",
                "wine_management", "report", "notification", "conversation"
            ]
            if agent_name in valid_agents:
                logger.info(f"✅ Router instradato a: {agent_name}")
                return agent_name
            else:
                logger.warning(f"⚠️ Router ritornato agent non valido: '{agent_name}', default: query")
                return "query"  # Default
        else:
            logger.error(f"❌ Router fallito, default: query")
            return "query"  # Default in caso di errore

