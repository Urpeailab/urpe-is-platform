#!/usr/bin/env python3
"""
Script de verificación de estructura de patente
Verifica que no haya duplicaciones y que la estructura sea correcta
"""
import sys
import re
from bs4 import BeautifulSoup

def verify_patent_html(html_content):
    """Verifica la estructura del HTML de la patente"""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    issues = []
    warnings = []
    
    # 1. Verificar header USPTO presente
    print("\n=== 1. Verificando Header USPTO ===")
    has_uspto_header = '35 U.S.C. Section 111(b)' in html_content
    if has_uspto_header:
        print("   ✅ Header USPTO presente")
    else:
        issues.append("❌ FALTA header USPTO '35 U.S.C. Section 111(b)'")
    
    invention_title_count = html_content.count('Invention Title:')
    print(f"   'Invention Title:' aparece {invention_title_count} veces")
    if invention_title_count > 1:
        issues.append(f"❌ HEADER DUPLICADO: 'Invention Title' aparece {invention_title_count} veces (debe ser 1)")
    elif invention_title_count == 1:
        print("   ✅ Título en header (no duplicado)")
    else:
        warnings.append("⚠️ No se encontró 'Invention Title'")
    
    # 2. Verificar FIELD OF INVENTION
    print("\n=== 2. Verificando FIELD OF THE INVENTION ===")
    field_section = soup.find(text=re.compile(r'FIELD OF THE INVENTION', re.IGNORECASE))
    if field_section:
        # Encontrar el contenido siguiente
        parent = field_section.find_parent()
        if parent:
            # Get next 500 characters
            content_after = str(parent)[:1000]
            
            # Verificar que NO tenga información de inventor
            has_inventor_info = (
                'Inventor:' in content_after or
                'Residence:' in content_after or
                'Email:' in content_after or
                'Tel:' in content_after or
                '@' in content_after
            )
            
            if has_inventor_info:
                issues.append("❌ FIELD OF INVENTION contiene información del inventor")
                print("   ❌ FIELD OF INVENTION tiene información del inventor (debe ser solo técnica)")
            else:
                print("   ✅ FIELD OF INVENTION contiene solo descripción técnica")
    else:
        warnings.append("⚠️ No se encontró sección FIELD OF THE INVENTION")
    
    # 3. Verificar sección INVENTOR INFORMATION al final
    print("\n=== 3. Verificando INVENTOR INFORMATION ===")
    has_inventor_section = bool(soup.find(text=re.compile(r'INVENTOR INFORMATION', re.IGNORECASE)))
    if has_inventor_section:
        print("   ✅ Sección INVENTOR INFORMATION encontrada")
    else:
        warnings.append("⚠️ No se encontró sección INVENTOR INFORMATION al final")
    
    # 4. Verificar título de DRAWINGS
    print("\n=== 4. Verificando Título de DRAWINGS ===")
    drawings_title_count = html_content.count('DRAWINGS AND TECHNICAL FIGURES')
    print(f"   'DRAWINGS AND TECHNICAL FIGURES' aparece {drawings_title_count} veces")
    if drawings_title_count > 1:
        issues.append(f"❌ TÍTULO DUPLICADO: 'DRAWINGS' aparece {drawings_title_count} veces (debe ser 1)")
    elif drawings_title_count == 1:
        print("   ✅ Título de DRAWINGS NO duplicado")
    else:
        warnings.append("⚠️ No se encontró título de DRAWINGS")
    
    # 5. Verificar marcador de diagramas
    print("\n=== 5. Verificando Marcador de Diagramas ===")
    has_diagram_marker = '___DIAGRAM_INSERTION_POINT___' in html_content
    if has_diagram_marker:
        print("   ✅ Marcador de inserción de diagramas encontrado")
    else:
        warnings.append("⚠️ No se encontró marcador ___DIAGRAM_INSERTION_POINT___")
    
    # Resumen
    print("\n" + "="*50)
    print("RESUMEN DE VERIFICACIÓN")
    print("="*50)
    
    if issues:
        print(f"\n❌ {len(issues)} PROBLEMAS CRÍTICOS:")
        for issue in issues:
            print(f"   {issue}")
    else:
        print("\n✅ No se encontraron problemas críticos")
    
    if warnings:
        print(f"\n⚠️ {len(warnings)} ADVERTENCIAS:")
        for warning in warnings:
            print(f"   {warning}")
    
    return len(issues) == 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python verify_patent_structure.py <archivo.html>")
        print("\nO para probar con contenido de muestra:")
        print("python verify_patent_structure.py --test")
        sys.exit(1)
    
    if sys.argv[1] == '--test':
        # Contenido de prueba
        test_content = """
        <h2>Provisional Patent Application - 35 U.S.C. Section 111(b)</h2>
        <p><strong>Invention Title:</strong> Test System</p>
        <p><strong>Inventor:</strong> JOHN DOE</p>
        
        <h2><strong>FIELD OF THE INVENTION</strong></h2>
        <p>¶0001 The present invention relates to computer systems...</p>
        
        <h1>___FORCE_PAGE_BREAK___</h1>
        ___DIAGRAM_INSERTION_POINT___
        
        <h2><strong>INVENTOR INFORMATION</strong></h2>
        <p><strong>Inventor:</strong> JOHN DOE</p>
        <p><strong>Email:</strong> john@example.com</p>
        """
        
        print("Testeando con contenido de muestra...")
        verify_patent_html(test_content)
    else:
        filepath = sys.argv[1]
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            print(f"Verificando archivo: {filepath}")
            verify_patent_html(content)
        except Exception as e:
            print(f"Error leyendo archivo: {e}")
            sys.exit(1)
