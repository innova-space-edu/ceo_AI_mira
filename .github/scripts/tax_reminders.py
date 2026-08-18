#!/usr/bin/env python3
"""Recordatorios F29 de Innova Admin.

Lee company_tax_records y envía recordatorios mediante Resend solo a 5, 3, 1 y 0
días del vencimiento registrado. El vencimiento es un dato de la base: no se
presupone que todos los contribuyentes venzan el día 20.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import date, datetime

REQUIRED = (
    "COMPANY_SUPABASE_URL",
    "COMPANY_SUPABASE_SERVICE_ROLE_KEY",
    "RESEND_API_KEY",
    "EMAIL_SEND_TO",
)


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def request_json(url: str, *, headers: dict[str, str], method: str = "GET", body=None):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    for key, value in headers.items():
        req.add_header(key, value)
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.read().decode("utf-8")
        return json.loads(raw) if raw else None


def main() -> int:
    missing = [name for name in REQUIRED if not env(name)]
    if missing:
        print("Tax reminders: configuración incompleta; se omite el envío.")
        print("Faltan:", ", ".join(missing))
        return 0

    base = env("COMPANY_SUPABASE_URL").rstrip("/")
    service_key = env("COMPANY_SUPABASE_SERVICE_ROLE_KEY")
    resend_key = env("RESEND_API_KEY")
    recipient = env("EMAIL_SEND_TO")
    sender = env("EMAIL_FROM") or "Innova Admin <contacto@innova-space-edu.cl>"

    query = urllib.parse.urlencode({
        "select": "id,period,record_type,status,due_date,debit_vat,credit_vat,ppm_amount,tax_amount,total_amount,notes",
        "record_type": "eq.f29",
        "due_date": "not.is.null",
        "order": "due_date.asc",
    })
    url = f"{base}/rest/v1/company_tax_records?{query}"
    records = request_json(
        url,
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Accept": "application/json",
        },
    ) or []

    today = date.today()
    sent = 0
    for record in records:
        status = str(record.get("status") or "").lower()
        if status in {"paid", "filed"}:
            continue
        try:
            due = datetime.strptime(str(record["due_date"]), "%Y-%m-%d").date()
        except (KeyError, TypeError, ValueError):
            continue

        days = (due - today).days
        if days not in {5, 3, 1, 0}:
            continue

        period = str(record.get("period") or "")[:7] or "sin período"
        debit = int(float(record.get("debit_vat") or 0))
        credit = int(float(record.get("credit_vat") or 0))
        ppm = int(float(record.get("ppm_amount") or 0))
        estimated = int(float(record.get("total_amount") or record.get("tax_amount") or 0))
        urgency = "HOY" if days == 0 else f"en {days} día{'s' if days != 1 else ''}"

        subject = f"F29 {period}: vencimiento {urgency} ({due.isoformat()})"
        text = (
            "Recordatorio automático de Innova Admin.\n\n"
            f"Período: {period}\n"
            f"Vencimiento registrado: {due.isoformat()}\n"
            f"Estado interno: {status or 'pendiente'}\n"
            f"IVA débito registrado: ${debit:,}\n"
            f"IVA crédito registrado: ${credit:,}\n"
            f"PPM / otros registrados: ${ppm:,}\n"
            f"Total interno estimado: ${estimated:,}\n\n"
            "Revisar la propuesta y situación tributaria real en SII antes de declarar o pagar. "
            "Este correo es un control preventivo y no constituye una declaración tributaria."
        ).replace(",", ".")

        key = f"f29-reminder/{record.get('id')}/{due.isoformat()}/d{days}"
        request_json(
            "https://api.resend.com/emails",
            method="POST",
            headers={
                "Authorization": f"Bearer {resend_key}",
                "Content-Type": "application/json",
                "Idempotency-Key": key[:256],
            },
            body={"from": sender, "to": [recipient], "subject": subject, "text": text},
        )
        sent += 1
        print(f"Recordatorio enviado: {period}, faltan {days} días")

    print(f"Tax reminders: {sent} correo(s) enviado(s).")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Tax reminders ERROR: {exc}", file=sys.stderr)
        raise
