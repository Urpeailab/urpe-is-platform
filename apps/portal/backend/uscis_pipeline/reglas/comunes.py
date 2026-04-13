"""Reglas comunes para todos los formularios USCIS."""

# Campos que siempre se hardcodean para URPE
HARDCODEOS_URPE = {
    "petitioner.address.street": "3235 NORTH POINT PKWY",
    "petitioner.address.suite": "SUITE 101",
    "petitioner.address.city": "ALPHARETTA",
    "petitioner.address.state": "GA",
    "petitioner.address.zip": "30005",
    "petitioner.address.country": "THE UNITED STATES OF AMERICA",
}

# Campos que se excluyen del cuestionario (se llenan automáticamente)
CAMPOS_AUTO = ['signature', 'preparer', 'interpreter', 'barcode', 'page_number']
