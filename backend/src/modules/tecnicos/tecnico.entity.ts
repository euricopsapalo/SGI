import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { OrdemDeServico } from '../ordens-servico/ordem-de-servico.entity';
import { Comissao } from '../comissoes/comissao.entity';

export enum TipoTecnico {
    SUPORTE = 'suporte',
    CAMPO = 'campo',
}

@Entity('tecnicos')
export class Tecnico {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 150 })
    nome: string;

    @Column({ nullable: true, length: 200 })
    email: string;

    @Column({ nullable: true, length: 30 })
    telefone: string;

    @Column({ type: 'enum', enum: TipoTecnico })
    tipo: TipoTecnico;

    @Column({
        name: 'comissao_por_servico',
        type: 'numeric',
        precision: 10,
        scale: 2,
        default: 0,
    })
    comissaoPorServico: number;

    @OneToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'id_user' })
    user: User;

    @OneToMany(() => OrdemDeServico, (os) => os.tecnicoCampo)
    ordensCampo: OrdemDeServico[];

    @OneToMany(() => OrdemDeServico, (os) => os.tecnicoSuporte)
    ordensSuporte: OrdemDeServico[];

    @OneToMany(() => Comissao, (c) => c.tecnico)
    comissoes: Comissao[];
}
