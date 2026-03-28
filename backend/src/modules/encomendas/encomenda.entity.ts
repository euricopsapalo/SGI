import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn } from 'typeorm';
import { Fornecedor } from '../fornecedores/fornecedor.entity';
import { EncomendaLinha } from './encomenda-linha.entity';
import { Rececao } from './rececao.entity';

export enum EstadoEncomenda {
    ABERTA = 'Aberta',
    PARCIAL = 'Parcial',
    RECEBIDA = 'Recebida',
    CANCELADA = 'Cancelada',
    FATURADA = 'Faturada',
}

@Entity('encomendas')
export class Encomenda {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 30 })
    numero: string;

    @ManyToOne(() => Fornecedor, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'fornecedor_id' })
    fornecedor: Fornecedor;

    @Column({ type: 'date' })
    data: string;

    @Column({ name: 'data_entrega', type: 'date', nullable: true })
    dataEntrega: string;

    @Column({ name: 'condicoes_pagamento', nullable: true, length: 100 })
    condicoesPagamento: string;

    @Column({ nullable: true, length: 150 })
    responsavel: string;

    @Column({ length: 10, default: 'AOA' })
    moeda: string;

    @Column({ nullable: true, type: 'text' })
    descricao: string;

    @Column({ nullable: true, type: 'text' })
    observacoes: string;

    @Column({ type: 'enum', enum: EstadoEncomenda, default: EstadoEncomenda.ABERTA })
    estado: EstadoEncomenda;

    @OneToMany(() => EncomendaLinha, (l) => l.encomenda, { cascade: true })
    linhas: EncomendaLinha[];

    @OneToMany(() => Rececao, (r) => r.encomenda)
    rececoes: Rececao[];
}
