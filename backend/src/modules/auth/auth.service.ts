import { Injectable, Logger, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { ConfiguracaoService } from '../configuracao/configuracao.service';
import { generateSecret, otpauthUri, verifyTotp } from './totp.util';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly jwtService: JwtService,
        private readonly mailService: MailService,
        private readonly configService: ConfiguracaoService,
    ) {}

    async login(email: string, password: string, code?: string) {
        const user = await this.userRepo.findOne({ where: { email } });
        if (!user || !user.ativo) throw new UnauthorizedException('Credenciais inválidas.');
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) throw new UnauthorizedException('Credenciais inválidas.');

        // 2FA (issue #100): se a conta tem 2FA ativo, exige código TOTP válido
        if (user.twoFactorEnabled && user.twoFactorSecret) {
            if (!code) return { twoFactorRequired: true };
            if (!verifyTotp(user.twoFactorSecret, code)) {
                throw new UnauthorizedException('Código de verificação inválido.');
            }
        }

        // Issue #65: enriquecer com tecnicoId se o user é técnico de campo
        const tec = await this.resolveTecnicoLink(user.id);
        const payload = { sub: user.id, email: user.email, role: user.role, nome: user.nome, tecnicoId: tec?.id };
        return {
            access_token: this.jwtService.sign(payload, { expiresIn: await this.sessionExpiry() }),
            user: { id: user.id, nome: user.nome, email: user.email, role: user.role, tecnicoId: tec?.id, tecnicoNome: tec?.nome },
        };
    }

    /** Duração da sessão (em segundos) a partir da configuração (issue #100); 0/ausente => 8h. */
    private async sessionExpiry(): Promise<number> {
        const cfg = await this.configService.get();
        const mins = Number(cfg.sessionExpiryMinutes);
        return mins && mins > 0 ? mins * 60 : 8 * 3600;
    }

    /** Aplica a política de comprimento mínimo de password (issue #100). */
    private async assertPasswordPolicy(password: string): Promise<void> {
        const cfg = await this.configService.get();
        const min = Number(cfg.minPasswordLength) || 8;
        if (!password || password.length < min) {
            throw new BadRequestException(`A password tem de ter pelo menos ${min} caracteres.`);
        }
    }

    // ── 2FA TOTP (issue #100) ──────────────────────────────────────────────
    /** Gera (ou regenera) o segredo TOTP para o utilizador; ainda não ativa. */
    async setupTwoFactor(userId: number) {
        const cfg = await this.configService.get();
        if (!cfg.twoFactorEnabled) {
            throw new BadRequestException('A autenticação de dois fatores está desativada nas Configurações.');
        }
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('Utilizador não encontrado.');
        const secret = generateSecret();
        await this.userRepo.update(userId, { twoFactorSecret: secret, twoFactorEnabled: false });
        return { secret, otpauthUri: otpauthUri(secret, user.email, 'SGI AQUATEX') };
    }

    /** Confirma o código do authenticator e ativa o 2FA da conta. */
    async enableTwoFactor(userId: number, code: string) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('Utilizador não encontrado.');
        if (!user.twoFactorSecret) throw new BadRequestException('Execute o setup do 2FA primeiro.');
        if (!verifyTotp(user.twoFactorSecret, code)) throw new BadRequestException('Código inválido.');
        await this.userRepo.update(userId, { twoFactorEnabled: true });
        return { message: '2FA ativado com sucesso.' };
    }

    /** Desativa o 2FA, exigindo um código válido para confirmar a posse do dispositivo. */
    async disableTwoFactor(userId: number, code: string) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('Utilizador não encontrado.');
        if (user.twoFactorEnabled && user.twoFactorSecret && !verifyTotp(user.twoFactorSecret, code)) {
            throw new BadRequestException('Código inválido.');
        }
        await this.userRepo.update(userId, { twoFactorSecret: null, twoFactorEnabled: false });
        return { message: '2FA desativado.' };
    }

    /** Estado do 2FA da conta (para a UI). */
    async twoFactorStatus(userId: number) {
        const [user, cfg] = await Promise.all([
            this.userRepo.findOne({ where: { id: userId } }),
            this.configService.get(),
        ]);
        return { enabled: !!user?.twoFactorEnabled, allowed: !!cfg.twoFactorEnabled };
    }

    /** Issue #65: devolve {id, nome} do Tecnico vinculado, ou null. */
    async resolveTecnicoLink(userId: number): Promise<{ id: number; nome: string } | null> {
        const rows = await this.userRepo.query(
            `SELECT id, nome FROM tecnicos WHERE id_user = $1 LIMIT 1`, [userId],
        );
        return rows[0] ?? null;
    }

    async forgotPassword(email: string) {
        const user = await this.userRepo.findOne({ where: { email } });
        // Always return the same message to avoid exposing which emails exist
        if (!user) return { message: 'Se o email existir, receberá as instruções de recuperação.' };
        const token = Math.random().toString(36).substring(2, 10).toUpperCase();
        const expiry = new Date(Date.now() + 3600000); // 1 hour
        await this.userRepo.update(user.id, { resetToken: token, resetTokenExpiry: expiry });
        try {
            await this.mailService.sendPasswordReset(user.email, user.nome, token);
        } catch {
            // SMTP não configurado: registar token nos logs para desenvolvimento
            this.logger.warn(`[DEV] Token de recuperação para ${user.email}: ${token}`);
        }
        return { message: 'Se o email existir, receberá as instruções de recuperação.' };
    }

    async resetPassword(token: string, newPassword: string) {
        const user = await this.userRepo.findOne({ where: { resetToken: token } });
        if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
            throw new BadRequestException('Token inválido ou expirado.');
        }
        await this.assertPasswordPolicy(newPassword);
        const hash = await bcrypt.hash(newPassword, 10);
        await this.userRepo.update(user.id, { passwordHash: hash, resetToken: null, resetTokenExpiry: null });
        return { message: 'Password alterada com sucesso.' };
    }

    async changePassword(userId: number, currentPassword: string, newPassword: string) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('Utilizador não encontrado.');
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) throw new BadRequestException('Password atual incorreta.');
        await this.assertPasswordPolicy(newPassword);
        const hash = await bcrypt.hash(newPassword, 10);
        await this.userRepo.update(userId, { passwordHash: hash });
        return { message: 'Password alterada com sucesso.' };
    }
}
