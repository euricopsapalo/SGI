import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Encomenda } from './encomenda.entity';

@Entity('encomenda_linhas')
export class EncomendaLinha {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Encomenda, (e) => e.linhas, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'encomenda_id' })
    encomenda: Encomenda;

    @Column({ name: 'artigo_id', nullable: true })
    artigoId: number;

    @Column({ length: 50 })
    codigo: string;

    @Column({ length: 300 })
    descricao: string;

    @Column({ name: 'qtd_encomendada', type: 'numeric', precision: 12, scale: 3, default: 0 })
    qtdEncomendada: number;

    @Column({ name: 'qtd_recebida', type: 'numeric', precision: 12, scale: 3, default: 0 })
    qtdRecebida: number;

    @Column({ length: 20, default: 'UN' })
    unidade: string;

    @Column({ name: 'custo_unit', type: 'numeric', precision: 12, scale: 2, default: 0 })
    custoUnit: number;

    @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
    desconto: number;

    @Column({ name: 'codigo_iva', length: 20, nullable: true })
    codigoIva: string;

    @Column({ name: 'taxa_iva', type: 'numeric', precision: 5, scale: 2, default: 0 })
    taxaIva: number;
}
