import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Check } from 'typeorm';
import { Cliente } from '../clientes/cliente.entity';
import { ModeloEquipamento } from './modelo-equipamento.entity';

export enum EstadoEquip {
    ATIVO = 'ativo',
    COM_PROBLEMA = 'com_problema',
    INATIVO = 'inativo',
}

@Entity('equip_instalados')
@Check('chk_equip_inst_estado', `"estado" IN ('ativo','com_problema','inativo')`)
export class EquipInstalado {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Cliente, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'cliente_id' })
    cliente: Cliente;

    @ManyToOne(() => ModeloEquipamento, (m) => m.equipInstalados, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'modelo_id' })
    modelo: ModeloEquipamento;

    @Column({ name: 'nr_serie', length: 100 })
    nrSerie: string;

    @Column({ name: 'data_instalacao', type: 'date' })
    dataInstalacao: string;

    @Column({ type: 'varchar', length: 30, default: EstadoEquip.ATIVO })
    estado: EstadoEquip;

    @Column({ name: 'data_ultima_manutencao', type: 'date', nullable: true })
    dataUltimaManutencao: string;

    @Column({ name: 'data_proxima_manutencao', type: 'date', nullable: true })
    dataProximaManutencao: string;

    @Column({ nullable: true, length: 200 })
    localizacao: string;
}
