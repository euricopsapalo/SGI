import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { MovimentoStock } from './movimento-stock.entity';

@Entity('artigos')
export class Artigo {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 50 })
    codigo: string;

    @Column({ length: 300 })
    descricao: string;

    @Column({ length: 100 })
    classe: string;

    @Column({ length: 100 })
    familia: string;

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

    @Column({ default: false })
    inativo: boolean;

    @Column({ default: false })
    critico: boolean;

    @Column({ nullable: true, type: 'text' })
    observacao: string;

    @OneToMany(() => MovimentoStock, (m) => m.artigo)
    movimentos: MovimentoStock[];
}
