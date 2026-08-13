import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { OrdemTrabalho } from './ordem-trabalho.entity';

@Entity('ot_artigos')
export class OtArtigo {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => OrdemTrabalho, (ot) => ot.artigos, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'ot_id' })
    ordemTrabalho: OrdemTrabalho;

    @Column({ name: 'artigo_id', nullable: true })
    artigoId: number;

    @Column({ length: 300 })
    descricao: string;

    @Column({ type: 'numeric', precision: 12, scale: 3, default: 1 })
    quantidade: number;

    /**
     * RF-OT-004 §3.1 — Linha de Consumo: previsto vs. reservado vs. consumido.
     * `qtdPrevista` vem da marcação (RF-OT-002 "Peças previstas"); `qtdReservada`
     * é preenchida na confirmação; `qtdConsumida` na execução (RF-OT-005).
     */
    @Column({ name: 'qtd_prevista', type: 'numeric', precision: 12, scale: 3, default: 0 })
    qtdPrevista: number;

    @Column({ name: 'qtd_reservada', type: 'numeric', precision: 12, scale: 3, default: 0 })
    qtdReservada: number;

    @Column({ name: 'qtd_consumida', type: 'numeric', precision: 12, scale: 3, nullable: true })
    qtdConsumida: number;

    /** RF-OT-004 §4 — marcada quando não houve stock suficiente para reservar tudo. */
    @Column({ name: 'para_reposicao', type: 'boolean', default: false })
    paraReposicao: boolean;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    preco: number;

    @Column({ name: 'codigo_iva', length: 20, nullable: true })
    codigoIva: string;

    @Column({ name: 'taxa_iva', type: 'numeric', precision: 5, scale: 2, nullable: true })
    taxaIva: number;
}
