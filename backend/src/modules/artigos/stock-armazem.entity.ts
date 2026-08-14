import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, Check, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Artigo } from './artigo.entity';
import { Armazem } from '../armazens/armazem.entity';

@Entity('stock_armazem')
@Unique(['artigo', 'armazem'])
// #35 — quantidade por armazém nunca negativa.
@Check('chk_stock_armazem_qtd_nn', `"quantidade" >= 0`)
export class StockArmazem {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Artigo, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'artigo_id' })
    artigo: Artigo;

    @ManyToOne(() => Armazem, { nullable: false, eager: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'armazem_id' })
    armazem: Armazem;

    @Column({ type: 'numeric', precision: 12, scale: 3, default: 0 })
    quantidade: number;

    @Column({ name: 'stock_minimo', type: 'numeric', precision: 12, scale: 3, default: 0 })
    stockMinimo: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
