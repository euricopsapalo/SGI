import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Check, Index, Unique,
    CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

/** #164 — Tipo de conta corrente (v10 §2.2). Ex.: `CCC` Conta Clientes. */
@Entity('cc_tipos')
@Check('chk_cc_tipos_entidade', `"entidade" IN ('CLIENTE','FORNECEDOR')`)
export class CcTipo {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 10, unique: true })
    codigo: string;

    @Column({ length: 150 })
    descricao: string;

    @Column({ type: 'varchar', length: 30 })
    entidade: 'CLIENTE' | 'FORNECEDOR';

    @OneToMany(() => CcEstado, (e) => e.ccTipo, { cascade: true })
    estados: CcEstado[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}

/** Estados possíveis de uma conta corrente, definidos por tipo de conta. Ex.: `PEN` Pendente. */
@Entity('cc_estados')
@Unique('uq_cc_estados_tipo_codigo', ['ccTipoId', 'codigo'])
@Index('idx_cc_estados_tipo', ['ccTipoId'])
export class CcEstado {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => CcTipo, (t) => t.estados, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'cc_tipo_id' })
    ccTipo: CcTipo;

    @Column({ name: 'cc_tipo_id' })
    ccTipoId: number;

    @Column({ length: 10 })
    codigo: string;

    @Column({ length: 150 })
    descricao: string;
}
