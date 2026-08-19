import { Injectable, Inject, Logger } from '@nestjs/common';
import { MailProvider, MAIL_PROVIDER } from './interfaces/mail-provider.interface';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(@Inject(MAIL_PROVIDER) private readonly mailProvider: MailProvider) {}

  async sendOtp(email: string, code: string): Promise<void> {
    try {
      await this.mailProvider.sendOtp(email, code);
    } catch (error) {
      this.logger.error('Failed to send OTP email', error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }
}
