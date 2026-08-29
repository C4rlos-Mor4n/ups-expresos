import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { StudentDepartureQueryDto } from './dto/operational.dto';
import { OperationalService } from './operational.service';

@ApiBearerAuth()
@ApiTags('Student Operations')
@Roles(UserRole.STUDENT)
@Controller('student')
export class StudentOperationalController {
  constructor(private readonly operationalService: OperationalService) {}

  @Get('campuses')
  @ApiOperation({ summary: 'List active campuses available to students' })
  @ApiOkResponse({ type: Object })
  getCampuses() {
    return this.operationalService.getStudentCampuses();
  }

  @Get('campuses/:campusId/service-lines')
  @ApiOperation({ summary: 'List active service lines for one active campus' })
  @ApiNotFoundResponse({ description: 'Campus not found or inactive' })
  @ApiOkResponse({ type: Object })
  getServiceLines(@Param('campusId', ParseUUIDPipe) campusId: string) {
    return this.operationalService.getStudentServiceLines(campusId);
  }

  @Get('service-lines/:serviceLineId/departures')
  @ApiOperation({ summary: 'List materialized departures and projected operational state for a civil date' })
  @ApiOkResponse({ type: Object })
  getDepartures(
    @Param('serviceLineId', ParseUUIDPipe) serviceLineId: string,
    @Query() query: StudentDepartureQueryDto,
  ) {
    return this.operationalService.getStudentDepartures(serviceLineId, query.date, query.direction);
  }

  @Get('scheduled-departures/:id')
  @ApiOperation({ summary: 'Get a scheduled departure with visible assignments and operational state' })
  @ApiNotFoundResponse({ description: 'Scheduled departure not found' })
  @ApiOkResponse({ type: Object })
  getDeparture(@Param('id', ParseUUIDPipe) id: string) {
    return this.operationalService.getStudentDepartureDetail(id);
  }
}
