import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { Cliente } from '../clientes/cliente.entity';
import { MaquinaInstalada } from '../maquinas-instaladas/maquina-instalada.entity';
import { Tecnico } from '../tecnicos/tecnico.entity';
import { Vendedor } from '../vendedores/vendedor.entity';
import { OsPeca } from './os-peca.entity';
import { Fatura } from '../faturas/fatura.entity';
import { Comissao } from '../comissoes/comissao.entity';

export enum TipoOS {
    MONTAGEM = 'montagem',
    PREVENTIVA = 'preventiva',
    CORRETIVA = 'corretiva',
    REMOTA = 'remota',
}

export enum EstadoOS {
    ABERTA = 'aberta',
    EM_EXECUCAO = 'em_execucao',
    CONCLUIDA = 'concluida',
    CANCELADA = 'cancelada',
    RESOLVIDA_REMOTAMENTE = 'resolvida_remotamente',
}

@Entity('ordens_servico')
export class OrdemDeServico {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'enum', enum: TipoOS })
    tipo: TipoOS;

    @ManyToOne(() => Cliente, (c) => c.ordensServico, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'id_cliente' })
    cliente: Cliente;

    @ManyToOne(() => MaquinaInstalada, (m) => m.ordensServico, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'id_maquina_instalada' })
    maquinaInstalada: MaquinaInstalada;

    @ManyToOne(() => Tecnico, (t) => t.ordensCampo, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'id_tecnico_campo' })
    tecnicoCampo: Tecnico;

    @ManyToOne(() => Tecnico, (t) => t.ordensSuporte, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'id_tecnico_suporte' })
    tecnicoSuporte: Tecnico;

    @ManyToOne(() => Vendedor, (v) => v.ordensServico, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'id_vendedor' })
    vendedor: Vendedor;

    // Auto-referência: OS corretiva que foi originada por uma OS remota
    @ManyToOne(() => OrdemDeServico, (os) => os.ordensOriginadas, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'id_os_origem' })
    osOrigem: OrdemDeServico;

    @OneToMany(() => OrdemDeServico, (os) => os.osOrigem)
    ordensOriginadas: OrdemDeServico[];

    @CreateDateColumn({ name: 'data_abertura' })
    dataAbertura: Date;

    @Column({ name: 'data_agendamento', type: 'timestamp', nullable: true })
    dataAgendamento: Date;

    @Column({ name: 'data_conclusao', type: 'timestamp', nullable: true })
    dataConclusao: Date;

    @Column({ type: 'enum', enum: EstadoOS, default: EstadoOS.ABERTA })
    estado: EstadoOS;

    @Column({ name: 'anomalia_descricao', type: 'text', nullable: true })
    anomaliaDescricao: string;

    @Column({ name: 'resolucao_descricao', type: 'text', nullable: true })
    resolucaoDescricao: string;

    @Column({ name: 'assinatura_cliente', type: 'text', nullable: true })
    assinaturaCliente: string;

    @OneToMany(() => OsPeca, (osp) => osp.ordemServico, { cascade: true })
    pecasUtilizadas: OsPeca[];

    @OneToMany(() => Fatura, (f) => f.ordemServico)
    faturas: Fatura[];

    @OneToMany(() => Comissao, (c) => c.ordemServico)
    comissoes: Comissao[];
}
