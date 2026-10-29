import { Body, Controller, Get, Post, Put, Req, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { AdminAuthGuard } from '../../common/admin-auth.guard';
import type { GeminiImageModelKey } from './gemini-models';
import { GeminiService } from './gemini.service';

class PutGeminiApiKeyDto {
  @IsString()
  apiKey!: string;
}

class AnalyzeImageDto {
  @IsOptional()
  @IsIn(['flash', 'flash-lite', 'pro'])
  model?: GeminiImageModelKey;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  prompt?: string;
}

@Controller()
@UseGuards(AdminAuthGuard)
export class GeminiAdminController {
  constructor(private readonly gemini: GeminiService) {}

  @Get('admin/ai/gemini/config')
  config() {
    return this.gemini.getConfigForAdmin();
  }

  @Put('admin/ai/gemini/api-key')
  async setApiKey(@Body() dto: PutGeminiApiKeyDto, @Req() req: { admin: { sub: number } }) {
    await this.gemini.setApiKey(req.admin.sub, dto.apiKey);
    return this.gemini.getConfigForAdmin();
  }

  @Post('admin/ai/gemini/analyze-image')
  analyze(@Body() dto: AnalyzeImageDto) {
    return this.gemini.analyzeImageForAdmin(dto);
  }
}
