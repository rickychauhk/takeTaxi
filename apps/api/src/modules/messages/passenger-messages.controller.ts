import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PassengerAuthGuard } from '../../common/passenger-auth.guard';
import { PassengerEntity } from '../passengers/passenger.entity';
import { MessagesService } from './messages.service';

@Controller()
export class PassengerMessagesController {
  constructor(private readonly messages: MessagesService) {}

  @UseGuards(PassengerAuthGuard)
  @Get('passenger/messages')
  list(@Req() req: { passenger: PassengerEntity }) {
    return this.messages.listForPassenger(req.passenger.id, req.passenger.phone);
  }
}
