import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { FaturaNew } from './fatura-new.entity';

@Entity('fatura_linhas')
export class FaturaLinha {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => FaturaNew, (f) => f.linhas, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'fatura_id' })
    fatura: FaturaNew;

    @Column({ length: 300 })
    descricao: string;

    @Column({ type: 'numeric', precision: 12, scale: 3, default: 1 })
    quantidade: number;

    @Column({ name: 'preco_unit', type: 'numeric', precision: 12, scale: 2, default: 0 })
    precoUnit: number;
}
