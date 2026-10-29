import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PassengerEntity } from '../modules/passengers/passenger.entity';

type PassengerJwt = { sub: string; typ?: string };

@Injectable()
export class PassengerAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(PassengerEntity) private readonly passengers: Repository<PassengerEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      passenger?: PassengerEntity;
    }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing token');
    let payload: PassengerJwt;
    try {
      payload = this.jwt.verify(header.slice(7), { secret: process.env.JWT_SECRET }) as PassengerJwt;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    if (payload.typ !== 'passenger' || !payload.sub) {
      throw new UnauthorizedException('Invalid token type');
    }
    const passenger = await this.passengers.findOne({ where: { id: payload.sub, isActive: true } });
    if (!passenger) throw new UnauthorizedException('Passenger not found');
    if (!passenger.phone?.trim()) {
      throw new UnauthorizedException('請先完成電話驗證');
    }
    req.passenger = passenger;
    return true;
  }
}
