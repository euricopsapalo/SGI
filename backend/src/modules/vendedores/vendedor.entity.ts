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

@Entity('vendedores')
export class Vendedor {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 150 })
    nome: string;

    @Column({ nullable: true, length: 200 })
    email: string;

    @Column({
        name: 'comissao_percentagem',
        type: 'numeric',
        precision: 5,
        scale: 2,
        default: 0,
    })
    comissaoPercentagem: number;

    @OneToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'id_user' })
    user: User;

    @OneToMany(() => OrdemDeServico, (os) => os.vendedor)
    ordensServico: OrdemDeServico[];

    @OneToMany(() => Comissao, (c) => c.vendedor)
    comissoes: Comissao[];
}
