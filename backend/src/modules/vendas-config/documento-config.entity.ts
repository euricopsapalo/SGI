import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, ManyToMany, JoinColumn, JoinTable, Index,
    CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { DocTipo } from './matriz.entity';
import { CcTipo, CcEstado } from './conta-corrente.entity';
import { ContaBancaria } from './conta-bancaria.entity';
import { Serie } from './serie.entity';

/**
 * #164 — Documento configurado pelo utilizador (v10 §1, v11 §3.4): `FT`, `FR`,
 * `NC`, `RE`, `MC`, … O comportamento resulta desta configuração, validada
 * contra a matriz de metadados (`MatrizService`). Os nomes das propriedades
 * configuráveis coincidem com `doc_campos.codigo`.
 *
 * Os domínios (natureza, tipo fiscal, entidade) NÃO têm CHECK na BD: são
 * definidos pela matriz (nível 3) e acrescentar um valor é uma linha de dados (R3).
 */
@Entity('documentos_config')
@Index('idx_documentos_config_tipo', ['tipoCodigo'])
export class DocumentoConfig {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 10, unique: true })
    codigo: string;

    @Column({ length: 150 })
    descricao: string;

    @ManyToOne(() => DocTipo, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'tipo_codigo' })
    tipo: DocTipo;

    @Column({ name: 'tipo_codigo', length: 30 })
    tipoCodigo: string;

    @Column({ type: 'varchar', length: 30, nullable: true })
    natureza: string | null;

    @Column({ name: 'entidade_permitida', type: 'varchar', length: 30, nullable: true })
    entidadePermitida: string | null;

    @Column({ name: 'tipo_fiscal', type: 'varchar', length: 30, nullable: true })
    tipoFiscal: string | null;

    @Column({ name: 'gera_mov_cc', default: false })
    geraMovCc: boolean;

    @Column({ name: 'opera_sobre_cc', default: false })
    operaSobreCc: boolean;

    @ManyToOne(() => CcTipo, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'cc_tipo_id' })
    ccTipo: CcTipo;

    @Column({ name: 'cc_tipo_id', type: 'int', nullable: true })
    ccTipoId: number | null;

    @ManyToOne(() => CcEstado, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'cc_estado_id' })
    ccEstado: CcEstado;

    @Column({ name: 'cc_estado_id', type: 'int', nullable: true })
    ccEstadoId: number | null;

    @Column({ name: 'ligacao_tesouraria', default: false })
    ligacaoTesouraria: boolean;

    @ManyToOne(() => DocumentoConfig, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'ligacao_tesouraria_doc_id' })
    ligacaoTesourariaDoc: DocumentoConfig;

    @Column({ name: 'ligacao_tesouraria_doc_id', type: 'int', nullable: true })
    ligacaoTesourariaDocId: number | null;

    @Column({ name: 'liquidacao_automatica', default: false })
    liquidacaoAutomatica: boolean;

    @ManyToOne(() => DocumentoConfig, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'liquidacao_auto_doc_id' })
    liquidacaoAutoDoc: DocumentoConfig;

    @Column({ name: 'liquidacao_auto_doc_id', type: 'int', nullable: true })
    liquidacaoAutoDocId: number | null;

    @Column({ default: false })
    estorno: boolean;

    @ManyToOne(() => DocumentoConfig, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'estorno_doc_id' })
    estornoDoc: DocumentoConfig;

    @Column({ name: 'estorno_doc_id', type: 'int', nullable: true })
    estornoDocId: number | null;

    @ManyToOne(() => Serie, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'estorno_serie_id' })
    estornoSerie: Serie;

    @Column({ name: 'estorno_serie_id', type: 'int', nullable: true })
    estornoSerieId: number | null;

    @ManyToOne(() => DocumentoConfig, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'acerto_sobra_doc_id' })
    acertoSobraDoc: DocumentoConfig;

    @Column({ name: 'acerto_sobra_doc_id', type: 'int', nullable: true })
    acertoSobraDocId: number | null;

    @ManyToOne(() => DocumentoConfig, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'acerto_quebra_doc_id' })
    acertoQuebraDoc: DocumentoConfig;

    @Column({ name: 'acerto_quebra_doc_id', type: 'int', nullable: true })
    acertoQuebraDocId: number | null;

    /** Bancos associados — universo de contas de destino possíveis (v10 §6.4.1). */
    @ManyToMany(() => ContaBancaria)
    @JoinTable({
        name: 'documentos_config_bancos',
        joinColumn: { name: 'documento_config_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'conta_bancaria_id', referencedColumnName: 'id' },
    })
    contas: ContaBancaria[];

    @OneToMany(() => Serie, (s) => s.documentoConfig)
    series: Serie[];

    @Column({ default: true })
    ativo: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
