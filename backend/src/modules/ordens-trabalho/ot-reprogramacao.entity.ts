import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { OrdemTrabalho } from './ordem-trabalho.entity';

@Entity('ot_reprogramacoes')
// #31 — índice de performance (antes no init.sql, na FK ot_id).
@Index('idx_ot_reprogramacoes_ot', ['ordemTrabalho'])
export class OtReprogramacao {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => OrdemTrabalho, ot => ot.reprogramacoes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ot_id' })
    ordemTrabalho: OrdemTrabalho;

    @Column({ name: 'data_anterior', type: 'date', nullable: true })
    dataAnterior: string;

    @Column({ name: 'nova_data', type: 'date', nullable: true })
    novaData: string;

    @Column({ type: 'text' })
    motivo: string;

    @CreateDateColumn({ name: 'criado_em' })
    criadoEm: Date;

    @Column({ nullable: true, length: 200 })
    usuario: string;
}
