import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('familias_artigo')
export class FamiliaArtigo {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100 })
    descricao: string;
}
