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

@Entity('clientes')
export class Cliente {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 200 })
    nome: string;

    @Column({ nullable: true, length: 20 })
    nif: string;

    @Column({ nullable: true, length: 200 })
    email: string;

    @Column({ nullable: true, length: 30 })
    telefone: string;

    @Column({ type: 'text', nullable: true })
    morada: string;

    @CreateDateColumn({ name: 'data_criacao' })
    dataCriacao: Date;

    @OneToMany(() => MaquinaInstalada, (m) => m.cliente)
    maquinasInstaladas: MaquinaInstalada[];

    @OneToMany(() => OrdemDeServico, (os) => os.cliente)
    ordensServico: OrdemDeServico[];

    @OneToMany(() => Fatura, (f) => f.cliente)
    faturas: Fatura[];
}
