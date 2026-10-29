import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { InjectRepository } from '@nestjs/typeorm';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { DriverEntity } from '../drivers/driver.entity';
import { LocationsService } from '../locations/locations.service';
import { OrdersService } from '../orders/orders.service';
import {
  parseDriverPosition,
  parseMaxPickupRadiusKm,
} from '../orders/driver-pickup-radius.util';
import { OrderNotificationsService } from './order-notifications.service';

@WebSocketGateway({
  cors: { origin: true },
  path: '/socket.io',
})
export class RealtimeGateway implements OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly locations: LocationsService,
    private readonly orders: OrdersService,
    private readonly orderNotifications: OrderNotificationsService,
    private readonly jwt: JwtService,
    @InjectRepository(DriverEntity) private readonly drivers: Repository<DriverEntity>,
  ) {}

  afterInit() {
    this.orderNotifications.setServer(this.server);
  }

  @SubscribeMessage('admin:orders:subscribe')
  async adminOrdersSubscribe(
    @MessageBody() body: { token?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const token = body?.token?.trim();
    if (!token) throw new WsException('缺少 admin token');
    try {
      this.jwt.verify(token, { secret: process.env.JWT_SECRET });
    } catch {
      throw new WsException('admin token 無效');
    }
    await client.join('admin:orders');
    const snapshot = await this.orders.listLiveOrdersForAdmin();
    client.emit('admin:order:snapshot', snapshot);
    return { ok: true, count: snapshot.length };
  }

  private async verifyDriverWsToken(token: string): Promise<DriverEntity> {
    let payload: { sub?: string; typ?: string; sv?: number };
    try {
      payload = this.jwt.verify(token, { secret: process.env.JWT_SECRET }) as typeof payload;
    } catch {
      throw new WsException('driver token 無效');
    }
    if (payload.typ !== 'driver' || !payload.sub) {
      throw new WsException('driver token 無效');
    }
    const driver = await this.drivers.findOne({ where: { id: payload.sub, isActive: true } });
    if (!driver) throw new WsException('司機不存在或已停用');
    if (payload.sv === undefined || driver.sessionVersion !== payload.sv) {
      throw new WsException('登入已失效，請重新登入');
    }
    return driver;
  }

  @SubscribeMessage('driver:orders:subscribe')
  async driverOrdersSubscribe(
    @MessageBody()
    body: {
      token?: string;
      maxPickupRadiusKm?: unknown;
      driverLat?: unknown;
      driverLng?: unknown;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const token = body?.token?.trim();
    if (!token) throw new WsException('缺少 driver token');
    const driver = await this.verifyDriverWsToken(token);
    const maxPickupRadiusKm = parseMaxPickupRadiusKm(body?.maxPickupRadiusKm);
    const driverPosition = parseDriverPosition(body);
    client.data.driverId = driver.id;
    client.data.driverTier = driver.driverTier;
    client.data.isInternalMember = Boolean(driver.isInternalMember);
    client.data.maxPickupRadiusKm = maxPickupRadiusKm;
    if (driverPosition) {
      client.data.driverLat = driverPosition.lat;
      client.data.driverLng = driverPosition.lng;
    } else {
      delete client.data.driverLat;
      delete client.data.driverLng;
    }
    await client.join('drivers:online');
    await client.join(`driver:${driver.id}`);
    const snapshot = await this.orders.listForDriver(
      driver.id,
      maxPickupRadiusKm,
      driverPosition,
    );
    client.emit('driver:order:snapshot', snapshot);
    return { ok: true, count: snapshot.length };
  }

  @SubscribeMessage('driver:orders:refresh')
  async driverOrdersRefresh(
    @MessageBody()
    body: {
      token?: string;
      maxPickupRadiusKm?: unknown;
      driverLat?: unknown;
      driverLng?: unknown;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const token = body?.token?.trim();
    if (!token) throw new WsException('缺少 driver token');
    const driver = await this.verifyDriverWsToken(token);
    if (body?.maxPickupRadiusKm !== undefined) {
      client.data.maxPickupRadiusKm = parseMaxPickupRadiusKm(body.maxPickupRadiusKm);
    }
    const driverPosition = parseDriverPosition(body);
    if (driverPosition) {
      client.data.driverLat = driverPosition.lat;
      client.data.driverLng = driverPosition.lng;
    }
    const maxPickupRadiusKm = client.data.maxPickupRadiusKm as number | null | undefined;
    const socketPos =
      driverPosition ??
      (client.data.driverLat != null && client.data.driverLng != null
        ? {
            lat: client.data.driverLat as number,
            lng: client.data.driverLng as number,
          }
        : null);
    const snapshot = await this.orders.listForDriver(driver.id, maxPickupRadiusKm, socketPos);
    client.emit('driver:order:snapshot', snapshot);
    return { ok: true, count: snapshot.length };
  }

  @SubscribeMessage('location:update')
  async onLocation(
    @MessageBody() body: { userId: string; role: 'passenger' | 'driver'; lat: number; lng: number },
  ) {
    await this.locations.upsertLive(body.userId, body.role, body.lat, body.lng);
    this.server.emit('location:sync', body);
    return { ok: true };
  }

  @SubscribeMessage('order:dispatch:ping')
  async dispatchPing(@MessageBody() body: { driverId: string }, @ConnectedSocket() client: Socket) {
    const orders = await this.orders.listForDriver(body.driverId);
    client.emit('order:dispatch:batch', orders);
    return { count: orders.length };
  }
}
