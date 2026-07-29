import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModeloEquipamento } from './modelo-equipamento.entity';
import { EquipInstalado } from './equip-instalado.entity';

@Injectable()
export class ParqueService {
    constructor(
        @InjectRepository(ModeloEquipamento)
        private modelosRepo: Repository<ModeloEquipamento>,

        @InjectRepository(EquipInstalado)
        private equipRepo: Repository<EquipInstalado>,
    ) {}

    // ModeloEquipamento
    findAllModelos() { return this.modelosRepo.find(); }
    findOneModelo(id: number) { return this.modelosRepo.findOne({ where: { id } }); }
    createModelo(body: Partial<ModeloEquipamento>) { return this.modelosRepo.save(this.modelosRepo.create(body)); }
    async updateModelo(id: number, body: Partial<ModeloEquipamento>) {
        await this.modelosRepo.update(id, body);
        return this.findOneModelo(id);
    }
    async removeModelo(id: number) {
        try {
            const res = await this.modelosRepo.delete(id);
            if (!res.affected) throw new NotFoundException('Modelo não encontrado.');
            return res;
        } catch (err) {
            throw this.mapFkConflict(err, 'Não é possível eliminar: existem equipamentos associados a este modelo.');
        }
    }

    // EquipInstalado
    findAllEquip() { return this.equipRepo.find({ relations: ['cliente', 'modelo'] }); }
    findOneEquip(id: number) { return this.equipRepo.findOne({ where: { id }, relations: ['cliente', 'modelo'] }); }
    async createEquip(body: any): Promise<EquipInstalado | null> {
        const entity = this.equipRepo.create({
            ...body,
            cliente: body.clienteId ? { id: Number(body.clienteId) } : undefined,
            modelo:  body.modeloId  ? { id: Number(body.modeloId)  } : undefined,
        });
        try {
            const result: any = await this.equipRepo.save(entity);
            return this.findOneEquip(result.id);
        } catch (err) {
            throw this.mapNrSerieConflict(err);
        }
    }
    async updateEquip(id: number, body: any) {
        const { clienteId, modeloId, ...rest } = body;
        try {
            await this.equipRepo.update(id, {
                ...rest,
                ...(clienteId ? { cliente: { id: Number(clienteId) } } : {}),
                ...(modeloId  ? { modelo:  { id: Number(modeloId)  } } : {}),
            });
        } catch (err) {
            throw this.mapNrSerieConflict(err);
        }
        return this.findOneEquip(id);
    }
    async removeEquip(id: number) {
        try {
            const res = await this.equipRepo.delete(id);
            if (!res.affected) throw new NotFoundException('Equipamento não encontrado.');
            return res;
        } catch (err) {
            throw this.mapFkConflict(err, 'Não é possível eliminar: existem OTs ou planos associados a este equipamento.');
        }
    }

    /** Traduz a violação de FK (Postgres 23503) num 409 legível (#95). */
    private mapFkConflict(err: any, message: string): any {
        if (err instanceof NotFoundException) return err;
        if (err?.code === '23503') return new ConflictException(message);
        return err;
    }

    /** Traduz a violação de UNIQUE (Postgres 23505) num 409 legível (#93). */
    private mapNrSerieConflict(err: any): any {
        if (err?.code === '23505') {
            return new ConflictException('Já existe um equipamento com esse nº de série.');
        }
        return err;
    }
}
