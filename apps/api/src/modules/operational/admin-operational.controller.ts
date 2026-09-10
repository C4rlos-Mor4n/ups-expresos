import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AdminOperationalAssignmentsQueryDto,
  AdminOperationalAssignmentsResponseDto,
  AdminOperationalCampusDto,
  AdminOperationalAssignmentDto,
  AdminOperationalServiceLineDto,
  AdminOperationalServiceLineTimetableDto,
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
  @ApiCreatedResponse({ type: AdminOperationalAssignmentDto })
  @ApiConflictResponse({ description: 'Vehicle/driver window conflict or invalid journey template ownership' })
  createAssignment(@Body() dto: CreateServiceAssignmentDto, @CurrentUser('sub') actorId: string): Promise<AdminOperationalAssignmentDto> {
    return this.operationalService.createAssignment(dto, actorId);
  }

  @Get('campuses')
  @ApiOperation({ summary: 'List campuses for the Admin operational catalog' })
  @ApiOkResponse({ type: AdminOperationalCampusDto, isArray: true })
  listCampuses(): Promise<AdminOperationalCampusDto[]> {
    return this.operationalService.getAdminCampuses();
  }

  @Get('service-lines')
  @ApiOperation({ summary: 'List ServiceLines for the Admin operational catalog' })
  @ApiOkResponse({ type: AdminOperationalServiceLineDto, isArray: true })
  listServiceLines(@Query() query: AdminServiceLinesQueryDto): Promise<AdminOperationalServiceLineDto[]> {
    return this.operationalService.getAdminServiceLines(query.campusId);
  }

  @Get('service-lines/:id/timetable')
  @ApiOperation({ summary: 'Read RoutePaths, calendars, timetable structure and materialized operational departures for one line' })
  @ApiOkResponse({ type: AdminOperationalServiceLineTimetableDto })
  getServiceLineTimetable(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: OperationalDateQueryDto,
  ): Promise<AdminOperationalServiceLineTimetableDto> {
    return this.operationalService.getAdminServiceLineTimetable(id, query.date);
  }

  @Get('service-assignments')
  @ApiOperation({ summary: 'List operational assignments for admin planning and monitoring' })
  @ApiOkResponse({ type: AdminOperationalAssignmentsResponseDto })
  listAssignments(@Query() query: AdminOperationalAssignmentsQueryDto): Promise<AdminOperationalAssignmentsResponseDto> {
    return this.operationalService.listAdminAssignments(query);
  }

  @Get('service-runs')
  @ApiOperation({ summary: 'List real service runs; assignments without a run are not treated as active operation' })
  @ApiOkResponse({ type: AdminOperationalAssignmentsResponseDto })
  listRuns(@Query() query: AdminOperationalAssignmentsQueryDto): Promise<AdminOperationalAssignmentsResponseDto> {
    return this.operationalService.listAdminRuns(query);
  }
}
