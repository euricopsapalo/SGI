import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany,
} from 'typeorm';
import { MaquinaInstalada } from '../maquinas-instaladas/maquina-instalada.entity';
import { OsPeca } from '../ordens-servico/os-peca.entity';

export enum TipoEquipamento {
    MAQUINA = 'maquina',
    FILTRO = 'filtro',
    PECA = 'peca',
    FILTRO_MAQUINA = 'filtro_maquina',
}

@Entity('equipamentos')
export class Equipamento {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 200 })
    nome: string;

    @Column({ type: 'enum', enum: TipoEquipamento })
    tipo: TipoEquipamento;

    @Column({ nullable: true, length: 100 })
    marca: string;

    @Column({ nullable: true, length: 100 })
    modelo: string;

    @Column({ name: 'nr_serie', nullable: true, length: 100 })
    nrSerie: string;

    @Column({ name: 'preco_venda', type: 'numeric', precision: 10, scale: 2, nullable: true })
    precoVenda: number;

    @Column({ name: 'quantidade_stock', type: 'int', default: 0 })
    quantidadeStock: number;

    @Column({ name: 'stock_minimo', type: 'int', default: 0 })
    stockMinimo: number;

    @Column({ default: true })
    ativo: boolean;

    @OneToMany(() => MaquinaInstalada, (m) => m.equipamentoCatalogo)
    maquinasInstaladas: MaquinaInstalada[];

    @OneToMany(() => OsPeca, (osp) => osp.equipamento)
    osPecas: OsPeca[];
}
