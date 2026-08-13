import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToOne,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { FuncaoTecnico } from '../tabelas-sistema/funcao-tecnico.entity';

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

    // #36 — relação para a Função Técnico (init.sql: ON DELETE SET NULL).
    @ManyToOne(() => FuncaoTecnico, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'funcao_id' })
    funcao: FuncaoTecnico;

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

    /**
     * Issue #65: vínculo 1:1 obrigatório com User (role 'campo').
     * Todo Tecnico = técnico de campo, e precisa de conta de acesso.
     */
    @OneToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'id_user' })
    user: User;

    @Column({ name: 'id_user' })
    userId: number;
}
