import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    OneToMany,
} from 'typeorm';
import { MaquinaInstalada } from '../maquinas-instaladas/maquina-instalada.entity';
import { OrdemDeServico } from '../ordens-servico/ordem-de-servico.entity';
import { Fatura } from '../faturas/fatura.entity';
import { ClienteEndereco } from './cliente-endereco.entity';

export enum TipoCliente {
    EMPRESA = 'empresa',
    PARTICULAR = 'particular',
}

@Entity('clientes')
export class Cliente {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'enum', enum: TipoCliente, default: TipoCliente.EMPRESA })
    tipo: TipoCliente;

    @Column({ length: 200 })
    nome: string;

    @Column({ nullable: true, length: 20 })
    nif: string;

    @Column({ nullable: true, length: 200 })
    email: string;

    @Column({ nullable: true, length: 30 })
    telefone: string;

    @CreateDateColumn({ name: 'data_criacao' })
    dataCriacao: Date;

    @OneToMany(() => ClienteEndereco, (e) => e.cliente, { cascade: true, eager: true })
    enderecos: ClienteEndereco[];

    @OneToMany(() => MaquinaInstalada, (m) => m.cliente)
    maquinasInstaladas: MaquinaInstalada[];

    @OneToMany(() => OrdemDeServico, (os) => os.cliente)
    ordensServico: OrdemDeServico[];

    @OneToMany(() => Fatura, (f) => f.cliente)
    faturas: Fatura[];
}
