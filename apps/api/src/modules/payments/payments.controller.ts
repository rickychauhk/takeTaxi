import { Body, Controller, Post } from '@nestjs/common';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

class CheckoutDto {
  @IsEnum(['stripe', 'paypal'])
  provider!: 'stripe' | 'paypal';

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsString()
  currency!: string;
}

@Controller('payments')
export class PaymentsController {
  @Post('checkout')
  checkout(@Body() dto: CheckoutDto) {
    return {
      status: 'pending',
      provider: dto.provider,
      message: 'stub — wire Stripe/PayPal SDK + webhooks + settlement ledger',
      amount: dto.amount,
      currency: dto.currency,
      orderId: dto.orderId ?? null,
    };
  }
}
