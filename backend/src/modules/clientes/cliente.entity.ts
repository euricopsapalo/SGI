import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    OneToMany,
    Check,
} from 'typeorm';
import { ClienteEndereco } from './cliente-endereco.entity';

export enum TipoCliente {
    EMPRESA = 'empresa',
    PARTICULAR = 'particular',
}

@Entity('clientes')
@Check('chk_clientes_tipo', `"tipo" IN ('empresa','particular')`)
export class Cliente {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 30, default: TipoCliente.EMPRESA })
    tipo: TipoCliente;

    @Column({ length: 200 })
    nome: string;

    @Column({ nullable: true, length: 20 })
    nif: string;

    @Column({ nullable: true, length: 200 })
    email: string;

    @Column({ nullable: true, length: 30 })
    telefone: string;

    @Column({ default: true })
    ativo: boolean;

    @Column({ name: 'condicao_pagamento_id', nullable: true })
    condicaoPagamentoId: number;

    @Column({ name: 'modo_pagamento_id', nullable: true })
    modoPagamentoId: number;

    @CreateDateColumn({ name: 'data_criacao' })
    dataCriacao: Date;

    @OneToMany(() => ClienteEndereco, (e) => e.cliente, { cascade: true, eager: true })
    enderecos: ClienteEndereco[];
}
