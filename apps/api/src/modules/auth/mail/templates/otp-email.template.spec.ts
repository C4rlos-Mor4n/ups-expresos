import { OTP_EMAIL_LOGO_CID, renderOtpEmail } from './otp-email.template';

describe('renderOtpEmail', () => {
  it('includes the code in subject, text and one box per digit', () => {
    const email = renderOtpEmail({ code: '482913', expiresMinutes: 10, withLogo: true });

    expect(email.subject).toContain('482913');
    expect(email.text).toContain('Código: 482913');
    expect(email.text).toContain('Vence en 10 minutos');
    for (const digit of '482913') {
      expect(email.html).toContain(`>${digit}</div></td>`);
    }
  });

  it('references the inline logo only when it is attached', () => {
    expect(renderOtpEmail({ code: '1', expiresMinutes: 10, withLogo: true }).html).toContain(
      `cid:${OTP_EMAIL_LOGO_CID}`,
    );
    const noLogo = renderOtpEmail({ code: '1', expiresMinutes: 10, withLogo: false }).html;
    expect(noLogo).not.toContain('cid:');
    expect(noLogo).toContain('UPS GO');
  });

  it('uses the configured expiry and singular form', () => {
    expect(renderOtpEmail({ code: '1', expiresMinutes: 1, withLogo: false }).html).toContain(
      'Vence en 1 minuto ·',
    );
  });

  it('escapes the code before inserting it in HTML', () => {
    const html = renderOtpEmail({ code: '<b>', expiresMinutes: 5, withLogo: false }).html;
    expect(html).not.toContain('<b>');
  });
});
