import { Entity, PrimaryGeneratedColumn, Column, Check, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * #164 — Conta bancária ou caixa (v10 §2.3). `aberta` só tem significado para
 * caixas e é gerida pela gestão de caixa (#167), nunca pelo CRUD.
 * Moeda fixa em `AOA` nesta fase (multi-moeda fora de âmbito).
 */
@Entity('contas_bancarias')
@Check('chk_contas_bancarias_tipo', `"tipo" IN ('CAIXA','DO')`)
export class ContaBancaria {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 20, unique: true })
    codigo: string;

    @Column({ length: 150 })
    descricao: string;

    @Column({ type: 'varchar', length: 30 })
    tipo: 'CAIXA' | 'DO';

    @Column({ length: 10, default: 'AOA' })
    moeda: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    banco: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    numero: string | null;

    @Column({ type: 'varchar', length: 50, nullable: true })
    iban: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    agencia: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    titular: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    gestor: string | null;

    @Column({ type: 'varchar', length: 150, nullable: true })
    contactos: string | null;

    @Column({ default: false })
    aberta: boolean;

    @Column({ default: true })
    ativo: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
