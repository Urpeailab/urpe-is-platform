"""Errores personalizados del pipeline USCIS."""

class ErrorPipeline(Exception):
    pass

class ErrorExtraccion(ErrorPipeline):
    pass

class ErrorInstrucciones(ErrorPipeline):
    pass

class ErrorGeneracion(ErrorPipeline):
    pass

class ErrorValidacion(ErrorPipeline):
    def __init__(self, errores: list):
        self.errores = errores
        super().__init__(f"{len(errores)} errores de validacion")

class ErrorMapeo(ErrorPipeline):
    pass

class ErrorRenderizado(ErrorPipeline):
    pass
