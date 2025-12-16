"""
Servizio AI per web app - Reuse logica da telegram-ai-bot
Adattato per REST API invece di Telegram handlers
"""
import logging
import os
import sys
from pathlib import Path
from typing import Optional, Dict, Any
from openai import OpenAI, OpenAIError

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
            # Importa adapter PRIMA di importare ai.py
            from app.services.telegram_bot_adapter import setup_telegram_bot_imports
            setup_telegram_bot_imports()
            
            # Prova a importare get_ai_response dal telegram bot
            try:
                # Assicurati che config.py del telegram bot abbia le variabili necessarie
                import config as telegram_config
                if not hasattr(telegram_config, 'OPENAI_API_KEY') or not telegram_config.OPENAI_API_KEY:
                    # Usa la chiave dalla web app
                    telegram_config.OPENAI_API_KEY = self.openai_api_key
                    telegram_config.OPENAI_MODEL = self.openai_model
                    logger.info("[AI_SERVICE] Config telegram bot aggiornata con chiavi web app")
                
                from ai import get_ai_response
                logger.info(f"[AI_SERVICE] get_ai_response importato con successo, telegram_id={telegram_id}")
                
                # Usa la funzione originale del bot
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
                # Fallback: chiamata OpenAI diretta semplificata
                return await self._simple_ai_response(user_message, telegram_id)
            except Exception as e:
                logger.error(f"[AI_SERVICE] Errore chiamata get_ai_response: {e}", exc_info=True)
                # Fallback: chiamata OpenAI diretta semplificata
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
                
                # Cerca vini se termine trovato
                if wine_search_term:
                    found_wines = await db_manager.search_wines(telegram_id, wine_search_term, limit=50)
                    if found_wines:
                        logger.info(f"[FALLBACK] Trovati {len(found_wines)} vini per '{wine_search_term}'")
                        specific_wine_info = self._format_wines_response(found_wines)
                    else:
                        logger.info(f"[FALLBACK] Nessun vino trovato per '{wine_search_term}', provo ricerca diretta")
                        # Retry: ricerca diretta con tutto il prompt pulito
                        broad_term = re.sub(r"[^\w\s'']", " ", user_message.lower()).strip()
                        broad_term_clean = self._clean_wine_search_term(broad_term)
                        if broad_term_clean and len(broad_term_clean) > 2 and broad_term_clean != wine_search_term:
                            logger.info(f"[FALLBACK] Retry con termine: '{broad_term_clean}'")
                            found_wines = await db_manager.search_wines(telegram_id, broad_term_clean, limit=50)
                            if found_wines:
                                logger.info(f"[FALLBACK] Trovati {len(found_wines)} vini con ricerca diretta")
                                specific_wine_info = self._format_wines_response(found_wines)
                            else:
                                specific_wine_info = f"❌ Non ho trovato vini per '{wine_search_term}' nel tuo inventario."
                        else:
                            specific_wine_info = f"❌ Non ho trovato vini per '{wine_search_term}' nel tuo inventario."
                
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
        
        # Se abbiamo già una risposta formattata con vini trovati, restituiscila direttamente
        if specific_wine_info and found_wines:
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
