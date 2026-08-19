import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiBody, ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NoticesService } from './notices.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { NoticeResponseDto } from './dto/notice-response.dto';
import { NoticePaginatedResponseDto } from './dto/notice-paginated-response.dto';

@ApiBearerAuth()
@ApiTags('Admin Notices')
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/notices')
@SkipThrottle({ auth: true })
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new notice' })
  @ApiBody({ type: CreateNoticeDto })
  @ApiCreatedResponse({ type: NoticeResponseDto, description: 'Notice created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  create(
    @Body() dto: CreateNoticeDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<NoticeResponseDto> {
    return this.noticesService.create(dto, actorId);
  }

  @Get()
  @ApiOperation({ summary: 'List all notices with pagination' })
  @ApiOkResponse({ type: NoticePaginatedResponseDto, description: 'Paginated list of notices' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findAll(@Query() pagination: PaginationDto): Promise<NoticePaginatedResponseDto> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    return this.noticesService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notice details' })
  @ApiParam({ name: 'id', description: 'Notice ID', format: 'uuid' })
  @ApiOkResponse({ type: NoticeResponseDto, description: 'Notice details' })
  @ApiNotFoundResponse({ description: 'Notice not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  findOne(@Param('id') id: string): Promise<NoticeResponseDto> {
    return this.noticesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a notice' })
  @ApiParam({ name: 'id', description: 'Notice ID', format: 'uuid' })
  @ApiBody({ type: UpdateNoticeDto })
  @ApiOkResponse({ type: NoticeResponseDto, description: 'Notice updated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiNotFoundResponse({ description: 'Notice not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNoticeDto,
    @CurrentUser('sub') actorId: string,
  ): Promise<NoticeResponseDto> {
    return this.noticesService.update(id, dto, actorId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a notice' })
  @ApiParam({ name: 'id', description: 'Notice ID', format: 'uuid' })
  @ApiOkResponse({ type: NoticeResponseDto, description: 'Notice deactivated successfully' })
  @ApiNotFoundResponse({ description: 'Notice not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  remove(
    @Param('id') id: string,
    @CurrentUser('sub') actorId: string,
  ): Promise<NoticeResponseDto> {
    return this.noticesService.remove(id, actorId);
  }
}
