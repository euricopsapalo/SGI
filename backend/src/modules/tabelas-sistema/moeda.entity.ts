import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('moedas')
export class Moeda {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 10 })
    codigo: string;

    @Column({ length: 100 })
    descricao: string;

    @Column({ length: 10 })
    simbolo: string;
}
