import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum TipoSysLog {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
}

@Entity('sys_logs')
export class SysLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true, length: 200 })
    usuario: string;

    @Column({ length: 100 })
    modulo: string;

    @Column({ length: 200 })
    acao: string;

    @Column({ type: 'text', nullable: true })
    detalhes: string;

    @Column({ type: 'enum', enum: TipoSysLog, default: TipoSysLog.INFO })
    tipo: TipoSysLog;

    @CreateDateColumn({ name: 'timestamp' })
    timestamp: Date;
}
