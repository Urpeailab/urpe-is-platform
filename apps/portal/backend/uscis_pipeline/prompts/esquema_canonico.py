"""Prompt para generación del esquema canónico."""

def construir_prompt_esquema(form_code: str, campos_texto: str, instrucciones_texto: str, visa_hint: str = "") -> str:
    return f"""You are a USCIS immigration forms expert. Analyze this {form_code} form and create a canonical data schema.

FORM FIELDS:
{campos_texto}

INSTRUCTIONS SUMMARY:
{instrucciones_texto[:3000]}

{visa_hint}

Generate a JSON canonical schema that maps logical keys to PDF field names.
Structure the schema by parts/sections of the form.
Use clear, hierarchical keys in English (e.g., "beneficiary.family_name", "petitioner.address.city").

For each entry include:
- "key": logical dot-notation key
- "pdf_field": the exact PDF field name
- "label_es": Spanish label for the user
- "label_en": English label
- "type": text/date/checkbox/select/radio/phone/email/ssn/number
- "part": which Part of the form
- "required": true/false
- "options": array if select/radio (empty otherwise)

Return a JSON object: {{"schema": [...], "parts": [{{"number": 1, "title_es": "...", "title_en": "..."}}]}}"""
