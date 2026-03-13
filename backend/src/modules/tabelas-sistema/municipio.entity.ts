import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Provincia } from './provincia.entity';

@Entity('municipios')
export class Municipio {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100 })
    nome: string;

    @ManyToOne(() => Provincia, (p) => p.municipios, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'provincia_id' })
    provincia: Provincia;
}
