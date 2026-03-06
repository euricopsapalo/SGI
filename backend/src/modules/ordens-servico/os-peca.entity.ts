import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { OrdemDeServico } from './ordem-de-servico.entity';
import { Equipamento } from '../equipamentos/equipamento.entity';

@Entity('os_pecas')
export class OsPeca {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => OrdemDeServico, (os) => os.pecasUtilizadas, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id_os' })
    ordemServico: OrdemDeServico;

    @ManyToOne(() => Equipamento, (e) => e.osPecas, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'id_equipamento' })
    equipamento: Equipamento;

    @Column({ type: 'int', default: 1 })
    quantidade: number;

    @Column({ name: 'preco_unitario', type: 'numeric', precision: 10, scale: 2 })
    precoUnitario: number;
}
