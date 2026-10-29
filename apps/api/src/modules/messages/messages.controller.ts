import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import { MessagesService, type MessageAudience, type PhoneAppTarget } from './messages.service';

class SendMessageDto {
  @IsEnum(['all_drivers', 'all_passengers', 'all_members', 'phones'])
  audience!: MessageAudience;

  @IsOptional()
  @IsString()
  phones?: string;

  @IsOptional()
  @IsEnum(['driver', 'passenger', 'both'])
  phoneAppTarget?: PhoneAppTarget;

  @IsString()
  title!: string;

  @IsString()
  body!: string;
}

@Controller('admin/messages')
@UseGuards(AdminAuthGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list() {
    return this.messages.list();
  }

  @Post()
  send(@Body() dto: SendMessageDto, @Req() req: { admin: { sub: number } }) {
    return this.messages.send(req.admin.sub, dto);
  }
}
