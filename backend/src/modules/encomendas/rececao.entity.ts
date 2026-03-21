import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Encomenda } from './encomenda.entity';

@Entity('rececoes')
export class Rececao {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Encomenda, (e) => e.rececoes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'encomenda_id' })
    encomenda: Encomenda;

    @Column({ name: 'data_hora', type: 'timestamptz', default: () => 'NOW()' })
    dataHora: Date;

    @Column({ length: 150 })
    operador: string;

    @Column({ length: 100 })
    armazem: string;

    @Column({ name: 'guia_remessa', length: 100 })
    guiaRemessa: string;

    @Column({ length: 20, default: 'Ativa' })
    estado: string;

    @Column({ nullable: true, type: 'text' })
    observacoes: string;

    @OneToMany(() => RececaoItem, (item) => item.rececao, { cascade: true, eager: true })
    itens: RececaoItem[];
}

@Entity('rececao_itens')
export class RececaoItem {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Rececao, (r) => r.itens, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'rececao_id' })
    rececao: Rececao;

    @Column({ name: 'artigo_id', nullable: true })
    artigoId: string;

    @Column({ length: 50 })
    codigo: string;

    @Column({ length: 300 })
    descricao: string;

    @Column({ type: 'numeric', precision: 12, scale: 3 })
    qtd: number;

    @Column({ length: 20, default: 'UN' })
    unidade: string;
}
