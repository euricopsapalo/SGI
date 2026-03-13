import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    @HttpCode(200)
    login(@Body() body: { email: string; password: string }) {
        return this.authService.login(body.email, body.password);
    }

    @Post('forgot-password')
    @HttpCode(200)
    forgotPassword(@Body() body: { email: string }) {
        return this.authService.forgotPassword(body.email);
    }

    @Post('reset-password')
    @HttpCode(200)
    resetPassword(@Body() body: { token: string; newPassword: string }) {
        return this.authService.resetPassword(body.token, body.newPassword);
    }

    @Post('change-password')
    @HttpCode(200)
    changePassword(@Body() body: { userId: number; currentPassword: string; newPassword: string }) {
        return this.authService.changePassword(body.userId, body.currentPassword, body.newPassword);
    }
}
