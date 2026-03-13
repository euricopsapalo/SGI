import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { EquipInstalado } from './equip-instalado.entity';

export enum TipoModelo {
    MAQUINA = 'maquina',
    FILTRO = 'filtro',
}

@Entity('modelos_equipamento')
export class ModeloEquipamento {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 200 })
    nome: string;

    @Column({ length: 100 })
    marca: string;

    @Column({ type: 'enum', enum: TipoModelo, default: TipoModelo.MAQUINA })
    tipo: TipoModelo;

    @OneToMany(() => EquipInstalado, (e) => e.modelo)
    equipInstalados: EquipInstalado[];
}
