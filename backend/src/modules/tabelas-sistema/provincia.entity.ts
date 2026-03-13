import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Pais } from './pais.entity';
import { Municipio } from './municipio.entity';

@Entity('provincias')
export class Provincia {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100 })
    nome: string;

    @ManyToOne(() => Pais, (p) => p.provincias, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'pais_id' })
    pais: Pais;

    @OneToMany(() => Municipio, (m) => m.provincia)
    municipios: Municipio[];
}
