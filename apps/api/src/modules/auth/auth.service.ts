import {
  Injectable,
  Inject,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { User, UserRole } from '@prisma/client';
import * as crypto from 'node:crypto';
import { RequestCodeDto } from './dto/request-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { AuthTokensDto, AuthUserDto } from './dto/auth-response.dto';
import { JwtPayload } from '../../common/types/jwt-payload.type';
import { MailService } from './mail/mail.service';
import { AppConfig } from '../../config/app.config';

interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  type: string;
}

type AuthConfigPort = Pick<ConfigService, 'get'>;
type AuthJwtPort = Pick<JwtService, 'decode' | 'signAsync' | 'verifyAsync'>;
type AuthPrismaPort = Pick<
  PrismaService,
  '$transaction' | 'authVerificationCode' | 'session' | 'user'
>;
type AuthMailPort = Pick<MailService, 'sendOtp'>;

@Injectable()
export class AuthService {
  constructor(
    @Inject(ConfigService) private readonly configService: AuthConfigPort,
    @Inject(JwtService) private readonly jwtService: AuthJwtPort,
    @Inject(PrismaService) private readonly prisma: AuthPrismaPort,
    @Inject(MailService) private readonly mailService: AuthMailPort,
  ) {}

  async requestCode(dto: RequestCodeDto): Promise<{ message: string; devCode?: string }> {
    this.validateEmailDomain(dto.email);

    const appConfig = this.getAppConfig();
    const otpConfig = appConfig.otp;
    const authConfig = appConfig.auth;

    const code = this.generateOtp();
    const codeHash = this.hashOtp(code);
    const expiresAt = new Date(Date.now() + otpConfig.expiresMinutes * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { email: dto.email },
        update: {},
        create: { email: dto.email, role: UserRole.STUDENT, emailVerified: false },
      });

      // Upsert atómico sobre email único: evita la race de deleteMany+create concurrente (P2002)
      await tx.authVerificationCode.upsert({
        where: { email: dto.email },
        update: {
          codeHash,
          expiresAt,
          usedAt: null,
          attempts: 0,
        },
        create: {
          email: dto.email,
          codeHash,
          expiresAt,
        },
      });
    });

    await this.mailService.sendOtp(dto.email, code);

    return {
      message: 'Verification code sent',
      ...(authConfig.devExposeOtp && { devCode: code }),
    };
  }

  async verifyCode(dto: VerifyCodeDto): Promise<AuthTokensDto> {
    const appConfig = this.getAppConfig();
    const otpConfig = appConfig.otp;

    const verification = await this.prisma.authVerificationCode.findFirst({
      where: {
        email: dto.email,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!verification) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    if (verification.attempts >= otpConfig.maxAttempts) {
      throw new UnauthorizedException('Maximum verification attempts exceeded');
    }

    const isValid = this.verifyOtpHash(dto.code, verification.codeHash);

    if (!isValid) {
      await this.prisma.authVerificationCode.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid verification code');
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User is deactivated');
    }

    // Consumo atómico del código: solo una petición concurrente puede marcarlo como usado
    const markedUsed = await this.prisma.authVerificationCode.updateMany({
      where: { id: verification.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (markedUsed.count !== 1) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    if (!user.emailVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }

    return this.createSessionAndTokens(user);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthTokensDto> {
    const appConfig = this.getAppConfig();
    const jwtConfig = appConfig.jwt;

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(dto.refreshToken, {
        secret: jwtConfig.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    if (!session.user.isActive) {
      throw new UnauthorizedException('User is deactivated');
    }

    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    if (session.refreshTokenHash !== tokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotación atómica: revoca la sesión vieja solo si sigue activa (evita doble uso del token)
    const revoked = await this.prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (revoked.count !== 1) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    return this.createSessionAndTokens(session.user);
  }

  async logout(dto: LogoutDto): Promise<{ message: string }> {
    if (!dto.refreshToken) {
      return { message: 'Logged out' };
    }

    const appConfig = this.getAppConfig();
    const jwtConfig = appConfig.jwt;

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(dto.refreshToken, {
        secret: jwtConfig.refreshSecret,
      });
    } catch {
      return { message: 'Logged out' };
    }

    if (payload.type !== 'refresh') {
      return { message: 'Logged out' };
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
    });

    if (session && !session.revokedAt) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }

    return { message: 'Logged out' };
  }

  async getMe(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapToAuthUser(user);
  }

  private async createSessionAndTokens(user: User): Promise<AuthTokensDto> {
    // Genera el sessionId antes de firmar el token (evita el patrón pending- y sesiones huérfanas)
    const sessionId = crypto.randomUUID();

    const { accessToken, refreshToken } = await this.generateTokens(user, sessionId);
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = this.extractTokenExpiration(refreshToken);

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: this.mapToAuthUser(user),
    };
  }

  private async generateTokens(user: User, sessionId: string): Promise<{ accessToken: string; refreshToken: string }> {
    const jwtConfig = this.getAppConfig().jwt;

    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      sessionId,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        accessPayload,
        {
          secret: jwtConfig.accessSecret,
          expiresIn: jwtConfig.accessExpiresIn,
        } as JwtSignOptions,
      ),
      this.jwtService.signAsync(
        refreshPayload,
        {
          secret: jwtConfig.refreshSecret,
          expiresIn: jwtConfig.refreshExpiresIn,
        } as JwtSignOptions,
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private validateEmailDomain(email: string): void {
    const appConfig = this.getAppConfig();
    const authConfig = appConfig.auth;

    if (authConfig.superAdminEmails.includes(email)) {
      return;
    }

    const domain = email.split('@')[1];

    if (!domain || !authConfig.allowedDomains.includes(domain)) {
      throw new BadRequestException('Email domain is not allowed');
    }
  }

  private generateOtp(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashOtp(otp: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(otp, salt, 32).toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyOtpHash(otp: string, storedHash: string): boolean {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;

    const [salt, hash] = parts;
    if (!salt || !hash) return false;

    const derived = crypto.scryptSync(otp, salt, 32);
    const expected = Buffer.from(hash, 'hex');

    if (derived.length !== expected.length) return false;

    return crypto.timingSafeEqual(derived, expected);
  }

  private hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private extractTokenExpiration(token: string): Date {
    const decoded = this.jwtService.decode<{ exp: number }>(token);
    const exp = decoded?.exp;

    if (!exp) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    return new Date(exp * 1000);
  }

  private getAppConfig(): AppConfig {
    const appConfig = this.configService.get<AppConfig>('app', { infer: true });

    if (!appConfig) {
      throw new InternalServerErrorException('Application configuration is missing');
    }

    return appConfig;
  }

  private mapToAuthUser(user: User): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
    };
  }
}
