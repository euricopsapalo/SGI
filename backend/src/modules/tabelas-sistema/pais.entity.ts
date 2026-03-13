import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Provincia } from './provincia.entity';

@Entity('paises')
export class Pais {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100 })
    nome: string;

    @Column({ length: 5 })
    codigo: string;

    @OneToMany(() => Provincia, (p) => p.pais)
    provincias: Provincia[];
}
