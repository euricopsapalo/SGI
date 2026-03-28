import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn } from 'typeorm';
import { Fornecedor } from '../fornecedores/fornecedor.entity';
import { LinhaFaturaFornecedor } from './linha-fatura-fornecedor.entity';

@Entity('faturas_fornecedor')
export class FaturaFornecedor {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Fornecedor, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'fornecedor_id' })
    fornecedor: Fornecedor;

    @Column({ name: 'id_encomenda', nullable: true })
    idEncomenda: number;

    @Column({ name: 'tipo_documento', length: 10 })
    tipoDocumento: string;

    @Column({ name: 'num_fatura_externo', length: 50 })
    numFaturaExterno: string;

    @Column({ name: 'data_emissao', type: 'date' })
    dataEmissao: string;

    @Column({ name: 'data_vencimento', type: 'date', nullable: true })
    dataVencimento: string;

    @CreateDateColumn({ name: 'data_registo_sistema' })
    dataRegistoSistema: Date;

    @Column({ name: 'total_liquido', type: 'numeric', precision: 18, scale: 2, default: 0 })
    totalLiquido: number;

    @Column({ name: 'total_iva', type: 'numeric', precision: 18, scale: 2, default: 0 })
    totalIva: number;

    @Column({ name: 'total_retencao', type: 'numeric', precision: 18, scale: 2, default: 0 })
    totalRetencao: number;

    @Column({ name: 'total_final', type: 'numeric', precision: 18, scale: 2, default: 0 })
    totalFinal: number;

    @Column({ length: 3, default: 'AOA' })
    moeda: string;

    @Column({ name: 'taxa_cambio', type: 'numeric', precision: 18, scale: 6, default: 1.0 })
    taxaCambio: number;

    @Column({ name: 'estado_pagamento', length: 20, default: 'Pendente' })
    estadoPagamento: string;

    @Column({ name: 'condicao_pagamento_id', nullable: true })
    condicaoPagamentoId: number;

    @Column({ name: 'modo_pagamento_id', nullable: true })
    modoPagamentoId: number;

    @Column({ nullable: true, type: 'text' })
    observacoes: string;

    @Column({ nullable: true, type: 'text' })
    descricao: string;

    @OneToMany(() => LinhaFaturaFornecedor, (l) => l.fatura, { cascade: true })
    linhas: LinhaFaturaFornecedor[];
}
