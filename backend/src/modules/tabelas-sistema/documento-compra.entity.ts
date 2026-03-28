import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('documentos_compra')
export class DocumentoCompra {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 10 })
    codigo: string;

    @Column({ length: 200 })
    descricao: string;
}
