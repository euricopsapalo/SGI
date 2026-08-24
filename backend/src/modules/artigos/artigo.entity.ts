import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Check, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { MovimentoStock } from './movimento-stock.entity';

@Entity('artigos')
// #35 — stock e quantidades nunca negativos.
@Check('chk_artigos_stock_nn', `"existencia" >= 0 AND "stock_reservado" >= 0 AND "stock_encomendado" >= 0`)
// #31 — índices de performance (antes no init.sql).
@Index('idx_artigos_codigo', ['codigo'])
@Index('idx_artigos_armazem', ['codigoArmazem'])
export class Artigo {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 50 })
    codigo: string;

    @Column({ length: 300 })
    descricao: string;

    // #159 — classe/familia deixam de ser obrigatórias no registo de artigo.
    @Column({ length: 100, nullable: true })
    classe: string | null;

    @Column({ length: 100, nullable: true })
    familia: string | null;

    @Column({ nullable: true, type: 'text' })
    imagem: string;

    @Column({ name: 'preco_unitario', type: 'numeric', precision: 12, scale: 2, default: 0 })
    precoUnitario: number;

    @Column({ length: 10, default: 'AOA' })
    moeda: string;

    @Column({ type: 'numeric', precision: 12, scale: 3, default: 0 })
    existencia: number;

    @Column({ name: 'nivel_maximo', type: 'numeric', precision: 12, scale: 3, default: 0 })
    nivelMaximo: number;

    @Column({ name: 'stock_seguranca', type: 'numeric', precision: 12, scale: 3, default: 0 })
    stockSeguranca: number;

    @Column({ name: 'custo_medio', type: 'numeric', precision: 12, scale: 2, default: 0 })
    custoMedio: number;

    @Column({ name: 'codigo_armazem', length: 20, default: 'ARM-01' })
    codigoArmazem: string;

    @Column({ name: 'stock_reservado', type: 'numeric', precision: 12, scale: 3, default: 0 })
    stockReservado: number;

    @Column({ name: 'preco_custo', type: 'numeric', precision: 12, scale: 2, default: 0 })
    precoCusto: number;

    @Column({ name: 'stock_encomendado', type: 'numeric', precision: 12, scale: 3, default: 0 })
    stockEncomendado: number;

    @Column({ default: false })
    inativo: boolean;

    @Column({ default: false })
    critico: boolean;

    @Column({ nullable: true, type: 'text' })
    observacao: string;

    @Column({ name: 'codigo_iva', length: 20, nullable: true, default: null })
    codigoIva: string;

    @Column({ name: 'stock_inicial', type: 'numeric', precision: 12, scale: 3, default: 0 })
    stockInicial: number;

    @Column({ name: 'unidade_medida', length: 20, default: 'UN' })
    unidadeMedida: string;

    @Column({ name: 'ref_fornecedor', length: 100, nullable: true, default: null })
    refFornecedor: string;

    @Column({ name: 'data_ultima_entrada', type: 'timestamp', nullable: true, default: null })
    dataUltimaEntrada: Date;

    @Column({ name: 'data_ultima_saida', type: 'timestamp', nullable: true, default: null })
    dataUltimaSaida: Date;

    @OneToMany(() => MovimentoStock, (m) => m.artigo)
    movimentos: MovimentoStock[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
