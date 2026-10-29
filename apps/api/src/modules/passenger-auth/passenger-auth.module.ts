import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassengerAuthGuard } from '../../common/passenger-auth.guard';
import { FirebaseTokenService } from '../admin-auth/firebase-token.service';
import { PassengerEntity } from '../passengers/passenger.entity';
import { PassengersModule } from '../passengers/passengers.module';
import { PassengerAuthController } from './passenger-auth.controller';
import { PassengerAuthService } from './passenger-auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([PassengerEntity]), PassengersModule, JwtModule.register({})],
  controllers: [PassengerAuthController],
  providers: [PassengerAuthService, FirebaseTokenService, PassengerAuthGuard],
  exports: [PassengerAuthService, PassengerAuthGuard, JwtModule],
})
export class PassengerAuthModule {}
