import { DevMailProvider } from './dev.mail-provider';

describe('DevMailProvider', () => {
  let provider: DevMailProvider;
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    provider = new DevMailProvider();
    // Espiar el logger interno del provider
    loggerSpy = jest.spyOn(
      (provider as unknown as Record<string, unknown>).logger as { log: (...args: unknown[]) => void },
      'log',
    );
  });

  describe('sendOtp', () => {
    it('should not throw error', async () => {
      // Act & Assert
      await expect(provider.sendOtp('user@test.com', '123456'))
        .resolves.not.toThrow();
    });

    it('should NOT log the OTP code for security', async () => {
      // Arrange
      const secretCode = '654321';

      // Act
      await provider.sendOtp('user@test.com', secretCode);

      // Assert — verificar que el logger fue llamado pero NUNCA con el codigo
      expect(loggerSpy).toHaveBeenCalledTimes(1);
      const loggedMessage = loggerSpy.mock.calls[0][0] as string;
      expect(loggedMessage).toContain('user@test.com');
      expect(loggedMessage).not.toContain(secretCode);
    });

    it('should log the email address', async () => {
      // Act
      await provider.sendOtp('admin@ups.edu.ec', '999999');

      // Assert
      expect(loggerSpy).toHaveBeenCalledTimes(1);
      const loggedMessage = loggerSpy.mock.calls[0][0] as string;
      expect(loggedMessage).toContain('admin@ups.edu.ec');
    });

    it('should resolve with undefined', async () => {
      // Act
      const result = await provider.sendOtp('test@test.com', '000000');

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
