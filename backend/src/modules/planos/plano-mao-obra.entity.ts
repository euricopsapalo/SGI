import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { PlanoManutencao } from './plano-manutencao.entity';
import { FuncaoTecnico } from '../tabelas-sistema/funcao-tecnico.entity';

@Entity('plano_maos_obra')
export class PlanoMaoObra {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => PlanoManutencao, (p) => p.maosObra, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'plano_id' })
    plano: PlanoManutencao;

    // #36 — relação para a Função Técnico (init.sql: ON DELETE SET NULL).
    @ManyToOne(() => FuncaoTecnico, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'funcao_id' })
    funcao: FuncaoTecnico;

    @Column({ name: 'funcao_id', nullable: true })
    funcaoId: number;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    custo: number;
}
