"""
Test del pipeline USCIS v2.
Verifica cada capa de forma aislada + el pipeline completo.
"""
import pytest
import sys
import os

sys.path.insert(0, '/app/backend')
os.chdir('/app/backend')

from dotenv import load_dotenv
load_dotenv()


class TestCapa1Extractores:
    """Capa 1: Extracción de campos del PDF."""

    def test_limpiar_nombre_campo(self):
        from uscis_pipeline.extractores.extractor_campos_formulario import _limpiar_nombre_campo
        assert 'Part 1 Item 1 Family Name' == _limpiar_nombre_campo('form1[0].#subform[0].Pt1Line1_FamilyName[0]')
        assert 'Part 3 Item 2d Date Of Birth' == _limpiar_nombre_campo('Pt3Line2d_DateOfBirth[0]')

    def test_obtener_etiqueta_espanol(self):
        from uscis_pipeline.extractores.extractor_campos_formulario import _obtener_etiqueta_espanol
        assert _obtener_etiqueta_espanol('Part 1 Family Name') == 'Apellido'
        assert _obtener_etiqueta_espanol('Date Of Birth') == 'Fecha de Nacimiento'
        assert _obtener_etiqueta_espanol('Email Address') == 'Correo Electrónico'
        assert _obtener_etiqueta_espanol('Random Field') == ''


class TestCapa2Instrucciones:
    """Capa 2: Parser de instrucciones."""

    def test_parsear_secciones(self):
        from uscis_pipeline.extractores.parser_instrucciones import _parsear_secciones
        texto = """Part 1. Information About You
Enter your name as shown on your passport.
Item Numbers 1-3. Full name.

Part 2. Application Type
Select the type of application."""
        secciones = _parsear_secciones(texto)
        assert len(secciones) == 2
        assert secciones[0].parte == 1
        assert 'Information About You' in secciones[0].titulo
        assert secciones[1].parte == 2


class TestNormalizadores:
    """Normalizadores de datos."""

    def test_fecha_ddmmyyyy(self):
        from uscis_pipeline.normalizadores.fechas import normalizar_fecha
        assert normalizar_fecha('19/02/2026') == '02/19/2026'  # DD/MM -> MM/DD
        assert normalizar_fecha('02/19/2026') == '02/19/2026'  # Already MM/DD
        assert normalizar_fecha('2026-03-15') == '03/15/2026'  # ISO
        assert normalizar_fecha('') == ''

    def test_estado(self):
        from uscis_pipeline.normalizadores.ubicaciones import normalizar_estado
        assert normalizar_estado('florida') == 'FL'
        assert normalizar_estado('FL') == 'FL'
        assert normalizar_estado('texas') == 'TX'

    def test_pais(self):
        from uscis_pipeline.normalizadores.ubicaciones import normalizar_pais
        assert normalizar_pais('venezuela') == 'VENEZUELA'
        assert normalizar_pais('estados unidos') == 'THE UNITED STATES OF AMERICA'
        assert normalizar_pais('eeuu') == 'THE UNITED STATES OF AMERICA'

    def test_telefono(self):
        from uscis_pipeline.normalizadores.identificadores import normalizar_telefono
        assert normalizar_telefono('+1 (281) 771-4597') == '12817714597'

    def test_checkbox(self):
        from uscis_pipeline.normalizadores.booleanos import normalizar_checkbox
        assert normalizar_checkbox('yes') == 'X'
        assert normalizar_checkbox('si') == 'X'
        assert normalizar_checkbox('no') == ''
        assert normalizar_checkbox('') == ''

    def test_si_no(self):
        from uscis_pipeline.normalizadores.booleanos import normalizar_si_no
        assert normalizar_si_no('sí') == 'Yes'
        assert normalizar_si_no('no') == 'No'

    def test_ssn(self):
        from uscis_pipeline.normalizadores.identificadores import normalizar_ssn
        assert normalizar_ssn('123-45-6789') == '123456789'

    def test_normalizar_respuestas(self):
        from uscis_pipeline.normalizadores import normalizar_respuestas
        from uscis_pipeline.esquemas import ReglaMapeo, TipoCampo
        reglas = [
            ReglaMapeo(clave_canonica='fecha', nombre_campo_pdf='f1', transformacion='date_mmddyyyy', tipo_campo=TipoCampo.DATE),
            ReglaMapeo(clave_canonica='tel', nombre_campo_pdf='f2', transformacion='phone_digits', tipo_campo=TipoCampo.PHONE),
        ]
        resultado = normalizar_respuestas({'fecha': '19/02/2026', 'tel': '+1-281-771-4597'}, reglas)
        assert resultado['fecha'] == '02/19/2026'
        assert resultado['tel'] == '12817714597'


class TestValidadores:
    """Validadores de datos."""

    def test_reglas_uscis_fecha_futura(self):
        from uscis_pipeline.validadores.reglas_uscis import validar_reglas_uscis
        errores = validar_reglas_uscis({'date_of_birth': '12/31/2099'})
        assert any('futuro' in e['error'] for e in errores)

    def test_reglas_uscis_email(self):
        from uscis_pipeline.validadores.reglas_uscis import validar_reglas_uscis
        errores = validar_reglas_uscis({'email': 'notanemail'})
        assert any('Email' in e['error'] for e in errores)

    def test_validar_todo_ok(self):
        from uscis_pipeline.validadores import validar_todo
        es_valido, errores = validar_todo({'email': 'test@test.com'}, [])
        assert es_valido


class TestMapeadores:
    """Mapeadores: construcción y aplicación."""

    def test_transformar_checkbox(self):
        from uscis_pipeline.mapeadores.transformador_valores import transformar_valor
        assert transformar_valor('yes', 'checkbox_x') == 'X'
        assert transformar_valor('no', 'checkbox_x') == ''

    def test_transformar_fecha(self):
        from uscis_pipeline.mapeadores.transformador_valores import transformar_valor
        assert transformar_valor('19/02/2026', 'date_mmddyyyy') == '02/19/2026'

    def test_transformar_telefono(self):
        from uscis_pipeline.mapeadores.transformador_valores import transformar_valor
        assert transformar_valor('+1-281-771', 'phone_digits') == '1281771'

    def test_aplicar_mapeo(self):
        from uscis_pipeline.mapeadores.aplicador_mapeo import aplicar_mapeo
        from uscis_pipeline.esquemas import ReglaMapeo, TipoCampo
        reglas = [
            ReglaMapeo(clave_canonica='nombre', nombre_campo_pdf='Pt1_FamilyName', transformacion='text', tipo_campo=TipoCampo.TEXT),
            ReglaMapeo(clave_canonica='niw', nombre_campo_pdf='Pt2_Checkbox', transformacion='checkbox_x', tipo_campo=TipoCampo.CHECKBOX),
        ]
        resultado = aplicar_mapeo({'nombre': 'GONZALEZ', 'niw': 'yes'}, reglas)
        assert resultado.total == 2
        assert len(resultado.campos_texto) == 1
        assert len(resultado.checkboxes) == 1
        lista = resultado.a_lista_plana()
        assert lista[0] == {'fieldName': 'Pt1_FamilyName', 'text': 'GONZALEZ'}
        assert lista[1] == {'fieldName': 'Pt2_Checkbox', 'text': 'X'}


class TestEsquemas:
    """Esquemas Pydantic."""

    def test_campo_pdf(self):
        from uscis_pipeline.esquemas import CampoPdf, TipoCampo
        campo = CampoPdf(nombre_campo_pdf='test_field', tipo_campo=TipoCampo.TEXT)
        assert campo.nombre_campo_pdf == 'test_field'
        assert campo.pagina == 0

    def test_regla_mapeo(self):
        from uscis_pipeline.esquemas import ReglaMapeo, TipoCampo
        regla = ReglaMapeo(clave_canonica='a.b', nombre_campo_pdf='field1')
        assert regla.transformacion == 'text'

    def test_resultado_renderizado(self):
        from uscis_pipeline.esquemas import ResultadoRenderizado
        r = ResultadoRenderizado(total_campos=100, campos_llenados=80)
        assert r.cobertura_pct == 0.0  # Must be calculated externally


class TestIntegracion:
    """Test de integración: I-140 N8N no fue afectado."""

    def test_i140_n8n_sigue_intacto(self):
        from data.i140_n8n_pdf_mapping import fill_i140_form_n8n, get_field_mapping
        mapping = get_field_mapping()
        assert len(mapping) > 100

        result = fill_i140_form_n8n({'1.a. Apellido del Beneficiario': 'TEST'})
        assert len(result['fields']) > 0

    def test_format_date_i140(self):
        from data.i140_n8n_pdf_mapping import format_date
        assert format_date('19/02/2026') == '02/19/2026'
        assert format_date('2026-03-15') == '03/15/2026'


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
