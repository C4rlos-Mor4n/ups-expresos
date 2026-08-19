import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthService } from './health.service';
import { Public } from '../../common/decorators/public.decorator';
import { HealthDbResponseDto, HealthResponseDto } from './dto/health-response.dto';

@ApiTags('Health')
@Controller('health')
@SkipThrottle({ auth: true })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiOkResponse({ type: HealthResponseDto, description: 'Service is healthy' })
  check(): Record<string, string> {
    return this.healthService.check();
  }

  @Public()
  @Get('db')
  @ApiOperation({ summary: 'Database connectivity health check' })
  @ApiOkResponse({ type: HealthDbResponseDto, description: 'Database connection is healthy' })
  @ApiServiceUnavailableResponse({ description: 'Database connection is unavailable' })
  async checkDb(): Promise<Record<string, string>> {
    return this.healthService.checkDb();
  }
}
