import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { OtArtigo } from './ot-artigo.entity';
import { Artigo } from '../artigos/artigo.entity';
import { SysLogsService } from '../sys-logs/sys-logs.service';
import { saidaStock } from '../artigos/stock-armazem.ops';

/** RF-OT-004 §4 — aviso devolvido ao confirmar quando falta stock. */
export interface AvisoStock {
    artigoId: number;
    descricao: string;
    previsto: number;
    reservado: number;
    emFalta: number;
}

/**
 * RF-OT-004 — Reserva e validação de stock na confirmação.
 *
 * Centraliza as operações sobre `artigos.stock_reservado` e as quantidades da
 * Linha de Consumo (`ot_artigos.qtd_prevista/qtd_reservada/qtd_consumida`).
 * Todas as operações são **transacionais** e usam lock pessimista na linha de
 * `artigos` para evitar over-reserva entre confirmações simultâneas (RD-2).
 *
 * Invariante: `disponivel = existencia − stock_reservado`.
 */
@Injectable()
export class StockReservaService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly sysLogs: SysLogsService,
    ) {}

    /**
     * RF-OT-004 §4 — Reserva as peças previstas de uma OT.
     * Não bloqueia com stock insuficiente: reserva o disponível e marca
     * `para_reposicao`. Devolve os avisos de falta (`avisosStock`).
     */
    async reservar(otId: number, usuario = 'sistema', manager?: EntityManager): Promise<AvisoStock[]> {
        // #200 — com `manager`, participa na transação do chamador (edição da OT).
        if (manager) return this.reservarCom(manager, otId, usuario);
        return this.dataSource.transaction((m) => this.reservarCom(m, otId, usuario));
    }

    private async reservarCom(manager: EntityManager, otId: number, usuario: string): Promise<AvisoStock[]> {
        const linhas = await manager.find(OtArtigo, {
            where: { ordemTrabalho: { id: otId } },
        });

        const avisos: AvisoStock[] = [];
        for (const linha of linhas) {
            if (!linha.artigoId) continue;
            const prevista = Number(linha.qtdPrevista ?? 0) || Number(linha.quantidade ?? 0);
            if (prevista <= 0) continue;

            // Lock pessimista na linha do artigo (RD-2).
            const artigo = await manager.findOne(Artigo, {
                where: { id: linha.artigoId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!artigo) continue;

            const disponivel = Number(artigo.existencia) - Number(artigo.stockReservado);
            const reservar = Math.min(prevista, Math.max(0, disponivel));
            const emFalta = prevista - reservar;

            linha.qtdReservada = reservar;
            linha.paraReposicao = emFalta > 0;
            await manager.save(OtArtigo, linha);

            if (reservar > 0) {
                await manager.update(Artigo, artigo.id, {
                    stockReservado: Number(artigo.stockReservado) + reservar,
                });
            }

            if (emFalta > 0) {
                avisos.push({
                    artigoId: artigo.id,
                    descricao: linha.descricao ?? artigo.descricao,
                    previsto: prevista,
                    reservado: reservar,
                    emFalta,
                });
            }
        }

        await this.sysLogs.create({
            usuario,
            modulo: 'OT',
            acao: 'OT_STOCK_RESERVADO',
            detalhes:
                `#${otId}: ${linhas.length} linha(s) processada(s)` +
                (avisos.length ? `, ${avisos.length} em reposição` : ', stock suficiente'),
        });

        return avisos;
    }

    /**
     * RF-OT-004 §5 — Liberta todas as reservas de uma OT (ao adiar/eliminar).
     * No-op seguro se não houver reservas.
     */
    async libertar(otId: number, usuario = 'sistema', manager?: EntityManager): Promise<void> {
        // #200 — com `manager`, participa na transação do chamador (edição da OT).
        if (manager) return this.libertarCom(manager, otId, usuario);
        await this.dataSource.transaction((m) => this.libertarCom(m, otId, usuario));
    }

    private async libertarCom(manager: EntityManager, otId: number, usuario: string): Promise<void> {
        const linhas = await manager.find(OtArtigo, {
            where: { ordemTrabalho: { id: otId } },
        });

        let libertadas = 0;
        for (const linha of linhas) {
            const reservada = Number(linha.qtdReservada ?? 0);
            if (!linha.artigoId || reservada <= 0) continue;

            const artigo = await manager.findOne(Artigo, {
                where: { id: linha.artigoId },
                lock: { mode: 'pessimistic_write' },
            });
            if (artigo) {
                const novoReservado = Math.max(0, Number(artigo.stockReservado) - reservada);
                await manager.update(Artigo, artigo.id, { stockReservado: novoReservado });
            }

            linha.qtdReservada = 0;
            linha.paraReposicao = false;
            await manager.save(OtArtigo, linha);
            libertadas++;
        }

        if (libertadas > 0) {
            await this.sysLogs.create({
                usuario,
                modulo: 'OT',
                acao: 'OT_STOCK_LIBERTADO',
                detalhes: `#${otId}: ${libertadas} reserva(s) libertada(s)`,
            });
        }
    }

    /**
     * RF-OT-004 §3.2 / RF-OT-005 — Baixa definitiva na execução.
     * Para cada linha: `existencia −= consumido` e `stock_reservado −= reservado`.
     * A conciliação fina reserva↔consumo é detalhada em RF-OT-005; aqui garante-se
     * apenas que a reserva é desfeita ao dar baixa (mantém a invariante).
     */
    async consumir(otId: number, usuario = 'sistema', manager?: EntityManager): Promise<void> {
        // #37 — se receber um `manager`, participa na transação do chamador
        // (ex.: fecho da OT); senão abre a sua própria transação.
        if (manager) {
            await this.consumirCom(manager, otId, usuario);
            return;
        }
        await this.dataSource.transaction((m) => this.consumirCom(m, otId, usuario));
    }

    private async consumirCom(manager: EntityManager, otId: number, usuario: string): Promise<void> {
        const linhas = await manager.find(OtArtigo, {
            where: { ordemTrabalho: { id: otId } },
        });

        for (const linha of linhas) {
            if (!linha.artigoId) continue;
            const consumido = Number(linha.qtdConsumida ?? linha.quantidade ?? 0);
            const reservada = Number(linha.qtdReservada ?? 0);
            if (consumido <= 0 && reservada <= 0) continue;

            const artigo = await manager.findOne(Artigo, {
                where: { id: linha.artigoId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!artigo) continue;

            // #204 — a baixa sai de stock_armazem (armazém do artigo e, se faltar, dos
            // restantes) e a existência é recalculada; sem stock suficiente → 422.
            await saidaStock(manager, artigo.id, consumido);
            await manager.update(Artigo, artigo.id, {
                stockReservado: Math.max(0, Number(artigo.stockReservado) - reservada),
            });

            linha.qtdConsumida = consumido;
            linha.qtdReservada = 0;
            linha.paraReposicao = false;
            await manager.save(OtArtigo, linha);
        }

        await this.sysLogs.create({
            usuario,
            modulo: 'OT',
            acao: 'OT_STOCK_CONSUMIDO',
            detalhes: `#${otId}: baixa definitiva de ${linhas.length} linha(s)`,
        });
    }
}
