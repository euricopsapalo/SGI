import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';

@ApiTags('health')
@Controller('health')
@SkipThrottle()
export class HealthController {
    @Public()
    @Get()
    check() {
        return { status: 'ok' };
    }
}
