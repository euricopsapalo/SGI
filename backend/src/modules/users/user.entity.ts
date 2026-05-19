import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToOne,
} from 'typeorm';

export enum UserRole {
    ADMIN = 'admin',
    SUPORTE = 'suporte',         // legado: mantido para compatibilidade
    COORDENADOR = 'coordenador', // novo: coordenador de intervenções (RF-OT-002/issue #65)
    CAMPO = 'campo',             // técnico de campo (vinculado a Tecnico 1:1 obrigatório)
    VENDEDOR = 'vendedor',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 150 })
    nome: string;

    @Column({ unique: true, length: 200 })
    email: string;

    @Column({ name: 'password_hash', length: 255 })
    passwordHash: string;

    @Column({ type: 'enum', enum: UserRole, default: UserRole.CAMPO })
    role: UserRole;

    @Column({ default: true })
    ativo: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @Column({ name: 'reset_token', nullable: true, length: 20 })
    resetToken: string;

    @Column({ name: 'reset_token_expiry', type: 'timestamp', nullable: true })
    resetTokenExpiry: Date;
}
