import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Check, Index, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { CcTipo, CcEstado } from '../vendas-config/conta-corrente.entity';
import { Cliente } from '../clientes/cliente.entity';
import { ModoPagamento } from '../tabelas-sistema/modo-pagamento.entity';

export enum OrigemMovimentoCc {
    DOCUMENTO_VENDA = 'DOCUMENTO_VENDA',
}

/**
 * #165 — Movimento de conta corrente (v10 §2.2, v11 §7.1).
 *
 * Nunca é criado manualmente: nasce da emissão de um documento com
 * `gera_mov_cc`. `valor_pendente` começa igual ao original e é reduzido pelas
 * liquidações (fase 3) e estornos (fase 6); nunca fica negativo.
 */
@Entity('movimentos_cc')
@Index('idx_movimentos_cc_cliente', ['clienteId'])
@Index('uq_movimentos_cc_origem', ['origemTipo', 'origemId'], { unique: true })
@Check('chk_movimentos_cc_origem', `"origem_tipo" IN ('DOCUMENTO_VENDA')`)
@Check('chk_movimentos_cc_natureza', `"natureza" IN ('D','C')`)
@Check('chk_movimentos_cc_valores', `"valor_original" > 0 AND "valor_pendente" >= 0 AND "valor_pendente" <= "valor_original"`)
export class MovimentoCc {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => CcTipo, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'cc_tipo_id' })
    ccTipo: CcTipo;

    @Column({ name: 'cc_tipo_id' })
    ccTipoId: number;

    @ManyToOne(() => CcEstado, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'cc_estado_id' })
    ccEstado: CcEstado;

    @Column({ name: 'cc_estado_id' })
    ccEstadoId: number;

    @ManyToOne(() => Cliente, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'cliente_id' })
    cliente: Cliente;

    @Column({ name: 'cliente_id' })
    clienteId: number;

    @Column({ name: 'origem_tipo', type: 'varchar', length: 30 })
    origemTipo: OrigemMovimentoCc;

    @Column({ name: 'origem_id', type: 'int' })
    origemId: number;

    /** `D` débito (a receber do cliente) · `C` crédito. */
    @Column({ type: 'varchar', length: 1 })
    natureza: 'D' | 'C';

    @Column({ name: 'valor_original', type: 'numeric', precision: 14, scale: 2 })
    valorOriginal: number;

    @Column({ name: 'valor_pendente', type: 'numeric', precision: 14, scale: 2 })
    valorPendente: number;

    @ManyToOne(() => ModoPagamento, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'modo_pagamento_id' })
    modoPagamento: ModoPagamento;

    @Column({ name: 'modo_pagamento_id', type: 'int', nullable: true })
    modoPagamentoId: number | null;

    @Column({ name: 'data_documento', type: 'date' })
    dataDocumento: string;

    @Column({ name: 'data_vencimento', type: 'date' })
    dataVencimento: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
