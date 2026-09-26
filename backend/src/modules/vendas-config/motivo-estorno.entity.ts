import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/** #164 — Motivos de estorno pré-criados (v10 §7.3). */
@Entity('motivos_estorno')
export class MotivoEstorno {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 10, unique: true })
    codigo: string;

    @Column({ length: 150 })
    descricao: string;

    @Column({ default: true })
    ativo: boolean;
}
