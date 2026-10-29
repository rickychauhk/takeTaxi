import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AdminAuditInterceptor } from './common/admin-audit.interceptor';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AdsModule } from './modules/ads/ads.module';
import { AiModule } from './modules/ai/ai.module';
import { AuditModule } from './modules/audit/audit.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { FeedbacksModule } from './modules/feedbacks/feedbacks.module';
import { HealthModule } from './modules/health/health.module';
import { LocationsModule } from './modules/locations/locations.module';
import { MapsModule } from './modules/maps/maps.module';
import { MessagesModule } from './modules/messages/messages.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DriverPointPackagesModule } from './modules/driver-point-packages/driver-point-packages.module';
import { PointTopupsModule } from './modules/point-topups/point-topups.module';
import { PromosModule } from './modules/promos/promos.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SettingsModule } from './modules/settings/settings.module';
import { DriverAuthModule } from './modules/driver-auth/driver-auth.module';
import { PassengerAuthModule } from './modules/passenger-auth/passenger-auth.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { PassengersModule } from './modules/passengers/passengers.module';
import { BookingOptionsModule } from './modules/booking-options/booking-options.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MobileAppReleasesModule } from './modules/mobile-app-releases/mobile-app-releases.module';
import { OrderChatModule } from './modules/order-chat/order-chat.module';
import { LostPropertyModule } from './modules/lost-property/lost-property.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DATABASE_HOST ?? '127.0.0.1',
      port: Number(process.env.DATABASE_PORT ?? 3306),
      username: process.env.DATABASE_USER ?? 'taxima',
      password: process.env.DATABASE_PASSWORD ?? '',
      database: process.env.DATABASE_NAME ?? 'taxima_uat',
      autoLoadEntities: true,
      synchronize: false,
      timezone: 'Z',
      charset: 'utf8mb4',
    }),
    HealthModule,
    AuditModule,
    AdminAuthModule,
    SettingsModule,
    FeedbacksModule,
    MessagesModule,
    PromosModule,
    AdsModule,
    DriversModule,
    DriverAuthModule,
    PassengersModule,
    PassengerAuthModule,
    DocumentsModule,
    DriverPointPackagesModule,
    PointTopupsModule,
    OrdersModule,
    RatingsModule,
    LocationsModule,
    MapsModule,
    AiModule,
    PaymentsModule,
    RealtimeModule,
    BookingOptionsModule,
    NotificationsModule,
    MobileAppReleasesModule,
    OrderChatModule,
    LostPropertyModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AdminAuditInterceptor }],
})
export class AppModule {}
