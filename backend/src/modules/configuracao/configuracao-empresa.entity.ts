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

    // --- #178 — identificação legal impressa nas faturas e recibos ---
    @Column({ type: 'varchar', length: 30, nullable: true })
    fax: string | null;

    @Column({ name: 'capital_social', type: 'varchar', length: 50, nullable: true })
    capitalSocial: string | null;

    /** Conservatória do Registo Comercial. */
    @Column({ name: 'conservatoria_registo', type: 'varchar', length: 150, nullable: true })
    conservatoriaRegisto: string | null;

    /** N.º de matrícula no registo comercial. */
    @Column({ type: 'varchar', length: 50, nullable: true })
    matricula: string | null;

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

    /** Taxa de IVA padrão (%) usada em faturas */
    @Column({ name: 'taxa_iva', type: 'numeric', precision: 5, scale: 2, default: 14 })
    taxaIva: number;

    /**
     * RF-OT-003 §3.3.1 — limite de adiamentos consecutivos. A partir do
     * `limite + 1`-ésimo adiamento é exigida aprovação de um administrador.
     */
    @Column({ name: 'limite_adiamentos', type: 'int', default: 3 })
    limiteAdiamentos: number;

    /** Número de casas decimais para formatação de valores monetários (ex: 2) */
    @Column({ name: 'casas_decimais', type: 'int', default: 2 })
    casasDecimais: number;

    /** Formato de apresentação de datas (ex: DD/MM/YYYY) */
    @Column({ name: 'formato_data', length: 20, default: 'DD/MM/YYYY' })
    formatoData: string;

    /** Latitude da empresa (para faturas e documentos) */
    @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true })
    latitude: number;

    /** Longitude da empresa (para faturas e documentos) */
    @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true })
    longitude: number;

    // --- Segurança (issue #100) ---
    /** Comprimento mínimo exigido nas passwords (aplicado no criar/reset/alterar). */
    @Column({ name: 'min_password_length', type: 'int', default: 8 })
    minPasswordLength: number;

    /** Duração da sessão em minutos (usado no expiresIn do JWT ao autenticar; 0 = 8h por defeito). */
    @Column({ name: 'session_expiry_minutes', type: 'int', default: 60 })
    sessionExpiryMinutes: number;

    /** Permite que os utilizadores ativem 2FA (TOTP) na sua conta. */
    @Column({ name: 'two_factor_enabled', type: 'boolean', default: false })
    twoFactorEnabled: boolean;

    /** Quando falso, a escrita de registos em sys_logs é ignorada. */
    @Column({ name: 'access_log_enabled', type: 'boolean', default: true })
    accessLogEnabled: boolean;

    // --- Comissões (issue #101) ---
    /** Comissão fixa (moeda) por OT concluída de natureza "Montagem / Instalação". */
    @Column({ name: 'comissao_montagem', type: 'numeric', precision: 10, scale: 2, default: 80 })
    comissaoMontagem: number;

    /** Comissão fixa (moeda) por OT concluída preventiva (Manutenção/Substituição de filtro/Inspeção). */
    @Column({ name: 'comissao_preventiva', type: 'numeric', precision: 10, scale: 2, default: 40 })
    comissaoPreventiva: number;

    /** Comissão fixa (moeda) por OT concluída de natureza "Reparação de avaria" (corretiva). */
    @Column({ name: 'comissao_corretiva', type: 'numeric', precision: 10, scale: 2, default: 50 })
    comissaoCorretiva: number;

    /** Comissão fixa (moeda) por OT concluída de suporte remoto. */
    @Column({ name: 'comissao_remota', type: 'numeric', precision: 10, scale: 2, default: 25 })
    comissaoRemota: number;

    /** Percentagem de comissão de vendas aplicada aos vendedores. */
    @Column({ name: 'comissao_venda_percentagem', type: 'numeric', precision: 5, scale: 2, default: 3 })
    comissaoVendaPercentagem: number;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
