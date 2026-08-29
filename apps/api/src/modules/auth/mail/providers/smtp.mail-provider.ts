import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailProvider } from '../interfaces/mail-provider.interface';
import { AppConfig } from '../../../../config/app.config';

@Injectable()
export class SmtpMailProvider implements MailProvider {
  private readonly logger = new Logger(SmtpMailProvider.name);
  private transporter: nodemailer.Transporter;

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

    this.logger.log(`SMTP provider initialized with host: ${smtpConfig.host}`);
  }

  async sendOtp(email: string, code: string): Promise<void> {
    const appConfig = this.configService.get<AppConfig>('app', { infer: true });
    const smtpConfig = appConfig?.smtp;
    const appName = appConfig?.appName;

    // Usar SMTP_FROM si está configurado, sino usar SMTP_USER
    const fromAddress = smtpConfig?.from || smtpConfig?.user;

    this.logger.log(`Sending OTP email to: ${email}`);
    this.logger.log(`From: ${fromAddress}`);
    this.logger.log(`SMTP Host: ${smtpConfig?.host}:${smtpConfig?.port}`);

    try {
      const info = await this.transporter.sendMail({
        from: `"${appName}" <${fromAddress}>`,
        to: email,
        subject: 'Código de verificación UPS GO',
        text: `Tu codigo de verificacion es: ${code}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>UPS GO</h2>
            <p>Tu codigo de verificacion es:</p>
            <h1 style="color: #0066cc; letter-spacing: 5px;">${code}</h1>
            <p>Este codigo expira en 10 minutos.</p>
            <p>Si no solicitaste este codigo, ignora este mensaje.</p>
          </div>
        `,
      });

      this.logger.log(`Email sent successfully. Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}
