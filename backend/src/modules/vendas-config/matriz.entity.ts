import { Entity, PrimaryColumn, Column, Check, Index, ManyToOne, JoinColumn } from 'typeorm';

/**
 * #164 — Metadados da matriz de configuração de documentos (v11 §3, regra R3).
 *
 * Tabelas de sistema, semeadas por migração e só de leitura pela API. O ecrã de
 * configuração e a validação do backend derivam TODO o comportamento destas
 * linhas — acrescentar um tipo de documento ou um valor elegível é um INSERT,
 * não uma alteração de código.
 */

/** Tipos de documento do sistema (Financeiro, Liquidações, Movimento em conta, caixa). */
@Entity('doc_tipos')
export class DocTipo {
    @PrimaryColumn({ length: 30 })
    codigo: string;

    @Column({ length: 100 })
    descricao: string;

    @Column({ length: 30 })
    modulo: string;

    @Column({ type: 'int', default: 0 })
    ordem: number;
}

export type DocCampoTipoValor =
    | 'BOOLEAN' | 'ENUM' | 'DOC_REF' | 'SERIE_REF' | 'CC_TIPO_REF' | 'CC_ESTADO_REF' | 'CONTAS_REF';

export type DocCampoAlvoRegra = 'TIPO_FIXO' | 'NATUREZA_INVERSA';

/**
 * Registo dos campos configuráveis. `codigo` é o nome da propriedade em
 * `DocumentoConfig`. Para `DOC_REF`, `alvo_regra` diz a que documento pode
 * apontar (R4): um tipo fixo (`alvo_tipo_codigo`) ou o mesmo tipo com natureza inversa.
 */
@Entity('doc_campos')
@Check('chk_doc_campos_tipo_valor', `"tipo_valor" IN ('BOOLEAN','ENUM','DOC_REF','SERIE_REF','CC_TIPO_REF','CC_ESTADO_REF','CONTAS_REF')`)
@Check('chk_doc_campos_alvo_regra', `"alvo_regra" IS NULL OR "alvo_regra" IN ('TIPO_FIXO','NATUREZA_INVERSA')`)
export class DocCampo {
    @PrimaryColumn({ length: 40 })
    codigo: string;

    @Column({ length: 150 })
    descricao: string;

    @Column({ name: 'tipo_valor', type: 'varchar', length: 30 })
    tipoValor: DocCampoTipoValor;

    @Column({ name: 'alvo_regra', type: 'varchar', length: 30, nullable: true })
    alvoRegra: DocCampoAlvoRegra | null;

    @Column({ name: 'alvo_tipo_codigo', type: 'varchar', length: 30, nullable: true })
    alvoTipoCodigo: string | null;

    @ManyToOne(() => DocTipo, { nullable: true, onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'alvo_tipo_codigo' })
    alvoTipo: DocTipo;

    /**
     * Campo de que esta referência depende: `SERIE_REF` → série do documento em
     * `campo_ref`; `CC_ESTADO_REF` → estado do tipo de CC em `campo_ref`;
     * `CC_TIPO_REF` → tipo de CC da entidade em `campo_ref`.
     */
    @Column({ name: 'campo_ref', type: 'varchar', length: 40, nullable: true })
    campoRef: string | null;

    @Column({ type: 'int', default: 0 })
    ordem: number;
}

/** Nível 1 — o campo está habilitado para o tipo de documento (presença = habilitado). */
@Entity('doc_matriz_campos')
export class DocMatrizCampo {
    @PrimaryColumn({ name: 'tipo_codigo', length: 30 })
    tipoCodigo: string;

    @PrimaryColumn({ name: 'campo_codigo', length: 40 })
    campoCodigo: string;

    @ManyToOne(() => DocTipo, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'tipo_codigo' })
    tipo: DocTipo;

    @ManyToOne(() => DocCampo, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'campo_codigo' })
    campo: DocCampo;
}

/**
 * Nível 2 — sub-campo habilitado quando `campo_pai` (disponível) tem o valor
 * `valor_pai`. Várias linhas para o mesmo campo combinam-se com OU.
 */
@Entity('doc_matriz_condicoes')
export class DocMatrizCondicao {
    @PrimaryColumn({ name: 'campo_codigo', length: 40 })
    campoCodigo: string;

    @PrimaryColumn({ name: 'campo_pai', length: 40 })
    campoPai: string;

    @PrimaryColumn({ name: 'valor_pai', length: 30 })
    valorPai: string;

    @ManyToOne(() => DocCampo, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'campo_codigo' })
    campo: DocCampo;

    @ManyToOne(() => DocCampo, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'campo_pai' })
    pai: DocCampo;
}

/**
 * Nível 3 — valores elegíveis de um campo `ENUM` para um tipo de documento.
 * `inverso` liga naturezas opostas (usado pela regra NATUREZA_INVERSA do estorno).
 */
@Entity('doc_matriz_dominios')
@Index('idx_doc_matriz_dominios_tipo', ['tipoCodigo'])
export class DocMatrizDominio {
    @PrimaryColumn({ name: 'tipo_codigo', length: 30 })
    tipoCodigo: string;

    @PrimaryColumn({ name: 'campo_codigo', length: 40 })
    campoCodigo: string;

    @PrimaryColumn({ length: 30 })
    valor: string;

    @Column({ length: 150 })
    descricao: string;

    @Column({ type: 'varchar', length: 30, nullable: true })
    inverso: string | null;

    @Column({ type: 'int', default: 0 })
    ordem: number;

    @ManyToOne(() => DocTipo, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'tipo_codigo' })
    tipo: DocTipo;

    @ManyToOne(() => DocCampo, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'campo_codigo' })
    campo: DocCampo;
}
