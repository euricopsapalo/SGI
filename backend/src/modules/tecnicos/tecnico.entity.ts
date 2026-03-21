import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Comissao } from '../comissoes/comissao.entity';

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

    @Column({ name: 'funcao_id', nullable: true })
    funcaoId: number;

    @Column({ name: 'custo_hora', type: 'numeric', precision: 12, scale: 2, default: 0 })
    custoHora: number;

    @Column({ default: true })
    ativo: boolean;

    @Column({ name: 'provincia_id', nullable: true })
    provinciaId: number;

    @Column({ name: 'municipio_id', nullable: true })
    municipioId: number;

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

    @OneToMany(() => Comissao, (c) => c.tecnico)
    comissoes: Comissao[];
}
