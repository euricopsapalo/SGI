import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { FaturaFornecedor } from './fatura-fornecedor.entity';

@Entity('linhas_fatura_fornecedor')
export class LinhaFaturaFornecedor {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => FaturaFornecedor, (f) => f.linhas, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'fatura_id' })
    fatura: FaturaFornecedor;

    @Column({ name: 'produto_id', nullable: true })
    produtoId: number;

    @Column({ name: 'id_linha_encomenda', nullable: true })
    idLinhaEncomenda: number;

    @Column({ name: 'descricao_customizada', length: 255, nullable: true })
    descricaoCustomizada: string;

    @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
    quantidade: number;

    @Column({ name: 'unidade_venda', length: 10, default: 'UN' })
    unidadeVenda: string;

    @Column({ name: 'preco_unitario_net', type: 'numeric', precision: 18, scale: 2, default: 0 })
    precoUnitarioNet: number;

    @Column({ name: 'taxa_iva', type: 'numeric', precision: 5, scale: 2, default: 0 })
    taxaIva: number;

    @Column({ name: 'valor_iva', type: 'numeric', precision: 18, scale: 2, default: 0 })
    valorIva: number;

    @Column({ name: 'codigo_isencao', length: 10, nullable: true })
    codigoIsencao: string;

    @Column({ name: 'valor_total_linha', type: 'numeric', precision: 18, scale: 2, default: 0 })
    valorTotalLinha: number;
}
