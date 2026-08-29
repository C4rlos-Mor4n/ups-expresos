import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { MailProvider, MAIL_PROVIDER } from './interfaces/mail-provider.interface';
import { Logger } from '@nestjs/common';

describe('MailService', () => {
  let service: MailService;
  let mockSendOtp: jest.Mock;

  beforeEach(async () => {
    mockSendOtp = jest.fn();
    const provider: MailProvider = { sendOtp: mockSendOtp };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: MAIL_PROVIDER,
          useValue: provider,
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  describe('sendOtp', () => {
    it('should call provider with correct email and code', async () => {
      // Arrange
      mockSendOtp.mockResolvedValue(undefined);

      // Act
      await service.sendOtp('user@test.com', '123456');

      // Assert
      expect(mockSendOtp).toHaveBeenCalledTimes(1);
      expect(mockSendOtp).toHaveBeenCalledWith('user@test.com', '123456');
    });

    it('should propagate error when provider fails', async () => {
      // Arrange
      const providerError = new Error('SMTP connection refused');
      mockSendOtp.mockRejectedValue(providerError);

      // Act & Assert
      await expect(service.sendOtp('user@test.com', '123456'))
        .rejects.toThrow('SMTP connection refused');
    });

    it('should log error when provider fails', async () => {
      // Arrange
      const providerError = new Error('SMTP timeout');
      mockSendOtp.mockRejectedValue(providerError);

      // Espiar el logger interno del servicio
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      // Act
      await expect(service.sendOtp('user@test.com', '654321'))
        .rejects.toThrow('SMTP timeout');

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to send OTP email',
        expect.stringContaining('SMTP timeout'),
      );
      loggerSpy.mockRestore();
    });

    it('should not throw when provider succeeds', async () => {
      // Arrange
      mockSendOtp.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.sendOtp('admin@ups.edu.ec', '999999'))
        .resolves.not.toThrow();
    });

    it('should handle non-Error rejections from provider', async () => {
      // Arrange — el provider lanza un string en vez de Error
      mockSendOtp.mockRejectedValue('string-error');

      // Espiar el logger
      const loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      // Act
      await expect(service.sendOtp('user@test.com', '111111'))
        .rejects.toBe('string-error');

      // Assert — el logger debe recibir el string convertido
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to send OTP email',
        'string-error',
      );
      loggerSpy.mockRestore();
    });
  });
});
