import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { DocumentsModule } from '../documents/documents.module';
import { SettingsModule } from '../settings/settings.module';
import { AiController } from './ai.controller';
import { GeminiAdminController } from './gemini-admin.controller';
import { GeminiService } from './gemini.service';

@Module({
  imports: [AdminAuthModule, SettingsModule, DocumentsModule],
  controllers: [AiController, GeminiAdminController],
  providers: [GeminiService],
  exports: [GeminiService],
})
export class AiModule {}
