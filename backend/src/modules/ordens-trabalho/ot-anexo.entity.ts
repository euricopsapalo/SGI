import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Check, Index } from 'typeorm';
import { OrdemTrabalho } from './ordem-trabalho.entity';

/**
 * #47 — Anexos de uma OT: fotos da intervenção (antes/depois) e assinatura
 * digital do cliente. O ficheiro é guardado em disco (storage local) e aqui
 * regista-se apenas o caminho/metadados.
 */
@Entity('ot_anexos')
@Index('idx_ot_anexos_ot', ['ordemTrabalho'])
// tipo é varchar + CHECK (convenção #89/#90), não enum nativo.
@Check('chk_ot_anexos_tipo', `"tipo" IN ('foto','assinatura')`)
export class OtAnexo {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => OrdemTrabalho, (ot) => ot.anexos, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ot_id' })
    ordemTrabalho: OrdemTrabalho;

    @Column({ length: 20 })
    tipo: 'foto' | 'assinatura';

    /** Caminho relativo do ficheiro na pasta de uploads (ex.: ot/12/foto-....jpg). */
    @Column({ length: 300 })
    path: string;

    /** Nome original do ficheiro (fotos); null para assinaturas geradas. */
    @Column({ name: 'nome_original', length: 255, nullable: true })
    nomeOriginal: string | null;

    @Column({ length: 100 })
    mime: string;

    @Column({ type: 'integer', default: 0 })
    tamanho: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
