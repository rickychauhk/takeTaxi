import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUserEntity } from '../modules/admin-auth/admin-user.entity';

type AdminJwtPayload = {
  sub: number;
  typ: string;
  role: string;
  sv?: number;
};

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(AdminUserEntity)
    private readonly admins: Repository<AdminUserEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      admin?: AdminJwtPayload;
    }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const payload = this.jwt.verify(header.slice(7), {
        secret: process.env.JWT_SECRET,
      }) as AdminJwtPayload;
      if (payload.typ !== 'admin') {
        throw new UnauthorizedException('Invalid token type');
      }
      const admin = await this.admins.findOne({ where: { id: payload.sub, isActive: true } });
      if (!admin) {
        throw new UnauthorizedException('Invalid token');
      }
      if (payload.sv === undefined || admin.sessionVersion !== payload.sv) {
        throw new UnauthorizedException('登入已失效（可能已在其他裝置登入），請重新驗證');
      }
      req.admin = payload;
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('登入已過期，請重新登入');
    }
  }
}
