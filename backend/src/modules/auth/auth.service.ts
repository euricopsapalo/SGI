import { Injectable, Logger, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly jwtService: JwtService,
        private readonly mailService: MailService,
    ) {}

    async login(email: string, password: string) {
        const user = await this.userRepo.findOne({ where: { email } });
        if (!user || !user.ativo) throw new UnauthorizedException('Credenciais inválidas.');
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) throw new UnauthorizedException('Credenciais inválidas.');
        // Issue #65: enriquecer com tecnicoId se o user é técnico de campo
        const tec = await this.resolveTecnicoLink(user.id);
        const payload = { sub: user.id, email: user.email, role: user.role, nome: user.nome, tecnicoId: tec?.id };
        return {
            access_token: this.jwtService.sign(payload),
            user: { id: user.id, nome: user.nome, email: user.email, role: user.role, tecnicoId: tec?.id, tecnicoNome: tec?.nome },
        };
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
        const hash = await bcrypt.hash(newPassword, 10);
        await this.userRepo.update(user.id, { passwordHash: hash, resetToken: null, resetTokenExpiry: null });
        return { message: 'Password alterada com sucesso.' };
    }

    async changePassword(userId: number, currentPassword: string, newPassword: string) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('Utilizador não encontrado.');
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) throw new BadRequestException('Password atual incorreta.');
        const hash = await bcrypt.hash(newPassword, 10);
        await this.userRepo.update(userId, { passwordHash: hash });
        return { message: 'Password alterada com sucesso.' };
    }
}
