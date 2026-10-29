import { Global, Module } from '@nestjs/common';
import { AdminMailService } from './admin-mail.service';
import { OneSignalDriverService } from './onesignal-driver.service';
import { OneSignalPassengerService } from './onesignal-passenger.service';
import { PassengerPushInboxModule } from './passenger-push-inbox.module';

@Global()
@Module({
  imports: [PassengerPushInboxModule],
  providers: [AdminMailService, OneSignalDriverService, OneSignalPassengerService],
  exports: [AdminMailService, OneSignalDriverService, OneSignalPassengerService, PassengerPushInboxModule],
})
export class NotificationsModule {}
