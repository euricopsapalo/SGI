import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import { CcEstado, CcTipo } from './conta-corrente.entity';
import { ContaBancaria } from './conta-bancaria.entity';
import { MotivoEstorno } from './motivo-estorno.entity';
import { DocumentoConfig } from './documento-config.entity';
import { erroValidacao } from './erros';
import {
    CreateCcTipoDto, UpdateCcTipoDto, CreateContaBancariaDto, UpdateContaBancariaDto,
    CreateMotivoEstornoDto, UpdateMotivoEstornoDto,
} from './dto/cadastros.dto';

/**
 * #164 — Cadastros de suporte à configuração de documentos: tipos de conta
 * corrente (com estados), contas bancárias/caixas e motivos de estorno.
 * Não se apaga nada que esteja referenciado pela configuração de um documento.
 */
@Injectable()
export class CadastrosService {
    constructor(
        @InjectRepository(CcTipo) private readonly ccTipoRepo: Repository<CcTipo>,
        @InjectRepository(CcEstado) private readonly ccEstadoRepo: Repository<CcEstado>,
        @InjectRepository(ContaBancaria) private readonly contaRepo: Repository<ContaBancaria>,
        @InjectRepository(MotivoEstorno) private readonly motivoRepo: Repository<MotivoEstorno>,
        @InjectRepository(DocumentoConfig) private readonly docRepo: Repository<DocumentoConfig>,
        private readonly dataSource: DataSource,
    ) {}

    // ── Tipos de conta corrente ──────────────────────────────────────────────

    findAllCcTipos() {
        return this.ccTipoRepo.find({ relations: ['estados'], order: { codigo: 'ASC', estados: { codigo: 'ASC' } } });
    }

    async createCcTipo(dto: CreateCcTipoDto) {
        if (await this.ccTipoRepo.exists({ where: { codigo: dto.codigo } })) {
            throw erroValidacao({ codigo: `Já existe uma conta corrente ${dto.codigo}` });
        }
        this.assertEstadosUnicos(dto.estados);
        const saved = await this.ccTipoRepo.save(this.ccTipoRepo.create({
            ...dto,
            estados: dto.estados.map(({ codigo, descricao }) => ({ codigo, descricao })),
        }));
        return this.findCcTipo(saved.id);
    }

    async updateCcTipo(id: number, dto: UpdateCcTipoDto) {
        const atual = await this.findCcTipo(id);
        if (dto.codigo && dto.codigo !== atual.codigo
            && await this.ccTipoRepo.exists({ where: { codigo: dto.codigo, id: Not(id) } })) {
            throw erroValidacao({ codigo: `Já existe uma conta corrente ${dto.codigo}` });
        }
        if (dto.entidade && dto.entidade !== atual.entidade
            && await this.docRepo.exists({ where: { ccTipoId: id } })) {
            throw erroValidacao({ entidade: 'A entidade não pode mudar: a conta corrente é usada por documentos configurados' });
        }

        await this.dataSource.transaction(async (m) => {
            const { estados, ...campos } = dto;
            if (Object.keys(campos).length) await m.update(CcTipo, id, campos);
            if (!estados) return;

            this.assertEstadosUnicos(estados);
            const manter = estados.filter((e) => e.id).map((e) => e.id as number);
            const remover = atual.estados.filter((e) => !manter.includes(e.id)).map((e) => e.id);
            if (remover.length) {
                const usados = await m.find(DocumentoConfig, { where: { ccEstadoId: In(remover) }, select: ['codigo'] });
                if (usados.length) {
                    throw erroValidacao({ estados: `Há estados em uso pelos documentos: ${usados.map((d) => d.codigo).join(', ')}` });
                }
                await m.delete(CcEstado, remover);
            }
            for (const e of estados) {
                if (e.id) {
                    if (!atual.estados.some((x) => x.id === e.id)) {
                        throw erroValidacao({ estados: `O estado ${e.id} não pertence a esta conta corrente` });
                    }
                    await m.update(CcEstado, e.id, { codigo: e.codigo, descricao: e.descricao });
                } else {
                    await m.save(m.create(CcEstado, { ccTipoId: id, codigo: e.codigo, descricao: e.descricao }));
                }
            }
        });
        return this.findCcTipo(id);
    }

    async removeCcTipo(id: number) {
        const cc = await this.findCcTipo(id);
        const usados = await this.docRepo.find({ where: { ccTipoId: id }, select: ['codigo'] });
        if (usados.length) {
            throw erroValidacao({ id: `A conta corrente ${cc.codigo} é usada pelos documentos: ${usados.map((d) => d.codigo).join(', ')}` });
        }
        await this.ccTipoRepo.delete(id);
        return { id };
    }

    private async findCcTipo(id: number) {
        const cc = await this.ccTipoRepo.findOne({ where: { id }, relations: ['estados'] });
        if (!cc) throw new NotFoundException(`Conta corrente ${id} não encontrada`);
        return cc;
    }

    private assertEstadosUnicos(estados: { codigo: string }[]) {
        const codigos = estados.map((e) => e.codigo);
        if (new Set(codigos).size !== codigos.length) {
            throw erroValidacao({ estados: 'Há códigos de estado repetidos' });
        }
    }

    // ── Contas bancárias / caixas ────────────────────────────────────────────

    findAllContas() {
        return this.contaRepo.find({ order: { codigo: 'ASC' } });
    }

    async createConta(dto: CreateContaBancariaDto) {
        if (await this.contaRepo.exists({ where: { codigo: dto.codigo } })) {
            throw erroValidacao({ codigo: `Já existe uma conta ${dto.codigo}` });
        }
        return this.contaRepo.save(this.contaRepo.create({ ...dto, moeda: 'AOA', aberta: false }));
    }

    async updateConta(id: number, dto: UpdateContaBancariaDto) {
        const atual = await this.findConta(id);
        if (dto.codigo && dto.codigo !== atual.codigo
            && await this.contaRepo.exists({ where: { codigo: dto.codigo, id: Not(id) } })) {
            throw erroValidacao({ codigo: `Já existe uma conta ${dto.codigo}` });
        }
        if (dto.tipo && dto.tipo !== atual.tipo && await this.contaUsada(id)) {
            throw erroValidacao({ tipo: 'O tipo não pode mudar: a conta está associada a documentos configurados' });
        }
        await this.contaRepo.update(id, dto);
        return this.findConta(id);
    }

    async removeConta(id: number) {
        const conta = await this.findConta(id);
        if (await this.contaUsada(id)) {
            throw erroValidacao({ id: `A conta ${conta.codigo} está associada a documentos configurados (pode ser desactivada)` });
        }
        await this.contaRepo.delete(id);
        return { id };
    }

    private async contaUsada(id: number): Promise<boolean> {
        const [{ n }] = await this.dataSource.query(
            'SELECT COUNT(*)::int AS n FROM documentos_config_bancos WHERE conta_bancaria_id = $1', [id],
        );
        return n > 0;
    }

    private async findConta(id: number) {
        const c = await this.contaRepo.findOne({ where: { id } });
        if (!c) throw new NotFoundException(`Conta ${id} não encontrada`);
        return c;
    }

    // ── Motivos de estorno ───────────────────────────────────────────────────

    findAllMotivos() {
        return this.motivoRepo.find({ order: { codigo: 'ASC' } });
    }

    async createMotivo(dto: CreateMotivoEstornoDto) {
        if (await this.motivoRepo.exists({ where: { codigo: dto.codigo } })) {
            throw erroValidacao({ codigo: `Já existe um motivo ${dto.codigo}` });
        }
        return this.motivoRepo.save(this.motivoRepo.create(dto));
    }

    async updateMotivo(id: number, dto: UpdateMotivoEstornoDto) {
        const atual = await this.motivoRepo.findOne({ where: { id } });
        if (!atual) throw new NotFoundException(`Motivo ${id} não encontrado`);
        if (dto.codigo && dto.codigo !== atual.codigo
            && await this.motivoRepo.exists({ where: { codigo: dto.codigo, id: Not(id) } })) {
            throw erroValidacao({ codigo: `Já existe um motivo ${dto.codigo}` });
        }
        await this.motivoRepo.update(id, dto);
        return this.motivoRepo.findOne({ where: { id } });
    }

    async removeMotivo(id: number) {
        // Fase 1: ainda não há estornos; a partir da fase 6 (#169) um motivo usado só se desactiva.
        const res = await this.motivoRepo.delete(id);
        if (!res.affected) throw new NotFoundException(`Motivo ${id} não encontrado`);
        return { id };
    }
}
