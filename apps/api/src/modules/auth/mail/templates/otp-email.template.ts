/**
 * Correo del código de acceso (OTP).
 *
 * HTML en tablas con estilos en línea: es lo único que Gmail, Outlook y los clientes móviles
 * respetan de forma consistente. El logo viaja como adjunto inline (`cid:`), que los clientes
 * muestran sin pedir "mostrar imágenes" y sin depender de una URL pública.
 */

export const OTP_EMAIL_LOGO_CID = 'logo-ups-go@upsgo';

export interface OtpEmailInput {
  code: string;
  expiresMinutes: number;
  /** `true` si el logo se adjunta como `cid:`; si no, se muestra el nombre en texto. */
  withLogo: boolean;
}

export interface OtpEmail {
  subject: string;
  text: string;
  html: string;
}

const NAVY = '#00224E';
const BLUE = '#0A5BA8';
const GOLD = '#F5B323';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export function renderOtpEmail({ code, expiresMinutes, withLogo }: OtpEmailInput): OtpEmail {
  const safeCode = escapeHtml(code);
  const minutes = `${expiresMinutes} ${expiresMinutes === 1 ? 'minuto' : 'minutos'}`;
  const digits = safeCode
    .split('')
    .map(
      (digit) =>
        `<td style="padding:0 4px;"><div style="width:40px;height:54px;line-height:54px;border-radius:12px;background:#FFFFFF;border:1px solid #D6E2F0;border-bottom:3px solid ${GOLD};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;color:${NAVY};text-align:center;">${digit}</div></td>`,
    )
    .join('');

  const brand = withLogo
    ? `<img src="cid:${OTP_EMAIL_LOGO_CID}" width="200" height="117" alt="UPS GO" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:200px;height:auto;">`
    : `<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:30px;font-weight:800;color:#FFFFFF;letter-spacing:1px;">UPS GO</div>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Tu código de acceso a UPS GO</title>
</head>
<body style="margin:0;padding:0;background:#EEF3F9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Tu código es ${safeCode}. Vence en ${minutes}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF3F9;">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 12px 32px rgba(0,34,78,0.12);">
        <tr>
          <td align="center" style="background:${NAVY};background-image:linear-gradient(135deg,${NAVY} 0%,${BLUE} 100%);padding:32px 24px 28px;">
            ${brand}
            <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#C9DBF0;margin-top:10px;letter-spacing:0.4px;">Transporte universitario · Universidad Politécnica Salesiana</div>
          </td>
        </tr>
        <tr>
          <td style="height:6px;background:${GOLD};font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:36px 32px 8px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <h1 style="margin:0 0 10px;font-size:24px;line-height:30px;color:${NAVY};font-weight:800;">Tu código de acceso</h1>
            <p style="margin:0;font-size:15px;line-height:23px;color:#4A5B70;">¡Hola! Escribe este código en la app para ingresar a <strong style="color:${NAVY};">UPS GO</strong>.</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:24px 16px 8px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#F4F8FD;border-radius:18px;">
              <tr><td style="padding:16px 12px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${digits}</tr></table></td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:12px 32px 28px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <span style="display:inline-block;background:#FFF4D8;color:#8A5A00;font-size:13px;font-weight:600;border-radius:999px;padding:7px 14px;">⏱ Vence en ${minutes} · se usa una sola vez</span>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F8FD;border-left:4px solid ${BLUE};border-radius:12px;">
              <tr>
                <td style="padding:14px 16px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:#4A5B70;">
                  <strong style="color:${NAVY};">¿No fuiste tú?</strong> Ignora este correo: nadie puede entrar a tu cuenta sin este código. Nunca te lo pediremos por teléfono, chat ni redes sociales.
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="background:#F7F9FC;border-top:1px solid #E5EDF7;padding:20px 24px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#7A8799;">
            UPS GO · Hecho por estudiantes de la Universidad Politécnica Salesiana<br>
            Este es un correo automático, por favor no respondas a este mensaje.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    'UPS GO — Tu código de acceso',
    '',
    `Código: ${code}`,
    `Vence en ${minutes} y se usa una sola vez.`,
    '',
    '¿No fuiste tú? Ignora este correo: nadie puede entrar a tu cuenta sin este código.',
    '',
    'UPS GO · Universidad Politécnica Salesiana',
  ].join('\n');

  return { subject: `${code} es tu código de acceso a UPS GO`, text, html };
}
