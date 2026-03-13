import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';

@Entity('armazens')
export class Armazem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 20 })
    codigo: string;

    @Column({ length: 200 })
    nome: string;

    @Column({ nullable: true, length: 300 })
    descricao: string;

    @Column({ default: true })
    ativo: boolean;
}
