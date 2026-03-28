import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('condicoes_pagamento')
export class CondicaoPagamento {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 200 })
    descricao: string;

    @Column({ name: 'num_dias', default: 0 })
    numDias: number;

    @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
    desconto: number;
}
