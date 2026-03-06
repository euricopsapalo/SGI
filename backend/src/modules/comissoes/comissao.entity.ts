import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { OrdemDeServico } from '../ordens-servico/ordem-de-servico.entity';
import { Tecnico } from '../tecnicos/tecnico.entity';
import { Vendedor } from '../vendedores/vendedor.entity';

export enum TipoComissao {
    TECNICO = 'tecnico',
    VENDEDOR = 'vendedor',
}

@Entity('comissoes')
export class Comissao {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => OrdemDeServico, (os) => os.comissoes, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'id_os' })
    ordemServico: OrdemDeServico;

    @ManyToOne(() => Tecnico, (t) => t.comissoes, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'id_tecnico' })
    tecnico: Tecnico;

    @ManyToOne(() => Vendedor, (v) => v.comissoes, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'id_vendedor' })
    vendedor: Vendedor;

    @Column({ type: 'enum', enum: TipoComissao })
    tipo: TipoComissao;

    @Column({ type: 'numeric', precision: 10, scale: 2 })
    valor: number;

    @CreateDateColumn()
    data: Date;
}
