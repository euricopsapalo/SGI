import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fornecedores')
export class Fornecedor {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 200 })
    nome: string;

    @Column({ nullable: true, length: 20 })
    nif: string;

    @Column({ nullable: true, length: 30 })
    telefone: string;

    @Column({ nullable: true, length: 200 })
    email: string;

    @Column({ nullable: true, length: 300 })
    morada: string;

    @Column({ default: true })
    ativo: boolean;

    @Column({ name: 'provincia_id', nullable: true })
    provinciaId: number;

    @Column({ name: 'municipio_id', nullable: true })
    municipioId: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
