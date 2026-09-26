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

    /** #178 — impresso no bloco do cliente das faturas e recibos. */
    @Column({ name: 'codigo_postal', type: 'varchar', length: 20, nullable: true })
    codigoPostal: string | null;

    @Column({ default: false })
    principal: boolean;

    @Column({ name: 'provincia_id', nullable: true })
    provinciaId: number;

    @Column({ name: 'municipio_id', nullable: true })
    municipioId: number;

    @ManyToOne(() => Cliente, (c) => c.enderecos, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'cliente_id' })
    cliente: Cliente;

    @Column({ name: 'cliente_id' })
    clienteId: number;
}
