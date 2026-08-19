import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    OneToMany,
    ManyToOne,
    JoinColumn,
    Check,
} from 'typeorm';
import { ClienteEndereco } from './cliente-endereco.entity';
import { CondicaoPagamento } from '../tabelas-sistema/condicao-pagamento.entity';
import { ModoPagamento } from '../tabelas-sistema/modo-pagamento.entity';

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

    // #36 — condições/modos de pagamento são lookups sem FK no init.sql;
    // relação aditiva (ON DELETE SET NULL) mantendo o escalar para o shape do frontend.
    @ManyToOne(() => CondicaoPagamento, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'condicao_pagamento_id' })
    condicaoPagamento: CondicaoPagamento;

    @Column({ name: 'condicao_pagamento_id', nullable: true })
    condicaoPagamentoId: number;

    @ManyToOne(() => ModoPagamento, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'modo_pagamento_id' })
    modoPagamento: ModoPagamento;

    @Column({ name: 'modo_pagamento_id', nullable: true })
    modoPagamentoId: number;

    @CreateDateColumn({ name: 'data_criacao' })
    dataCriacao: Date;

    @OneToMany(() => ClienteEndereco, (e) => e.cliente, { cascade: true, eager: true })
    enderecos: ClienteEndereco[];
}
