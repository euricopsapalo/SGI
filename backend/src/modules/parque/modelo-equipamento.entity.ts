import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Check } from 'typeorm';
import { EquipInstalado } from './equip-instalado.entity';

export enum TipoModelo {
    MAQUINA = 'maquina',
    FILTRO = 'filtro',
}

@Entity('modelos_equipamento')
@Check('chk_modelos_tipo', `"tipo" IN ('maquina','filtro')`)
export class ModeloEquipamento {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 200 })
    nome: string;

    @Column({ length: 100 })
    marca: string;

    @Column({ type: 'varchar', length: 30, default: TipoModelo.MAQUINA })
    tipo: TipoModelo;

    @OneToMany(() => EquipInstalado, (e) => e.modelo)
    equipInstalados: EquipInstalado[];
}
