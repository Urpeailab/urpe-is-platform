import React from 'react';

export const PrivacyContent = () => {
  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="bg-green-50 border-2 border-green-300 rounded-xl p-6">
        <h2 className="text-xl font-bold text-green-800 mb-3">
          Tu privacidad es importante para nosotros
        </h2>
        <p className="text-gray-700 leading-relaxed">
          En URPE Integral Services, nos comprometemos a proteger tu privacidad y manejar 
          tu información personal con el máximo cuidado y respeto. Esta Política de Privacidad 
          explica cómo recopilamos, usamos, almacenamos y protegemos tu información.
        </p>
      </div>

      <div className="w-full h-1 bg-gray-200 my-8"></div>

      {/* Full Privacy Policy Content */}
      <div className="space-y-6">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Información que Recopilamos</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Recopilamos diferentes tipos de información para proporcionar y mejorar nuestros servicios:
          </p>
          
          <h3 className="text-xl font-semibold text-gray-800 mb-2 mt-4">1.1 Información Personal</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li>Nombre completo y apellidos</li>
            <li>Dirección de correo electrónico</li>
            <li>Número de teléfono</li>
            <li>Fecha de nacimiento</li>
            <li>Nacionalidad y país de residencia</li>
            <li>Información profesional (educación, experiencia laboral, logros)</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mb-2 mt-4">1.2 Documentos</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li>Pasaportes y documentos de identificación</li>
            <li>Diplomas y certificados académicos</li>
            <li>Cartas de recomendación</li>
            <li>Publicaciones y patentes</li>
            <li>Registros profesionales y certificaciones</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-800 mb-2 mt-4">1.3 Información de Uso</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li>Dirección IP y ubicación geográfica</li>
            <li>Tipo de navegador y dispositivo</li>
            <li>Páginas visitadas y tiempo de permanencia</li>
            <li>Interacciones con nuestra plataforma</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Cómo Usamos tu Información</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Utilizamos la información recopilada para los siguientes propósitos:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li>Preparar y procesar tu petición de visa EB-2 NIW</li>
            <li>Comunicarnos contigo sobre tu caso y servicios</li>
            <li>Proporcionar soporte y responder a tus consultas</li>
            <li>Mejorar nuestros servicios y experiencia de usuario</li>
            <li>Procesar pagos y transacciones</li>
            <li>Enviar actualizaciones importantes sobre tu caso</li>
            <li>Cumplir con obligaciones legales y regulatorias</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Compartir tu Información</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            No vendemos ni alquilamos tu información personal a terceros. Podemos compartir 
            tu información solo en las siguientes circunstancias:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li>
              <strong>Con tu consentimiento:</strong> Cuando nos autorizas expresamente
            </li>
            <li>
              <strong>Proveedores de servicios:</strong> Con terceros que nos ayudan a operar 
              (procesadores de pago, servicios de almacenamiento en la nube)
            </li>
            <li>
              <strong>Requisitos legales:</strong> Cuando sea requerido por ley o para proteger 
              nuestros derechos legales
            </li>
            <li>
              <strong>Transferencias de negocio:</strong> En caso de fusión, adquisición o venta 
              de activos
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">4. Seguridad de la Información</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Implementamos medidas de seguridad técnicas y organizativas para proteger tu información:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li>Encriptación SSL/TLS para transmisión de datos</li>
            <li>Almacenamiento seguro en servidores protegidos</li>
            <li>Control de acceso restringido a información personal</li>
            <li>Monitoreo regular de sistemas de seguridad</li>
            <li>Capacitación de personal en prácticas de privacidad</li>
            <li>Auditorías de seguridad periódicas</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            Sin embargo, ningún método de transmisión por Internet o almacenamiento electrónico 
            es 100% seguro. Aunque nos esforzamos por proteger tu información, no podemos garantizar 
            su seguridad absoluta.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Retención de Datos</h2>
          <p className="text-gray-700 leading-relaxed">
            Retenemos tu información personal durante el tiempo necesario para cumplir con los 
            propósitos descritos en esta política, a menos que la ley requiera o permita un 
            período de retención más largo. Generalmente:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4 mt-3">
            <li>Información de cuenta activa: Mientras tu cuenta esté activa</li>
            <li>Documentos de caso: 7 años después del cierre del caso</li>
            <li>Registros financieros: Según lo requerido por ley fiscal</li>
            <li>Comunicaciones: 3 años después del último contacto</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Tus Derechos de Privacidad</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Dependiendo de tu ubicación, puedes tener los siguientes derechos:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li>
              <strong>Acceso:</strong> Solicitar una copia de tu información personal
            </li>
            <li>
              <strong>Rectificación:</strong> Corregir información inexacta o incompleta
            </li>
            <li>
              <strong>Eliminación:</strong> Solicitar la eliminación de tu información (sujeto a 
              obligaciones legales)
            </li>
            <li>
              <strong>Portabilidad:</strong> Recibir tu información en un formato estructurado
            </li>
            <li>
              <strong>Oposición:</strong> Oponerte al procesamiento de tu información en ciertas 
              circunstancias
            </li>
            <li>
              <strong>Restricción:</strong> Solicitar la limitación del procesamiento de tu información
            </li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            Para ejercer estos derechos, contáctanos en privacy@urpeintegralservice.co
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Cookies y Tecnologías de Seguimiento</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Utilizamos cookies y tecnologías similares para:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
            <li>Mantener tu sesión activa</li>
            <li>Recordar tus preferencias</li>
            <li>Analizar el uso de nuestra plataforma</li>
            <li>Mejorar la seguridad</li>
            <li>Personalizar tu experiencia</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            Puedes controlar las cookies a través de la configuración de tu navegador. Ten en cuenta 
            que deshabilitar cookies puede afectar la funcionalidad de nuestra plataforma.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Privacidad de Menores</h2>
          <p className="text-gray-700 leading-relaxed">
            Nuestros servicios no están dirigidos a personas menores de 18 años. No recopilamos 
            conscientemente información personal de menores. Si descubrimos que hemos recopilado 
            información de un menor, la eliminaremos inmediatamente.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Transferencias Internacionales</h2>
          <p className="text-gray-700 leading-relaxed">
            Tu información puede ser transferida y almacenada en servidores ubicados fuera de tu 
            país de residencia. Estos países pueden tener leyes de protección de datos diferentes. 
            Al usar nuestros servicios, consientes estas transferencias. Implementamos salvaguardas 
            apropiadas para proteger tu información en estas transferencias.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Cambios a esta Política</h2>
          <p className="text-gray-700 leading-relaxed">
            Podemos actualizar esta Política de Privacidad periódicamente para reflejar cambios en 
            nuestras prácticas o por razones legales, operativas o regulatorias. Te notificaremos 
            sobre cambios materiales por correo electrónico o mediante un aviso destacado en nuestra 
            plataforma. El uso continuado de nuestros servicios después de dichos cambios constituye 
            tu aceptación de la política actualizada.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Contacto</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Si tienes preguntas, inquietudes o solicitudes sobre esta Política de Privacidad o 
            nuestras prácticas de privacidad, contáctanos:
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-3">
            <p className="text-gray-700"><strong>Email:</strong> privacy@urpeintegralservice.co</p>
            <p className="text-gray-700"><strong>Email de Soporte:</strong> support@urpeintegralservice.co</p>
            <p className="text-gray-700"><strong>Sitio web:</strong> www.urpeintegralservice.co</p>
          </div>
        </section>
      </div>

      {/* Last Updated */}
      <div className="text-center text-sm text-gray-500 mt-8 pt-6 border-t border-gray-200">
        Última actualización: {new Date().toLocaleDateString('es-ES', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}
      </div>
    </div>
  );
};
