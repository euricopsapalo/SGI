import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Check, Index, Unique,
    CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { DocumentoConfig } from '../vendas-config/documento-config.entity';
import { Serie } from '../vendas-config/serie.entity';
import { MotivoEstorno } from '../vendas-config/motivo-estorno.entity';
import { Cliente } from '../clientes/cliente.entity';
import { OrdemTrabalho } from '../ordens-trabalho/ordem-trabalho.entity';
import { OtArtigo } from '../ordens-trabalho/ot-artigo.entity';
import { Artigo } from '../artigos/artigo.entity';
import { ModoPagamento } from '../tabelas-sistema/modo-pagamento.entity';
import { User } from '../users/user.entity';
import type { SnapshotCliente, SnapshotEmpresa } from './snapshot';

export enum EstadoDocumentoVenda {
    RASCUNHO = 'RASCUNHO',
    EMITIDO = 'EMITIDO',
}

/**
 * #165 — Documento de venda (`FT`/`FR`/`NC`/`ND`) — v11 §4, §7.1.
 *
 * Nasce sempre de uma OT (D2). Em RASCUNHO não tem série, número nem data-hora:
 * a numeração é atribuída só na emissão (um rascunho abandonado não queima
 * números). Depois de EMITIDO é imutável (D6) — só se estorna (fase 6).
 *
 * Descontos em percentagem (linha e global); os valores monetários guardados
 * são o snapshot calculado na última gravação/emissão.
 */
@Entity('documentos_venda')
@Unique('uq_documentos_venda_serie_numero', ['serieId', 'numero'])
@Index('idx_documentos_venda_ot', ['otId'])
@Index('idx_documentos_venda_cliente', ['clienteId'])
@Index('idx_documentos_venda_estado', ['estado'])
@Check('chk_documentos_venda_estado', `"estado" IN ('RASCUNHO','EMITIDO')`)
@Check('chk_documentos_venda_numeracao', `("estado" = 'RASCUNHO' AND "numero" IS NULL AND "serie_id" IS NULL) OR ("estado" = 'EMITIDO' AND "numero" IS NOT NULL AND "serie_id" IS NOT NULL AND "data_hora" IS NOT NULL)`)
@Check('chk_documentos_venda_desconto', `"desconto_global" >= 0 AND "desconto_global" <= 100`)
@Check('chk_documentos_venda_totais_nn', `"subtotal" >= 0 AND "desconto" >= 0 AND "valor_iva" >= 0 AND "total" >= 0`)
export class DocumentoVenda {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => DocumentoConfig, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'documento_config_id' })
    documentoConfig: DocumentoConfig;

    @Column({ name: 'documento_config_id' })
    documentoConfigId: number;

    @ManyToOne(() => Serie, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'serie_id' })
    serie: Serie;

    @Column({ name: 'serie_id', type: 'int', nullable: true })
    serieId: number | null;

    @Column({ type: 'int', nullable: true })
    numero: number | null;

    @Column({ name: 'data_hora', type: 'timestamptz', nullable: true })
    dataHora: Date | null;

    @Column({ type: 'varchar', length: 30, default: EstadoDocumentoVenda.RASCUNHO })
    estado: EstadoDocumentoVenda;

    @ManyToOne(() => Cliente, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'cliente_id' })
    cliente: Cliente;

    @Column({ name: 'cliente_id' })
    clienteId: number;

    @ManyToOne(() => OrdemTrabalho, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'ot_id' })
    ot: OrdemTrabalho;

    @Column({ name: 'ot_id' })
    otId: number;

    /** NC/ND → documento estornado (fase 6). */
    @ManyToOne(() => DocumentoVenda, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'documento_origem_id' })
    documentoOrigem: DocumentoVenda;

    @Column({ name: 'documento_origem_id', type: 'int', nullable: true })
    documentoOrigemId: number | null;

    @ManyToOne(() => ModoPagamento, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'modo_pagamento_id' })
    modoPagamento: ModoPagamento;

    @Column({ name: 'modo_pagamento_id', type: 'int', nullable: true })
    modoPagamentoId: number | null;

    /** `OT-NNNNNN` + equipamento/n.º de série (v11 §4.2). */
    @Column({ type: 'varchar', length: 200, nullable: true })
    referencia: string | null;

    @Column({ type: 'text', nullable: true })
    observacoes: string | null;

    /** #178 — n.º de requisição/encomenda do cliente (impresso na fatura). */
    @Column({ type: 'varchar', length: 50, nullable: true })
    requisicao: string | null;

    /**
     * #178 — hash do documento (SHA-256, base64), gerado na emissão e encadeado
     * com o do documento anterior da mesma série. Mecanismo próprio do SGI, não
     * a assinatura certificada pela AGT (fora de âmbito — v11 §10).
     */
    @Column({ type: 'varchar', length: 64, nullable: true })
    hash: string | null;

    /** #178 — data em que os bens/serviços foram colocados à disposição (fim da OT). */
    @Column({ name: 'data_disposicao', type: 'date', nullable: true })
    dataDisposicao: string | null;

    /** #178 — cópia dos dados do cliente na emissão (a segunda via sai igual ao original). */
    @Column({ name: 'snapshot_cliente', type: 'jsonb', nullable: true })
    snapshotCliente: SnapshotCliente | null;

    /** #178 — cópia dos dados da empresa na emissão. */
    @Column({ name: 'snapshot_empresa', type: 'jsonb', nullable: true })
    snapshotEmpresa: SnapshotEmpresa | null;

    /** #178 — n.º de impressões: a 1.ª é o Original, as seguintes são Segunda via. */
    @Column({ type: 'int', default: 0 })
    impressoes: number;

    /** Desconto global em percentagem, aplicado depois dos descontos de linha. */
    @Column({ name: 'desconto_global', type: 'numeric', precision: 5, scale: 2, default: 0 })
    descontoGlobal: number;

    /** Σ total líquido das linhas (já com o desconto de linha). */
    @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
    subtotal: number;

    /** Valor do desconto global. */
    @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
    desconto: number;

    @Column({ name: 'valor_iva', type: 'numeric', precision: 14, scale: 2, default: 0 })
    valorIva: number;

    @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
    total: number;

    @Column({ length: 10, default: 'AOA' })
    moeda: string;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'criado_por_id' })
    criadoPor: User;

    @Column({ name: 'criado_por_id', type: 'int', nullable: true })
    criadoPorId: number | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'emitido_por_id' })
    emitidoPor: User;

    @Column({ name: 'emitido_por_id', type: 'int', nullable: true })
    emitidoPorId: number | null;

    @Column({ name: 'emitido_em', type: 'timestamptz', nullable: true })
    emitidoEm: Date | null;

    @OneToMany(() => DocumentoVendaLinha, (l) => l.documento, { cascade: true })
    linhas: DocumentoVendaLinha[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}

/**
 * #165 — Linha de documento de venda. Só consumíveis da OT (D4): cada linha
 * aponta para a `ot_artigos` de origem e copia descrição, quantidade, preço e IVA.
 */
@Entity('documentos_venda_linhas')
@Index('idx_documentos_venda_linhas_doc', ['documentoId'])
@Check('chk_dvl_quantidade', `"quantidade" > 0`)
@Check('chk_dvl_preco', `"preco_unitario" >= 0`)
@Check('chk_dvl_desconto', `"desconto" >= 0 AND "desconto" <= 100`)
@Check('chk_dvl_taxa_iva', `"taxa_iva" >= 0`)
@Check('chk_dvl_qtd_estornada', `"qtd_estornada" >= 0 AND "qtd_estornada" <= "quantidade"`)
export class DocumentoVendaLinha {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => DocumentoVenda, (d) => d.linhas, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'documento_id' })
    documento: DocumentoVenda;

    @Column({ name: 'documento_id' })
    documentoId: number;

    @ManyToOne(() => OtArtigo, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'ot_artigo_id' })
    otArtigo: OtArtigo;

    @Column({ name: 'ot_artigo_id', type: 'int', nullable: true })
    otArtigoId: number | null;

    @ManyToOne(() => Artigo, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'artigo_id' })
    artigo: Artigo;

    @Column({ name: 'artigo_id', type: 'int', nullable: true })
    artigoId: number | null;

    @Column({ length: 300 })
    descricao: string;

    @Column({ type: 'numeric', precision: 12, scale: 3 })
    quantidade: number;

    @Column({ name: 'preco_unitario', type: 'numeric', precision: 12, scale: 2 })
    precoUnitario: number;

    /** Desconto de linha em percentagem. */
    @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
    desconto: number;

    @Column({ name: 'codigo_iva', type: 'varchar', length: 20, nullable: true })
    codigoIva: string | null;

    @Column({ name: 'taxa_iva', type: 'numeric', precision: 5, scale: 2, default: 0 })
    taxaIva: number;

    /** quantidade × preço − desconto de linha (sem IVA). */
    @Column({ name: 'total_liquido', type: 'numeric', precision: 14, scale: 2, default: 0 })
    totalLiquido: number;

    /** Quantidade já estornada por NC (fase 6). */
    @Column({ name: 'qtd_estornada', type: 'numeric', precision: 12, scale: 3, default: 0 })
    qtdEstornada: number;

    /** NC → linha da FT estornada (fase 6). */
    @ManyToOne(() => DocumentoVendaLinha, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'linha_origem_id' })
    linhaOrigem: DocumentoVendaLinha;

    @Column({ name: 'linha_origem_id', type: 'int', nullable: true })
    linhaOrigemId: number | null;

    @ManyToOne(() => MotivoEstorno, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'motivo_estorno_id' })
    motivoEstorno: MotivoEstorno;

    @Column({ name: 'motivo_estorno_id', type: 'int', nullable: true })
    motivoEstornoId: number | null;

    @Column({ type: 'int', default: 0 })
    ordem: number;
}
