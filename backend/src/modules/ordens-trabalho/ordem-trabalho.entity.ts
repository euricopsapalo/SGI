import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, Check, Index } from 'typeorm';
import { Cliente } from '../clientes/cliente.entity';
import { Tecnico } from '../tecnicos/tecnico.entity';
import { User } from '../users/user.entity';
import { OtMaoObra } from './ot-mao-obra.entity';
import { OtArtigo } from './ot-artigo.entity';
import { OtReprogramacao } from './ot-reprogramacao.entity';
import { EquipInstalado } from '../parque/equip-instalado.entity';
import { PlanoManutencao } from '../planos/plano-manutencao.entity';

/**
 * RF-OT-002 §3.1 — natureza da intervenção pedida.
 * #75: classificação única da OT (funde os antigos `tipoTrabalho`/`tipoOT`).
 * `MONTAGEM` cobre as OTs auto-criadas no Parque; `REPARACAO_AVARIA` é a corretiva.
 */
export enum NaturezaIntervencao {
    MANUTENCAO = 'Manutenção',
    SUBSTITUICAO_FILTRO = 'Substituição de filtro',
    REPARACAO_AVARIA = 'Reparação de avaria',
    INSPECAO = 'Inspeção',
    MONTAGEM = 'Montagem / Instalação',
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
// #89 — CHECKs espelham o init.sql; mantidos pelo synchronize via @Check.
@Check('chk_ot_tipo', `"tipo" IN ('pontual','periodica')`)
@Check('chk_ot_natureza', `"natureza_intervencao" IS NULL OR "natureza_intervencao" IN ('Manutenção','Substituição de filtro','Reparação de avaria','Inspeção','Montagem / Instalação')`)
@Check('chk_ot_prioridade', `"prioridade" IN ('Normal','Alta','Urgente')`)
@Check('chk_ot_estado', `"estado" IN ('Registada','Programada','Adiada','Confirmada','Em execução','Finalizada')`)
// #31 — índices de performance (antes definidos no init.sql; agora geridos pela entity).
@Index('idx_ordens_trabalho_cliente', ['cliente'])
@Index('idx_ordens_trabalho_estado', ['estado'])
@Index('idx_ot_registado_por', ['registadoPorId'])
@Index('idx_ot_executado_por', ['executadoPorId'])
@Index('idx_ot_natureza', ['naturezaIntervencao'])
@Index('idx_ot_prioridade', ['prioridade'])
@Index('idx_ordens_trabalho_equip', ['equipInstaladoId'])
@Index('idx_ordens_trabalho_prog', ['dataAgendada'])
@Index('idx_ot_gerada_de', ['geradaDeOtId'])
export class OrdemTrabalho {
    @PrimaryGeneratedColumn()
    id: number;

    /** RF-OT-002 §3.1 — número único gerado pelo servidor (OT-NNNNNN). */
    @Column({ nullable: true, length: 30, unique: true })
    numero: string;

    @Column({ type: 'varchar', length: 30, default: OTTipo.PONTUAL })
    tipo: OTTipo;

    @Column({ name: 'assinada_cliente', type: 'boolean', default: false })
    assinadaCliente: boolean;

    /** RF-OT-002 §3.1 — natureza da intervenção pedida. */
    @Column({ name: 'natureza_intervencao', type: 'varchar', length: 30, nullable: true })
    naturezaIntervencao: NaturezaIntervencao;

    /** RF-OT-002 §3.1 — prioridade (default Normal). */
    @Column({ type: 'varchar', length: 30, default: OTPrioridade.NORMAL })
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

    // #36 — relações para máquina instalada e plano (init.sql: ON DELETE SET NULL);
    // mantêm-se os escalares `equipInstaladoId`/`planoId` para o shape do frontend.
    @ManyToOne(() => EquipInstalado, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'equip_instalado_id' })
    equipInstalado: EquipInstalado;

    @Column({ name: 'equip_instalado_id', nullable: true })
    equipInstaladoId: number;

    @ManyToOne(() => PlanoManutencao, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'plano_id' })
    plano: PlanoManutencao;

    @Column({ name: 'plano_id', nullable: true })
    planoId: number;

    @Column({ type: 'text' })
    descricao: string;

    @Column({ name: 'previsao_tempo', type: 'numeric', precision: 6, scale: 2, default: 0 })
    previsaoTempo: number;

    @Column({ nullable: true, length: 30 })
    periodicidade: string;

    @Column({ nullable: true, length: 150 })
    orgao: string;

    @Column({ nullable: true, type: 'text' })
    sintoma: string;

    @Column({ nullable: true, type: 'text' })
    causa: string;

    /** RF-OT-003 §4 — data agendada actual da OT (antiga data_prog_inicio, #74). */
    @Column({ name: 'data_agendada', type: 'date', nullable: true })
    dataAgendada: string;

    /** RF-OT-003 §3.2 — data definida ao confirmar (executar a OT). */
    @Column({ name: 'data_execucao', type: 'date', nullable: true })
    dataExecucao: string;

    /** RF-OT-003 §3.3 — contador de adiamentos. */
    @Column({ name: 'adiamentos', type: 'int', default: 0 })
    adiamentos: number;

    /** RF-OT-003 §3.1 — limite superior da janela de programação (default: data_registo + 6m). */
    @Column({ name: 'janela_fim', type: 'date', nullable: true })
    janelaFim: string;

    /**
     * RF-OT-003 §3.3.1 — utilizador que aprovou o adiamento que ultrapassou o
     * limite (FK para users). NULL quando não foi necessária aprovação.
     */
    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'aprovado_por_id' })
    aprovadoPor: User;

    @Column({ name: 'aprovado_por_id', nullable: true })
    aprovadoPorId: number;

    @Column({ name: 'data_inicio', type: 'date', nullable: true })
    dataInicio: string;

    @Column({ name: 'data_fim', type: 'date', nullable: true })
    dataFim: string;

    /** RF-OT-006 §3.1 — referência opcional ao comprovativo de assinatura do cliente. */
    @Column({ name: 'assinatura_ref', type: 'varchar', length: 255, nullable: true })
    assinaturaRef: string;

    /**
     * RF-OT-006 §3.2.4 — rastreabilidade da cadeia periódica: aponta para a OT
     * que originou esta (NULL na primeira do ciclo).
     */
    @ManyToOne(() => OrdemTrabalho, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'gerada_de_ot_id' })
    geradaDe: OrdemTrabalho;

    @Column({ name: 'gerada_de_ot_id', nullable: true })
    geradaDeOtId: number;

    @Column({ type: 'varchar', length: 30, default: OTEstado.REGISTADA })
    estado: OTEstado;

    @OneToMany(() => OtMaoObra, (m) => m.ordemTrabalho, { cascade: true })
    maosObra: OtMaoObra[];

    @OneToMany(() => OtArtigo, (a) => a.ordemTrabalho, { cascade: true })
    artigos: OtArtigo[];

    @OneToMany(() => OtReprogramacao, (r) => r.ordemTrabalho, { cascade: true })
    reprogramacoes: OtReprogramacao[];
}
