import { Controller, Post, Get, Body, HttpCode, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TwoFactorCodeDto } from './dto/two-factor-code.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    // Anti brute-force: 5 tentativas/min por IP (issue #41)
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Public()
    @Post('login')
    @HttpCode(200)
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto.email, dto.password, dto.code);
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Public()
    @Post('forgot-password')
    @HttpCode(200)
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto.email);
    }

    @Public()
    @Post('reset-password')
    @HttpCode(200)
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto.token, dto.newPassword);
    }

    @Post('change-password')
    @HttpCode(200)
    changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
        return this.authService.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
    }

    @Post('me')
    @HttpCode(200)
    async getProfile(@Request() req: any) {
        // Issue #65: incluir tecnicoId/tecnicoNome (caso o user esteja vinculado)
        const tec = await this.authService.resolveTecnicoLink(req.user.id ?? req.user.sub);
        return { user: { ...req.user, tecnicoId: tec?.id, tecnicoNome: tec?.nome } };
    }

    // ── 2FA TOTP (issue #100) — enrolamento opt-in por utilizador ──────────
    @Get('2fa/status')
    twoFactorStatus(@Request() req: any) {
        return this.authService.twoFactorStatus(req.user.id ?? req.user.sub);
    }

    @Post('2fa/setup')
    @HttpCode(200)
    twoFactorSetup(@Request() req: any) {
        return this.authService.setupTwoFactor(req.user.id ?? req.user.sub);
    }

    @Post('2fa/enable')
    @HttpCode(200)
    twoFactorEnable(@Request() req: any, @Body() dto: TwoFactorCodeDto) {
        return this.authService.enableTwoFactor(req.user.id ?? req.user.sub, dto.code);
    }

    @Post('2fa/disable')
    @HttpCode(200)
    twoFactorDisable(@Request() req: any, @Body() dto: TwoFactorCodeDto) {
        return this.authService.disableTwoFactor(req.user.id ?? req.user.sub, dto.code);
    }
}
