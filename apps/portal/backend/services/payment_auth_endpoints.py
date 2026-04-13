"""
Payment Authorization Endpoints
Public form for third-party payment authorization + PDF generation
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import logging
import io

logger = logging.getLogger(__name__)

router = APIRouter()


class PaymentAuthSubmission(BaseModel):
    # Payer
    payerName: str
    payerAddress: str
    payerZip: str
    payerPhone: str
    payerEmail: Optional[str] = None
    # Payment method
    paymentMethod: str = "card"  # "card" or "ach"
    # Card fields (only when paymentMethod == "card")
    cardType: Optional[str] = None  # "credit" or "debit"
    cardLastFour: Optional[str] = None
    # ACH fields (only when paymentMethod == "ach")
    bankName: Optional[str] = None
    accountType: Optional[str] = None  # "checking" or "savings"
    accountLastFour: Optional[str] = None
    # Common
    amount: float
    currency: str = "USD"
    procedureType: str = "EB-2 NIW"  # EB-2 NIW, Asilo, Visa L1A, Ajustes de estatus
    # Beneficiary
    beneficiaryName: str
    beneficiaryAddress: Optional[str] = None
    beneficiaryZip: Optional[str] = None
    isSamePerson: bool = False
    relationship: Optional[str] = None
    # Consent
    signatureDataUrl: str
    agreedToTerms: bool = True
    ipAddress: Optional[str] = None


def setup_payment_auth_router(db):

    @router.post("/public/payment-authorization")
    async def submit_payment_authorization(data: PaymentAuthSubmission):
        """Public endpoint - client submits payment authorization after external payment."""
        if not data.agreedToTerms:
            raise HTTPException(status_code=400, detail="Debe aceptar los terminos")
        if not data.signatureDataUrl:
            raise HTTPException(status_code=400, detail="Se requiere firma digital")
        if not data.payerName or not data.payerAddress:
            raise HTTPException(status_code=400, detail="Datos del pagador incompletos")
        if not data.beneficiaryName:
            raise HTTPException(status_code=400, detail="Nombre del beneficiario requerido")
        if data.paymentMethod == "card":
            if not data.cardLastFour or len(data.cardLastFour) != 4:
                raise HTTPException(status_code=400, detail="Ingrese los ultimos 4 digitos de la tarjeta")
        elif data.paymentMethod == "ach":
            if not data.bankName:
                raise HTTPException(status_code=400, detail="Nombre del banco requerido")
            if not data.accountLastFour or len(data.accountLastFour) != 4:
                raise HTTPException(status_code=400, detail="Ingrese los ultimos 4 digitos de la cuenta")

        submission_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        record = {
            "_id": submission_id,
            "id": submission_id,
            "payerName": data.payerName.strip(),
            "payerAddress": data.payerAddress.strip(),
            "payerZip": data.payerZip.strip(),
            "payerPhone": data.payerPhone.strip(),
            "payerEmail": data.payerEmail,
            "paymentMethod": data.paymentMethod,
            "cardType": data.cardType,
            "cardLastFour": data.cardLastFour,
            "bankName": data.bankName,
            "accountType": data.accountType,
            "accountLastFour": data.accountLastFour,
            "amount": data.amount,
            "currency": data.currency,
            "procedureType": data.procedureType,
            "beneficiaryName": data.beneficiaryName.strip(),
            "beneficiaryAddress": data.beneficiaryAddress,
            "beneficiaryZip": data.beneficiaryZip,
            "isSamePerson": data.isSamePerson,
            "relationship": data.relationship,
            "signatureDataUrl": data.signatureDataUrl,
            "agreedToTerms": data.agreedToTerms,
            "ipAddress": data.ipAddress,
            "submittedAt": now.isoformat(),
            "status": "completed",
        }

        await db.payment_authorizations.insert_one(record)
        record.pop("_id", None)

        # Generate PDF
        pdf_bytes = _generate_authorization_pdf(record)

        # Upload PDF to storage
        pdf_url = None
        try:
            from supabase import create_client
            import os
            supa_url = os.environ.get("SUPABASE_STORAGE_URL")
            supa_key = os.environ.get("SUPABASE_STORAGE_KEY")
            bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "urpe-documents")
            if supa_url and supa_key:
                supa = create_client(supa_url, supa_key)
                path = f"payment-authorizations/{submission_id}.pdf"
                supa.storage.from_(bucket).upload(path, pdf_bytes, file_options={"content-type": "application/pdf", "upsert": "true"})
                pdf_url = supa.storage.from_(bucket).get_public_url(path)
                await db.payment_authorizations.update_one({"id": submission_id}, {"$set": {"pdfUrl": pdf_url}})
        except Exception as e:
            logger.error(f"PDF upload error: {e}")

        # Send email notification to finanzas
        try:
            from services.case_notifications import _send_email, _email_wrapper
            if data.paymentMethod == "ach":
                method_label = f"ACH - {data.bankName} ({data.accountType or 'Checking'}) ****{data.accountLastFour}"
            else:
                card_label = "Crédito" if data.cardType == "credit" else "Débito"
                method_label = f"Tarjeta {card_label} ****{data.cardLastFour}"
            third_party = f"<p><strong>Relación:</strong> {data.relationship or 'No especificada'}</p>" if not data.isSamePerson else ""
            body = (
                f"<p>Se ha recibido una nueva confirmación de pago realizado.</p>"
                f"<table style='width:100%;border-collapse:collapse;margin:16px 0;'>"
                f"<tr><td style='padding:6px 0;color:#64748B;font-size:13px;width:140px;'>Pagador:</td><td style='padding:6px 0;color:#0F172A;font-weight:600;'>{data.payerName}</td></tr>"
                f"<tr><td style='padding:6px 0;color:#64748B;font-size:13px;'>Dirección:</td><td style='padding:6px 0;color:#0F172A;'>{data.payerAddress}, {data.payerZip}</td></tr>"
                f"<tr><td style='padding:6px 0;color:#64748B;font-size:13px;'>Método:</td><td style='padding:6px 0;color:#0F172A;'>{method_label}</td></tr>"
                f"<tr><td style='padding:6px 0;color:#64748B;font-size:13px;'>Monto:</td><td style='padding:6px 0;color:#0F172A;font-weight:600;'>${data.amount:,.2f} {data.currency}</td></tr>"
                f"<tr><td style='padding:6px 0;color:#64748B;font-size:13px;'>Trámite:</td><td style='padding:6px 0;color:#0F172A;'>{data.procedureType}</td></tr>"
                f"<tr><td style='padding:6px 0;color:#64748B;font-size:13px;'>Beneficiario:</td><td style='padding:6px 0;color:#0F172A;'>{data.beneficiaryName}</td></tr>"
                f"<tr><td style='padding:6px 0;color:#64748B;font-size:13px;'>Misma persona:</td><td style='padding:6px 0;color:#0F172A;'>{'Sí' if data.isSamePerson else 'No'}</td></tr>"
                f"</table>"
                f"{third_party}"
            )
            if pdf_url:
                body += f"<p><a href='{pdf_url}' style='color:#007AFF;'>Descargar PDF de confirmación</a></p>"

            html = _email_wrapper("Equipo Finanzas", "Confirmación de pago realizado", body)
            _send_email("finanzas@urpeintegralservices.co", f"Confirmación de pago: {data.payerName} → {data.beneficiaryName}", html)
        except Exception as e:
            logger.error(f"Email notification error: {e}")

        return {
            "success": True,
            "message": "Confirmación registrada exitosamente",
            "id": submission_id,
            "pdfUrl": pdf_url,
        }

    @router.get("/admin/payment-authorizations")
    async def list_payment_authorizations():
        """Admin: list all payment authorizations."""
        auths = await db.payment_authorizations.find({}, {"_id": 0, "signatureDataUrl": 0}).sort("submittedAt", -1).to_list(500)
        return {"success": True, "authorizations": auths, "total": len(auths)}

    return router


def _generate_authorization_pdf(data: dict) -> bytes:
    """Generate a professional PDF for the payment authorization."""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    import base64

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.75*inch, bottomMargin=0.75*inch, leftMargin=0.75*inch, rightMargin=0.75*inch)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title2', parent=styles['Title'], fontSize=14, spaceAfter=6, textColor=colors.HexColor('#1C3A6B'), alignment=1)
    subtitle_style = ParagraphStyle('Subtitle2', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#666666'), alignment=1, spaceAfter=16)
    heading_style = ParagraphStyle('Heading2', parent=styles['Heading2'], fontSize=11, textColor=colors.HexColor('#1C3A6B'), spaceAfter=8, spaceBefore=14)
    body_style = ParagraphStyle('Body2', parent=styles['Normal'], fontSize=9.5, leading=14, textColor=colors.HexColor('#333333'), spaceAfter=8)
    small_style = ParagraphStyle('Small2', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#999999'))

    elements = []

    # Header
    elements.append(Paragraph("URPE INTEGRAL SERVICES", title_style))
    elements.append(Paragraph("THIRD-PARTY CREDIT CARD CHARGE AUTHORIZATION", subtitle_style))
    elements.append(Spacer(1, 8))

    now_str = datetime.now(timezone.utc).strftime("%B %d, %Y")
    payment_method = data.get("paymentMethod", "card")
    card_label = "Credit" if data.get("cardType") == "credit" else "Debit"
    payer = data.get("payerName", "")
    payer_address = data.get("payerAddress", "")
    payer_zip = data.get("payerZip", "")
    last4 = data.get("cardLastFour", "XXXX")
    amount = data.get("amount", 0)
    currency = data.get("currency", "USD")
    beneficiary = data.get("beneficiaryName", "")
    relationship = data.get("relationship", "N/A")
    is_same = data.get("isSamePerson", False)
    procedure_type = data.get("procedureType", "EB-2 NIW")

    # Declaration text
    elements.append(Paragraph(f"I, <b>{payer}</b>, residing at <b>{payer_address}, {payer_zip}</b>, hereby voluntarily declare the following:", body_style))

    # Clauses
    if payment_method == "ach":
        bank_name = data.get("bankName", "N/A")
        account_type = "Checking" if data.get("accountType") == "checking" else "Savings"
        acct_last4 = data.get("accountLastFour", "XXXX")
        payment_clause = f"<b>1. PAYMENT AUTHORIZATION:</b> I expressly and fully authorize the ACH transfer from my {account_type} account at <b>{bank_name}</b>, ending in <b>{acct_last4}</b>, for the amount of <b>${amount:,.2f} {currency}</b>."
    else:
        payment_clause = f"<b>1. PAYMENT AUTHORIZATION:</b> I expressly and fully authorize the charge made to my {card_label} card ending in the last four digits <b>{last4}</b>, through the FANBASIS platform, for the amount of <b>${amount:,.2f} {currency}</b>."

    clauses = [
        payment_clause,
        f"<b>2. BENEFICIARY DESIGNATION:</b> I hereby acknowledge that said payment has been made to cover the professional fees and costs of the <b>{procedure_type}</b> immigration process for <b>{beneficiary}</b>.",
        "<b>3. ACKNOWLEDGMENT OF SERVICES:</b> I declare that I have full knowledge of the terms, conditions, and scope of the services offered by URPE INTEGRAL SERVICES, which have been previously agreed upon with the beneficiary.",
        "<b>4. WAIVER OF DISPUTES (CHARGEBACKS):</b> I declare that this payment is legitimate and has been made voluntarily. I formally commit not to initiate any dispute, reversal, or \"chargeback\" process with my financial institution under the claim of \"unrecognized charge\" or \"service not received,\" acknowledging that the service is rendered through the direct management of the immigration process for the aforementioned beneficiary.",
    ]

    if not is_same:
        clauses.append(f"<b>5. RELATIONSHIP BETWEEN PARTIES:</b> My relationship with the beneficiary is <b>{relationship}</b>, and I am making this payment on their behalf with full consent.")

    for clause in clauses:
        elements.append(Paragraph(clause, body_style))
        elements.append(Spacer(1, 4))

    elements.append(Spacer(1, 12))
    elements.append(Paragraph(f"In witness whereof, and to serve as evidence before any request from the payment platform or financial institution, I sign this declaration.", body_style))

    elements.append(Spacer(1, 20))

    # Signature
    sig_data = data.get("signatureDataUrl", "")
    if sig_data and sig_data.startswith("data:image"):
        try:
            header, encoded = sig_data.split(",", 1)
            sig_bytes = base64.b64decode(encoded)
            sig_buffer = io.BytesIO(sig_bytes)
            sig_img = Image(sig_buffer, width=2.5*inch, height=0.8*inch)
            elements.append(sig_img)
        except:
            elements.append(Paragraph("[Digital signature on file]", body_style))
    else:
        elements.append(Paragraph("[Digital signature on file]", body_style))

    elements.append(Spacer(1, 4))

    # Info table
    info_data = [
        ["Name:", payer],
        ["Address:", f"{payer_address}, {payer_zip}"],
        ["Phone:", data.get("payerPhone", "N/A")],
        ["Email:", data.get("payerEmail", "N/A")],
        ["Date:", now_str],
    ]
    info_table = Table(info_data, colWidths=[1.2*inch, 4*inch])
    info_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#666666')),
        ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1C3A6B')),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica-Bold'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(info_table)

    elements.append(Spacer(1, 20))
    elements.append(Paragraph(f"Record ID: {data.get('id', 'N/A')}", small_style))
    elements.append(Paragraph(f"IP: {data.get('ipAddress', 'N/A')} | UTC Date: {data.get('submittedAt', 'N/A')}", small_style))

    doc.build(elements)
    return buffer.getvalue()
