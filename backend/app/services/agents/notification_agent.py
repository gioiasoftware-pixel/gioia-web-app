"""
Notification Agent - Specializzato per notifiche proattive e alert automatici.
Genera notifiche basate su stato inventario e pattern.
"""
from .base_agent import BaseAgent
from .wine_card_helper import WineCardHelper
from app.core.database import db_manager
from typing import Dict, Any, Optional, List
import logging
from datetime import datetime, timedelta

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
                    # Genera wine cards per i vini esauriti
                    wine_cards_html = ""
                    wines_for_cards = []
                    for alert in alerts:  # Mostra tutti i vini esauriti (non limitiamo a 5)
                        wine = await db_manager.get_wine_by_id(user_id, alert["wine_id"])
                        if wine:
                            wines_for_cards.append(wine)
                            badge = "🔴 Esaurito"
                            wine_cards_html += WineCardHelper.generate_wine_card_html(wine, badge=badge) + "<br>"
                    
                    # Genera anche lista HTML per vini esauriti (se molti)
                    if len(wines_for_cards) > 10:
                        # Usa lista HTML per vini esauriti
                        wines_list_html = WineCardHelper.generate_wines_list_html(
                            wines_for_cards,
                            title=f"Vini Esauriti ({len(alerts)})",
                            show_buttons=False
                        )
                        return {
                            "success": True,
                            "message": wines_list_html,
                            "agent": self.name,
                            "is_html": True,
                            "metadata": {"type": "out_of_stock_alerts", "count": len(alerts)}
                        }
                    else:
                        # Usa wine cards individuali
                        messages = [alert["message"] for alert in alerts]
                        message_text = "\n\n".join(messages)
                        full_message = wine_cards_html + "\n\n" + message_text if wine_cards_html else message_text
                        
                        return {
                            "success": True,
                            "message": full_message,
                            "agent": self.name,
                            "is_html": True if wine_cards_html else False,
                            "metadata": {"type": "out_of_stock_alerts", "count": len(alerts)}
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

