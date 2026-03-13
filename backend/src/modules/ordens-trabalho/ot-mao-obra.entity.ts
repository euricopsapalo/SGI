import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { OrdemTrabalho } from './ordem-trabalho.entity';

@Entity('ot_maos_obra')
export class OtMaoObra {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => OrdemTrabalho, (ot) => ot.maosObra, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ot_id' })
    ordemTrabalho: OrdemTrabalho;

    @Column({ length: 100 })
    funcao: string;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    custo: number;

    @Column({ nullable: true, length: 10 })
    hora: string;
}
