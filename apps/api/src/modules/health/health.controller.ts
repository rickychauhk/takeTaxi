import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      ok: true,
      env: process.env.TAXIMA_ENV ?? 'unknown',
      ts: new Date().toISOString(),
    };
  }
}
