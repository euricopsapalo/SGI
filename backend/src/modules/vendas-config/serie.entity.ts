import {
    Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Check, Index, Unique,
    CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { DocumentoConfig } from './documento-config.entity';

/**
 * #164 — Série de numeração de um documento (v10 §2.1).
 *
 * - Corresponde sempre a um ano civil: datas inicial/final derivam de `ano`.
 * - `ultimo_numero` / `ultima_data_hora` são mantidos pela emissão (fase 2);
 *   `ultimo_numero IS NOT NULL` significa série — e documento — em uso (R2).
 * - No máximo uma série por defeito por documento (índice único parcial).
 */
@Entity('series')
@Unique('uq_series_doc_codigo', ['documentoConfigId', 'codigo'])
@Index('uq_series_por_defeito', ['documentoConfigId'], { unique: true, where: '"por_defeito" = true' })
@Check('chk_series_ano', `"ano" BETWEEN 2000 AND 2100`)
@Check('chk_series_limites', `"limite_inferior" >= 0 AND "limite_superior" > "limite_inferior"`)
@Check('chk_series_ultimo_numero', `"ultimo_numero" IS NULL OR ("ultimo_numero" > "limite_inferior" AND "ultimo_numero" <= "limite_superior")`)
export class Serie {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => DocumentoConfig, (d) => d.series, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'documento_config_id' })
    documentoConfig: DocumentoConfig;

    @Column({ name: 'documento_config_id' })
    documentoConfigId: number;

    @Column({ length: 20 })
    codigo: string;

    @Column({ type: 'int' })
    ano: number;

    @Column({ name: 'limite_inferior', type: 'int', default: 0 })
    limiteInferior: number;

    @Column({ name: 'limite_superior', type: 'int', default: 99999999 })
    limiteSuperior: number;

    @Column({ name: 'ultimo_numero', type: 'int', nullable: true })
    ultimoNumero: number | null;

    @Column({ name: 'ultima_data_hora', type: 'timestamptz', nullable: true })
    ultimaDataHora: Date | null;

    @Column({ name: 'por_defeito', default: false })
    porDefeito: boolean;

    @Column({ name: 'sugere_data_sistema', default: true })
    sugereDataSistema: boolean;

    @Column({ default: true })
    ativo: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
