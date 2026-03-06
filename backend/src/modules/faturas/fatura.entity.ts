import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { OrdemDeServico } from '../ordens-servico/ordem-de-servico.entity';
import { Cliente } from '../clientes/cliente.entity';

export enum EstadoFatura {
    PENDENTE = 'pendente',
    PAGA = 'paga',
}

@Entity('faturas')
export class Fatura {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => OrdemDeServico, (os) => os.faturas, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'id_os' })
    ordemServico: OrdemDeServico;

    @ManyToOne(() => Cliente, (c) => c.faturas, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'id_cliente' })
    cliente: Cliente;

    @CreateDateColumn({ name: 'data_emissao' })
    dataEmissao: Date;

    @Column({ name: 'valor_total', type: 'numeric', precision: 10, scale: 2 })
    valorTotal: number;

    @Column({ type: 'enum', enum: EstadoFatura, default: EstadoFatura.PENDENTE })
    estado: EstadoFatura;

    @Column({ type: 'text', nullable: true })
    observacoes: string;
}
