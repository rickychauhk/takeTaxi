import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { DriverAuthGuard } from '../../common/driver-auth.guard';
import { DriverEntity } from '../drivers/driver.entity';
import { OrderChatService } from './order-chat.service';

class SendDriverChatDto {
  @IsString()
  body!: string;
}

@Controller()
export class DriverOrderChatController {
  constructor(private readonly chat: OrderChatService) {}

  @UseGuards(DriverAuthGuard)
  @Get('driver/orders/:orderId/chat/messages')
  list(
    @Param('orderId') orderId: string,
    @Req() req: Request & { driver: DriverEntity },
  ) {
    return this.chat.listForDriver(orderId, req.driver.id);
  }

  @UseGuards(DriverAuthGuard)
  @Get('driver/orders/:orderId/chat/unread-count')
  unread(
    @Param('orderId') orderId: string,
    @Req() req: Request & { driver: DriverEntity },
  ) {
    return this.chat.countUnreadForDriver(orderId, req.driver.id).then((count) => ({ count }));
  }

  @UseGuards(DriverAuthGuard)
  @Patch('driver/orders/:orderId/chat/read')
  markRead(
    @Param('orderId') orderId: string,
    @Req() req: Request & { driver: DriverEntity },
  ) {
    return this.chat.markReadByDriver(orderId, req.driver.id);
  }

  @UseGuards(DriverAuthGuard)
  @Post('driver/orders/:orderId/chat/messages')
  send(
    @Param('orderId') orderId: string,
    @Body() dto: SendDriverChatDto,
    @Req() req: Request & { driver: DriverEntity },
  ) {
    return this.chat.sendFromDriver(orderId, req.driver.id, dto.body);
  }
}
