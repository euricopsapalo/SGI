import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fornecedores')
export class Fornecedor {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 200 })
    nome: string;

    @Column({ nullable: true, length: 20 })
    nif: string;

    @Column({ nullable: true, length: 30 })
    telefone: string;

    @Column({ nullable: true, length: 200 })
    email: string;

    @Column({ nullable: true, length: 300 })
    morada: string;

    @Column({ default: true })
    ativo: boolean;

    @Column({ name: 'provincia_id', nullable: true })
    provinciaId: number;

    @Column({ name: 'municipio_id', nullable: true })
    municipioId: number;

    @Column({ name: 'condicao_pagamento_id', nullable: true })
    condicaoPagamentoId: number;

    @Column({ name: 'modo_pagamento_id', nullable: true })
    modoPagamentoId: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
