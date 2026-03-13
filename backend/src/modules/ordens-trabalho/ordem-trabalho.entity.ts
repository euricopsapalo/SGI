import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn } from 'typeorm';
import { Cliente } from '../clientes/cliente.entity';
import { OtMaoObra } from './ot-mao-obra.entity';
import { OtArtigo } from './ot-artigo.entity';

export enum OTEstado {
    PROGRAMADO = 'Programado',
    EM_CURSO = 'Em curso',
    TERMINADO = 'Terminado',
    ENCERRADO = 'Encerrado',
}

export enum OTTipo {
    PROGRAMADA = 'programada',
    PONTUAL = 'pontual',
}

@Entity('ordens_trabalho')
export class OrdemTrabalho {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'enum', enum: OTTipo, default: OTTipo.PONTUAL })
    tipo: OTTipo;

    @ManyToOne(() => Cliente, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'cliente_id' })
    cliente: Cliente;

    @Column({ name: 'equip_instalado_id', nullable: true })
    equipInstaladoId: number;

    @Column({ name: 'plano_id', nullable: true })
    planoId: number;

    @Column({ name: 'tipo_trabalho', nullable: true, length: 100 })
    tipoTrabalho: string;

    @Column({ type: 'text' })
    descricao: string;

    @Column({ name: 'previsao_tempo', type: 'numeric', precision: 6, scale: 2, default: 0 })
    previsaoTempo: number;

    @Column({ nullable: true, length: 30 })
    periodicidade: string;

    @Column({ nullable: true, length: 150 })
    responsavel: string;

    @Column({ nullable: true, length: 150 })
    orgao: string;

    @Column({ nullable: true, type: 'text' })
    sintoma: string;

    @Column({ nullable: true, type: 'text' })
    causa: string;

    @Column({ name: 'data_prog_inicio', type: 'date', nullable: true })
    dataProgInicio: string;

    @Column({ name: 'data_prog_fim', type: 'date', nullable: true })
    dataProgFim: string;

    @Column({ name: 'data_emissao', type: 'date', nullable: true })
    dataEmissao: string;

    @Column({ name: 'data_inicio', type: 'date', nullable: true })
    dataInicio: string;

    @Column({ name: 'data_fim', type: 'date', nullable: true })
    dataFim: string;

    @Column({ name: 'data_encerramento', type: 'date', nullable: true })
    dataEncerramento: string;

    @Column({ type: 'enum', enum: OTEstado, default: OTEstado.PROGRAMADO })
    estado: OTEstado;

    @OneToMany(() => OtMaoObra, (m) => m.ordemTrabalho, { cascade: true })
    maosObra: OtMaoObra[];

    @OneToMany(() => OtArtigo, (a) => a.ordemTrabalho, { cascade: true })
    artigos: OtArtigo[];
}
