import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Check, Index, Unique, CreateDateColumn,
} from 'typeorm';
import { DocumentoConfig } from '../vendas-config/documento-config.entity';
import { Serie } from '../vendas-config/serie.entity';
import { ContaBancaria } from '../vendas-config/conta-bancaria.entity';
import { Cliente } from '../clientes/cliente.entity';
import { User } from '../users/user.entity';
import { MovimentoCc } from '../vendas/movimento-cc.entity';

/**
 * #166 — Liquidação (`RE`, tipo Liquidações — v10 §6.1–6.3, v11 §5.4).
 *
 * Documento de contas correntes, sempre emitido (não tem rascunho): abate o
 * pendente de um ou mais movimentos de CC do mesmo cliente e, na mesma
 * transacção, emite o Movimento em conta da sua ligação a tesouraria.
 * O estorno (fase 6) é por documento inverso — a liquidação nunca se altera.
 */
@Entity('liquidacoes')
@Unique('uq_liquidacoes_serie_numero', ['serieId', 'numero'])
@Index('idx_liquidacoes_cliente', ['clienteId'])
@Check('chk_liquidacoes_totais', `"total" > 0 AND "desconto" >= 0`)
export class Liquidacao {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => DocumentoConfig, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'documento_config_id' })
    documentoConfig: DocumentoConfig;

    @Column({ name: 'documento_config_id' })
    documentoConfigId: number;

    @ManyToOne(() => Serie, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'serie_id' })
    serie: Serie;

    @Column({ name: 'serie_id' })
    serieId: number;

    @Column({ type: 'int' })
    numero: number;

    @Column({ name: 'data_hora', type: 'timestamptz' })
    dataHora: Date;

    @ManyToOne(() => Cliente, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'cliente_id' })
    cliente: Cliente;

    @Column({ name: 'cliente_id' })
    clienteId: number;

    /** Conta de destino, escolhida de entre os bancos associados ao `MC` (v10 §6.4.1). */
    @ManyToOne(() => ContaBancaria, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'conta_bancaria_id' })
    contaBancaria: ContaBancaria;

    @Column({ name: 'conta_bancaria_id' })
    contaBancariaId: number;

    /** Σ valor pago (o que entra na conta). */
    @Column({ type: 'numeric', precision: 14, scale: 2 })
    total: number;

    /** Σ desconto concedido na liquidação (abate o pendente, não entra na conta). */
    @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
    desconto: number;

    @Column({ length: 10, default: 'AOA' })
    moeda: string;

    @Column({ type: 'text', nullable: true })
    observacoes: string | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'emitido_por_id' })
    emitidoPor: User;

    @Column({ name: 'emitido_por_id', type: 'int', nullable: true })
    emitidoPorId: number | null;

    @OneToMany(() => LiquidacaoLinha, (l) => l.liquidacao, { cascade: true })
    linhas: LiquidacaoLinha[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}

/** #166 — Linha de liquidação: quanto se pagou (e descontou) de um movimento de CC. */
@Entity('liquidacoes_linhas')
@Index('idx_liquidacoes_linhas_liq', ['liquidacaoId'])
@Index('idx_liquidacoes_linhas_mov', ['movimentoCcId'])
@Check('chk_liquidacoes_linhas_valores', `"valor_pago" >= 0 AND "desconto" >= 0 AND "valor_pago" + "desconto" > 0`)
export class LiquidacaoLinha {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Liquidacao, (l) => l.linhas, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'liquidacao_id' })
    liquidacao: Liquidacao;

    @Column({ name: 'liquidacao_id' })
    liquidacaoId: number;

    @ManyToOne(() => MovimentoCc, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'movimento_cc_id' })
    movimentoCc: MovimentoCc;

    @Column({ name: 'movimento_cc_id' })
    movimentoCcId: number;

    @Column({ name: 'valor_pago', type: 'numeric', precision: 14, scale: 2 })
    valorPago: number;

    @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
    desconto: number;

    /** Pendente do movimento imediatamente antes desta liquidação (histórico / impressão). */
    @Column({ name: 'pendente_anterior', type: 'numeric', precision: 14, scale: 2 })
    pendenteAnterior: number;
}
