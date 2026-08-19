import { Controller, Post, Get, Body, HttpCode } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiOkResponse, ApiCreatedResponse,
  ApiBearerAuth, ApiTooManyRequestsResponse, ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestCodeDto } from './dto/request-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { AuthTokensDto, AuthUserDto } from './dto/auth-response.dto';
import { LogoutResponseDto, RequestCodeResponseDto } from './dto/auth-message-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('request-code')
  @ApiOperation({ summary: 'Request an OTP verification code' })
  @ApiCreatedResponse({ type: RequestCodeResponseDto, description: 'Verification code sent' })
  @ApiBadRequestResponse({ description: 'Invalid email format or email domain not allowed' })
  @ApiTooManyRequestsResponse({ description: 'Too many requests. Try again later.' })
  requestCode(@Body() dto: RequestCodeDto): Promise<{ message: string; devCode?: string }> {
    return this.authService.requestCode(dto);
  }

  @Public()
  @Post('verify-code')
  @ApiOperation({ summary: 'Verify OTP and obtain access/refresh tokens' })
  @ApiCreatedResponse({ type: AuthTokensDto, description: 'Tokens generated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid email or code format' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired code' })
  verifyCode(@Body() dto: VerifyCodeDto): Promise<AuthTokensDto> {
    return this.authService.verifyCode(dto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  @ApiCreatedResponse({ type: AuthTokensDto, description: 'Tokens refreshed successfully' })
  @ApiBadRequestResponse({ description: 'Invalid refresh token format' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.authService.refresh(dto);
  }

  @SkipThrottle({ auth: true })
  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke session' })
  @ApiOkResponse({ type: LogoutResponseDto, description: 'Logged out successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token' })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  logout(@Body() dto: LogoutDto): Promise<{ message: string }> {
    return this.authService.logout(dto);
  }

  @SkipThrottle({ auth: true })
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiOkResponse({ type: AuthUserDto, description: 'Current user' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing token' })
  getMe(@CurrentUser('sub') userId: string): Promise<AuthUserDto> {
    return this.authService.getMe(userId);
  }
}
