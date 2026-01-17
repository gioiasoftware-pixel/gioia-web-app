from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.core.auth import get_current_user
from app.services.movements_service import get_movements_for_period
from app.core.processor_client import processor_client

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _parse_iso_date(date_str: str):
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Formato data non valido (usa YYYY-MM-DD).")


def _sanitize_pdf_text(text: str) -> str:
    if not text:
        return ""
    ascii_text = "".join(ch if ord(ch) < 128 else "?" for ch in text)
    return ascii_text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_simple_pdf(lines: List[str]) -> bytes:
    header = "%PDF-1.4\n"

    clean_lines = [_sanitize_pdf_text(line) for line in lines]
    content_lines = ["BT", "/F1 12 Tf", "50 750 Td"]
    for line in clean_lines:
        content_lines.append(f"({line}) Tj")
        content_lines.append("0 -16 Td")
    content_lines.append("ET")
    content = "\n".join(content_lines)
    content_bytes = content.encode("latin-1", "replace")

    obj1 = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj"
    obj2 = "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj"
    obj3 = (
        "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        "/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj"
    )
    obj4 = f"4 0 obj << /Length {len(content_bytes)} >> stream\n{content}\nendstream endobj"
    obj5 = "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj"

    objects = [obj1, obj2, obj3, obj4, obj5]
    offsets = []

    output = header
    for obj in objects:
        offsets.append(len(output))
        output += obj + "\n"

    startxref = len(output)
    xref = "xref\n0 6\n0000000000 65535 f \n"
    for off in offsets:
        xref += f"{off:010} 00000 n \n"

    trailer = f"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n{startxref}\n%%EOF"
    output += xref + trailer
    return output.encode("latin-1", "replace")


@router.get("/movements/pdf")
async def download_movements_pdf(
    start_date: str = Query(...),
    end_date: str = Query(...),
    period_label: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get("user_id") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Utente non autenticato.")

    start = _parse_iso_date(start_date)
    end = _parse_iso_date(end_date)

    if end < start:
        raise HTTPException(status_code=400, detail="Intervallo date non valido.")

    if period_label:
        period_description = period_label
    elif start == end:
        period_description = start.strftime("%d/%m/%Y")
    else:
        period_description = f"{start.strftime('%d/%m/%Y')} - {end.strftime('%d/%m/%Y')}"

    # Prova PDF con stesso stile del report giornaliero (processor)
    if start == end:
        pdf_data = await processor_client.get_daily_report_pdf(
            user_id=user_id,
            report_date=start.isoformat()
        )
        if pdf_data:
            filename = f"report_movimenti_{start.isoformat()}_{end.isoformat()}.pdf"
            return Response(
                content=pdf_data,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'}
            )

    pdf_data = await processor_client.get_movements_report_pdf_range(
        user_id=user_id,
        start_date=start.isoformat(),
        end_date=end.isoformat()
    )
    if pdf_data:
        filename = f"report_movimenti_{start.isoformat()}_{end.isoformat()}.pdf"
        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    movements_data = await get_movements_for_period(
        user_id=user_id,
        start_date=start,
        end_date=end,
        period_description=period_description
    )

    wines = movements_data.get("wines_with_movements", [])
    total_consumi = movements_data.get("total_consumi", 0)
    total_rifornimenti = movements_data.get("total_rifornimenti", 0)

    lines = [
        f"Report Movimenti - {period_description}",
        f"Periodo: {start.isoformat()} -> {end.isoformat()}",
        "",
        f"Vini con movimenti: {len(wines)}",
        f"Totale consumi: {total_consumi}",
        f"Totale rifornimenti: {total_rifornimenti}",
        "",
        "Dettaglio per vino:"
    ]

    max_wines = 40
    for wine_data in wines[:max_wines]:
        name = wine_data.get("wine_name", "Vino")
        consumi = wine_data.get("total_consumi", 0)
        rifornimenti = wine_data.get("total_rifornimenti", 0)
        stock = wine_data.get("current_stock", 0)
        lines.append(f"- {name}: consumi {consumi}, rifornimenti {rifornimenti}, stock {stock}")

    if len(wines) > max_wines:
        lines.append(f"... e altri {len(wines) - max_wines} vini")

    pdf_bytes = _build_simple_pdf(lines)
    filename = f"report_movimenti_{start.isoformat()}_{end.isoformat()}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/inventory/pdf")
async def download_inventory_stats_pdf(
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get("user_id") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Utente non autenticato.")

    pdf_data = await processor_client.get_inventory_stats_pdf(user_id=user_id)
    if pdf_data:
        filename = "report_statistiche_inventario.pdf"
        return Response(
            content=pdf_data,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    # Calcola statistiche inventario
    from app.core.database import db_manager
    wines = await db_manager.get_user_wines(user_id)
    if not wines:
        raise HTTPException(status_code=404, detail="Inventario vuoto.")

    total_wines = len(wines)
    total_bottles = sum(w.quantity or 0 for w in wines)
    total_value = sum((w.selling_price or 0) * (w.quantity or 0) for w in wines)

    types_count = {}
    for wine in wines:
        wine_type = wine.wine_type or "Altro"
        types_count[wine_type] = types_count.get(wine_type, 0) + 1

    low_stock = [w for w in wines if (w.quantity or 0) < 5 and (w.quantity or 0) > 0]
    out_of_stock = [w for w in wines if (w.quantity or 0) == 0]

    lines = [
        "Report Statistiche Inventario",
        "",
        f"Vini totali: {total_wines}",
        f"Bottiglie totali: {total_bottles}",
        f"Valore stimato: {total_value:.2f}",
        "",
        "Distribuzione per tipo:"
    ]

    for wine_type, count in sorted(types_count.items(), key=lambda x: x[1], reverse=True):
        lines.append(f"- {wine_type}: {count}")

    lines += [
        "",
        f"Vini a bassa scorta (<5): {len(low_stock)}",
        f"Vini esauriti (0): {len(out_of_stock)}"
    ]

    pdf_bytes = _build_simple_pdf(lines)
    filename = "report_statistiche_inventario.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename=\"{filename}\"'}
    )
