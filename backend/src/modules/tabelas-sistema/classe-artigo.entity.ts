import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('classes_artigo')
export class ClasseArtigo {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100 })
    descricao: string;
}
