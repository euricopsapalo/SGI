import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { EquipInstalado } from '../parque/equip-instalado.entity';
import { PlanoMaoObra } from './plano-mao-obra.entity';
import { PlanoArtigo } from './plano-artigo.entity';

@Entity('planos_manutencao')
export class PlanoManutencao {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => EquipInstalado, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'equip_instalado_id' })
    equipInstalado: EquipInstalado;

    @Column({ type: 'text' })
    descricao: string;

    @Column({ name: 'tipo_trabalho_id', nullable: true })
    tipoTrabalhoId: number;

    @Column({ length: 30 })
    periodicidade: string;

    @Column({ name: 'previsao_tempo', type: 'numeric', precision: 6, scale: 2, default: 0 })
    previsaoTempo: number;

    @Column({ default: true })
    ativo: boolean;

    @OneToMany(() => PlanoMaoObra, (m) => m.plano, { cascade: true })
    maosObra: PlanoMaoObra[];

    @OneToMany(() => PlanoArtigo, (a) => a.plano, { cascade: true })
    artigos: PlanoArtigo[];
}
