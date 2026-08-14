import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { PlanoManutencao } from './plano-manutencao.entity';
import { Artigo } from '../artigos/artigo.entity';

@Entity('plano_artigos')
export class PlanoArtigo {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => PlanoManutencao, (p) => p.artigos, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'plano_id' })
    plano: PlanoManutencao;

    // #36 — relação para o Artigo (init.sql: ON DELETE RESTRICT).
    @ManyToOne(() => Artigo, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'artigo_id' })
    artigo: Artigo;

    @Column({ name: 'artigo_id', nullable: true })
    artigoId: number;

    @Column({ type: 'numeric', precision: 12, scale: 3, default: 1 })
    quantidade: number;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    preco: number;
}
