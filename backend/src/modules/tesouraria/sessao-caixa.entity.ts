import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Check, Index, CreateDateColumn, Relation,
} from 'typeorm';
import { ContaBancaria } from '../vendas-config/conta-bancaria.entity';
import { Serie } from '../vendas-config/serie.entity';
import { User } from '../users/user.entity';
import { MovimentoConta } from './movimento-conta.entity';

/**
 * #167 — Sessão de caixa (v10 §6.4, v11 §5.5): da abertura (`ABC`) ao fecho (`FCC`).
 *
 * - Abertura: regista o valor **sugerido** (contado no fecho anterior) e o **declarado**.
 * - Durante a sessão, todo o movimento na caixa (liquidações, saídas) aponta para ela.
 * - Fecho: saldo teórico = declarado + entradas − saídas; o valor **contado** e a
 *   diferença, que gera o acerto de sobra (`ACS`) ou de quebra (`ACQ`).
 * No máximo uma sessão aberta por caixa (índice único parcial).
 * A abertura e o fecho são numerados nas séries dos respectivos documentos.
 */
@Entity('sessoes_caixa')
@Index('idx_sessoes_caixa_conta', ['contaBancariaId'])
@Index('uq_sessoes_caixa_aberta', ['contaBancariaId'], { unique: true, where: '"fechada_em" IS NULL' })
@Check('chk_sessoes_caixa_valores', `"valor_sugerido" >= 0 AND "valor_declarado" >= 0 AND ("valor_contado" IS NULL OR "valor_contado" >= 0)`)
@Check('chk_sessoes_caixa_fecho', `("fechada_em" IS NULL) = ("valor_contado" IS NULL)`)
export class SessaoCaixa {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => ContaBancaria, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'conta_bancaria_id' })
    contaBancaria: ContaBancaria;

    @Column({ name: 'conta_bancaria_id' })
    contaBancariaId: number;

    // ── abertura ──
    @ManyToOne(() => Serie, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'abertura_serie_id' })
    aberturaSerie: Serie;

    @Column({ name: 'abertura_serie_id' })
    aberturaSerieId: number;

    @Column({ name: 'abertura_numero', type: 'int' })
    aberturaNumero: number;

    @Column({ name: 'aberta_em', type: 'timestamptz' })
    abertaEm: Date;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'aberta_por_id' })
    abertaPor: User;

    @Column({ name: 'aberta_por_id', type: 'int', nullable: true })
    abertaPorId: number | null;

    @Column({ name: 'valor_sugerido', type: 'numeric', precision: 14, scale: 2 })
    valorSugerido: number;

    @Column({ name: 'valor_declarado', type: 'numeric', precision: 14, scale: 2 })
    valorDeclarado: number;

    @Column({ name: 'observacoes_abertura', type: 'text', nullable: true })
    observacoesAbertura: string | null;

    // ── fecho ──
    @ManyToOne(() => Serie, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'fecho_serie_id' })
    fechoSerie: Serie;

    @Column({ name: 'fecho_serie_id', type: 'int', nullable: true })
    fechoSerieId: number | null;

    @Column({ name: 'fecho_numero', type: 'int', nullable: true })
    fechoNumero: number | null;

    @Column({ name: 'fechada_em', type: 'timestamptz', nullable: true })
    fechadaEm: Date | null;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'fechada_por_id' })
    fechadaPor: User;

    @Column({ name: 'fechada_por_id', type: 'int', nullable: true })
    fechadaPorId: number | null;

    @Column({ name: 'saldo_teorico', type: 'numeric', precision: 14, scale: 2, nullable: true })
    saldoTeorico: number | null;

    @Column({ name: 'valor_contado', type: 'numeric', precision: 14, scale: 2, nullable: true })
    valorContado: number | null;

    /** Acerto (`ACS`/`ACQ`) gerado pela diferença entre o contado e o teórico. */
    @ManyToOne(() => MovimentoConta, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'documento_acerto_id' })
    documentoAcerto: Relation<MovimentoConta>;

    @Column({ name: 'documento_acerto_id', type: 'int', nullable: true })
    documentoAcertoId: number | null;

    @Column({ name: 'observacoes_fecho', type: 'text', nullable: true })
    observacoesFecho: string | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
