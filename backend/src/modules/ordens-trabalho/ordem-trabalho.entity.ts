import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn } from 'typeorm';
import { Cliente } from '../clientes/cliente.entity';
import { Tecnico } from '../tecnicos/tecnico.entity';
import { User } from '../users/user.entity';
import { OtMaoObra } from './ot-mao-obra.entity';
import { OtArtigo } from './ot-artigo.entity';
import { OtReprogramacao } from './ot-reprogramacao.entity';

/** RF-OT-002 §3.1 — natureza da intervenção pedida. */
export enum NaturezaIntervencao {
    MANUTENCAO = 'Manutenção',
    SUBSTITUICAO_FILTRO = 'Substituição de filtro',
    REPARACAO_AVARIA = 'Reparação de avaria',
    INSPECAO = 'Inspeção',
}

/** RF-OT-002 §3.1 — prioridade da OT. */
export enum OTPrioridade {
    NORMAL = 'Normal',
    ALTA = 'Alta',
    URGENTE = 'Urgente',
}

export enum OTEstado {
    REGISTADA = 'Registada',
    PROGRAMADA = 'Programada',
    ADIADA = 'Adiada',
    CONFIRMADA = 'Confirmada',
    EM_EXECUCAO = 'Em execução',
    FINALIZADA = 'Finalizada',
}

export enum OTTipo {
    PONTUAL = 'pontual',
    PERIODICA = 'periodica',
}

/** Máquina de estados central (RF-OT-001 §3.1). */
export const OT_TRANSICOES: Record<OTEstado, OTEstado[]> = {
    [OTEstado.REGISTADA]: [OTEstado.PROGRAMADA],
    [OTEstado.PROGRAMADA]: [OTEstado.CONFIRMADA, OTEstado.ADIADA],
    [OTEstado.ADIADA]: [OTEstado.PROGRAMADA],
    [OTEstado.CONFIRMADA]: [OTEstado.EM_EXECUCAO, OTEstado.ADIADA],
    [OTEstado.EM_EXECUCAO]: [OTEstado.FINALIZADA],
    [OTEstado.FINALIZADA]: [],
};

@Entity('ordens_trabalho')
export class OrdemTrabalho {
    @PrimaryGeneratedColumn()
    id: number;

    /** RF-OT-002 §3.1 — número único gerado pelo servidor (OT-NNNNNN). */
    @Column({ nullable: true, length: 30, unique: true })
    numero: string;

    @Column({ type: 'enum', enum: OTTipo, default: OTTipo.PONTUAL })
    tipo: OTTipo;

    @Column({ name: 'assinada_cliente', type: 'boolean', default: false })
    assinadaCliente: boolean;

    /** RF-OT-002 §3.1 — natureza da intervenção pedida. */
    @Column({ name: 'natureza_intervencao', type: 'enum', enum: NaturezaIntervencao, nullable: true })
    naturezaIntervencao: NaturezaIntervencao;

    /** RF-OT-002 §3.1 — prioridade (default Normal). */
    @Column({ type: 'enum', enum: OTPrioridade, default: OTPrioridade.NORMAL })
    prioridade: OTPrioridade;

    /** RF-OT-002 §3.1 — data de registo (preenchida ao criar). */
    @Column({ name: 'data_registo', type: 'date', nullable: true })
    dataRegisto: string;

    /**
     * RF-OT-002 §3.1 + decisão #65: criador da OT = qualquer User
     * (admin/coordenador/...). Não é FK para tecnicos.
     */
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'registado_por_id' })
    registadoPor: User;

    @Column({ name: 'registado_por_id', nullable: true })
    registadoPorId: number;

    /** RF-OT-002 §3.1 — técnico de campo (opcional na marcação). */
    @ManyToOne(() => Tecnico, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'executado_por_id' })
    executadoPor: Tecnico;

    @Column({ name: 'executado_por_id', nullable: true })
    executadoPorId: number;

    @ManyToOne(() => Cliente, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'cliente_id' })
    cliente: Cliente;

    @Column({ name: 'equip_instalado_id', nullable: true })
    equipInstaladoId: number;

    @Column({ name: 'plano_id', nullable: true })
    planoId: number;

    @Column({ name: 'tipo_trabalho', nullable: true, length: 100 })
    tipoTrabalho: string;

    @Column({ name: 'tipo_ot', nullable: true, length: 100 })
    tipoOT: string;

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

    @Column({ type: 'enum', enum: OTEstado, default: OTEstado.REGISTADA })
    estado: OTEstado;

    @OneToMany(() => OtMaoObra, (m) => m.ordemTrabalho, { cascade: true })
    maosObra: OtMaoObra[];

    @OneToMany(() => OtArtigo, (a) => a.ordemTrabalho, { cascade: true })
    artigos: OtArtigo[];

    @OneToMany(() => OtReprogramacao, (r) => r.ordemTrabalho, { cascade: true })
    reprogramacoes: OtReprogramacao[];
}
