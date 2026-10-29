import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { FeedbackEntity } from './feedback.entity';
import { FeedbacksController } from './feedbacks.controller';
import { FeedbacksService } from './feedbacks.service';

@Module({
  imports: [TypeOrmModule.forFeature([FeedbackEntity]), AdminAuthModule],
  controllers: [FeedbacksController],
  providers: [FeedbacksService],
})
export class FeedbacksModule {}
