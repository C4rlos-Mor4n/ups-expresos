import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import {
  AdminUserDto,
  AdminUsersPageDto,
  AdminUsersQueryDto,
  AuditLogsPageDto,
  AuditLogsQueryDto,
  DashboardDto,
  DashboardQueryDto,
  UpdateAdminUserDto,
} from './dto/admin.dto';

@ApiBearerAuth()
@ApiTags('Admin')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Daily operation summary for the admin panel' })
  @ApiOkResponse({ type: DashboardDto })
  dashboard(@Query() query: DashboardQueryDto) {
    return this.admin.dashboard(query.date);
  }

  @Get('users')
  @ApiOperation({ summary: 'List user accounts (search by email or name, filter by role)' })
  @ApiOkResponse({ type: AdminUsersPageDto })
  users(@Query() query: AdminUsersQueryDto) {
    return this.admin.listUsers(query);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Activate/deactivate an account or change its role (admin roles: SUPER_ADMIN only)' })
  @ApiForbiddenResponse({ description: 'Own account, or administrator accounts without SUPER_ADMIN' })
  @ApiOkResponse({ type: AdminUserDto })
  updateUser(
    @CurrentUser() actor: { sub: string; role: UserRole },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.admin.updateUser(actor, id, dto);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Audit trail of administrative and automatic actions' })
  @ApiOkResponse({ type: AuditLogsPageDto })
  auditLogs(@Query() query: AuditLogsQueryDto) {
    return this.admin.listAuditLogs(query);
  }
}
