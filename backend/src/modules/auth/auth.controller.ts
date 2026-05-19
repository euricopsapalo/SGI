import { Controller, Post, Body, HttpCode, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @Post('login')
    @HttpCode(200)
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto.email, dto.password);
    }

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
}
