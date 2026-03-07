import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Cliente } from './cliente.entity';

@Entity('cliente_enderecos')
export class ClienteEndereco {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100, nullable: true })
    descricao: string;

    @Column({ type: 'text' })
    morada: string;

    @Column({ length: 100 })
    cidade: string;

    @Column({ default: false })
    principal: boolean;

    @ManyToOne(() => Cliente, (c) => c.enderecos, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'cliente_id' })
    cliente: Cliente;

    @Column({ name: 'cliente_id' })
    clienteId: number;
}
