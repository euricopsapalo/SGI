import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Check,
} from 'typeorm';
import { MaquinaInstalada } from './maquina-instalada.entity';

export enum TipoHistorico {
    MONTAGEM   = 'montagem',
    PREVENTIVA = 'preventiva',
    CORRETIVA  = 'corretiva',
    REMOTA     = 'remota',
}

export enum EstadoHistorico {
    CONCLUIDA = 'concluida',
    CANCELADA = 'cancelada',
}

@Entity('maquina_historico')
@Check('chk_maq_hist_tipo', `"tipo" IN ('montagem','preventiva','corretiva','remota')`)
@Check('chk_maq_hist_estado', `"estado" IN ('concluida','cancelada')`)
export class MaquinaHistorico {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => MaquinaInstalada, (m) => m.historico, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'maquina_id' })
    maquina: MaquinaInstalada;

    @Column({ name: 'maquina_id' })
    maquinaId: number;

    @Column({ type: 'date' })
    data: Date;

    @Column({ type: 'varchar', length: 30 })
    tipo: TipoHistorico;

    @Column({ type: 'text' })
    descricao: string;

    /** Nome do técnico (futuramente FK para tecnicos) */
    @Column({ length: 150, nullable: true })
    tecnico: string;

    @Column({ type: 'varchar', length: 30, default: EstadoHistorico.CONCLUIDA })
    estado: EstadoHistorico;

    @Column({ type: 'text', nullable: true })
    observacoes: string;
}
