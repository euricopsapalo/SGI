import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';

@Controller('health')
@SkipThrottle()
export class HealthController {
    @Public()
    @Get()
    check() {
        return { status: 'ok' };
    }
}
