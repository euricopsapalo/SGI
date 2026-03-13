import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { PlanoManutencao } from './plano-manutencao.entity';

@Entity('plano_maos_obra')
export class PlanoMaoObra {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => PlanoManutencao, (p) => p.maosObra, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'plano_id' })
    plano: PlanoManutencao;

    @Column({ name: 'funcao_id', nullable: true })
    funcaoId: number;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    custo: number;
}
