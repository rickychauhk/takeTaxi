import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverEntity } from '../modules/drivers/driver.entity';

type DriverJwt = { sub: string; typ?: string; sv?: number };

@Injectable()
export class DriverAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(DriverEntity) private readonly drivers: Repository<DriverEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ headers: { authorization?: string }; driver?: DriverEntity }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing token');
    let payload: DriverJwt;
    try {
      payload = this.jwt.verify(header.slice(7), { secret: process.env.JWT_SECRET }) as DriverJwt;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    if (payload.typ !== 'driver' || !payload.sub) {
      throw new UnauthorizedException('Invalid token type');
    }
    const driver = await this.drivers.findOne({ where: { id: payload.sub, isActive: true } });
    if (!driver) throw new UnauthorizedException('Driver not found');
    if (payload.sv === undefined || driver.sessionVersion !== payload.sv) {
      throw new UnauthorizedException('帳戶已在另一部裝置登入，此裝置已登出。');
    }
    req.driver = driver;
    return true;
  }
}
