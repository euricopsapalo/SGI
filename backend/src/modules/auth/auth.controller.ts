import { Controller, Post, Get, Body, HttpCode, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { TwoFactorCodeDto } from './dto/two-factor-code.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    // Anti brute-force: 5 tentativas/min por IP (issue #41)
    @ApiOperation({ summary: 'Autenticar utilizador (email + password; código 2FA se aplicável)' })
    @ApiResponse({ status: 200, description: 'Token JWT emitido, ou { twoFactorRequired: true } se faltar o código 2FA.' })
    @ApiResponse({ status: 401, description: 'Credenciais inválidas ou código 2FA incorreto.' })
    @ApiResponse({ status: 429, description: 'Demasiadas tentativas (limite 5/min).' })
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Public()
    @Post('login')
    @HttpCode(200)
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto.email, dto.password, dto.code);
    }

    @ApiOperation({ summary: 'Pedir recuperação de password (envia código por email)' })
    @ApiResponse({ status: 200, description: 'Se o email existir, é enviado um código de recuperação.' })
    // Anti-abuso: 5 pedidos/hora por IP (issue #25)
    @Throttle({ default: { limit: 5, ttl: 3600000 } })
    @Public()
    @Post('forgot-password')
    @HttpCode(200)
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto.email);
    }

    @ApiOperation({ summary: 'Redefinir password com o token de recuperação' })
    @ApiResponse({ status: 200, description: 'Password redefinida.' })
    @ApiResponse({ status: 400, description: 'Token inválido/expirado ou password abaixo do mínimo.' })
    @Public()
    @Post('reset-password')
    @HttpCode(200)
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto.token, dto.newPassword);
    }

    @ApiOperation({ summary: 'Alterar a password do utilizador autenticado' })
    @ApiResponse({ status: 200, description: 'Password alterada.' })
    @ApiBearerAuth('access-token')
    @Post('change-password')
    @HttpCode(200)
    changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
        return this.authService.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
    }

    @ApiOperation({ summary: 'Perfil do utilizador autenticado (inclui vínculo a técnico, se aplicável)' })
    @ApiBearerAuth('access-token')
    @Post('me')
    @HttpCode(200)
    async getProfile(@Request() req: any) {
        // Issue #65: incluir tecnicoId/tecnicoNome (caso o user esteja vinculado)
        const tec = await this.authService.resolveTecnicoLink(req.user.id ?? req.user.sub);
        return { user: { ...req.user, tecnicoId: tec?.id, tecnicoNome: tec?.nome } };
    }

    // ── 2FA TOTP (issue #100) — enrolamento opt-in por utilizador ──────────
    @ApiOperation({ summary: 'Estado do 2FA da conta autenticada' })
    @ApiBearerAuth('access-token')
    @Get('2fa/status')
    twoFactorStatus(@Request() req: any) {
        return this.authService.twoFactorStatus(req.user.id ?? req.user.sub);
    }

    @ApiOperation({ summary: 'Iniciar enrolamento 2FA (devolve segredo + URI otpauth)' })
    @ApiBearerAuth('access-token')
    @Post('2fa/setup')
    @HttpCode(200)
    twoFactorSetup(@Request() req: any) {
        return this.authService.setupTwoFactor(req.user.id ?? req.user.sub);
    }

    @ApiOperation({ summary: 'Ativar 2FA confirmando um código do authenticator' })
    @ApiBearerAuth('access-token')
    @Post('2fa/enable')
    @HttpCode(200)
    twoFactorEnable(@Request() req: any, @Body() dto: TwoFactorCodeDto) {
        return this.authService.enableTwoFactor(req.user.id ?? req.user.sub, dto.code);
    }

    @ApiOperation({ summary: 'Desativar 2FA na conta autenticada' })
    @ApiBearerAuth('access-token')
    @Post('2fa/disable')
    @HttpCode(200)
    twoFactorDisable(@Request() req: any, @Body() dto: TwoFactorCodeDto) {
        return this.authService.disableTwoFactor(req.user.id ?? req.user.sub, dto.code);
    }
}
