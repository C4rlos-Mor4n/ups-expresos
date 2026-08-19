import { Injectable, Logger } from '@nestjs/common';
import { MailProvider } from '../interfaces/mail-provider.interface';

@Injectable()
export class DevMailProvider implements MailProvider {
  private readonly logger = new Logger(DevMailProvider.name);

  async sendOtp(email: string, _code: string): Promise<void> {
    // En desarrollo, NO loguear el codigo OTP por seguridad
    this.logger.log(`DevMailProvider: OTP sent to ${email} (code not logged for security)`);
  }
}
