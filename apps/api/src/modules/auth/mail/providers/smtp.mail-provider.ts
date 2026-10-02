import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as nodemailer from 'nodemailer';
import { MailProvider } from '../interfaces/mail-provider.interface';
import { AppConfig } from '../../../../config/app.config';
import { OTP_EMAIL_LOGO_CID, renderOtpEmail } from '../templates/otp-email.template';

// Relativo al directorio de trabajo: `apps/api` en local y `/app` en la imagen Docker.
const LOGO_PATH = join(process.cwd(), 'assets', 'email', 'logo-ups-go.png');

@Injectable()
export class SmtpMailProvider implements MailProvider {
  private readonly logger = new Logger(SmtpMailProvider.name);
  private transporter: nodemailer.Transporter;
  private readonly logo: Buffer | null;

  constructor(private readonly configService: ConfigService<AppConfig>) {
    const appConfig = this.configService.get<AppConfig>('app', { infer: true });
    const smtpConfig = appConfig?.smtp;

    if (!smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) {
      throw new Error('SMTP configuration is missing or incomplete');
    }

    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port ?? 587,
      secure: smtpConfig.secure ?? false,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });

    // Sin el logo el correo sigue siendo válido: muestra el nombre en texto.
    this.logo = existsSync(LOGO_PATH) ? readFileSync(LOGO_PATH) : null;
    if (!this.logo) this.logger.warn(`Email logo not found at ${LOGO_PATH}`);

    this.logger.log('SMTP provider initialized');
  }

  async sendOtp(email: string, code: string): Promise<void> {
    const appConfig = this.configService.get<AppConfig>('app', { infer: true });
    const smtpConfig = appConfig?.smtp;
    const appName = appConfig?.appName;

    // Usar SMTP_FROM si está configurado, sino usar SMTP_USER
    const fromAddress = smtpConfig?.from || smtpConfig?.user;

    try {
      const message = renderOtpEmail({
        code,
        expiresMinutes: appConfig?.otp.expiresMinutes ?? 10,
        withLogo: this.logo !== null,
      });
      await this.transporter.sendMail({
        from: `"${appName}" <${fromAddress}>`,
        to: email,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: this.logo
          ? [{ filename: 'ups-go.png', content: this.logo, cid: OTP_EMAIL_LOGO_CID, contentType: 'image/png' }]
          : [],
      });

      this.logger.log('OTP email sent');
    } catch (error) {
      this.logger.error('Mail delivery failed');
      throw error;
    }
  }
}
