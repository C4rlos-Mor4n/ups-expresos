import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OperationalService } from './operational.service';

@ApiBearerAuth()
@ApiTags('Driver Operations')
@Roles(UserRole.DRIVER)
@Controller('driver/operational')
export class DriverOperationalController {
  constructor(private readonly operationalService: OperationalService) {}

  @Get('assignments/today')
  @ApiOperation({ summary: 'List today operational assignments for the authenticated driver' })
  @ApiOkResponse({ type: Object })
  getToday(@CurrentUser('sub') userId: string) {
    return this.operationalService.getDriverAssignmentsToday(userId);
  }

  @Get('assignments/:id')
  @ApiOperation({ summary: 'Get one operational assignment owned by the authenticated driver' })
  @ApiNotFoundResponse({ description: 'Assignment not found' })
  @ApiOkResponse({ type: Object })
  getAssignment(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.operationalService.getDriverAssignment(userId, id);
  }

  @Post('assignments/:id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start the authenticated driver operational run; repeated starts are idempotent' })
  @ApiConflictResponse({ description: 'Assignment unavailable or another vehicle/driver run is active' })
  @ApiOkResponse({ type: Object })
  start(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.operationalService.startDriverRun(userId, id);
  }

  @Get('service-runs/current')
  @ApiOperation({ summary: 'Get the authenticated driver current ServiceRun, or null' })
  @ApiOkResponse({ type: Object })
  current(@CurrentUser('sub') userId: string) {
    return this.operationalService.getCurrentDriverRun(userId);
  }

  @Post('service-runs/:id/finish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finish an authenticated driver ServiceRun; repeated finishes are idempotent' })
  @ApiConflictResponse({ description: 'ServiceRun cannot be finished' })
  @ApiOkResponse({ type: Object })
  finish(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.operationalService.finishDriverRun(userId, id);
  }
}
