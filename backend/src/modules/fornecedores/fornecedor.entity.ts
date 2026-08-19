import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Provincia } from '../tabelas-sistema/provincia.entity';
import { Municipio } from '../tabelas-sistema/municipio.entity';
import { CondicaoPagamento } from '../tabelas-sistema/condicao-pagamento.entity';
import { ModoPagamento } from '../tabelas-sistema/modo-pagamento.entity';

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

    // #36 — geografia e pagamento são lookups sem FK no init.sql; relações
    // aditivas (ON DELETE SET NULL) mantendo os escalares para o shape do frontend.
    @ManyToOne(() => Provincia, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'provincia_id' })
    provincia: Provincia;

    @Column({ name: 'provincia_id', nullable: true })
    provinciaId: number;

    @ManyToOne(() => Municipio, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'municipio_id' })
    municipio: Municipio;

    @Column({ name: 'municipio_id', nullable: true })
    municipioId: number;

    @ManyToOne(() => CondicaoPagamento, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'condicao_pagamento_id' })
    condicaoPagamento: CondicaoPagamento;

    @Column({ name: 'condicao_pagamento_id', nullable: true })
    condicaoPagamentoId: number;

    @ManyToOne(() => ModoPagamento, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'modo_pagamento_id' })
    modoPagamento: ModoPagamento;

    @Column({ name: 'modo_pagamento_id', nullable: true })
    modoPagamentoId: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
