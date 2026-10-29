import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { FeedbackEntity } from './feedback.entity';
import { FeedbacksService } from './feedbacks.service';

class PublicFeedbackDto {
  @IsString()
  senderName!: string;

  @IsString()
  senderPhone!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}

class StatusDto {
  @IsEnum(['new', 'in_progress', 'closed'])
  status!: FeedbackEntity['status'];
}

@Controller()
export class FeedbacksController {
  constructor(private readonly feedbacks: FeedbacksService) {}

  @Post('public/feedbacks')
  create(@Body() dto: PublicFeedbackDto) {
    return this.feedbacks.createPublic(dto);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/feedbacks')
  list(@Query('status') status?: FeedbackEntity['status']) {
    return this.feedbacks.listAdmin(status);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/feedbacks/:id/status')
  patch(@Param('id') id: string, @Body() dto: StatusDto, @Req() req: { admin: { sub: number } }) {
    return this.feedbacks.updateStatus(req.admin.sub, id, dto.status);
  }
}
