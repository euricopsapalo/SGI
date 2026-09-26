import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Check, Index, Unique, CreateDateColumn,
} from 'typeorm';
import { DocumentoConfig } from '../vendas-config/documento-config.entity';
import { Serie } from '../vendas-config/serie.entity';
import { ContaBancaria } from '../vendas-config/conta-bancaria.entity';
import { ModoPagamento } from '../tabelas-sistema/modo-pagamento.entity';

export enum OrigemMovimentoConta {
    LIQUIDACAO = 'LIQUIDACAO',
}

/**
 * #166 — Movimento em conta (`MC` — v10 §6.4.1).
 *
 * Nunca é criado manualmente: nasce da liquidação (ligação a tesouraria), na
 * mesma transacção. É um documento configurado com série própria. O modo de
 * pagamento **qualifica** o movimento; a conta foi escolhida pelo utilizador.
 * `valor` tem sinal: entradas positivas, saídas negativas.
 */
@Entity('movimentos_conta')
@Unique('uq_movimentos_conta_serie_numero', ['serieId', 'numero'])
@Index('idx_movimentos_conta_conta', ['contaBancariaId'])
@Index('idx_movimentos_conta_origem', ['origemTipo', 'origemId'])
@Check('chk_movimentos_conta_origem', `"origem_tipo" IN ('LIQUIDACAO')`)
@Check('chk_movimentos_conta_valor', `"valor" <> 0`)
export class MovimentoConta {
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

    @ManyToOne(() => ContaBancaria, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'conta_bancaria_id' })
    contaBancaria: ContaBancaria;

    @Column({ name: 'conta_bancaria_id' })
    contaBancariaId: number;

    @Column({ name: 'origem_tipo', type: 'varchar', length: 30 })
    origemTipo: OrigemMovimentoConta;

    @Column({ name: 'origem_id', type: 'int' })
    origemId: number;

    @Column({ type: 'numeric', precision: 14, scale: 2 })
    valor: number;

    @ManyToOne(() => ModoPagamento, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'modo_pagamento_id' })
    modoPagamento: ModoPagamento;

    @Column({ name: 'modo_pagamento_id', type: 'int', nullable: true })
    modoPagamentoId: number | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
