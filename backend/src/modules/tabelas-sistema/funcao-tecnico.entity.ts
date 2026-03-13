import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';

@Entity('funcoes_tecnico')
export class FuncaoTecnico {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 20 })
    codigo: string;

    @Column({ length: 200 })
    descricao: string;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    custo: number;
}
