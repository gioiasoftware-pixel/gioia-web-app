"""
Notification Agent - Specializzato per notifiche proattive e alert automatici.
Genera notifiche basate su stato inventario e pattern.
"""
from .base_agent import BaseAgent
from .wine_card_helper import WineCardHelper
from .chart_helper import ChartHelper
from app.core.database import db_manager, AsyncSessionLocal
from sqlalchemy import text as sql_text
from typing import Dict, Any, Optional, List
import logging
from datetime import datetime, timedelta
import httpx
import os
import json

logger = logging.getLogger(__name__)

class NotificationAgent(BaseAgent):
    """Agent specializzato per notifiche proattive"""
    
    def __init__(self):
        instructions = """
        Sei un assistente proattivo che monitora l'inventario e genera notifiche utili.
        
        Il tuo compito è analizzare lo stato dell'inventario e generare:
        1. Alert scorte basse
        2. Promemoria movimenti
        3. Notifiche ordini
        4. Report periodici automatici
        5. Alert anomalie
        6. Insights e suggerimenti
        
        IMPORTANTE:
        - Analizza dati inventario per identificare problemi
        - Genera notifiche chiare e actionable
         - Suggerisci azioni concrete
        - Mantieni un tono professionale ma amichevole
        - Evita spam: notifica solo informazioni rilevanti
        """
        
        super().__init__(
            name="NotificationAgent",
            instructions=instructions,
            model="gpt-4o-mini"  # Modello economico per analisi semplici
        )
    
    async def generate_out_of_stock_alerts(
        self,
        user_id: int
    ) -> List[Dict[str, Any]]:
        """
        Genera alert per vini esauriti (quantità = 0).
        
        Args:
            user_id: ID utente
        
        Returns:
            Lista di alert per vini esauriti
        """
        try:
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return []
            
            alerts = []
            out_of_stock_wines = [w for w in wines if (w.quantity or 0) == 0]
            
            for wine in out_of_stock_wines:
                alerts.append({
                    "type": "out_of_stock",
                    "severity": "critical",
                    "wine_id": wine.id,
                    "wine_name": wine.name,
                    "current_stock": 0,
                    "message": f"🔴 **{wine.name}** è esaurito. Considera un riordino urgente."
                })
            
            return alerts
        
        except Exception as e:
            logger.error(f"[NOTIFICATION] Errore generazione alert vini esauriti: {e}", exc_info=True)
            return []
    
    async def generate_low_stock_alerts(
        self,
        user_id: int,
        threshold: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Genera alert per vini a bassa scorta.
        
        Args:
            user_id: ID utente
            threshold: Soglia minima bottiglie (default: 5)
        
        Returns:
            Lista di alert per vini a bassa scorta (esclusi quelli esauriti)
        """
        try:
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return []
            
            alerts = []
            # Filtra vini a bassa scorta ma NON esauriti (quantity > 0 ma < threshold)
            low_stock_wines = [w for w in wines if 0 < (w.quantity or 0) < threshold]
            
            for wine in low_stock_wines:
                alerts.append({
                    "type": "low_stock",
                    "severity": "warning",
                    "wine_id": wine.id,
                    "wine_name": wine.name,
                    "current_stock": wine.quantity or 0,
                    "threshold": threshold,
                    "message": self._format_low_stock_message(wine, threshold)
                })
            
            return alerts
        
        except Exception as e:
            logger.error(f"[NOTIFICATION] Errore generazione alert scorte basse: {e}", exc_info=True)
            return []
    
    def _format_low_stock_message(self, wine, threshold: int) -> str:
        """Formatta messaggio alert scorta bassa"""
        qty = wine.quantity or 0
        if qty == 0:
            return f"⚠️ **{wine.name}** è esaurito. Considera un riordino urgente."
        else:
            return f"⚠️ **{wine.name}** ha solo {qty} bottiglie disponibili (soglia: {threshold}). Considera un riordino."
    
    async def generate_daily_report(
        self,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Genera report giornaliero automatico.
        
        Args:
            user_id: ID utente
        
        Returns:
            Dict con report giornaliero
        """
        try:
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return {
                    "type": "daily_report",
                    "message": "📊 **Report Giornaliero**\n\nIl tuo inventario è vuoto. Inizia ad aggiungere vini!",
                    "data": {}
                }
            
            # Calcola statistiche
            total_wines = len(wines)
            total_bottles = sum(w.quantity or 0 for w in wines)
            total_value = sum((w.selling_price or 0) * (w.quantity or 0) for w in wines)
            low_stock_count = len([w for w in wines if (w.quantity or 0) < 5])
            
            # Top 5 vini per quantità
            top_wines = sorted(wines, key=lambda w: w.quantity or 0, reverse=True)[:5]
            
            report_message = f"""📊 **Report Giornaliero - {datetime.now().strftime('%d/%m/%Y')}**

**Statistiche Inventario:**
- Vini totali: {total_wines}
- Bottiglie totali: {total_bottles}
- Valore stimato: €{total_value:,.2f}
- Vini a bassa scorta: {low_stock_count}

**Top 5 Vini per Quantità:**
"""
            for idx, wine in enumerate(top_wines, 1):
                qty = wine.quantity or 0
                report_message += f"{idx}. {wine.name}: {qty} bottiglie\n"
            
            if low_stock_count > 0:
                report_message += f"\n⚠️ **Attenzione:** {low_stock_count} vini hanno scorte basse. Considera un riordino."
            
            return {
                "type": "daily_report",
                "message": report_message,
                "data": {
                    "total_wines": total_wines,
                    "total_bottles": total_bottles,
                    "total_value": total_value,
                    "low_stock_count": low_stock_count
                }
            }
        
        except Exception as e:
            logger.error(f"[NOTIFICATION] Errore generazione report giornaliero: {e}", exc_info=True)
            return {
                "type": "daily_report",
                "message": "Errore durante la generazione del report giornaliero.",
                "data": {}
            }
    
    async def generate_anomaly_alerts(
        self,
        user_id: int
    ) -> List[Dict[str, Any]]:
        """
        Genera alert per anomalie nell'inventario.
        
        Args:
            user_id: ID utente
        
        Returns:
            Lista di alert anomalie
        """
        try:
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return []
            
            alerts = []
            
            # Rileva anomalie
            for wine in wines:
                # Quantità molto alta
                if wine.quantity and wine.quantity > 1000:
                    alerts.append({
                        "type": "anomaly",
                        "severity": "info",
                        "wine_id": wine.id,
                        "wine_name": wine.name,
                        "message": f"ℹ️ **{wine.name}** ha una quantità molto alta ({wine.quantity} bottiglie). Verifica che sia corretta."
                    })
                
                # Prezzo vendita molto basso rispetto a prezzo acquisto
                if wine.selling_price and wine.cost_price:
                    if wine.selling_price < wine.cost_price:
                        alerts.append({
                            "type": "anomaly",
                            "severity": "warning",
                            "wine_id": wine.id,
                            "wine_name": wine.name,
                            "message": f"⚠️ **{wine.name}**: Prezzo vendita (€{wine.selling_price}) inferiore al prezzo acquisto (€{wine.cost_price})."
                        })
                
                # Annata futura o molto vecchia
                if wine.vintage:
                    try:
                        vintage_int = int(wine.vintage)
                        current_year = datetime.now().year
                        if vintage_int > current_year + 1:
                            alerts.append({
                                "type": "anomaly",
                                "severity": "warning",
                                "wine_id": wine.id,
                                "wine_name": wine.name,
                                "message": f"⚠️ **{wine.name}**: Annata {vintage_int} sembra futura. Verifica che sia corretta."
                            })
                    except (ValueError, TypeError):
                        pass
            
            return alerts
        
        except Exception as e:
            logger.error(f"[NOTIFICATION] Errore generazione alert anomalie: {e}", exc_info=True)
            return []
    
    async def get_wine_movements_data(
        self,
        user_id: int,
        wine_name: str
    ) -> Dict[str, Any]:
        """
        Recupera dati movimenti storici per un vino specifico.
        Usa la stessa logica dell'endpoint /api/viewer/movements.
        
        Args:
            user_id: ID utente
            wine_name: Nome del vino
        
        Returns:
            Dict con dati movimenti nel formato dell'API viewer
        """
        try:
            user = await db_manager.get_user_by_id(user_id)
            if not user or not user.business_name:
                return {
                    "wine_name": wine_name,
                    "current_stock": 0,
                    "opening_stock": 0,
                    "movements": []
                }
            
            table_storico = f'"{user_id}/{user.business_name} Storico vino"'
            
            async with AsyncSessionLocal() as session:
                # Verifica che la tabella esista
                table_name_check = table_storico.strip('"')
                check_table_query = sql_text("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = :table_name
                    )
                """)
                result = await session.execute(
                    check_table_query,
                    {"table_name": table_name_check}
                )
                table_exists = result.scalar()
                
                if not table_exists:
                    logger.info(f"[NOTIFICATION] Tabella Storico vino non esiste per user_id={user_id}")
                    return {
                        "wine_name": wine_name,
                        "current_stock": 0,
                        "opening_stock": 0,
                        "movements": []
                    }
                
                # Cerca storico vino con matching più robusto
                # Prima prova match esatto (case-insensitive)
                # Poi prova match parziale (LIKE)
                # Infine prova con caratteri accentati normalizzati
                query_storico = sql_text(f"""
                    SELECT 
                        current_stock,
                        history,
                        first_movement_date,
                        last_movement_date,
                        total_consumi,
                        total_rifornimenti,
                        wine_name
                    FROM {table_storico}
                    WHERE user_id = :user_id
                    AND (
                        LOWER(TRIM(wine_name)) = LOWER(TRIM(:wine_name_exact))
                        OR LOWER(wine_name) LIKE LOWER(:wine_name_pattern)
                        OR LOWER(TRIM(wine_name)) LIKE LOWER(:wine_name_pattern_trim)
                        OR translate(LOWER(wine_name), 'àáâäèéêëìíîïòóôöùúûü', 'aaaaeeeeiiiioooouuuu') = translate(LOWER(:wine_name_exact), 'àáâäèéêëìíîïòóôöùúûü', 'aaaaeeeeiiiioooouuuu')
                    )
                    ORDER BY 
                        CASE 
                            WHEN LOWER(TRIM(wine_name)) = LOWER(TRIM(:wine_name_exact)) THEN 1
                            WHEN LOWER(wine_name) LIKE LOWER(:wine_name_pattern) THEN 2
                            ELSE 3
                        END
                    LIMIT 1
                """)
                
                result = await session.execute(
                    query_storico,
                    {
                        "user_id": user.id,  # Usa user.id invece di user_id
                        "wine_name_exact": wine_name,
                        "wine_name_pattern": f"%{wine_name}%",
                        "wine_name_pattern_trim": f"%{wine_name.strip()}%"
                    }
                )
                storico_row = result.fetchone()
                
                if not storico_row:
                    # Log dettagliato per debug
                    logger.warning(f"[NOTIFICATION] Nessun storico trovato per vino '{wine_name}' (user_id={user.id}, table={table_storico})")
                    # Prova a vedere quali vini ci sono nella tabella storico
                    try:
                        debug_query = sql_text(f"SELECT DISTINCT wine_name FROM {table_storico} WHERE user_id = :user_id LIMIT 10")
                        debug_result = await session.execute(debug_query, {"user_id": user.id})
                        debug_wines = [row[0] for row in debug_result.fetchall()]
                        logger.info(f"[NOTIFICATION] Vini disponibili nello storico (primi 10): {debug_wines}")
                    except Exception as debug_e:
                        logger.warning(f"[NOTIFICATION] Errore durante debug query: {debug_e}")
                    
                    return {
                        "wine_name": wine_name,
                        "current_stock": 0,
                        "opening_stock": 0,
                        "movements": []
                    }
                
                # Estrai history (JSONB)
                history = storico_row[1] if storico_row[1] else []
                if isinstance(history, str):
                    history = json.loads(history)
                
                # Converti history in formato per frontend
                movements = []
                for entry in history:
                    movements.append({
                        "at": entry.get("date"),
                        "type": entry.get("type"),
                        "quantity_change": entry.get("quantity") if entry.get("type") == "rifornimento" else -entry.get("quantity", 0),
                        "quantity_before": entry.get("quantity_before", 0),
                        "quantity_after": entry.get("quantity_after", 0)
                    })
                
                # Ordina per data
                movements.sort(key=lambda x: x["at"] if x["at"] else "")
                
                current_stock = storico_row[0] or 0
                opening_stock = movements[0]["quantity_before"] if movements else 0
                actual_wine_name = storico_row[6] if len(storico_row) > 6 else wine_name  # Nome effettivo trovato nello storico
                
                logger.info(f"[NOTIFICATION] Storico trovato per '{actual_wine_name}': {len(movements)} movimenti, stock={current_stock}")
                
                return {
                    "wine_name": actual_wine_name,  # Usa il nome trovato nello storico
                    "current_stock": current_stock,
                    "opening_stock": opening_stock,
                    "movements": movements,
                    "total_consumi": storico_row[4] or 0,
                    "total_rifornimenti": storico_row[5] or 0,
                    "first_movement_date": storico_row[2].isoformat() if storico_row[2] else None,
                    "last_movement_date": storico_row[3].isoformat() if storico_row[3] else None
                }
        
        except Exception as e:
            logger.error(f"[NOTIFICATION] Errore recupero movimenti vino: {e}", exc_info=True)
            return {
                "wine_name": wine_name,
                "current_stock": 0,
                "opening_stock": 0,
                "movements": []
            }
    
    async def generate_wine_statistics_with_chart(
        self,
        user_id: int,
        wine_name: str,
        period: str = "week"
    ) -> Dict[str, Any]:
        """
        Genera statistiche e grafico per un vino specifico.
        
        Args:
            user_id: ID utente
            wine_name: Nome del vino
            period: Periodo preset per il grafico ("day", "week", "month", "quarter", "year")
        
        Returns:
            Dict con HTML wine card + grafico e metadati
        """
        try:
            # Cerca vino nell'inventario
            wines = await db_manager.get_user_wines(user_id)
            wine = None
            for w in wines:
                if wine_name.lower() in w.name.lower() or w.name.lower() in wine_name.lower():
                    wine = w
                    break
            
            if not wine:
                return {
                    "success": False,
                    "error": f"Vino '{wine_name}' non trovato nell'inventario",
                    "agent": self.name
                }
            
            # Recupera dati movimenti storici - usa il nome ESATTO del vino dall'inventario
            # IMPORTANTE: Passa wine.name (nome esatto dal DB) invece di wine_name (da messaggio utente)
            movements_data = await self.get_wine_movements_data(user_id, wine.name)
            
            logger.info(f"[NOTIFICATION] Richiesta statistiche vino '{wine.name}': trovati {len(movements_data.get('movements', []))} movimenti")
            
            if not movements_data.get("movements") or len(movements_data.get("movements", [])) == 0:
                # Nessun movimento, mostra solo wine card
                wine_card_html = WineCardHelper.generate_wine_card_html(wine, badge="📊 Statistiche")
                return {
                    "success": True,
                    "message": wine_card_html + "<br><p>ℹ️ Nessun movimento storico registrato per questo vino.</p>",
                    "agent": self.name,
                    "is_html": True,
                    "metadata": {"type": "wine_statistics", "wine_name": wine.name, "has_chart": False}
                }
            
            # Genera wine card con grafico
            full_html = ChartHelper.generate_wine_card_with_chart(
                wine=wine,
                movements_data=movements_data,
                period=period,
                badge="📊 Statistiche"
            )
            
            return {
                "success": True,
                "message": full_html,
                "agent": self.name,
                "is_html": True,
                "metadata": {
                    "type": "wine_statistics",
                    "wine_name": wine.name,
                    "has_chart": True,
                    "movements_count": len(movements_data.get("movements", [])),
                    "period": period
                }
            }
        
        except Exception as e:
            logger.error(f"[NOTIFICATION] Errore generazione statistiche vino: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Errore durante la generazione delle statistiche: {str(e)}",
                "agent": self.name
            }
    
    async def process_with_context(
        self,
        message: str,
        user_id: int,
        thread_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processa richiesta notifica con contesto inventario.
        """
        try:
            # Controlla se è una richiesta di statistiche per un vino specifico
            message_lower = message.lower()
            
            # Keywords per statistiche vino specifico
            stats_keywords = ["statistiche", "statistica", "andamento", "grafico", "trend", "storico", "movimenti"]
            # Cerca nomi vini nel messaggio
            wines = await db_manager.get_user_wines(user_id)
            mentioned_wine = None
            
            for wine in wines:
                wine_name_lower = wine.name.lower()
                if wine_name_lower in message_lower and any(keyword in message_lower for keyword in stats_keywords):
                    mentioned_wine = wine.name
                    break
            
            # Se è una richiesta di statistiche per un vino specifico
            if mentioned_wine and any(keyword in message_lower for keyword in stats_keywords):
                # Determina periodo (default: week)
                period = "week"
                if "giorno" in message_lower or "day" in message_lower:
                    period = "day"
                elif "settimana" in message_lower or "week" in message_lower:
                    period = "week"
                elif "mese" in message_lower or "month" in message_lower:
                    period = "month"
                elif "trimestre" in message_lower or "quarter" in message_lower:
                    period = "quarter"
                elif "anno" in message_lower or "year" in message_lower:
                    period = "year"
                
                return await self.generate_wine_statistics_with_chart(user_id, mentioned_wine, period)
            
            # Genera notifiche basate su richiesta
            if "report" in message.lower() or "riepilogo" in message.lower():
                report = await self.generate_daily_report(user_id)
                return {
                    "success": True,
                    "message": report["message"],
                    "agent": self.name,
                    "metadata": {"type": "report", "data": report["data"]}
                }
            elif "esauriti" in message.lower() or "esaurito" in message.lower() or "out of stock" in message.lower() or "finite" in message.lower():
                # Richiesta specifica per vini esauriti
                alerts = await self.generate_out_of_stock_alerts(user_id)
                if alerts:
                    # IMPORTANTE: Usa solo i vini esauriti (quantità = 0), non tutti i vini
                    wines_for_cards = []
                    for alert in alerts:
                        wine = await db_manager.get_wine_by_id(user_id, alert["wine_id"])
                        if wine and (wine.quantity or 0) == 0:  # Verifica esplicita quantità = 0
                            wines_for_cards.append(wine)
                    
                    # Genera lista HTML per vini esauriti (sempre, più efficiente)
                    if len(wines_for_cards) > 0:
                        wines_list_html = WineCardHelper.generate_wines_list_html(
                            wines_for_cards,
                            title=f"Vini Esauriti ({len(wines_for_cards)})",
                            show_buttons=False
                        )
                        return {
                            "success": True,
                            "message": wines_list_html,
                            "agent": self.name,
                            "is_html": True,
                            "metadata": {"type": "out_of_stock_alerts", "count": len(wines_for_cards)}
                        }
                else:
                    return {
                        "success": True,
                        "message": "✅ Nessun vino esaurito. Tutti i vini hanno scorte disponibili!",
                        "agent": self.name
                    }
            elif "scorte" in message.lower() or "bassa" in message.lower():
                # Richiesta per vini a bassa scorta (ma non esauriti)
                alerts = await self.generate_low_stock_alerts(user_id)
                if alerts:
                    # Genera wine cards per i vini a bassa scorta
                    wine_cards_html = ""
                    wines_for_cards = []
                    for alert in alerts[:5]:  # Max 5 vini
                        wine = await db_manager.get_wine_by_id(user_id, alert["wine_id"])
                        if wine:
                            wines_for_cards.append(wine)
                            badge = "⚠️ Scorta Bassa"
                            wine_cards_html += WineCardHelper.generate_wine_card_html(wine, badge=badge) + "<br>"
                    
                    messages = [alert["message"] for alert in alerts]
                    message_text = "\n\n".join(messages)
                    
                    # Combina wine cards e messaggi
                    full_message = wine_cards_html + "\n\n" + message_text if wine_cards_html else message_text
                    
                    return {
                        "success": True,
                        "message": full_message,
                        "agent": self.name,
                        "is_html": True if wine_cards_html else False,
                        "metadata": {"type": "low_stock_alerts", "count": len(alerts)}
                    }
                else:
                    return {
                        "success": True,
                        "message": "✅ Nessun vino a bassa scorta. Tutti i vini hanno quantità sufficienti!",
                        "agent": self.name
                    }
            else:
                # Analisi generica con AI
                context = await self._get_notification_context(user_id)
                enhanced_message = f"{message}\n\nContesto inventario:\n{context}"
                
                result = await self.process(
                    message=enhanced_message,
                    thread_id=thread_id,
                    user_id=user_id,
                    context={"user_id": user_id, "notification_context": context}
                )
                
                return result
        
        except Exception as e:
            logger.error(f"[NOTIFICATION] Errore processamento: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Errore durante la generazione notifiche: {str(e)}",
                "agent": self.name
            }
    
    async def _get_notification_context(self, user_id: int) -> str:
        """Ottiene contesto per notifiche"""
        try:
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return "Inventario vuoto."
            
            total_wines = len(wines)
            total_bottles = sum(w.quantity or 0 for w in wines)
            low_stock = [w for w in wines if (w.quantity or 0) < 5]
            
            context = f"""
Inventario: {total_wines} vini, {total_bottles} bottiglie totali
- Vini a bassa scorta: {len(low_stock)}
- Vini esauriti: {len([w for w in wines if (w.quantity or 0) == 0])}

Usa queste informazioni per generare notifiche utili e actionable.
"""
            return context
        
        except Exception as e:
            logger.error(f"Errore recupero contesto notifiche: {e}")
            return "Errore nel recupero informazioni inventario."
    
    def _format_context(self, context: Dict[str, Any]) -> str:
        """Formatta contesto per l'agent"""
        user_id = context.get("user_id")
        notification_context = context.get("notification_context", "")
        
        return f"""
Contesto notifiche:
- User ID: {user_id}
- Stato inventario:
{notification_context}

Nota: Genera notifiche chiare, actionable e utili. Evita spam e notifica solo informazioni rilevanti.
"""

