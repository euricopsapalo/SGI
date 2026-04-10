import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { OrdemTrabalho } from './ordem-trabalho.entity';

@Entity('ot_artigos')
export class OtArtigo {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => OrdemTrabalho, (ot) => ot.artigos, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ot_id' })
    ordemTrabalho: OrdemTrabalho;

    @Column({ name: 'artigo_id', nullable: true })
    artigoId: number;

    @Column({ length: 300 })
    descricao: string;

    @Column({ type: 'numeric', precision: 12, scale: 3, default: 1 })
    quantidade: number;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    preco: number;

    @Column({ name: 'codigo_iva', length: 20, nullable: true })
    codigoIva: string;

    @Column({ name: 'taxa_iva', type: 'numeric', precision: 5, scale: 2, nullable: true })
    taxaIva: number;
}
