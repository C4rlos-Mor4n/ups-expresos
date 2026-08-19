import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBody, ApiParam,
  ApiBearerAuth, ApiCreatedResponse, ApiOkResponse,
  ApiBadRequestResponse, ApiUnauthorizedResponse, ApiNotFoundResponse, ApiForbiddenResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { TripFeedbackService } from './trip-feedback.service';
import { CreateTripFeedbackDto } from './dto/create-trip-feedback.dto';
import { TripFeedbackResponseDto } from './dto/trip-feedback-response.dto';
import { TripFeedbackPaginatedResponseDto } from './dto/trip-feedback-paginated-response.dto';
import { TripFeedbackQueryDto } from './dto/trip-feedback-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/types/jwt-payload.type';

@ApiTags('Trip Feedback')
@ApiBearerAuth()
@Controller('trip-feedback')
@SkipThrottle({ auth: true })
export class TripFeedbackController {
  constructor(private readonly tripFeedbackService: TripFeedbackService) {}

  @Post()
  @ApiOperation({ summary: 'Create trip feedback' })
  @ApiBody({ type: CreateTripFeedbackDto })
  @ApiCreatedResponse({
    description: 'Feedback created successfully',
    type: TripFeedbackResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiNotFoundResponse({ description: 'Route or driver not found' })
  async create(
    @Body() dto: CreateTripFeedbackDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TripFeedbackResponseDto> {
    return this.tripFeedbackService.create(dto, user.sub, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List trip feedback with pagination' })
  @ApiOkResponse({
    description: 'Paginated list of feedback',
    type: TripFeedbackPaginatedResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async findAll(
    @Query() query: TripFeedbackQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<TripFeedbackPaginatedResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.tripFeedbackService.findAll(page, limit, user, query.userId, query.routeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get trip feedback by ID' })
  @ApiParam({ name: 'id', description: 'Feedback ID', format: 'uuid' })
  @ApiOkResponse({
    description: 'Feedback details',
    type: TripFeedbackResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  @ApiForbiddenResponse({ description: 'Not authorized to view this feedback' })
  @ApiNotFoundResponse({ description: 'Feedback not found' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<TripFeedbackResponseDto> {
    return this.tripFeedbackService.findOne(id, user);
  }
}
