import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
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

    @Column({ type: 'enum', enum: TipoHistorico })
    tipo: TipoHistorico;

    @Column({ type: 'text' })
    descricao: string;

    /** Nome do técnico (futuramente FK para tecnicos) */
    @Column({ length: 150, nullable: true })
    tecnico: string;

    @Column({ type: 'enum', enum: EstadoHistorico, default: EstadoHistorico.CONCLUIDA })
    estado: EstadoHistorico;
}
