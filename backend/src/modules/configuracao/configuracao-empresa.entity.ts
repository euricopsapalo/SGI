import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    UpdateDateColumn,
} from 'typeorm';

/**
 * Tabela singleton — deve conter sempre apenas 1 registo.
 * Guarda os dados da empresa e as configurações globais da aplicação.
 * Editável apenas pelo perfil Administrador.
 */
@Entity('configuracao_empresa')
export class ConfiguracaoEmpresa {
    @PrimaryGeneratedColumn()
    id: number;

    // --- Dados da Empresa ---
    @Column({ length: 200 })
    nome: string;

    @Column({ nullable: true, length: 20 })
    nif: string;

    @Column({ type: 'text', nullable: true })
    morada: string;

    @Column({ nullable: true, length: 30 })
    telefone: string;

    @Column({ nullable: true, length: 200 })
    email: string;

    @Column({ nullable: true, length: 300 })
    website: string;

    /** URL ou base64 do logótipo da empresa */
    @Column({ name: 'logo_url', type: 'text', nullable: true })
    logoUrl: string;

    /** Texto personalizado do rodapé dos documentos PDF (OS, faturas) */
    @Column({ name: 'rodape_documentos', type: 'text', nullable: true })
    rodapeDocumentos: string;

    // --- Dados Bancários (para faturas) ---
    @Column({ nullable: true, length: 100 })
    iban: string;

    @Column({ nullable: true, length: 100 })
    banco: string;

    // --- Configurações de Negócio ---
    /** Meses entre manutenções preventivas (default: 6) */
    @Column({
        name: 'meses_manutencao_preventiva',
        type: 'int',
        default: 6,
    })
    mesesManutencaoPreventiva: number;

    /** Dias de antecedência para alertar manutenções a vencer (default: 15) */
    @Column({
        name: 'dias_alerta_manutencao',
        type: 'int',
        default: 15,
    })
    diasAlertaManutencao: number;

    /** Moeda utilizada nos documentos (ex: EUR) */
    @Column({ length: 10, default: 'EUR' })
    moeda: string;

    /** Fuso horário da empresa (ex: Europe/Lisbon) */
    @Column({ name: 'fuso_horario', length: 50, default: 'Europe/Lisbon' })
    fusoHorario: string;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
