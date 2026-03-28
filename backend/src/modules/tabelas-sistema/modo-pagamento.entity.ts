import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('modos_pagamento')
export class ModoPagamento {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 20 })
    movimento: string;

    @Column({ length: 200 })
    descricao: string;
}
