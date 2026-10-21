import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Check,
} from 'typeorm';

export enum UserRole {
    ADMIN = 'admin',
    SUPORTE = 'suporte',         // legado: mantido para compatibilidade
    COORDENADOR = 'coordenador', // novo: coordenador de intervenções (RF-OT-002/issue #65)
    CAMPO = 'campo',             // técnico de campo (vinculado a Tecnico 1:1 obrigatório)
    VENDEDOR = 'vendedor',
}

@Entity('users')
@Check('chk_users_role', `"role" IN ('admin','suporte','coordenador','campo','vendedor')`)
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 150 })
    nome: string;

    @Column({ unique: true, length: 200 })
    email: string;

    @Column({ name: 'password_hash', length: 255 })
    passwordHash: string;

    @Column({ type: 'varchar', length: 30, default: UserRole.CAMPO })
    role: UserRole;

    @Column({ default: true })
    ativo: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @Column({ name: 'reset_token', nullable: true, length: 100 })
    resetToken: string;

    @Column({ name: 'reset_token_expiry', type: 'timestamp', nullable: true })
    resetTokenExpiry: Date;

    // --- 2FA TOTP (issue #100) ---
    /** Segredo base32 do TOTP; presente após o setup (mesmo antes de ativar). */
    @Column({ name: 'two_factor_secret', nullable: true, length: 64 })
    twoFactorSecret: string;

    /** 2FA ativo para esta conta (exige código TOTP no login). */
    @Column({ name: 'two_factor_enabled', type: 'boolean', default: false })
    twoFactorEnabled: boolean;
}
