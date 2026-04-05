import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { FaturaFornecedor } from './fatura-fornecedor.entity';

@Entity('vnc_faturas_associadas')
@Unique(['vncId', 'faturaAssociadaId'])
export class VncFaturaAssociada {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'vnc_id' })
    vncId: number;

    @ManyToOne(() => FaturaFornecedor, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'vnc_id' })
    vnc: FaturaFornecedor;

    @Column({ name: 'fatura_associada_id' })
    faturaAssociadaId: number;

    @ManyToOne(() => FaturaFornecedor, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'fatura_associada_id' })
    faturaAssociada: FaturaFornecedor;
}
