import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Artigo } from './artigo.entity';

export enum TipoMovimento {
    ENTRADA = 'entrada',
    SAIDA = 'saida',
    AJUSTE = 'ajuste',
    TRANSFERENCIA = 'transferencia',
    DEVOLUCAO = 'devolucao',
}

@Entity('movimentos_stock')
export class MovimentoStock {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Artigo, (a) => a.movimentos, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'artigo_id' })
    artigo: Artigo;

    @Column({ type: 'enum', enum: TipoMovimento })
    tipo: TipoMovimento;

    @Column({ type: 'numeric', precision: 12, scale: 3 })
    quantidade: number;

    @Column({ name: 'armazem_id', nullable: true, length: 20 })
    armazemId: string;

    @Column({ name: 'armazem_destino_id', nullable: true, length: 20 })
    armazemDestinoId: string;

    @Column({ nullable: true, length: 100 })
    referencia: string;

    @Column({ nullable: true, length: 200 })
    usuario: string;

    @Column({ nullable: true, type: 'text' })
    observacao: string;

    @CreateDateColumn({ name: 'data' })
    data: Date;
}
