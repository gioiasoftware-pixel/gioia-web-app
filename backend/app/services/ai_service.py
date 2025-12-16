"""
Servizio AI per web app - Reuse logica da telegram-ai-bot
Adattato per REST API invece di Telegram handlers
"""
import logging
import os
import sys
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from openai import OpenAI, OpenAIError
import json
import re

# Aggiungi path al telegram bot per importare moduli
# Da backend/app/services/ai_service.py → root → telegram-ai-bot/src
current_file = Path(__file__)
root_dir = current_file.parent.parent.parent.parent.parent  # Root del progetto
telegram_bot_src = root_dir / "telegram-ai-bot" / "src"

if telegram_bot_src.exists():
    sys.path.insert(0, str(telegram_bot_src))
    logger = logging.getLogger(__name__)
    logger.info(f"[AI_SERVICE] Path telegram bot aggiunto: {telegram_bot_src}")
else:
    logger = logging.getLogger(__name__)
    logger.warning(f"[AI_SERVICE] Path telegram bot non trovato: {telegram_bot_src}")

from app.core.config import get_settings
from app.core.database import db_manager
from app.core.processor_client import processor_client

# Disabilita proxy automatici
os.environ.pop('HTTP_PROXY', None)
os.environ.pop('HTTPS_PROXY', None)
os.environ.pop('http_proxy', None)
os.environ.pop('https_proxy', None)
os.environ.pop('ALL_PROXY', None)
os.environ.pop('all_proxy', None)


class AIService:
    """Servizio AI per web app - riusa logica telegram bot"""
    
    def __init__(self):
        settings = get_settings()
        self.openai_api_key = settings.OPENAI_API_KEY
        self.openai_model = settings.OPENAI_MODEL
        
        if not self.openai_api_key:
            logger.warning("OpenAI API key non configurata")
            self.client = None
        else:
            self.client = OpenAI(api_key=self.openai_api_key)
    
    async def process_message(
        self,
        user_message: str,
        telegram_id: int,
        conversation_history: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Processa messaggio utente e restituisce risposta AI.
        
        Args:
            user_message: Messaggio utente
            telegram_id: ID Telegram utente
            conversation_history: Storia conversazione (opzionale)
        
        Returns:
            Dict con:
                - message: Risposta AI
                - metadata: Metadati aggiuntivi (tipo risposta, vini trovati, ecc.)
        """
        if not self.client:
            return {
                "message": "⚠️ L'AI non è configurata. Contatta l'amministratore.",
                "metadata": {"error": "openai_not_configured"}
            }
        
        if not user_message or not user_message.strip():
            return {
                "message": "⚠️ Messaggio vuoto ricevuto. Prova a scrivere qualcosa!",
                "metadata": {"error": "empty_message"}
            }
        
        try:
            # ========== NUOVO FLUSSO: Function Calling prima di tutto ==========
            
            # 1. Prepara contesto utente per function calling
            user_context = ""
            try:
                user = await db_manager.get_user_by_telegram_id(telegram_id)
                if user:
                    user_context = f"""
INFORMAZIONI UTENTE:
- Nome attività: {user.business_name or 'Non specificato'}
- Onboarding completato: {'Sì' if user.onboarding_completed else 'No'}
"""
                    wines = await db_manager.get_user_wines(telegram_id)
                    if wines:
                        user_context += f"\nINVENTARIO ATTUALE:\n"
                        user_context += f"- Totale vini: {len(wines)}\n"
                        user_context += f"- Quantità totale: {sum(w.quantity for w in wines if w.quantity) or 0} bottiglie\n"
                        low_stock = [w for w in wines if w.quantity is not None and w.min_quantity is not None and w.quantity <= w.min_quantity]
                        if low_stock:
                            user_context += f"- Scorte basse: {len(low_stock)} vini\n"
            except Exception as e:
                logger.warning(f"[AI_SERVICE] Errore recupero contesto utente: {e}")
            
            # 2. Rilevamento richieste specifiche PRIMA di function calling (bypass AI quando possibile)
            
            # 2a. Richieste esplicite di elenco inventario
            if self._is_inventory_list_request(user_message):
                logger.info(f"[AI_SERVICE] Richiesta lista inventario rilevata, bypass AI")
                inventory_response = await self._build_inventory_list_response(telegram_id, limit=50)
                return {
                    "message": inventory_response,
                    "metadata": {
                        "type": "inventory_list",
                        "model": None
                    },
                    "buttons": None
                }
            
            # 2b. Richieste di riepilogo movimenti
            is_movement_request, period = self._is_movement_summary_request(user_message)
            if is_movement_request:
                logger.info(f"[AI_SERVICE] Richiesta movimenti rilevata: period={period}")
                # TODO: Implementare recupero movimenti quando necessario
                # Per ora ritorna messaggio informativo
                if period == 'yesterday':
                    return {
                        "message": "📊 Funzionalità riepilogo movimenti in fase di implementazione. Usa Function Calling per ora.",
                        "metadata": {"type": "movement_summary", "period": period},
                        "buttons": None
                    }
                else:
                    return {
                        "message": "📊 Per quale periodo vuoi vedere i movimenti? (giorno/settimana/mese)",
                        "metadata": {"type": "movement_summary_ask_period"},
                        "buttons": None
                    }
            
            # 2c. Query informative (min/max)
            query_type, field = self._is_informational_query(user_message)
            if query_type and field:
                logger.info(f"[AI_SERVICE] Query informativa rilevata: {query_type} {field}")
                informational_response = await self._handle_informational_query(telegram_id, query_type, field)
                if informational_response:
                    return {
                        "message": informational_response,
                        "metadata": {
                            "type": "informational_query",
                            "query_type": query_type,
                            "field": field
                        },
                        "buttons": None
                    }
            
            # 3. Prova Function Calling OpenAI (nuovo sistema)
            logger.info(f"[AI_SERVICE] Tentativo function calling per telegram_id={telegram_id}")
            function_call_result = await self._call_openai_with_tools(
                user_message=user_message,
                telegram_id=telegram_id,
                conversation_history=conversation_history,
                user_context=user_context
            )
            
            if function_call_result:
                logger.info(f"[AI_SERVICE] Function calling completato: tipo={function_call_result.get('metadata', {}).get('type')}")
                return function_call_result
            
            # 3. Fallback: Prova import get_ai_response dal telegram bot (sistema esistente)
            logger.info(f"[AI_SERVICE] Function calling non ha prodotto risultato, provo import bot")
            from app.services.telegram_bot_adapter import setup_telegram_bot_imports
            setup_telegram_bot_imports()
            
            try:
                import config as telegram_config
                if not hasattr(telegram_config, 'OPENAI_API_KEY') or not telegram_config.OPENAI_API_KEY:
                    telegram_config.OPENAI_API_KEY = self.openai_api_key
                    telegram_config.OPENAI_MODEL = self.openai_model
                    logger.info("[AI_SERVICE] Config telegram bot aggiornata con chiavi web app")
                
                from ai import get_ai_response
                logger.info(f"[AI_SERVICE] get_ai_response importato con successo, telegram_id={telegram_id}")
                
                response_text = await get_ai_response(
                    prompt=user_message,
                    telegram_id=telegram_id,
                    correlation_id=None
                )
                
                logger.info(f"[AI_SERVICE] Risposta ricevuta dal bot: {response_text[:100]}...")
                
                return {
                    "message": response_text,
                    "metadata": {
                        "type": "ai_response",
                        "model": self.openai_model
                    }
                }
            except ImportError as e:
                logger.error(f"[AI_SERVICE] Impossibile importare get_ai_response dal bot: {e}", exc_info=True)
                # Fallback finale: chiamata OpenAI diretta semplificata
                return await self._simple_ai_response(user_message, telegram_id)
            except Exception as e:
                logger.error(f"[AI_SERVICE] Errore chiamata get_ai_response: {e}", exc_info=True)
                # Fallback finale: chiamata OpenAI diretta semplificata
                return await self._simple_ai_response(user_message, telegram_id)
        
        except OpenAIError as e:
            logger.error(f"Errore OpenAI: {e}")
            return {
                "message": "⚠️ Errore temporaneo dell'AI. Riprova tra qualche minuto.",
                "metadata": {"error": "openai_error", "details": str(e)}
            }
        except Exception as e:
            logger.error(f"Errore imprevisto in process_message: {e}", exc_info=True)
            return {
                "message": "⚠️ Errore temporaneo dell'AI. Riprova tra qualche minuto.",
                "metadata": {"error": "unexpected_error", "details": str(e)}
            }
    
    def _clean_wine_search_term(self, term: str) -> str:
        """
        Pulisce il termine di ricerca rimuovendo parole interrogative, articoli, congiunzioni, ecc.
        ma preserva quelle che fanno parte del nome del vino (es. "del" in "Ca del Bosco").
        Reuse da telegram-ai-bot.
        """
        import re
        
        if not term:
            return term
        
        term_lower = term.lower().strip()
        
        # Parole interrogative da rimuovere
        interrogative_words = {'che', 'quale', 'quali', 'quanto', 'quanti', 'quante', 'cosa', 'cos\'', 'cos', 
                              'chi', 'dove', 'come', 'perché', 'perche', 'perchè'}
        
        # Articoli da rimuovere
        articles = {'il', 'lo', 'la', 'gli', 'le', 'i', 'un', 'uno', 'una'}
        
        # Verbi comuni che indicano possesso/richiesta
        common_verbs = {'ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno', 'è', 'sono', 'c\'è', 'ci sono',
                        'vendo', 'vendi', 'vende', 'vendiamo', 'vendete', 'vendono'}
        
        # Varianti comuni/typo di "vino" da rimuovere
        wine_variants = {'vino', 'vinio', 'vini', 'vinii', 'vinno'}
        
        # Preposizioni articolate che POTREBBERO far parte del nome
        articulated_prepositions = {'del', 'della', 'dello', 'dei', 'degli', 'delle', 
                                    'dal', 'dalla', 'dallo', 'dai', 'dagli', 'dalle'}
        
        # Preposizioni semplici da rimuovere solo se all'inizio
        simple_prepositions = {'di', 'da', 'in', 'su', 'per', 'con', 'tra', 'fra'}
        
        words = term_lower.split()
        if not words:
            return term
        
        cleaned_words = []
        
        # Rimuovi parole all'inizio che sono interrogative, articoli o verbi
        start_idx = 0
        for i, word in enumerate(words):
            if word in interrogative_words or word in articles:
                start_idx = i + 1
                continue
            break
        
        # Processa le parole rimanenti
        i = start_idx
        while i < len(words):
            word = words[i]
            
            # Se è una preposizione articolata, potrebbe far parte del nome
            if word in articulated_prepositions:
                if i + 1 < len(words):
                    cleaned_words.append(word)
                    i += 1
                    continue
            
            # Rimuovi verbi comuni
            if word in common_verbs:
                i += 1
                continue
            
            # Rimuovi varianti/typo di "vino"
            if word in wine_variants:
                i += 1
                continue
            
            # Rimuovi preposizioni semplici solo se sono all'inizio della parte pulita
            if not cleaned_words and word in simple_prepositions:
                i += 1
                continue
            
            # Aggiungi la parola
            cleaned_words.append(word)
            i += 1
        
        result = ' '.join(cleaned_words).strip()
        
        # Rimuovi anche eventuali segni di punteggiatura finali
        result = re.sub(r'[?.,;:!]+$', '', result).strip()
        
        return result if result else term  # Se rimane vuoto, ritorna il termine originale
    
    # ========== RILEVAMENTO RICHIESTE SPECIFICHE ==========
    
    def _is_inventory_list_request(self, prompt: str) -> bool:
        """
        Riconosce richieste tipo: che vini ho? elenco/lista inventario, mostra inventario, ecc.
        IMPORTANTE: NON matchare se la richiesta contiene filtri (region, tipo, paese, prezzo) -
        in quel caso passa all'AI che userà search_wines.
        """
        p = prompt.lower().strip()
        
        # Se contiene filtri, NON è una richiesta lista semplice → passa all'AI
        filter_keywords = [
            'della', 'del', 'dello', 'delle', 'degli', 'di', 'itali', 'frances', 'spagnol', 'tedesc',
            'toscana', 'piemonte', 'veneto', 'sicilia', 'rosso', 'bianco', 'spumante', 'rosato',
            'prezzo', 'annata', 'produttore', 'cantina', 'azienda'
        ]
        if any(kw in p for kw in filter_keywords):
            return False  # Passa all'AI con search_wines
        
        patterns = [
            r"\bche\s+vini\s+ho\b",
            r"\bquanti\s+vini\s+ho\b",
            r"\bquante\s+vini\s+ho\b",
            r"\bquanti\s+vini\s+hai\b",
            r"\bquante\s+vini\s+hai\b",
            r"\bche\s+vini\s+hai\b",
            r"\bquali\s+vini\s+ho\b",
            r"\bquali\s+vini\s+hai\b",
            r"\belenco\s+vini\b",
            r"\blista\s+vini\b",
            r"\bmostra\s+inventario\b",
            r"\bvedi\s+inventario\b",
            r"\bmostra\s+i\s+vini\b",
            r"\bmostrami\s+i\s+vini\b",
            r"\bmostrami\s+inventario\b",
            r"\bmostra\s+tutti\s+i\s+vini\b",
            r"\binventario\s+completo\b",
            r"\binventario\b",
        ]
        return any(re.search(pt, p) for pt in patterns)
    
    def _is_movement_summary_request(self, prompt: str) -> tuple[bool, Optional[str]]:
        """
        Riconosce richieste tipo: ultimi consumi/movimenti/ricavi.
        Ritorna (is_request, period) dove period può essere 'day', 'week', 'month', o 'yesterday'.
        """
        p = prompt.lower().strip()
        
        # Controlla prima per richieste specifiche con date
        # Richieste consumo ieri
        if any(re.search(pt, p) for pt in [
            r"\b(consumato|consumi|consumate)\s+(ieri|il\s+giorno\s+prima)\b",
            r"\bvini\s+(consumato|consumi|consumate)\s+ieri\b",
            r"\b(che\s+)?vini\s+ho\s+consumato\s+ieri\b",
            r"\b(che\s+)?vini\s+hai\s+consumato\s+ieri\b",
            r"\bconsumi\s+(di|del)\s+ieri\b",
            r"\b(ieri|il\s+giorno\s+prima)\s+(ho|hai)\s+consumato\b",
        ]):
            return (True, 'yesterday')
        
        # Richieste rifornimenti/arrivati/ricevuti ieri
        if any(re.search(pt, p) for pt in [
            r"\b(che\s+)?vini\s+(mi\s+sono\s+)?(arrivati|ricevuti|riforniti)\s+ieri",
            r"\b(che\s+)?vini\s+ho\s+(ricevuto|rifornito)\s+ieri",
            r"\bvini\s+(mi\s+sono\s+)?arrivati\s+ieri",
            r"\b(ieri|il\s+giorno\s+prima)\s+(sono\s+arrivati|ho\s+ricevuto|ho\s+rifornito)",
            r"\brifornimenti\s+(di|del)\s+ieri",
            r"\b(arrivati|arrivate|arrivato|ricevuti|ricevute|ricevuto|riforniti|rifornite|rifornito)\s+(ieri|il\s+giorno\s+prima)",
        ]):
            return (True, 'yesterday_replenished')
        
        # Richieste movimenti generici di ieri
        if any(re.search(pt, p) for pt in [
            r"\bmovimenti\s+(di|del)\s+ieri\b",
        ]):
            return (True, 'yesterday')
        
        # Pattern generici (senza data specifica)
        if any(re.search(pt, p) for pt in [
            r"\bultimi\s+consumi\b",
            r"\bultimi\s+movimenti\b",
            r"\bconsumi\s+recenti\b",
            r"\bmovimenti\s+recenti\b",
            r"\bmi\s+dici\s+i\s+miei\s+ultimi\s+consumi\b",
            r"\bmi\s+dici\s+gli\s+ultimi\s+miei\s+consumi\b",
            r"\bultimi\s+miei\s+consumi\b",
            r"\bmostra\s+(ultimi|recenti)\s+(consumi|movimenti)\b",
            r"\briepilogo\s+(consumi|movimenti)\b",
        ]):
            return (True, None)  # Period non specificato, chiedi all'utente
        
        return (False, None)
    
    def _is_informational_query(self, prompt: str) -> tuple[Optional[str], Optional[str]]:
        """
        Riconosce domande informative generiche sul vino.
        Ritorna (query_type, field) dove:
        - query_type: 'min' o 'max'
        - field: 'quantity', 'selling_price', 'cost_price', 'vintage'
        """
        p = prompt.lower().strip()
        
        # Pattern per quantità (min)
        min_quantity_patterns = [
            r"quale\s+(?:vino|bottiglia)\s+(?:ha|con)\s+(?:meno|minore|minima)\s+(?:quantit[àa]|bottiglie)",
            r"quale\s+è\s+il\s+(?:vino|bottiglia)\s+(?:con|che\s+ha)\s+(?:meno|minore|minima)\s+(?:quantit[àa]|bottiglie)",
            r"(?:vino|bottiglia)\s+(?:con|che\s+ha)\s+(?:meno|minore|minima)\s+(?:quantit[àa]|bottiglie)",
            r"(?:meno|minore|minima)\s+(?:quantit[àa]|bottiglie)",
        ]
        
        # Pattern per quantità (max)
        max_quantity_patterns = [
            r"quale\s+(?:vino|bottiglia)\s+(?:ha|con)\s+(?:pi[ùu]|maggiore|massima)\s+(?:quantit[àa]|bottiglie)",
            r"quale\s+è\s+il\s+(?:vino|bottiglia)\s+(?:con|che\s+ha)\s+(?:pi[ùu]|maggiore|massima)\s+(?:quantit[àa]|bottiglie)",
            r"(?:vino|bottiglia)\s+(?:con|che\s+ha)\s+(?:pi[ùu]|maggiore|massima)\s+(?:quantit[àa]|bottiglie)",
            r"(?:pi[ùu]|maggiore|massima)\s+(?:quantit[àa]|bottiglie)",
        ]
        
        # Pattern per prezzo vendita (max - più costoso)
        max_price_patterns = [
            r"quale\s+(?:vino|bottiglia)\s+(?:è|è\s+il)\s+(?:pi[ùu]\s+)?costos[oa]",
            r"quale\s+è\s+il\s+(?:vino|bottiglia)\s+(?:pi[ùu]\s+)?costos[oa]",
            r"(?:vino|bottiglia)\s+(?:pi[ùu]\s+)?costos[oa]",
            r"quale\s+(?:vino|bottiglia)\s+costa\s+di\s+pi[ùu]",
            r"quale\s+(?:vino|bottiglia)\s+ha\s+il\s+prezzo\s+(?:pi[ùu]\s+)?alto",
            r"(?:pi[ùu]\s+)?costos[oa]",
        ]
        
        # Pattern per prezzo vendita (min - più economico)
        min_price_patterns = [
            r"quale\s+(?:vino|bottiglia)\s+(?:è|è\s+il)\s+(?:pi[ùu]\s+)?economic[oa]",
            r"quale\s+è\s+il\s+(?:vino|bottiglia)\s+(?:pi[ùu]\s+)?economic[oa]",
            r"(?:vino|bottiglia)\s+(?:pi[ùu]\s+)?economic[oa]",
            r"quale\s+(?:vino|bottiglia)\s+costa\s+di\s+meno",
            r"quale\s+(?:vino|bottiglia)\s+ha\s+il\s+prezzo\s+(?:pi[ùu]\s+)?basso",
            r"(?:pi[ùu]\s+)?economic[oa]",
        ]
        
        # Pattern per prezzo acquisto (max)
        max_cost_patterns = [
            r"quale\s+(?:vino|bottiglia)\s+(?:è|è\s+il)\s+(?:pi[ùu]\s+)?costos[oa]\s+(?:da\s+)?acquist[oa]",
            r"quale\s+(?:vino|bottiglia)\s+ho\s+pagato\s+di\s+pi[ùu]",
            r"(?:prezzo|costo)\s+acquisto\s+(?:pi[ùu]\s+)?alto",
        ]
        
        # Pattern per prezzo acquisto (min)
        min_cost_patterns = [
            r"quale\s+(?:vino|bottiglia)\s+(?:è|è\s+il)\s+(?:pi[ùu]\s+)?economic[oa]\s+(?:da\s+)?acquist[oa]",
            r"quale\s+(?:vino|bottiglia)\s+ho\s+pagato\s+di\s+meno",
            r"(?:prezzo|costo)\s+acquisto\s+(?:pi[ùu]\s+)?basso",
        ]
        
        # Pattern per annata (max - più recente)
        max_vintage_patterns = [
            r"quale\s+(?:vino|bottiglia)\s+(?:è|è\s+il)\s+(?:pi[ùu]\s+)?recente",
            r"quale\s+(?:vino|bottiglia)\s+(?:ha|con)\s+(?:annata|anno)\s+(?:pi[ùu]\s+)?recente",
            r"(?:annata|anno)\s+(?:pi[ùu]\s+)?recente",
        ]
        
        # Pattern per annata (min - più vecchio)
        min_vintage_patterns = [
            r"quale\s+(?:vino|bottiglia)\s+(?:è|è\s+il)\s+(?:pi[ùu]\s+)?vecchi[oa]",
            r"quale\s+(?:vino|bottiglia)\s+(?:ha|con)\s+(?:annata|anno)\s+(?:pi[ùu]\s+)?vecchi[oa]",
            r"(?:annata|anno)\s+(?:pi[ùu]\s+)?vecchi[oa]",
        ]
        
        # Controlla pattern
        if any(re.search(pt, p) for pt in min_quantity_patterns):
            return ('min', 'quantity')
        if any(re.search(pt, p) for pt in max_quantity_patterns):
            return ('max', 'quantity')
        if any(re.search(pt, p) for pt in max_price_patterns):
            return ('max', 'selling_price')
        if any(re.search(pt, p) for pt in min_price_patterns):
            return ('min', 'selling_price')
        if any(re.search(pt, p) for pt in max_cost_patterns):
            return ('max', 'cost_price')
        if any(re.search(pt, p) for pt in min_cost_patterns):
            return ('min', 'cost_price')
        if any(re.search(pt, p) for pt in max_vintage_patterns):
            return ('max', 'vintage')
        if any(re.search(pt, p) for pt in min_vintage_patterns):
            return ('min', 'vintage')
        
        return (None, None)
    
    async def _handle_informational_query(self, telegram_id: int, query_type: str, field: str) -> Optional[str]:
        """
        Gestisce una domanda informativa generica e ritorna la risposta formattata.
        Copia logica da telegram-ai-bot/src/ai.py:_handle_informational_query
        
        Args:
            telegram_id: ID Telegram utente
            query_type: 'min' o 'max'
            field: Campo da interrogare ('quantity', 'selling_price', 'cost_price', 'vintage')
        
        Returns:
            Risposta formattata o None se errore
        """
        try:
            user = await db_manager.get_user_by_telegram_id(telegram_id)
            if not user or not user.business_name:
                return None
            
            table_name = f'"{telegram_id}/{user.business_name} INVENTARIO"'
            
            # Determina ORDER BY e NULLS LAST/FIRST
            if query_type == 'max':
                order_by = f"{field} DESC NULLS LAST"
                if field == 'vintage':
                    order_by = f"{field} DESC NULLS LAST"
            else:  # min
                order_by = f"{field} ASC NULLS LAST"
                if field == 'vintage':
                    order_by = f"{field} ASC NULLS LAST"
            
            # Query SQL: prima trova il valore min/max, poi tutti i vini con quel valore
            from sqlalchemy import text as sql_text
            from app.core.database import AsyncSessionLocal
            
            # Step 1: Trova il valore min/max
            find_value_query = sql_text(f"""
                SELECT {field}
                FROM {table_name}
                WHERE user_id = :user_id
                AND {field} IS NOT NULL
                ORDER BY {order_by}
                LIMIT 1
            """)
            
            async with AsyncSessionLocal() as session:
                result = await session.execute(find_value_query, {"user_id": user.id})
                value_row = result.fetchone()
                
                if not value_row:
                    # Nessun vino trovato con quel campo valorizzato
                    field_names = {
                        'quantity': 'quantità',
                        'selling_price': 'prezzo di vendita',
                        'cost_price': 'prezzo di acquisto',
                        'vintage': 'annata'
                    }
                    field_name = field_names.get(field, field)
                    return f"❌ Non ho trovato vini con {field_name} specificato nel tuo inventario."
                
                target_value = value_row[0]
                
                # Step 2: Trova TUTTI i vini con quel valore
                find_all_query = sql_text(f"""
                    SELECT *
                    FROM {table_name}
                    WHERE user_id = :user_id
                    AND {field} = :target_value
                    ORDER BY name ASC
                    LIMIT 20
                """)
                
                result = await session.execute(find_all_query, {"user_id": user.id, "target_value": target_value})
                rows = result.fetchall()
                
                if not rows:
                    return f"❌ Errore: valore trovato ma nessun vino corrispondente."
                
                # Costruisci oggetti Wine
                from app.core.database import Wine
                wines = []
                for row in rows:
                    wine_dict = {
                        'id': row.id,
                        'user_id': row.user_id,
                        'name': row.name,
                        'producer': row.producer,
                        'vintage': row.vintage,
                        'grape_variety': row.grape_variety,
                        'region': row.region,
                        'country': row.country,
                        'wine_type': row.wine_type,
                        'classification': row.classification,
                        'quantity': row.quantity,
                        'min_quantity': row.min_quantity if hasattr(row, 'min_quantity') else 0,
                        'cost_price': row.cost_price,
                        'selling_price': row.selling_price,
                        'alcohol_content': row.alcohol_content,
                        'description': row.description,
                        'notes': row.notes,
                        'created_at': row.created_at,
                        'updated_at': row.updated_at
                    }
                    
                    wine = Wine()
                    for key, value in wine_dict.items():
                        setattr(wine, key, value)
                    wines.append(wine)
                
                # Formatta risposta usando _format_wines_response
                return self._format_wines_response(wines)
                
        except Exception as e:
            logger.error(f"[INFORMATIONAL_QUERY] Errore gestione query informativa: {e}", exc_info=True)
            return None
    
    async def _build_inventory_list_response(self, telegram_id: int, limit: int = 50) -> str:
        """
        Costruisce risposta formattata per lista inventario.
        Copia logica da telegram-ai-bot.
        """
        try:
            wines = await db_manager.get_user_wines(telegram_id)
            if not wines:
                return "📋 Il tuo inventario è vuoto."
            
            wine_list = []
            for idx, wine in enumerate(wines[:limit], start=1):
                wine_str = f"{idx}. **{wine.name}**"
                if wine.producer:
                    wine_str += f" ({wine.producer})"
                if wine.vintage:
                    wine_str += f" {wine.vintage}"
                if wine.quantity is not None:
                    wine_str += f" — {wine.quantity} bott."
                if wine.selling_price:
                    wine_str += f" - €{wine.selling_price:.2f}"
                wine_list.append(wine_str)
            
            response = f"📋 **Il tuo inventario** ({len(wines)} vini)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            response += "\n".join(wine_list)
            response += "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            return response
        except Exception as e:
            logger.error(f"[INVENTORY_LIST] Errore costruzione lista: {e}", exc_info=True)
            return "❌ Errore nel recupero dell'inventario. Riprova."
    
    # ========== CASCADING RETRY SEARCH ==========
    
    async def _retry_level_1_normalize_local(self, query: str) -> List[str]:
        """
        Livello 1: Normalizzazione locale (plurali, accenti).
        Genera varianti normalizzate del termine di ricerca.
        """
        variants = [query]
        query_lower = query.lower().strip()
        
        # Normalizzazione plurali (stessa logica di search_wines)
        if len(query_lower) > 2:
            if query_lower.endswith('i'):
                # Plurale maschile: "vermentini" -> "vermentino"
                base = query_lower[:-1]
                variants.append(base + 'o')  # vermentino
                variants.append(base)  # vermentin
            elif query_lower.endswith('e'):
                # Plurale femminile: "bianche" -> "bianco"
                base = query_lower[:-1]
                variants.append(base + 'a')  # bianca
                variants.append(base + 'o')  # bianco
                variants.append(base)  # bianch
        
        # Rimuovi accenti/apostrofi (normalizzazione base)
        if "'" in query:
            variants.append(query.replace("'", ""))
        if "'" in query:  # apostrofo unicode (diverso carattere)
            variants.append(query.replace("'", ""))
        
        return list(set(variants))  # Rimuovi duplicati mantenendo ordine
    
    async def _retry_level_2_fallback_less_specific(
        self,
        telegram_id: int,
        original_filters: Dict[str, Any],
        original_query: Optional[str] = None
    ) -> Optional[List]:
        """
        Livello 2: Fallback a ricerca meno specifica.
        Rimuove filtri troppo specifici e prova ricerca generica.
        """
        try:
            # Estrai termini chiave dai filtri per ricerca generica
            fallback_queries = []
            
            # Se c'è producer, usa come query generica
            if "producer" in original_filters and original_filters["producer"]:
                fallback_queries.append(original_filters["producer"])
            
            # Se c'è name_contains, usa come query generica
            if "name_contains" in original_filters and original_filters["name_contains"]:
                fallback_queries.append(original_filters["name_contains"])
            
            # Se c'è una query originale, usala
            if original_query:
                fallback_queries.append(original_query)
            
            # Prova ogni query fallback con search_wines (ricerca generica)
            for fallback_query in fallback_queries:
                if not fallback_query or not fallback_query.strip():
                    continue
                
                logger.info(f"[RETRY_L2] Provo ricerca meno specifica con: '{fallback_query}'")
                wines = await db_manager.search_wines(telegram_id, fallback_query.strip(), limit=50)
                if wines:
                    logger.info(f"[RETRY_L2] ✅ Trovati {len(wines)} vini con ricerca meno specifica")
                    return wines
            
            return None
        except Exception as e:
            logger.error(f"[RETRY_L2] Errore in fallback meno specifica: {e}", exc_info=True)
            return None
    
    async def _retry_level_3_ai_post_processing(
        self,
        original_query: str,
        failed_search_term: Optional[str] = None,
        original_filters: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Livello 3: AI Post-Processing.
        Chiama OpenAI per reinterpretare/suggerire query alternativa.
        """
        try:
            if not self.openai_api_key:
                logger.warning("[RETRY_L3] OPENAI_API_KEY non disponibile, salto AI Post-Processing")
                return None
            
            # Costruisci prompt per AI
            context_parts = []
            if failed_search_term:
                context_parts.append(f"L'utente ha cercato: '{failed_search_term}'")
            elif original_query:
                context_parts.append(f"L'utente ha cercato: '{original_query}'")
            
            if original_filters:
                filters_str = ", ".join([f"{k}: {v}" for k, v in original_filters.items() if v])
                if filters_str:
                    context_parts.append(f"Filtri applicati: {filters_str}")
            
            context_parts.append("La ricerca nel database non ha trovato risultati.")
            
            retry_prompt = f"""
{chr(10).join(context_parts)}

Suggerisci una query di ricerca alternativa normalizzata. Considera:
- Normalizzazione plurali (es. "vermentini" → "vermentino")
- Rimozione filtri troppo specifici
- Termine chiave principale da cercare

Rispondi SOLO con il termine di ricerca suggerito, senza spiegazioni, senza virgolette, senza punteggiatura finale.
Esempio di risposta: vermentino
"""
            
            logger.info(f"[RETRY_L3] Chiamo AI per reinterpretare query: {original_query[:50]}")
            
            response = self.client.chat.completions.create(
                model=self.openai_model,
                messages=[
                    {"role": "system", "content": "Sei un assistente che aiuta a normalizzare query di ricerca per vini. Rispondi solo con il termine normalizzato."},
                    {"role": "user", "content": retry_prompt}
                ],
                max_tokens=50,
                temperature=0.3  # Bassa temperatura per risposte più deterministiche
            )
            
            if response.choices and response.choices[0].message.content:
                retry_query = response.choices[0].message.content.strip().strip('"').strip("'").strip()
                if retry_query and retry_query != original_query and len(retry_query) > 1:
                    logger.info(f"[RETRY_L3] ✅ AI suggerisce query alternativa: '{retry_query}'")
                    return retry_query
            
            return None
        except Exception as e:
            logger.error(f"[RETRY_L3] Errore in AI Post-Processing: {e}", exc_info=True)
            return None
    
    async def _cascading_retry_search(
        self,
        telegram_id: int,
        original_query: str,
        search_func,
        search_func_args: Dict[str, Any],
        original_filters: Optional[Dict[str, Any]] = None
    ) -> Tuple[Optional[List], Optional[str], str]:
        """
        Esegue ricerca con cascata di retry a 3 livelli.
        
        Returns:
            (wines_found, retry_query_used, level_used)
        """
        # Tentativo originale
        try:
            wines = await search_func(**search_func_args)
            if wines:
                logger.info(f"[RETRY] ✅ Ricerca originale ha trovato {len(wines)} vini")
                return wines, None, "original"
        except Exception as e:
            logger.warning(f"[RETRY] Errore ricerca originale: {e}")
        
        # Livello 1: Normalizzazione locale (solo per ricerca non filtrata o con name_contains)
        if not original_filters or "name_contains" in search_func_args.get("filters", {}):
            variants = await self._retry_level_1_normalize_local(original_query)
            for variant in variants[1:]:  # Skip primo (originale già provato)
                if variant == original_query:
                    continue
                try:
                    # Prova con variante normalizzata
                    args_retry = search_func_args.copy()
                    if "search_term" in args_retry:
                        args_retry["search_term"] = variant
                    elif "query" in args_retry:
                        args_retry["query"] = variant
                    elif "filters" in args_retry:
                        # Per search_wines_filtered, aggiungi variant come name_contains
                        args_retry["filters"] = args_retry["filters"].copy()
                        args_retry["filters"]["name_contains"] = variant
                    
                    wines = await search_func(**args_retry)
                    if wines:
                        logger.info(f"[RETRY_L1] ✅ Trovati {len(wines)} vini con variante normalizzata: '{variant}'")
                        return wines, variant, "level1"
                except Exception as e:
                    logger.debug(f"[RETRY_L1] Variante '{variant}' fallita: {e}")
                    continue
        
        # Livello 2: Fallback a ricerca meno specifica (solo se ricerca filtrata)
        if original_filters:
            logger.info(f"[RETRY_L2] Avvio fallback ricerca meno specifica per query filtrata: '{original_query}'")
            wines = await self._retry_level_2_fallback_less_specific(
                telegram_id, original_filters, original_query
            )
            if wines:
                logger.info(f"[RETRY_L2] ✅ Fallback riuscito: trovati {len(wines)} vini")
                return wines, None, "level2"
            else:
                logger.info(f"[RETRY_L2] ❌ Fallback non ha trovato risultati")
        
        # Livello 3: AI Post-Processing
        logger.info(f"[RETRY_L3] Avvio AI Post-Processing per: '{original_query}'")
        retry_query = await self._retry_level_3_ai_post_processing(
            original_query, original_query, original_filters
        )
        if retry_query:
            logger.info(f"[RETRY_L3] Query suggerita da AI: '{retry_query}'")
            try:
                # Per ricerca filtrata, usa sempre search_wines generico con query AI
                # Per ricerca semplice, prova con search_func modificato
                if original_filters:
                    # Ricerca filtrata: usa search_wines generico
                    wines = await db_manager.search_wines(telegram_id, retry_query, limit=50)
                    if wines:
                        logger.info(f"[RETRY_L3] ✅ Trovati {len(wines)} vini con query AI (ricerca generica): '{retry_query}'")
                        return wines, retry_query, "level3"
                else:
                    # Ricerca semplice: prova con search_func modificato
                    args_retry = search_func_args.copy()
                    if "search_term" in args_retry:
                        args_retry["search_term"] = retry_query
                    elif "query" in args_retry:
                        args_retry["query"] = retry_query
                    
                    wines = await search_func(**args_retry)
                    if wines:
                        logger.info(f"[RETRY_L3] ✅ Trovati {len(wines)} vini con query AI: '{retry_query}'")
                        return wines, retry_query, "level3"
            except Exception as e:
                logger.warning(f"[RETRY_L3] Errore ricerca con query AI: {e}", exc_info=True)
        
        logger.warning(f"[RETRY] ❌ TUTTI I LIVELLI DI RETRY FALLITI per query: '{original_query}' (livelli provati: originale → L1 → L2 → L3)")
        return None, None, "failed"
    
    # ========== FUNCTION CALLING OPENAI ==========
    
    def _get_openai_tools(self) -> List[Dict[str, Any]]:
        """
        Definisce tutti i tools disponibili per OpenAI function calling.
        Copia struttura dal telegram bot.
        """
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_inventory_list",
                    "description": "Restituisce l'elenco dei vini dell'utente corrente con quantità e prezzi.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "limit": {"type": "integer", "description": "Numero massimo di vini da elencare", "default": 50}
                        },
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_wine_info",
                    "description": "Restituisce le informazioni dettagliate di un vino presente nell'inventario utente.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "wine_query": {"type": "string", "description": "Nome o parte del nome del vino da cercare"}
                        },
                        "required": ["wine_query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_wine_price",
                    "description": "Restituisce i prezzi (vendita/acquisto) per un vino dell'utente.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "wine_query": {"type": "string", "description": "Nome o parte del nome del vino"}
                        },
                        "required": ["wine_query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_wine_quantity",
                    "description": "Restituisce la quantità in magazzino per un vino dell'utente.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "wine_query": {"type": "string", "description": "Nome o parte del nome del vino"}
                        },
                        "required": ["wine_query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_wine_by_criteria",
                    "description": """Trova il vino che corrisponde a criteri specifici (min/max per quantità, prezzo, annata).
                    Usa questa funzione quando l'utente chiede domande qualitative o comparative:
                    - "quale vino ha meno quantità" → query_type: "min", field: "quantity"
                    - "quale è il più costoso/pregiato/migliore/valore/prestigio" → query_type: "max", field: "selling_price"
                    - "quale ha più bottiglie" → query_type: "max", field: "quantity"
                    - "quale è il più economico" → query_type: "min", field: "selling_price"
                    - "quale vino ho pagato di più" → query_type: "max", field: "cost_price"
                    - "quale è il più recente/nuovo" → query_type: "max", field: "vintage"
                    - "quale è il più vecchio/antico" → query_type: "min", field: "vintage"
                    
                    IMPORTANTE: "pregiato", "migliore", "di valore", "prestigioso" generalmente si riferiscono al prezzo più alto (selling_price max).
                    """,
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query_type": {
                                "type": "string",
                                "enum": ["min", "max"],
                                "description": "Tipo di query: 'min' per trovare il minimo, 'max' per trovare il massimo"
                            },
                            "field": {
                                "type": "string",
                                "enum": ["quantity", "selling_price", "cost_price", "vintage"],
                                "description": "Campo da interrogare: 'quantity' per quantità bottiglie, 'selling_price' per prezzo vendita, 'cost_price' per prezzo acquisto, 'vintage' per annata"
                            }
                        },
                        "required": ["query_type", "field"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "search_wines",
                    "description": """Cerca vini applicando filtri multipli. USA QUESTA FUNZIONE quando l'utente chiede vini con criteri specifici:
- Geografici: 'della Toscana', 'italiani', 'del Piemonte', 'francesi', ecc.
- Tipo: 'rossi', 'bianchi', 'spumanti', 'rosati'
- Prezzo: 'prezzo sotto X', 'prezzo sopra Y'
- Annata: 'dal 2015', 'fino al 2020'
- Produttore: 'produttore X', 'cantina Y'
- Combinati: 'rossi toscani', 'italiani sotto €50'

IMPORTANTE: Se la richiesta contiene QUALSIASI filtro, usa questa funzione invece di get_inventory_list.
Formato filters: {"region": "Toscana", "country": "Italia", "wine_type": "rosso", "price_max": 50, "vintage_min": 2015, "producer": "nome", "name_contains": "testo"}""",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "filters": {
                                "type": "object",
                                "properties": {
                                    "region": {"type": "string", "description": "Regione italiana (es. 'Toscana', 'Piemonte')"},
                                    "country": {"type": "string", "description": "Paese (es. 'Italia', 'Francia', 'Spagna')"},
                                    "wine_type": {"type": "string", "enum": ["rosso", "bianco", "rosato", "spumante"]},
                                    "classification": {"type": "string"},
                                    "producer": {"type": "string", "description": "Nome produttore/cantina"},
                                    "name_contains": {"type": "string", "description": "Testo contenuto nel nome vino"},
                                    "price_min": {"type": "number", "description": "Prezzo minimo vendita"},
                                    "price_max": {"type": "number", "description": "Prezzo massimo vendita"},
                                    "vintage_min": {"type": "integer", "description": "Annata minima (es. 2015)"},
                                    "vintage_max": {"type": "integer", "description": "Annata massima (es. 2020)"},
                                    "quantity_min": {"type": "integer"},
                                    "quantity_max": {"type": "integer"}
                                }
                            },
                            "limit": {"type": "integer", "default": 50}
                        },
                        "required": ["filters"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_inventory_stats",
                    "description": "Ritorna il riepilogo inventario (totale vini, totale bottiglie, prezzi media/min/max, low stock).",
                    "parameters": {"type": "object", "properties": {}}
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_movement_summary",
                    "description": "Riepiloga consumi/rifornimenti per un periodo (day/week/month). Se periodo mancante, chiedilo all'utente.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "period": {"type": "string", "enum": ["day", "week", "month"], "description": "Periodo del riepilogo"}
                        },
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "register_consumption",
                    "description": "Registra un consumo (vendita/consumo) di bottiglie. Diminuisce la quantità disponibile del vino specificato.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "wine_name": {"type": "string", "description": "Nome del vino da consumare"},
                            "quantity": {"type": "integer", "description": "Numero di bottiglie consumate (deve essere positivo)"}
                        },
                        "required": ["wine_name", "quantity"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "register_replenishment",
                    "description": "Registra un rifornimento (acquisto/aggiunta) di bottiglie. Aumenta la quantità disponibile del vino specificato.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "wine_name": {"type": "string", "description": "Nome del vino da rifornire"},
                            "quantity": {"type": "integer", "description": "Numero di bottiglie aggiunte (deve essere positivo)"}
                        },
                        "required": ["wine_name", "quantity"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_low_stock_wines",
                    "description": "Ottiene lista vini con scorte basse (quantità inferiore alla soglia). Utile per identificare vini da rifornire.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "threshold": {"type": "integer", "description": "Soglia minima quantità (vini con quantità < threshold vengono segnalati)", "default": 5}
                        }
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_wine_details",
                    "description": "Ottiene dettagli completi di un vino specifico: nome, produttore, annata, quantità, prezzo, regione, tipo, etc.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "wine_id": {"type": "integer", "description": "ID del vino di cui ottenere i dettagli"}
                        },
                        "required": ["wine_id"]
                    }
                }
            }
        ]
        return tools
    
    async def _execute_tool(
        self,
        tool_name: str,
        tool_args: Dict[str, Any],
        telegram_id: int
    ) -> Dict[str, Any]:
        """
        Esegue un tool chiamato dall'AI.
        Fallback inline (compatibilità senza FunctionExecutor).
        """
        logger.info(f"[TOOLS] Esecuzione tool: {tool_name} con args: {tool_args}")
        
        try:
            # get_inventory_list
            if tool_name == "get_inventory_list":
                limit = int(tool_args.get("limit", 50))
                wines = await db_manager.get_user_wines(telegram_id)
                if wines:
                    wine_list = []
                    for wine in wines[:limit]:
                        wine_str = f"• **{wine.name}**"
                        if wine.producer:
                            wine_str += f" ({wine.producer})"
                        if wine.vintage:
                            wine_str += f" {wine.vintage}"
                        if wine.quantity is not None:
                            wine_str += f" - {wine.quantity} bottiglie"
                        if wine.selling_price:
                            wine_str += f" - €{wine.selling_price:.2f}"
                        wine_list.append(wine_str)
                    
                    response = f"📋 **Il tuo inventario** ({len(wines)} vini)\n\n"
                    response += "\n".join(wine_list)
                    return {"success": True, "message": response, "use_template": False}
                return {"success": True, "message": "📋 Il tuo inventario è vuoto.", "use_template": False}
            
            # get_wine_info
            if tool_name == "get_wine_info":
                query = (tool_args.get("wine_query") or "").strip()
                if not query:
                    return {"success": False, "error": "Richiesta incompleta: specifica il vino."}
                
                wines, retry_query_used, level_used = await self._cascading_retry_search(
                    telegram_id=telegram_id,
                    original_query=query,
                    search_func=db_manager.search_wines,
                    search_func_args={"telegram_id": telegram_id, "search_term": query, "limit": 10},
                    original_filters=None
                )
                
                if wines:
                    logger.info(f"[TOOLS] ✅ Trovati {len(wines)} vini (livello: {level_used})")
                    if len(wines) == 1:
                        wine = wines[0]
                        response = f"🍷 **{wine.name}**"
                        if wine.producer:
                            response += f" ({wine.producer})"
                        response += "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        if wine.vintage:
                            response += f"📅 **Annata:** {wine.vintage}\n"
                        if wine.quantity is not None:
                            response += f"📦 **Quantità:** {wine.quantity} bottiglie\n"
                        if wine.selling_price:
                            response += f"💰 **Prezzo vendita:** €{wine.selling_price:.2f}\n"
                        if wine.cost_price:
                            response += f"💵 **Prezzo acquisto:** €{wine.cost_price:.2f}\n"
                        if wine.region:
                            response += f"📍 **Regione:** {wine.region}\n"
                        if wine.country:
                            response += f"🌍 **Paese:** {wine.country}\n"
                        if wine.wine_type:
                            response += f"🔴/⚪ **Tipo:** {wine.wine_type}\n"
                        response += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                        return {"success": True, "message": response, "use_template": False, "buttons": None}
                    else:
                        # Più vini: genera buttons
                        buttons = [
                            {
                                "id": wine.id,
                                "text": f"{wine.name}" + (f" ({wine.producer})" if wine.producer else "") + (f" {wine.vintage}" if wine.vintage else "")
                            }
                            for wine in wines[:10]
                        ]
                        response = f"🔍 Ho trovato **{len(wines)} vini** che corrispondono a '{query}':\n\n"
                        for wine in wines[:10]:
                            response += f"• **{wine.name}**"
                            if wine.producer:
                                response += f" ({wine.producer})"
                            response += "\n"
                        response += "\n💡 Seleziona quale vuoi vedere per maggiori dettagli."
                        return {"success": True, "message": response, "use_template": False, "buttons": buttons}
                
                return {"success": False, "error": f"❌ Non ho trovato vini per '{query}' nel tuo inventario."}
            
            # get_wine_price
            if tool_name == "get_wine_price":
                query = (tool_args.get("wine_query") or "").strip()
                if not query:
                    return {"success": False, "error": "Richiesta incompleta: specifica il vino."}
                
                wines, retry_query_used, level_used = await self._cascading_retry_search(
                    telegram_id=telegram_id,
                    original_query=query,
                    search_func=db_manager.search_wines,
                    search_func_args={"telegram_id": telegram_id, "search_term": query, "limit": 50},
                    original_filters=None
                )
                
                if wines:
                    response_parts = []
                    for wine in wines[:5]:  # Max 5 vini per prezzo
                        wine_info = f"🍷 **{wine.name}**"
                        if wine.producer:
                            wine_info += f" ({wine.producer})"
                        wine_info += "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        if wine.selling_price:
                            wine_info += f"💰 **Prezzo vendita:** €{wine.selling_price:.2f}\n"
                        if wine.cost_price:
                            wine_info += f"💵 **Prezzo acquisto:** €{wine.cost_price:.2f}\n"
                            if wine.selling_price and wine.cost_price:
                                margin = wine.selling_price - wine.cost_price
                                margin_pct = (margin / wine.cost_price) * 100 if wine.cost_price > 0 else 0
                                wine_info += f"📊 **Margine:** €{margin:.2f} ({margin_pct:.1f}%)\n"
                        wine_info += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                        response_parts.append(wine_info)
                    
                    return {"success": True, "message": "\n\n".join(response_parts), "use_template": False}
                
                return {"success": False, "error": f"❌ Non ho trovato vini per '{query}' nel tuo inventario."}
            
            # get_wine_quantity
            if tool_name == "get_wine_quantity":
                query = (tool_args.get("wine_query") or "").strip()
                if not query:
                    return {"success": False, "error": "Richiesta incompleta: specifica il vino."}
                
                wines, retry_query_used, level_used = await self._cascading_retry_search(
                    telegram_id=telegram_id,
                    original_query=query,
                    search_func=db_manager.search_wines,
                    search_func_args={"telegram_id": telegram_id, "search_term": query, "limit": 50},
                    original_filters=None
                )
                
                if wines:
                    response_parts = []
                    for wine in wines[:5]:  # Max 5 vini per quantità
                        wine_info = f"🍷 **{wine.name}**"
                        if wine.producer:
                            wine_info += f" ({wine.producer})"
                        wine_info += "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        if wine.quantity is not None:
                            wine_info += f"📦 **In cantina hai:** {wine.quantity} bottiglie\n"
                        else:
                            wine_info += "📦 **Quantità:** Non specificata\n"
                        wine_info += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                        response_parts.append(wine_info)
                    
                    return {"success": True, "message": "\n\n".join(response_parts), "use_template": False}
                
                return {"success": False, "error": f"❌ Non ho trovato vini per '{query}' nel tuo inventario."}
            
            # get_wine_by_criteria
            if tool_name == "get_wine_by_criteria":
                query_type = tool_args.get("query_type")
                field = tool_args.get("field")
                if not query_type or not field:
                    return {"success": False, "error": "Richiesta incompleta: specifica query_type (min/max) e field."}
                
                logger.info(f"[TOOLS] get_wine_by_criteria: {query_type} {field}")
                informational_response = await self._handle_informational_query(telegram_id, query_type, field)
                if informational_response:
                    return {"success": True, "message": informational_response, "use_template": False}
                return {"success": False, "error": "Non ho trovato vini che corrispondono ai criteri richiesti."}
            
            # search_wines
            if tool_name == "search_wines":
                filters = tool_args.get("filters") or {}
                limit = int(tool_args.get("limit", 50))
                
                # TODO: implementare search_wines_filtered in db_manager
                logger.info(f"[TOOLS] search_wines con filtri: {filters} - TODO: implementare search_wines_filtered")
                return {"success": False, "error": "Ricerca filtrata in fase di implementazione. Usa ricerca semplice per ora."}
            
            # get_inventory_stats
            if tool_name == "get_inventory_stats":
                wines = await db_manager.get_user_wines(telegram_id)
                if wines:
                    total_bottles = sum(w.quantity for w in wines if w.quantity) or 0
                    prices = [w.selling_price for w in wines if w.selling_price]
                    low_stock = [w for w in wines if w.quantity is not None and w.min_quantity is not None and w.quantity <= w.min_quantity]
                    
                    response = f"📊 **Riepilogo Inventario**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                    response += f"🍷 **Totale vini:** {len(wines)}\n"
                    response += f"📦 **Totale bottiglie:** {total_bottles}\n"
                    if prices:
                        response += f"💰 **Prezzo medio:** €{sum(prices)/len(prices):.2f}\n"
                        response += f"💰 **Prezzo min:** €{min(prices):.2f}\n"
                        response += f"💰 **Prezzo max:** €{max(prices):.2f}\n"
                    if low_stock:
                        response += f"⚠️ **Scorte basse:** {len(low_stock)} vini\n"
                    response += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                    return {"success": True, "message": response, "use_template": False}
                
                return {"success": True, "message": "📊 Il tuo inventario è vuoto.", "use_template": False}
            
            # register_consumption / register_replenishment
            if tool_name in ("register_consumption", "register_replenishment"):
                wine_name = (tool_args.get("wine_name") or "").strip()
                quantity = tool_args.get("quantity")
                
                if not wine_name or not quantity or quantity <= 0:
                    return {"success": False, "error": "Richiesta incompleta: specifica vino e quantità valida."}
                
                movement_type = "consumo" if tool_name == "register_consumption" else "rifornimento"
                
                # ✅ FUZZY MATCHING: Cerca il vino nel database PRIMA di chiamare il processor
                # Usa cascading retry search per trovare il nome esatto del vino
                logger.info(f"[TOOLS] {tool_name}: Ricerca fuzzy matching per '{wine_name}'")
                wines, retry_query_used, level_used = await self._cascading_retry_search(
                    telegram_id=telegram_id,
                    original_query=wine_name,
                    search_func=db_manager.search_wines,
                    search_func_args={"telegram_id": telegram_id, "search_term": wine_name, "limit": 10},
                    original_filters=None
                )
                
                # Se trovato, usa il nome esatto del primo match
                if wines and len(wines) > 0:
                    matched_wine_name = wines[0].name
                    logger.info(f"[TOOLS] {tool_name}: Fuzzy matching '{wine_name}' → '{matched_wine_name}' (livello: {level_used})")
                    wine_name = matched_wine_name  # Usa nome esatto trovato nel database
                else:
                    # Se non trovato, prova comunque con il nome originale (potrebbe essere un nuovo vino)
                    logger.warning(f"[TOOLS] {tool_name}: Nessun vino trovato per '{wine_name}', uso nome originale")
                
                # Processa movimento via Processor
                try:
                    user = await db_manager.get_user_by_telegram_id(telegram_id)
                    if not user or not user.business_name:
                        return {"success": False, "error": "Nome locale non trovato. Completa prima l'onboarding."}
                    
                    result = await processor_client.process_movement(
                        telegram_id=telegram_id,
                        business_name=user.business_name,
                        wine_name=wine_name,  # Usa nome esatto trovato (o originale se non trovato)
                        movement_type=movement_type,
                        quantity=quantity
                    )
                    
                    if result.get('status') == 'success':
                        wine_name_result = result.get('wine_name', wine_name)
                        qty_before = result.get('quantity_before', 0)
                        qty_after = result.get('quantity_after', 0)
                        
                        response = f"✅ **{movement_type.capitalize()} registrato**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                        response += f"🍷 **Vino:** {wine_name_result}\n"
                        response += f"📦 **Quantità:** {quantity} bottiglie\n"
                        response += f"📊 **Prima:** {qty_before} bottiglie\n"
                        response += f"📊 **Dopo:** {qty_after} bottiglie\n"
                        response += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                        return {"success": True, "message": response, "use_template": False}
                    else:
                        error_msg = result.get('error', 'Errore sconosciuto')
                        return {"success": False, "error": f"❌ Errore: {error_msg}"}
                except Exception as e:
                    logger.error(f"[TOOLS] Errore processamento movimento: {e}", exc_info=True)
                    return {"success": False, "error": f"Errore durante il processamento: {str(e)[:200]}"}
            
            # Tool non riconosciuto
            logger.warning(f"[TOOLS] Tool '{tool_name}' non riconosciuto")
            return {"success": False, "error": f"Funzione '{tool_name}' non ancora implementata."}
            
        except Exception as e:
            logger.error(f"[TOOLS] Errore esecuzione tool '{tool_name}': {e}", exc_info=True)
            return {"success": False, "error": f"Errore durante l'esecuzione: {str(e)[:200]}"}
    
    async def _call_openai_with_tools(
        self,
        user_message: str,
        telegram_id: int,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        user_context: str = ""
    ) -> Dict[str, Any]:
        """
        Chiama OpenAI con function calling.
        Restituisce risposta formattata o None se nessun tool chiamato.
        """
        if not self.client:
            return None
        
        try:
            # Prepara system prompt
            system_prompt = f"""Sei Gio.ia-bot, un assistente AI specializzato nella gestione inventario vini. Sei gentile, professionale e parli in italiano.

{user_context}

CAPACITÀ:
- Analizzare l'inventario dell'utente in tempo reale
- Rispondere a QUALSIASI domanda o messaggio
- Suggerire riordini per scorte basse
- Fornire consigli pratici su gestione magazzino
- Analizzare movimenti e consumi
- Generare report e statistiche
- Conversazione naturale e coinvolgente

ISTRUZIONI IMPORTANTI:
- CONSULTA SEMPRE il database usando i tools prima di rispondere a qualsiasi domanda informativa
- RISPONDI SEMPRE a qualsiasi messaggio, anche se non è una domanda
- Mantieni una conversazione naturale e amichevole
- Usa sempre i dati dell'inventario e dei movimenti quando disponibili
- Sii specifico e pratico nei consigli
- Se l'utente comunica consumi/rifornimenti, usa register_consumption o register_replenishment
- Se l'inventario ha scorte basse, avvisa proattivamente

REGOLA D'ORO: Prima di rispondere a qualsiasi domanda informativa, consulta SEMPRE il database usando i tools disponibili."""
            
            # Prepara messaggi
            messages = [{"role": "system", "content": system_prompt}]
            
            # Aggiungi storia conversazione se disponibile
            if conversation_history:
                messages.extend(conversation_history)
            
            # Aggiungi ultimo messaggio utente
            messages.append({"role": "user", "content": user_message.strip()})
            
            # Ottieni tools
            tools = self._get_openai_tools()
            
            # Chiama OpenAI con tools
            logger.info(f"[FUNCTION_CALLING] Chiamata OpenAI con {len(tools)} tools disponibili")
            response = self.client.chat.completions.create(
                model=self.openai_model,
                messages=messages,
                max_tokens=1500,
                temperature=0.7,
                tools=tools,
                tool_choice="auto"
            )
            
            choice = response.choices[0]
            message = choice.message
            
            # Controlla se ci sono tool calls
            tool_calls = getattr(message, "tool_calls", None)
            
            if tool_calls:
                # Esegui la prima tool call (una risposta deterministica e rapida)
                call = tool_calls[0]
                fn = call.function
                tool_name = getattr(fn, "name", "")
                tool_args = {}
                try:
                    tool_args = json.loads(getattr(fn, "arguments", "{}") or "{}")
                except Exception as e:
                    logger.error(f"[FUNCTION_CALLING] Errore parsing tool arguments: {e}")
                    return None
                
                logger.info(f"[FUNCTION_CALLING] Tool chiamato: {tool_name} con args: {tool_args}")
                
                # Esegui tool
                tool_result = await self._execute_tool(tool_name, tool_args, telegram_id)
                
                if tool_result.get("success"):
                    message_text = tool_result.get("message", "✅ Operazione completata")
                    buttons = tool_result.get("buttons")
                    
                    return {
                        "message": message_text,
                        "metadata": {
                            "type": "function_call",
                            "tool": tool_name,
                            "model": self.openai_model
                        },
                        "buttons": buttons
                    }
                else:
                    error_msg = tool_result.get("error", "Errore sconosciuto")
                    return {
                        "message": f"❌ {error_msg}",
                        "metadata": {
                            "type": "function_call_error",
                            "tool": tool_name
                        },
                        "buttons": None
                    }
            else:
                # Nessun tool chiamato: usa contenuto generato dall'AI
                content = getattr(message, "content", "") or ""
                if content.strip():
                    return {
                        "message": content.strip(),
                        "metadata": {
                            "type": "ai_response",
                            "model": self.openai_model
                        },
                        "buttons": None
                    }
            
            return None
            
        except Exception as e:
            logger.error(f"[FUNCTION_CALLING] Errore chiamata OpenAI con tools: {e}", exc_info=True)
            return None
    
    async def _simple_ai_response(
        self,
        user_message: str,
        telegram_id: int
    ) -> Dict[str, Any]:
        """
        Fallback: risposta AI con ricerca vini integrata (logica essenziale del bot).
        """
        import re
        
        # Recupera contesto utente
        user_context = ""
        specific_wine_info = ""
        found_wines = []
        
        try:
            user = await db_manager.get_user_by_telegram_id(telegram_id)
            if user:
                user_context = f"""
INFORMAZIONI UTENTE:
- Nome attività: {user.business_name or 'Non specificato'}
- Onboarding completato: {'Sì' if user.onboarding_completed else 'No'}
"""
                
                # Rileva ricerca vini nel messaggio (pattern dal telegram bot)
                wine_search_patterns = [
                    # Pattern 0: "che X ho/hai?" - PRIMA di altri pattern
                    r'(?:che|quale|quali)\s+(.+?)(?:\s+ho|\s+hai|\s+ci\s+sono|\s+in\s+cantina|\s+in\s+magazzino|\s+quantità|\?|$)',
                    # Pattern 1: "quanti/quante bottiglie di X ho/hai"
                    r'(?:quanti|quante)\s+bottiglie?\s+di\s+(.+?)(?:\s+ho|\s+hai|\s+ci\s+sono|\s+in\s+cantina|\s+in\s+magazzino|\s+quantità|$)',
                    # Pattern 2: "quanti/quante X ho/hai"
                    r'(?:quanti|quante)\s+(.+?)(?:\s+ho|\s+hai|\s+ci\s+sono|\s+in\s+cantina|\s+in\s+magazzino|\s+quantità|$)',
                    # Pattern 3: "a quanto vendo/vendi X"
                    r'a\s+quanto\s+(?:vendo|vendi|costano|prezzo)\s+(.+)',
                    # Pattern 4: "prezzo X"
                    r'prezzo\s+(.+)',
                ]
                
                wine_search_term = None
                for pattern in wine_search_patterns:
                    match = re.search(pattern, user_message.lower())
                    if match:
                        raw_term = match.group(1).strip()
                        # Pulisci termine usando funzione dedicata
                        wine_search_term = self._clean_wine_search_term(raw_term)
                        if wine_search_term and len(wine_search_term) > 2:
                            logger.info(f"[FALLBACK] Pattern matchato: '{pattern[:50]}...' | Termine estratto: '{raw_term}' → pulito: '{wine_search_term}'")
                            break
                
                # Cerca vini se termine trovato (con cascading retry)
                if wine_search_term:
                    try:
                        # Usa cascading retry per migliorare successo ricerca
                        found_wines, retry_query_used, level_used = await self._cascading_retry_search(
                            telegram_id=telegram_id,
                            original_query=wine_search_term,
                            search_func=db_manager.search_wines,
                            search_func_args={"telegram_id": telegram_id, "search_term": wine_search_term, "limit": 50},
                            original_filters=None
                        )
                        if found_wines:
                            logger.info(f"[FALLBACK] Trovati {len(found_wines)} vini per '{wine_search_term}' (livello: {level_used})")
                            specific_wine_info = self._format_wines_response(found_wines)
                        else:
                            logger.info(f"[FALLBACK] Nessun vino trovato dopo cascading retry per '{wine_search_term}'")
                            specific_wine_info = f"❌ Non ho trovato vini per '{wine_search_term}' nel tuo inventario."
                    except Exception as e:
                        logger.error(f"[FALLBACK] Errore ricerca vini con cascading retry: {e}", exc_info=True)
                        specific_wine_info = f"❌ Errore temporaneo nella ricerca. Riprova tra qualche minuto."
                
                # Statistiche inventario (solo se non abbiamo già trovato vini specifici)
                if not specific_wine_info:
                    try:
                        wines = await db_manager.get_user_wines(telegram_id)
                        if wines:
                            user_context += f"\nINVENTARIO ATTUALE:\n"
                            user_context += f"- Totale vini: {len(wines)}\n"
                            user_context += f"- Quantità totale: {sum(w.quantity for w in wines if w.quantity) or 0} bottiglie\n"
                            low_stock = [w for w in wines if w.quantity is not None and w.min_quantity is not None and w.quantity <= w.min_quantity]
                            if low_stock:
                                user_context += f"- Scorte basse: {len(low_stock)} vini\n"
                    except Exception as e:
                        logger.warning(f"[FALLBACK] Errore recupero statistiche inventario: {e}")
        except Exception as e:
            logger.error(f"[FALLBACK] Errore accesso database: {e}", exc_info=True)
            # Continua comunque con risposta generica
    
    def _format_wines_response(self, found_wines: list) -> str:
        """
        Formatta risposta per vini trovati, simile a format_wines_response_by_count del telegram bot.
        Restituisce messaggio formattato e prepara metadata per pulsanti se necessario.
        """
        if not found_wines:
            return "❌ Nessun vino trovato."
        
        num_wines = len(found_wines)
        
        # Caso 1: 1 solo vino → info completo
        if num_wines == 1:
            wine = found_wines[0]
            response_parts = [f"✅ **{wine.name}**"]
            if wine.producer:
                response_parts.append(f"Produttore: {wine.producer}")
            if wine.vintage:
                response_parts.append(f"Annata: {wine.vintage}")
            if wine.quantity is not None:
                response_parts.append(f"Quantità: {wine.quantity} bottiglie")
            if wine.selling_price:
                response_parts.append(f"Prezzo vendita: €{wine.selling_price:.2f}")
            return "\n".join(response_parts)
        
        # Caso 2: 2-10 vini → lista con suggerimento selezione
        if 2 <= num_wines <= 10:
            wine_list = []
            for wine in found_wines:
                wine_str = f"• **{wine.name}**"
                if wine.producer:
                    wine_str += f" ({wine.producer})"
                if wine.vintage:
                    wine_str += f" {wine.vintage}"
                if wine.quantity is not None:
                    wine_str += f" - {wine.quantity} bottiglie"
                wine_list.append(wine_str)
            
            response = f"🔍 Ho trovato **{num_wines} vini** che corrispondono alla tua ricerca:\n\n"
            response += "\n".join(wine_list)
            response += "\n\n💡 Seleziona quale vuoi vedere per maggiori dettagli."
            return response
        
        # Caso 3: >10 vini → messaggio informativo
        wine_list = []
        for wine in found_wines[:10]:
            wine_str = f"• **{wine.name}**"
            if wine.producer:
                wine_str += f" ({wine.producer})"
            wine_list.append(wine_str)
        
        response = f"🔍 Ho trovato **{num_wines} vini** che corrispondono alla tua ricerca.\n\n"
        response += "Ecco i primi 10:\n\n"
        response += "\n".join(wine_list)
        response += f"\n\n... e altri {num_wines - 10} vini.\n\n"
        response += "💡 Usa il viewer a destra per vedere e filtrare tutti i vini."
        return response
    
    async def _simple_ai_response_complete(
        self,
        user_message: str,
        telegram_id: int,
        specific_wine_info: str = "",
        found_wines: list = None,
        user_context: str = ""
    ) -> Dict[str, Any]:
        """
        Completa la risposta AI dopo la ricerca vini.
        Gestisce il caso in cui abbiamo già trovato vini o dobbiamo chiamare OpenAI.
        """
        found_wines = found_wines or []
        
        # Se abbiamo già una risposta formattata con vini trovati, restituiscila direttamente
        if specific_wine_info and found_wines and len(found_wines) > 0:
            buttons = None
            if 2 <= len(found_wines) <= 10:
                buttons = [
                    {
                        "id": wine.id,
                        "text": f"{wine.name}" + (f" ({wine.producer})" if wine.producer else "") + (f" {wine.vintage}" if wine.vintage else "")
                    }
                    for wine in found_wines[:10]
                ]
            
            return {
                "message": specific_wine_info,
                "metadata": {
                    "type": "fallback_ai_response",
                    "model": self.openai_model,
                    "wines_found": len(found_wines)
                },
                "buttons": buttons
            }
        
        # Se abbiamo un messaggio di errore ma non vini, restituiscilo comunque
        if specific_wine_info and not found_wines:
            return {
                "message": specific_wine_info,
                "metadata": {
                    "type": "fallback_ai_response",
                    "model": self.openai_model,
                    "wines_found": 0
                },
                "buttons": None
            }
        
        # Altrimenti usa AI per generare risposta
        system_prompt = """Sei Gio.ia-bot, un assistente AI specializzato nella gestione inventario vini.
Sei gentile, professionale e parli in italiano.

Puoi aiutare gli utenti con:
- Consultazione inventario vini
- Ricerca vini per nome, produttore, regione, tipo
- Gestione movimenti inventario (consumi/rifornimenti)
- Report e statistiche

IMPORTANTE: Se l'utente chiede informazioni su vini specifici, usa i dati forniti nel contesto.
Rispondi sempre in italiano in modo chiaro e professionale."""
        
        try:
            messages = [
                {"role": "system", "content": system_prompt + user_context}
            ]
            
            # Aggiungi info vini trovati se disponibile
            if specific_wine_info:
                messages.append({"role": "assistant", "content": specific_wine_info})
            
            messages.append({"role": "user", "content": user_message})
            
            response = self.client.chat.completions.create(
                model=self.openai_model,
                messages=messages,
                temperature=0.7
            )
            
            message_content = response.choices[0].message.content
            
            # Se abbiamo info vini, combina con risposta AI
            if specific_wine_info and not message_content.startswith("✅") and not message_content.startswith("🔍"):
                message_content = specific_wine_info + "\n\n" + message_content
            elif specific_wine_info:
                message_content = specific_wine_info
            
            # Prepara metadata per pulsanti se ci sono 2-10 vini
            buttons = None
            if found_wines and 2 <= len(found_wines) <= 10:
                buttons = [
                    {
                        "id": wine.id,
                        "text": f"{wine.name}" + (f" ({wine.producer})" if wine.producer else "") + (f" {wine.vintage}" if wine.vintage else "")
                    }
                    for wine in found_wines[:10]
                ]
            
            return {
                "message": message_content,
                "metadata": {
                    "type": "fallback_ai_response",
                    "model": self.openai_model,
                    "wines_found": len(found_wines) if found_wines else 0
                },
                "buttons": buttons
            }
        except Exception as e:
            logger.error(f"[FALLBACK] Errore chiamata OpenAI: {e}", exc_info=True)
            # Restituisci comunque una risposta valida anche se OpenAI fallisce
            return {
                "message": specific_wine_info if specific_wine_info else "⚠️ Errore temporaneo dell'AI. Riprova tra qualche minuto.",
                "metadata": {
                    "type": "fallback_error",
                    "error": str(e)
                },
                "buttons": None
            }


# Istanza globale
ai_service = AIService()

