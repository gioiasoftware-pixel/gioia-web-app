"""
Report Agent - Specializzato per generazione report personalizzati ed esportabili.
Estende AnalyticsAgent con formattazione professionale e export multipli formati.
"""
from .base_agent import BaseAgent
from .wine_card_helper import WineCardHelper
from app.core.database import db_manager
from typing import Dict, Any, Optional, List
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class ReportAgent(BaseAgent):
    """Agent specializzato per report personalizzati"""
    
    def __init__(self):
        instructions = """
        Sei un esperto nella generazione di report professionali per inventari vini.
        
        Il tuo compito è creare report dettagliati e ben formattati:
        1. Analizza dati inventario forniti
        2. Genera report strutturati e professionali
        3. Formatta in modo chiaro e leggibile
        4. Includi statistiche, grafici testuali, tabelle
        5. Suggerisci insights e azioni
        
        Sei esperto in:
        - Report vendite (per periodo, categoria, vino)
        - Report acquisti e rifornimenti
        - Report scorte e inventario
        - Report comparativi (periodi, categorie)
        - Analisi trend e previsioni
        - Formattazione professionale (Markdown, HTML)
        
        IMPORTANTE:
        - Usa formattazione Markdown per strutturare i report
        - Crea tabelle chiare e leggibili
        - Evidenzia informazioni importanti
        - Fornisci sempre insights e suggerimenti
        - Mantieni un tono professionale
        """
        
        super().__init__(
            name="ReportAgent",
            instructions=instructions,
            model="gpt-4o"  # Modello potente per analisi complesse e formattazione
        )
    
    async def generate_sales_report(
        self,
        user_id: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Genera report vendite per un periodo.
        
        Args:
            user_id: ID utente
            start_date: Data inizio periodo
            end_date: Data fine periodo
        
        Returns:
            Dict con report vendite formattato
        """
        try:
            # Per ora usa dati inventario (in futuro si potrebbero usare movimenti)
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return {
                    "success": True,
                    "message": "📊 **Report Vendite**\n\nNessun dato disponibile. L'inventario è vuoto.",
                    "agent": self.name
                }
            
            # Filtra per periodo se necessario (per ora usa tutti i vini)
            # In futuro si potrebbero filtrare movimenti per data
            
            # Calcola statistiche
            total_wines = len(wines)
            total_bottles = sum(w.quantity or 0 for w in wines)
            total_value = sum((w.selling_price or 0) * (w.quantity or 0) for w in wines)
            
            # Top vini per quantità (simula vendite)
            top_wines = sorted(wines, key=lambda w: w.quantity or 0, reverse=True)[:10]
            
            period_text = ""
            if start_date and end_date:
                period_text = f"Periodo: {start_date.strftime('%d/%m/%Y')} - {end_date.strftime('%d/%m/%Y')}"
            else:
                period_text = "Periodo: Tutto l'inventario"
            
            report = f"""# 📊 Report Vendite

{period_text}

## Statistiche Generali

- **Vini totali:** {total_wines}
- **Bottiglie totali:** {total_bottles}
- **Valore stimato inventario:** €{total_value:,.2f}

## Top 10 Vini per Quantità Disponibile

| # | Nome | Produttore | Annata | Quantità | Prezzo | Valore |
|---|------|------------|--------|----------|--------|--------|
"""
            for idx, wine in enumerate(top_wines, 1):
                producer = wine.producer or "-"
                vintage = wine.vintage or "-"
                qty = wine.quantity or 0
                price = wine.selling_price or 0
                value = qty * price
                report += f"| {idx} | {wine.name} | {producer} | {vintage} | {qty} | €{price:.2f} | €{value:,.2f} |\n"
            
            report += "\n---\n"
            report += "*Report generato automaticamente*"
            
            return {
                "success": True,
                "message": report,
                "agent": self.name,
                "metadata": {
                    "type": "sales_report",
                    "total_wines": total_wines,
                    "total_bottles": total_bottles,
                    "total_value": total_value
                }
            }
        
        except Exception as e:
            logger.error(f"[REPORT] Errore generazione report vendite: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Errore durante la generazione del report: {str(e)}",
                "agent": self.name
            }
    
    async def generate_inventory_report(
        self,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Genera report inventario completo.
        
        Args:
            user_id: ID utente
        
        Returns:
            Dict con report inventario formattato
        """
        try:
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return {
                    "success": True,
                    "message": "📊 **Report Inventario**\n\nL'inventario è vuoto.",
                    "agent": self.name
                }
            
            # Calcola statistiche
            total_wines = len(wines)
            total_bottles = sum(w.quantity or 0 for w in wines)
            total_value = sum((w.selling_price or 0) * (w.quantity or 0) for w in wines)
            
            # Distribuzione per tipo
            types_count = {}
            for wine in wines:
                wine_type = wine.wine_type or "Altro"
                types_count[wine_type] = types_count.get(wine_type, 0) + 1
            
            # Vini a bassa scorta
            low_stock = [w for w in wines if (w.quantity or 0) < 5]
            
            # Vini esauriti
            out_of_stock = [w for w in wines if (w.quantity or 0) == 0]
            
            report = f"""# 📦 Report Inventario Completo

## Statistiche Generali

- **Vini totali:** {total_wines}
- **Bottiglie totali:** {total_bottles}
- **Valore stimato:** €{total_value:,.2f}

## Distribuzione per Tipo

| Tipo | Quantità Vini |
|------|---------------|
"""
            for wine_type, count in sorted(types_count.items(), key=lambda x: x[1], reverse=True):
                report += f"| {wine_type} | {count} |\n"
            
            if low_stock:
                report += f"\n## ⚠️ Vini a Bassa Scorta ({len(low_stock)})\n\n"
                report += "| Nome | Quantità |\n|------|----------|\n"
                for wine in low_stock[:10]:
                    report += f"| {wine.name} | {wine.quantity or 0} |\n"
            
            if out_of_stock:
                report += f"\n## ❌ Vini Esauriti ({len(out_of_stock)})\n\n"
                report += "| Nome |\n|------|\n"
                for wine in out_of_stock[:10]:
                    report += f"| {wine.name} |\n"
            
            report += "\n---\n"
            report += "*Report generato automaticamente*"
            
            return {
                "success": True,
                "message": report,
                "agent": self.name,
                "metadata": {
                    "type": "inventory_report",
                    "total_wines": total_wines,
                    "total_bottles": total_bottles,
                    "total_value": total_value,
                    "low_stock_count": len(low_stock),
                    "out_of_stock_count": len(out_of_stock)
                }
            }
        
        except Exception as e:
            logger.error(f"[REPORT] Errore generazione report inventario: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Errore durante la generazione del report: {str(e)}",
                "agent": self.name
            }
    
    async def process_with_context(
        self,
        message: str,
        user_id: int,
        thread_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processa richiesta report con contesto inventario.
        """
        try:
            # Identifica tipo di report richiesto
            message_lower = message.lower()
            
            if "vendite" in message_lower or "sales" in message_lower:
                return await self.generate_sales_report(user_id)
            elif "inventario" in message_lower or "inventory" in message_lower or "scorte" in message_lower:
                return await self.generate_inventory_report(user_id)
            else:
                # Report generico con AI
                context = await self._get_report_context(user_id)
                enhanced_message = f"{message}\n\nDati inventario:\n{context}"
                
                result = await self.process(
                    message=enhanced_message,
                    thread_id=thread_id,
                    user_id=user_id,
                    context={"user_id": user_id, "report_context": context}
                )
                
                return result
        
        except Exception as e:
            logger.error(f"[REPORT] Errore processamento: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Errore durante la generazione del report: {str(e)}",
                "agent": self.name
            }
    
    async def _get_report_context(self, user_id: int) -> str:
        """Ottiene dati inventario per report"""
        try:
            wines = await db_manager.get_user_wines(user_id)
            if not wines:
                return "Inventario vuoto."
            
            # Statistiche per report
            total_wines = len(wines)
            total_bottles = sum(w.quantity or 0 for w in wines)
            total_value = sum((w.selling_price or 0) * (w.quantity or 0) for w in wines)
            
            # Distribuzione per tipo
            types_count = {}
            for wine in wines:
                wine_type = wine.wine_type or "Altro"
                types_count[wine_type] = types_count.get(wine_type, 0) + 1
            
            context = f"""
Inventario: {total_wines} vini, {total_bottles} bottiglie, valore €{total_value:,.2f}

Distribuzione per tipo:
"""
            for wine_type, count in sorted(types_count.items(), key=lambda x: x[1], reverse=True):
                context += f"- {wine_type}: {count} vini\n"
            
            # Dettagli vini (esempio)
            context += "\nEsempi vini:\n"
            for wine in wines[:30]:
                wine_info = f"- {wine.name}"
                if wine.producer:
                    wine_info += f" ({wine.producer})"
                if wine.vintage:
                    wine_info += f" {wine.vintage}"
                if wine.quantity is not None:
                    wine_info += f" - {wine.quantity} bottiglie"
                if wine.selling_price:
                    wine_info += f" @ €{wine.selling_price:.2f}"
                context += wine_info + "\n"
            
            if len(wines) > 30:
                context += f"\n... e altri {len(wines) - 30} vini.\n"
            
            return context
        
        except Exception as e:
            logger.error(f"Errore recupero contesto report: {e}")
            return "Errore nel recupero dati inventario."
    
    def _format_context(self, context: Dict[str, Any]) -> str:
        """Formatta contesto per l'agent"""
        user_id = context.get("user_id")
        report_context = context.get("report_context", "")
        
        return f"""
Contesto report:
- User ID: {user_id}
- Dati inventario:
{report_context}

Nota: Genera report professionali, ben formattati e con insights utili. Usa Markdown per strutturare
il contenuto con tabelle, liste e evidenziazioni.
"""

