import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Check, Index } from 'typeorm';

export enum TipoSysLog {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
}

@Entity('sys_logs')
@Check('chk_sys_logs_tipo', `"tipo" IN ('info','warning','error')`)
// #35 — índice temporal (a página de Logs ordena/filtra por data).
@Index('idx_sys_logs_timestamp', ['timestamp'])
// #31 — índice de performance (antes no init.sql).
@Index('idx_sys_logs_usuario', ['usuario'])
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

    @Column({ type: 'varchar', length: 30, default: TipoSysLog.INFO })
    tipo: TipoSysLog;

    @CreateDateColumn({ name: 'timestamp' })
    timestamp: Date;
}
