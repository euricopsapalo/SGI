import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Check, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Encomenda } from './encomenda.entity';
import { Artigo } from '../artigos/artigo.entity';

@Entity('encomenda_linhas')
// #35 — quantidades não-negativas e recebido nunca excede o encomendado.
@Check('chk_enc_linha_qtds', `"qtd_encomendada" >= 0 AND "qtd_recebida" >= 0 AND "qtd_recebida" <= "qtd_encomendada"`)
export class EncomendaLinha {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Encomenda, (e) => e.linhas, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'encomenda_id' })
    encomenda: Encomenda;

    // #36 — relação para o Artigo (init.sql: ON DELETE SET NULL).
    @ManyToOne(() => Artigo, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'artigo_id' })
    artigo: Artigo;

    @Column({ name: 'artigo_id', nullable: true })
    artigoId: number;

    @Column({ length: 50 })
    codigo: string;

    @Column({ length: 300 })
    descricao: string;

    @Column({ name: 'qtd_encomendada', type: 'numeric', precision: 12, scale: 3, default: 0 })
    qtdEncomendada: number;

    @Column({ name: 'qtd_recebida', type: 'numeric', precision: 12, scale: 3, default: 0 })
    qtdRecebida: number;

    @Column({ length: 20, default: 'UN' })
    unidade: string;

    @Column({ name: 'custo_unit', type: 'numeric', precision: 12, scale: 2, default: 0 })
    custoUnit: number;

    @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
    desconto: number;

    @Column({ name: 'codigo_iva', length: 20, nullable: true })
    codigoIva: string;

    @Column({ name: 'taxa_iva', type: 'numeric', precision: 5, scale: 2, default: 0 })
    taxaIva: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
