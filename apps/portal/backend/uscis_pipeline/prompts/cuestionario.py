"""Prompt para generación del cuestionario."""

def construir_prompt_cuestionario(form_code: str, esquema_texto: str, partes_texto: str, instrucciones_texto: str, visa_hint: str = "") -> str:
    return f"""You are creating a questionnaire in SPANISH for USCIS form {form_code}. {visa_hint}

CANONICAL SCHEMA:
{esquema_texto}

{partes_texto}

INSTRUCTIONS CONTEXT:
{instrucciones_texto[:2000]}

RULES:
1. Questions MUST be in natural, clear Spanish that a non-expert client can understand
2. NEVER include technical field names (like form1[0].#subform...) in questions
3. Group related fields: full name (first + middle + last) = one question section
4. For addresses: ask each component separately (street, city, state, zip, country)
5. For dates: specify format (DD/MM/YYYY)
6. Add "hint" with helpful context from instructions
7. Mark required fields
8. Use appropriate types: text, date, select, yes_no, phone, email, ssn, number, textarea
9. Organize by Part/Section
10. Each question must include "field_keys" array mapping to canonical schema keys

Generate JSON:
{{
  "sections": [
    {{
      "id": "part_1",
      "name": "Part 1 - Información del Peticionario",
      "description": "Complete la información personal",
      "questions": [
        {{
          "id": "q_1_1",
          "question": "¿Cuál es su apellido?",
          "type": "text",
          "required": true,
          "hint": "Escriba su apellido tal como aparece en su pasaporte",
          "field_keys": ["petitioner.family_name"]
        }}
      ]
    }}
  ]
}}"""
