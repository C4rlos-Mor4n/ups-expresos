import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { MAIL_PROVIDER } from './interfaces/mail-provider.interface';
import { SmtpMailProvider } from './providers/smtp.mail-provider';
import { DevMailProvider } from './providers/dev.mail-provider';
import { AppConfig } from '../../../config/app.config';

@Module({
  imports: [ConfigModule],
  providers: [
    MailService,
    {
      provide: MAIL_PROVIDER,
      useFactory: (configService: ConfigService<AppConfig>) => {
        const appConfig = configService.get<AppConfig>('app', { infer: true });
        const smtpConfig = appConfig?.smtp;

        // Usar SmtpMailProvider si las credenciales SMTP están configuradas
        // independientemente del NODE_ENV
        if (smtpConfig?.host && smtpConfig?.user && smtpConfig?.pass) {
          return new SmtpMailProvider(configService);
        }
        
        return new DevMailProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [MailService],
})
export class MailModule {}
