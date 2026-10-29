import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { PassengerEntity } from '../passengers/passenger.entity';
import { JwtService } from '@nestjs/jwt';
import { FirebaseTokenService } from '../admin-auth/firebase-token.service';
import { normalizePhoneE164 } from '../admin-auth/phone.util';
import { PassengerPointsService } from '../passengers/passenger-points.service';
import { PassengersService } from '../passengers/passengers.service';

const PASSENGER_JWT_EXPIRES_IN = process.env.PASSENGER_JWT_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '365d';

@Injectable()
export class PassengerAuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly firebase: FirebaseTokenService,
    private readonly passengers: PassengersService,
    private readonly passengerPoints: PassengerPointsService,
  ) {}

  /** 發 OTP 前：是否已有此電話的乘客會員（有＝登入叫車；無＝OTP 後註冊） */
  async checkPhone(rawPhone: string) {
    const phone = normalizePhoneE164(rawPhone);
    const existing = await this.passengers.findActiveByPhone(phone);
    return {
      ok: true as const,
      phone,
      registered: Boolean(existing),
    };
  }

  /** 內測：設 PASSENGER_PHONE_LOGIN_ENABLED=false 關閉（恢復 Firebase OTP） */
  private phoneLoginWithoutOtpEnabled(): boolean {
    return process.env.PASSENGER_PHONE_LOGIN_ENABLED !== 'false';
  }

  private issuePassengerSession(passenger: PassengerEntity) {
    const token = this.jwt.sign(
      { sub: passenger.id, typ: 'passenger' },
      { secret: process.env.JWT_SECRET, expiresIn: PASSENGER_JWT_EXPIRES_IN },
    );
    const decoded = this.jwt.decode(token) as { exp?: number } | null;
    const expiresAt =
      decoded?.exp != null ? new Date(decoded.exp * 1000).toISOString() : null;

    return {
      token,
      expiresAt,
      passenger: {
        id: passenger.id,
        phone: passenger.phone,
        displayName: passenger.displayName,
      },
    };
  }

  /** 暫停 OTP：以電話查 DB，有則登入、無則 registerLogin 建立乘客 */
  async loginWithPhoneOnly(rawPhone: string, appClientId: string) {
    if (!this.phoneLoginWithoutOtpEnabled()) {
      throw new ForbiddenException('Passenger phone login is disabled');
    }
    if (!appClientId?.trim()) throw new BadRequestException('appClientId is required');
    const passenger = await this.passengers.registerLoginWithPhoneAndAppClientId(
      rawPhone,
      appClientId,
    );
    return this.issuePassengerSession(passenger);
  }

  async loginWithFirebase(idToken: string, appClientId: string) {
    if (!appClientId?.trim()) throw new BadRequestException('appClientId is required');
    const { phone: firebasePhone } = await this.firebase.verifyIdToken(idToken);
    const passenger = await this.passengers.registerLoginWithPhoneAndAppClientId(
      firebasePhone,
      appClientId,
    );
    return this.issuePassengerSession(passenger);
  }

  async getProfile(passengerId: string, appClientId?: string) {
    if (appClientId?.trim()) {
      await this.passengers.bindAppClientIdToVerifiedPassenger(passengerId, appClientId);
    }
    const row = await this.passengers.findActiveById(passengerId);
    if (!row?.phone?.trim()) throw new UnauthorizedException('請先完成電話驗證');
    const [pointsBalance, pointsHkdPerPoint, pointsRedeemEnabled] = await Promise.all([
      Promise.resolve(Math.round(Number(row.pointsBalance ?? 0))),
      this.passengerPoints.getHkdPerPoint(),
      this.passengerPoints.isPointsRedeemEnabled(),
    ]);
    return {
      id: row.id,
      phone: row.phone,
      displayName: row.displayName,
      pointsBalance,
      pointsHkdPerPoint,
      pointsRedeemEnabled,
    };
  }

}
