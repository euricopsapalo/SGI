import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tipos_documento')
export class TipoDocumento {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 20 })
    codigo: string;

    @Column({ length: 200 })
    descricao: string;
}
