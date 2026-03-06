import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    JoinColumn,
} from 'typeorm';
import { Cliente } from '../clientes/cliente.entity';
import { Equipamento } from '../equipamentos/equipamento.entity';
import { OrdemDeServico } from '../ordens-servico/ordem-de-servico.entity';

export enum EstadoMaquina {
    ATIVA = 'ativa',
    COM_PROBLEMA = 'com_problema',
    DESATIVADA = 'desativada',
}

@Entity('maquinas_instaladas')
export class MaquinaInstalada {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Cliente, (c) => c.maquinasInstaladas, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'id_cliente' })
    cliente: Cliente;

    @ManyToOne(() => Equipamento, (e) => e.maquinasInstaladas, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'id_equipamento' })
    equipamentoCatalogo: Equipamento;

    @Column({ name: 'nr_serie', nullable: true, length: 100 })
    nrSerie: string;

    @Column({ name: 'data_instalacao', type: 'date' })
    dataInstalacao: Date;

    @Column({ name: 'data_ultima_manutencao', type: 'date', nullable: true })
    dataUltimaManutencao: Date;

    @Column({ name: 'data_proxima_manutencao', type: 'date', nullable: true })
    dataProximaManutencao: Date;

    @Column({ type: 'enum', enum: EstadoMaquina, default: EstadoMaquina.ATIVA })
    estado: EstadoMaquina;

    @OneToMany(() => OrdemDeServico, (os) => os.maquinaInstalada)
    ordensServico: OrdemDeServico[];
}
