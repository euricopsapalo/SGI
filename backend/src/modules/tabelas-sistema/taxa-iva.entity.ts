import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('taxas_iva')
export class TaxaIva {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 20 })
    codigo: string;

    @Column({ length: 200 })
    descricao: string;

    @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
    taxa: number;
}
