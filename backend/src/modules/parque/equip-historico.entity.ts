import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { EquipInstalado } from './equip-instalado.entity';

@Entity('equip_historico')
export class EquipHistorico {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => EquipInstalado, (e) => e.historico, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'equip_id' })
    equip: EquipInstalado;

    @Column({ type: 'text' })
    descricao: string;

    @Column({ name: 'estado_anterior', nullable: true, length: 30 })
    estadoAnterior: string;

    @Column({ name: 'estado_novo', nullable: true, length: 30 })
    estadoNovo: string;

    @Column({ nullable: true, length: 200 })
    usuario: string;

    @CreateDateColumn({ name: 'data' })
    data: Date;
}
