import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AdminOperationalAssignmentsQueryDto,
  AdminServiceLinesQueryDto,
  CreateServiceAssignmentDto,
  OperationalDateQueryDto,
} from './dto/operational.dto';
import { OperationalService } from './operational.service';

@ApiBearerAuth()
@ApiTags('Admin Operational')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/operational')
export class AdminOperationalController {
  constructor(private readonly operationalService: OperationalService) {}

  @Post('service-assignments')
  @ApiOperation({ summary: 'Create a resource assignment for a materialized scheduled departure' })
  @ApiCreatedResponse({ type: Object })
  @ApiConflictResponse({ description: 'Vehicle/driver window conflict or invalid journey template ownership' })
  createAssignment(@Body() dto: CreateServiceAssignmentDto, @CurrentUser('sub') actorId: string) {
    return this.operationalService.createAssignment(dto, actorId);
  }

  @Get('campuses')
  @ApiOperation({ summary: 'List campuses for the Admin operational catalog' })
  @ApiOkResponse({ type: Object })
  listCampuses() {
    return this.operationalService.getAdminCampuses();
  }

  @Get('service-lines')
  @ApiOperation({ summary: 'List ServiceLines for the Admin operational catalog' })
  @ApiOkResponse({ type: Object })
  listServiceLines(@Query() query: AdminServiceLinesQueryDto) {
    return this.operationalService.getAdminServiceLines(query.campusId);
  }

  @Get('service-lines/:id/timetable')
  @ApiOperation({ summary: 'Read RoutePaths, calendars, timetable structure and materialized operational departures for one line' })
  @ApiOkResponse({ type: Object })
  getServiceLineTimetable(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: OperationalDateQueryDto,
  ) {
    return this.operationalService.getAdminServiceLineTimetable(id, query.date);
  }

  @Get('service-assignments')
  @ApiOperation({ summary: 'List operational assignments for admin planning and monitoring' })
  @ApiOkResponse({ type: Object })
  listAssignments(@Query() query: AdminOperationalAssignmentsQueryDto) {
    return this.operationalService.listAdminAssignments(query);
  }

  @Get('service-runs')
  @ApiOperation({ summary: 'List real service runs; assignments without a run are not treated as active operation' })
  @ApiOkResponse({ type: Object })
  listRuns(@Query() query: AdminOperationalAssignmentsQueryDto) {
    return this.operationalService.listAdminRuns(query);
  }
}
