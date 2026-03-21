import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Artigo } from './artigo.entity';
import { Armazem } from '../armazens/armazem.entity';

@Entity('stock_armazem')
@Unique(['artigo', 'armazem'])
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
}
