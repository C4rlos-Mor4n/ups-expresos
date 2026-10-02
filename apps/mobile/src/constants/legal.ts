/**
 * Textos legales de UPS GO (Política de privacidad y Términos de uso).
 *
 * Redactados de forma general para la fase de pruebas, alineados con la Ley Orgánica de Protección de
 * Datos Personales del Ecuador (LOPDP). Antes de publicar en tiendas deben revisarlos el área legal y el
 * responsable del tratamiento, y completarse `LEGAL_CONTACT_EMAIL`.
 */

export type LegalDocumentId = "privacy" | "terms";

/** Se muestra en orden: `intro`, `bullets`, `paragraphs`. */
export interface LegalSection {
  title: string;
  intro?: string;
  bullets?: string[];
  paragraphs?: string[];
}

export interface LegalDocument {
  id: LegalDocumentId;
  title: string;
  summary: string;
  sections: LegalSection[];
}

export const LEGAL_VERSION = "1.0";
export const LEGAL_UPDATED_AT = "2 de octubre de 2026";

/** Correo para ejercer derechos y consultas. `null` mientras no exista un buzón oficial. */
export const LEGAL_CONTACT_EMAIL: string | null = null;

const contactLine = LEGAL_CONTACT_EMAIL
  ? `Escríbenos a ${LEGAL_CONTACT_EMAIL} indicando tu nombre, el correo con el que usas la app y tu solicitud.`
  : "Comunícate por los canales oficiales de soporte de la Universidad Politécnica Salesiana indicando tu nombre, el correo con el que usas la app y tu solicitud.";

export const PRIVACY_POLICY: LegalDocument = {
  id: "privacy",
  title: "Política de privacidad",
  summary:
    "Usamos tu correo para darte acceso y la información operativa del transporte para mostrarte horarios y recorridos. No vendemos tus datos, no mostramos publicidad y no accedemos a tu ubicación, contactos, fotos ni micrófono.",
  sections: [
    {
      title: "1. Quiénes somos y alcance",
      paragraphs: [
        "UPS GO (en adelante, «el Servicio») es la aplicación de información del transporte universitario para la comunidad de la Universidad Politécnica Salesiana (UPS). El operador del Servicio actúa como responsable del tratamiento de los datos personales descritos aquí, en coordinación con la universidad.",
        "Esta política aplica a la aplicación móvil, a la API que la respalda y a cualquier canal administrativo del Servicio. Se rige por la Ley Orgánica de Protección de Datos Personales del Ecuador (LOPDP), su reglamento y demás normativa aplicable.",
      ],
    },
    {
      title: "2. Datos que tratamos",
      bullets: [
        "Cuenta: correo electrónico, nombre (si decides registrarlo), rol (estudiante, conductor o administrador) y estado de la cuenta.",
        "Verificación: un código de un solo uso enviado a tu correo. Lo guardamos cifrado (no en texto legible), caduca en pocos minutos y tiene un número limitado de intentos.",
        "Sesión: identificador de sesión, fechas de inicio y vencimiento, dirección IP y tipo de dispositivo o navegador desde el que ingresas. El token de sesión se guarda cifrado en el almacenamiento seguro de tu teléfono y como huella cifrada en nuestros servidores.",
        "Conductores: nombre, teléfono, número de licencia, vehículo y servicios asignados, y la hora de inicio y fin de cada recorrido.",
        "Uso y seguridad: registros técnicos del servidor (fecha, dirección IP, ruta solicitada y errores) y registros de auditoría de las acciones administrativas.",
        "En tu dispositivo: campus preferido, rutas favoritas y preferencias de la app. Se guardan solo en tu teléfono y puedes borrarlos desinstalando la app o borrando sus datos.",
      ],
      paragraphs: [
        "No recopilamos tu ubicación, contactos, fotos, cámara, micrófono, datos de pago ni datos sensibles (salud, religión, biometría, etc.). Si en el futuro incorporamos funciones que los requieran —por ejemplo, ver el bus en el mapa en tiempo real— te lo informaremos y pediremos tu permiso cuando la ley lo exija.",
      ],
    },
    {
      title: "3. Para qué los usamos",
      bullets: [
        "Verificar tu identidad y darte acceso según tu rol.",
        "Mostrarte campus, rutas, paradas, horarios y el estado de los servicios.",
        "Permitir a los conductores consultar sus asignaciones y registrar el inicio y fin de los recorridos.",
        "Planificar y supervisar la operación del transporte universitario.",
        "Proteger el Servicio: prevenir accesos no autorizados y abusos, limitar intentos y atender incidentes.",
        "Enviarte correos necesarios para el servicio (códigos de acceso y avisos importantes). No enviamos publicidad.",
        "Mejorar la app y cumplir obligaciones legales o requerimientos de autoridad competente.",
      ],
    },
    {
      title: "4. Base legal",
      paragraphs: [
        "Tratamos tus datos con base en: (a) la prestación del Servicio que solicitas al ingresar; (b) el interés legítimo de la universidad y del operador en organizar un transporte seguro y eficiente; (c) el cumplimiento de obligaciones legales; y (d) tu consentimiento, cuando sea necesario, el cual puedes revocar en cualquier momento sin efecto retroactivo.",
      ],
    },
    {
      title: "5. Con quién los compartimos",
      bullets: [
        "La Universidad Politécnica Salesiana y el personal autorizado de la operación de transporte, solo en lo necesario para su gestión.",
        "Proveedores que nos prestan servicios (alojamiento de servidores y base de datos, envío de correos, distribución de actualizaciones de la app). Actúan como encargados del tratamiento, bajo contrato y solo siguiendo nuestras instrucciones.",
        "Autoridades competentes, cuando la ley o una orden válida lo exijan.",
      ],
      paragraphs: [
        "No vendemos, alquilamos ni cedemos tus datos con fines comerciales o publicitarios.",
        "Algunos proveedores pueden alojar información fuera de Ecuador. En ese caso exigimos garantías adecuadas de protección conforme a la LOPDP.",
      ],
    },
    {
      title: "6. Cuánto tiempo los conservamos",
      bullets: [
        "Códigos de verificación: hasta su uso o vencimiento (minutos).",
        "Sesiones: hasta que cierras sesión, se revocan o vencen.",
        "Cuenta y datos de conductor: mientras la cuenta esté activa o exista la relación con el Servicio.",
        "Registros de recorridos, auditoría y seguridad: el tiempo necesario para la operación, la atención de incidentes y el cumplimiento de obligaciones legales.",
      ],
      paragraphs: [
        "Cumplidos esos plazos, los datos se eliminan o anonimizan de forma que ya no permitan identificarte.",
      ],
    },
    {
      title: "7. Cómo los protegemos",
      paragraphs: [
        "Aplicamos medidas técnicas y organizativas razonables: conexiones cifradas (HTTPS), códigos y tokens almacenados cifrados, sesiones con vencimiento y revocables, límites de intentos, control de acceso por roles y registros de auditoría. Ningún sistema es infalible; si ocurre una vulneración que afecte tus datos, actuaremos y notificaremos conforme a la ley.",
      ],
    },
    {
      title: "8. Tus derechos",
      bullets: [
        "Acceso: saber qué datos tenemos sobre ti.",
        "Rectificación y actualización: corregir datos inexactos (tu nombre puedes editarlo en tu perfil).",
        "Eliminación de tus datos y cierre de tu cuenta.",
        "Oposición y suspensión del tratamiento.",
        "Portabilidad de tus datos.",
        "No ser objeto de decisiones basadas únicamente en tratamientos automatizados.",
        "Revocar tu consentimiento cuando sea la base del tratamiento.",
      ],
      paragraphs: [
        `${contactLine} Responderemos dentro de los plazos establecidos por la ley. Si consideras que no atendimos tu solicitud, puedes acudir a la Superintendencia de Protección de Datos Personales.`,
      ],
    },
    {
      title: "9. Menores de edad",
      paragraphs: [
        "El Servicio está dirigido a la comunidad universitaria. Si eres menor de edad, debes usarlo con el conocimiento y autorización de tu representante legal. Si detectamos datos de un menor tratados sin la autorización requerida, los eliminaremos.",
      ],
    },
    {
      title: "10. Almacenamiento local y rastreo",
      paragraphs: [
        "La app usa el almacenamiento de tu teléfono solo para mantener tu sesión y tus preferencias. No utilizamos herramientas de publicidad ni rastreo entre aplicaciones.",
      ],
    },
    {
      title: "11. Cambios a esta política",
      paragraphs: [
        "Podemos actualizar esta política por cambios en el Servicio o en la ley. Publicaremos la versión vigente en la app con su fecha; si el cambio es relevante, te lo avisaremos dentro de la app o por correo.",
      ],
    },
    {
      title: "12. Contacto",
      paragraphs: [contactLine],
    },
  ],
};

export const TERMS_OF_USE: LegalDocument = {
  id: "terms",
  title: "Términos de uso",
  summary:
    "UPS GO te informa sobre rutas, horarios y el estado del transporte universitario. Los horarios son referenciales, tu cuenta es personal y debes usar la app de forma responsable.",
  sections: [
    {
      title: "1. Aceptación",
      paragraphs: [
        "Al ingresar a UPS GO aceptas estos Términos de uso y la Política de privacidad. Si no estás de acuerdo, no uses el Servicio.",
      ],
    },
    {
      title: "2. Qué es el Servicio",
      paragraphs: [
        "UPS GO es una herramienta informativa y operativa del transporte universitario de la Universidad Politécnica Salesiana: muestra campus, rutas, paradas, horarios y el estado de las salidas, y permite a los conductores gestionar sus recorridos asignados. El Servicio puede encontrarse en fase de pruebas, por lo que algunas funciones pueden cambiar, ampliarse o retirarse.",
        "El uso de la app es gratuito. El acceso físico al transporte se rige por los reglamentos y disposiciones de la universidad.",
      ],
    },
    {
      title: "3. Tu cuenta",
      bullets: [
        "Ingresas con un correo autorizado y un código que te enviamos. Tu cuenta es personal e intransferible.",
        "Eres responsable de mantener la seguridad de tu correo y de la actividad realizada con tu cuenta.",
        "Avísanos de inmediato si sospechas de un uso no autorizado.",
        "Tu rol (estudiante, conductor o administrador) lo asigna la operación del transporte; no puedes atribuirte otro.",
      ],
    },
    {
      title: "4. Uso permitido",
      intro: "Te comprometes a usar el Servicio de buena fe. Está prohibido:",
      bullets: [
        "Acceder o intentar acceder a cuentas, datos o funciones que no te corresponden.",
        "Registrar información falsa, en especial inicios o finales de recorridos que no ocurrieron.",
        "Interferir con el funcionamiento del Servicio: automatizar solicitudes, sobrecargarlo, probar vulnerabilidades sin autorización o eludir sus límites de seguridad.",
        "Copiar, descompilar, modificar o redistribuir la app, salvo lo permitido por la ley.",
        "Usar el Servicio para fines ilícitos o que afecten derechos de terceros.",
      ],
    },
    {
      title: "5. Horarios e información del transporte",
      paragraphs: [
        "Los horarios, tiempos estimados de paso y paradas son referenciales. Pueden variar por tráfico, clima, cierres viales, emergencias, fuerza mayor o decisiones operativas, y no garantizan la puntualidad ni la disponibilidad de cupo. Te recomendamos llegar a tu parada con anticipación.",
        "Las ubicaciones de las paradas son aproximadas. Ante cualquier diferencia prevalecen las indicaciones oficiales de la operación de transporte.",
      ],
    },
    {
      title: "6. Conductores",
      bullets: [
        "Registra el inicio y el fin de cada recorrido de forma veraz y oportuna.",
        "No manipules el teléfono mientras conduces: usa la app solo con el vehículo detenido y en un lugar seguro.",
        "Cumple en todo momento la normativa de tránsito y las disposiciones de la universidad. La app no reemplaza esas obligaciones.",
      ],
    },
    {
      title: "7. Disponibilidad y actualizaciones",
      paragraphs: [
        "Procuramos que el Servicio esté disponible, pero puede tener interrupciones por mantenimiento, fallas técnicas o causas ajenas a nosotros. La app puede descargar actualizaciones automáticamente para corregir errores o incorporar mejoras; algunas funciones pueden requerir instalar una versión nueva.",
      ],
    },
    {
      title: "8. Propiedad intelectual",
      paragraphs: [
        "La app, su diseño, código y contenidos pertenecen a sus respectivos titulares. El nombre, logotipos y marcas de la Universidad Politécnica Salesiana pertenecen a la universidad. El uso del Servicio no te otorga ningún derecho sobre ellos.",
      ],
    },
    {
      title: "9. Suspensión y cierre de cuenta",
      paragraphs: [
        "Podemos suspender o cerrar el acceso de una cuenta que incumpla estos términos, que ya no pertenezca a la comunidad autorizada o cuando lo exija la seguridad del Servicio. Puedes dejar de usar la app y solicitar el cierre de tu cuenta en cualquier momento.",
      ],
    },
    {
      title: "10. Responsabilidad",
      paragraphs: [
        "En la medida permitida por la ley, el Servicio se ofrece «tal cual» y no respondemos por daños derivados de demoras, cambios de horario, interrupciones del Servicio o decisiones tomadas con base en información referencial. Nada de lo aquí dispuesto limita los derechos que la ley ecuatoriana reconoce como irrenunciables.",
      ],
    },
    {
      title: "11. Privacidad",
      paragraphs: [
        "El tratamiento de tus datos personales se describe en la Política de privacidad, que forma parte de estos términos.",
      ],
    },
    {
      title: "12. Cambios a estos términos",
      paragraphs: [
        "Podemos modificar estos términos. Publicaremos la versión vigente en la app con su fecha; si el cambio es relevante, te lo avisaremos. Seguir usando el Servicio después de la actualización implica su aceptación.",
      ],
    },
    {
      title: "13. Ley aplicable",
      paragraphs: [
        "Estos términos se rigen por las leyes de la República del Ecuador. Cualquier controversia se procurará resolver primero de forma directa y amistosa; de no lograrse, se someterá a los jueces competentes del Ecuador.",
      ],
    },
    {
      title: "14. Contacto",
      paragraphs: [contactLine],
    },
  ],
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  privacy: PRIVACY_POLICY,
  terms: TERMS_OF_USE,
};
