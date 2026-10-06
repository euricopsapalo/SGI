import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Check, Index, Unique, CreateDateColumn, Relation,
} from 'typeorm';
import { SessaoCaixa } from './sessao-caixa.entity';
import { DocumentoConfig } from '../vendas-config/documento-config.entity';
import { Serie } from '../vendas-config/serie.entity';
import { ContaBancaria } from '../vendas-config/conta-bancaria.entity';
import { ModoPagamento } from '../tabelas-sistema/modo-pagamento.entity';

export enum OrigemMovimentoConta {
    LIQUIDACAO = 'LIQUIDACAO',
    /** #167 — saída de caixa (`SDC`); `origem_id` = sessão de caixa. */
    SAIDA_CAIXA = 'SAIDA_CAIXA',
    /** #167 — acerto de sobra/quebra no fecho (`ACS`/`ACQ`); `origem_id` = sessão de caixa. */
    ACERTO_CAIXA = 'ACERTO_CAIXA',
}

/**
 * #166 — Movimento em conta (`MC` — v10 §6.4.1).
 *
 * Nunca é criado manualmente: nasce da liquidação (ligação a tesouraria), na
 * mesma transacção. É um documento configurado com série própria. O modo de
 * pagamento **qualifica** o movimento; a conta foi escolhida pelo utilizador.
 * `valor` tem sinal: entradas positivas, saídas negativas.
 *
 * #167 — Numa caixa, todo o movimento pertence à sessão aberta no momento
 * (`sessao_caixa_id`). A saída de caixa e os acertos do fecho são também
 * movimentos em conta, emitidos com o documento respectivo (`SDC`, `ACS`/`ACQ`).
 */
@Entity('movimentos_conta')
@Unique('uq_movimentos_conta_serie_numero', ['serieId', 'numero'])
@Index('idx_movimentos_conta_conta', ['contaBancariaId'])
@Index('idx_movimentos_conta_origem', ['origemTipo', 'origemId'])
@Index('idx_movimentos_conta_sessao', ['sessaoCaixaId'])
@Check('chk_movimentos_conta_origem', `"origem_tipo" IN ('LIQUIDACAO','SAIDA_CAIXA','ACERTO_CAIXA')`)
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

    @ManyToOne(() => SessaoCaixa, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'sessao_caixa_id' })
    sessaoCaixa: Relation<SessaoCaixa>;

    /** #167 — sessão de caixa em que o movimento entrou (só contas do tipo caixa). */
    @Column({ name: 'sessao_caixa_id', type: 'int', nullable: true })
    sessaoCaixaId: number | null;

    /** #167 — motivo da saída de caixa / descrição do acerto. */
    @Column({ type: 'varchar', length: 300, nullable: true })
    descricao: string | null;

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
