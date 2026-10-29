import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { OrderChatService } from './order-chat.service';
import type { PassengerChatQuickReplyAction } from './passenger-order-chat-quick-reply.entity';

class QuickReplyDto {
  @IsString()
  labelZh!: string;

  @IsOptional()
  @IsString()
  labelEn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(['message', 'cancel_order', 'release_to_hall'])
  actionType?: PassengerChatQuickReplyAction;
}

class PatchQuickReplyDto {
  @IsOptional()
  @IsString()
  labelZh?: string;

  @IsOptional()
  @IsString()
  labelEn?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(['message', 'cancel_order', 'release_to_hall'])
  actionType?: PassengerChatQuickReplyAction;
}

@Controller()
export class OrderChatAdminController {
  constructor(private readonly chat: OrderChatService) {}

  @UseGuards(AdminAuthGuard)
  @Get('admin/order-chat/quick-replies')
  listQuickReplies() {
    return this.chat.listQuickRepliesAdmin();
  }

  @UseGuards(AdminAuthGuard)
  @Post('admin/order-chat/quick-replies')
  create(@Body() dto: QuickReplyDto) {
    return this.chat.createQuickReply(dto);
  }

  @UseGuards(AdminAuthGuard)
  @Patch('admin/order-chat/quick-replies/:id')
  patch(@Param('id', ParseIntPipe) id: number, @Body() dto: PatchQuickReplyDto) {
    return this.chat.updateQuickReply(id, dto);
  }

  @UseGuards(AdminAuthGuard)
  @Delete('admin/order-chat/quick-replies/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.chat.deleteQuickReply(id);
  }

  @UseGuards(AdminAuthGuard)
  @Get('admin/orders/:orderId/chat/messages')
  adminMessages(@Param('orderId') orderId: string) {
    return this.chat.listForAdmin(orderId);
  }
}
