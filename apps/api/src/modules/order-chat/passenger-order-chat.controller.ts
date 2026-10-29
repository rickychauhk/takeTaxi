import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PassengerAuthGuard } from '../../common/passenger-auth.guard';
import { PassengerEntity } from '../passengers/passenger.entity';
import { OrdersService } from '../orders/orders.service';
import { OrderChatService } from './order-chat.service';

class SendPassengerChatDto {
  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  quickReplyId?: number;
}

@Controller()
export class PassengerOrderChatController {
  constructor(
    private readonly chat: OrderChatService,
    private readonly orders: OrdersService,
  ) {}

  @UseGuards(PassengerAuthGuard)
  @Get('passenger/order-chat/quick-replies')
  quickReplies() {
    return this.chat.listQuickRepliesForPassengerApp();
  }

  @UseGuards(PassengerAuthGuard)
  @Get('passenger/orders/:orderId/chat/messages')
  list(
    @Param('orderId') orderId: string,
    @Req() req: Request & { passenger: PassengerEntity },
  ) {
    return this.chat.listForPassenger(orderId, req.passenger.id);
  }

  @UseGuards(PassengerAuthGuard)
  @Get('passenger/orders/:orderId/chat/unread-count')
  unread(
    @Param('orderId') orderId: string,
    @Req() req: Request & { passenger: PassengerEntity },
  ) {
    return this.chat.countUnreadForPassenger(orderId, req.passenger.id).then((count) => ({ count }));
  }

  @UseGuards(PassengerAuthGuard)
  @Patch('passenger/orders/:orderId/chat/read')
  markRead(
    @Param('orderId') orderId: string,
    @Req() req: Request & { passenger: PassengerEntity },
  ) {
    return this.chat.markReadByPassenger(orderId, req.passenger.id);
  }

  @UseGuards(PassengerAuthGuard)
  @Post('passenger/orders/:orderId/chat/messages')
  async send(
    @Param('orderId') orderId: string,
    @Body() dto: SendPassengerChatDto,
    @Req() req: Request & { passenger: PassengerEntity },
  ) {
    const result = await this.chat.sendFromPassenger(
      orderId,
      req.passenger.id,
      dto.body?.trim() ?? '',
      { quickReplyId: dto.quickReplyId },
    );
    if (result.cancelOrder) {
      await this.orders.passengerCancelOrder(orderId);
    } else if (result.releaseToHall) {
      await this.orders.passengerReleaseOrderToHall(req.passenger.id, orderId);
    }
    return result;
  }
}
