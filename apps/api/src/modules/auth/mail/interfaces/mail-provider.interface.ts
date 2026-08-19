export interface MailProvider {
  sendOtp(email: string, code: string): Promise<void>;
}

export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
