import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { PlanoManutencao } from './plano-manutencao.entity';

@Entity('plano_artigos')
export class PlanoArtigo {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => PlanoManutencao, (p) => p.artigos, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'plano_id' })
    plano: PlanoManutencao;

    @Column({ name: 'artigo_id', nullable: true })
    artigoId: number;

    @Column({ type: 'numeric', precision: 12, scale: 3, default: 1 })
    quantidade: number;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    preco: number;
}
