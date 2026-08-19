import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Check, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Cliente } from '../clientes/cliente.entity';
import { FaturaLinha } from './fatura-linha.entity';
import { OrdemTrabalho } from '../ordens-trabalho/ordem-trabalho.entity';

export enum EstadoFatura {
    PENDENTE = 'Pendente',
    PAGA = 'Paga',
    ANULADA = 'Anulada',
    EMITIDO = 'Emitido',
}

@Entity('faturas')
@Check('chk_faturas_estado', `"estado" IN ('Pendente','Paga','Anulada','Emitido')`)
// #35 — totais nunca negativos.
@Check('chk_faturas_totais_nn', `"valor_subtotal" >= 0 AND "valor_iva" >= 0 AND "valor_total" >= 0`)
// #35 — índice na FK da OT de origem (faturação por OT).
@Index('idx_faturas_ot', ['otId'])
// #31 — índices de performance (antes no init.sql).
@Index('idx_faturas_cliente', ['cliente'])
@Index('idx_faturas_estado', ['estado'])
export class Fatura {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'tipo_documento', length: 20, default: 'FAT' })
    tipoDocumento: string;

    // #36 — faturas.ot_id é INTEGER sem FK no init.sql; relação aditiva
    // (ON DELETE SET NULL) mantendo o escalar para o shape do frontend.
    @ManyToOne(() => OrdemTrabalho, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'ot_id' })
    ot: OrdemTrabalho;

    @Column({ name: 'ot_id', nullable: true })
    otId: number;

    @ManyToOne(() => Cliente, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'cliente_id' })
    cliente: Cliente;

    @Column({ name: 'data_emissao', type: 'date' })
    dataEmissao: string;

    @Column({ name: 'preco_servico', type: 'numeric', precision: 12, scale: 2, default: 0 })
    precoServico: number;

    @Column({ name: 'taxa_iva', type: 'numeric', precision: 5, scale: 2, default: 14 })
    taxaIva: number;

    @Column({ name: 'valor_subtotal', type: 'numeric', precision: 14, scale: 2, default: 0 })
    valorSubtotal: number;

    @Column({ name: 'valor_iva', type: 'numeric', precision: 14, scale: 2, default: 0 })
    valorIva: number;

    @Column({ name: 'valor_total', type: 'numeric', precision: 14, scale: 2, default: 0 })
    valorTotal: number;

    @Column({ length: 10, default: 'AOA' })
    moeda: string;

    @Column({ type: 'varchar', length: 30, default: EstadoFatura.PENDENTE })
    estado: EstadoFatura;

    @Column({ nullable: true, type: 'text' })
    observacoes: string;

    @Column({ name: 'data_pagamento', type: 'date', nullable: true })
    dataPagamento: string;

    @Column({ name: 'motivo_anulacao', nullable: true, type: 'text' })
    motivoAnulacao: string;

    @Column({ nullable: true, length: 200 })
    comprovativo: string;

    @Column({ name: 'nr_serie_equip', nullable: true, length: 100 })
    nrSerieEquip: string;

    @OneToMany(() => FaturaLinha, (l) => l.fatura, { cascade: true })
    linhas: FaturaLinha[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
