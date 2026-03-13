import { Injectable } from '@nestjs/common';
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
    removeModelo(id: number) { return this.modelosRepo.delete(id); }

    // EquipInstalado
    findAllEquip() { return this.equipRepo.find({ relations: ['cliente', 'modelo', 'historico'] }); }
    findOneEquip(id: number) { return this.equipRepo.findOne({ where: { id }, relations: ['cliente', 'modelo', 'historico'] }); }
    async createEquip(body: any): Promise<EquipInstalado | null> {
        const entity = this.equipRepo.create({
            ...body,
            cliente: body.clienteId ? { id: Number(body.clienteId) } : undefined,
            modelo:  body.modeloId  ? { id: Number(body.modeloId)  } : undefined,
        });
        const result: any = await this.equipRepo.save(entity);
        return this.findOneEquip(result.id);
    }
    async updateEquip(id: number, body: any) {
        const { clienteId, modeloId, ...rest } = body;
        await this.equipRepo.update(id, {
            ...rest,
            ...(clienteId ? { cliente: { id: Number(clienteId) } } : {}),
            ...(modeloId  ? { modelo:  { id: Number(modeloId)  } } : {}),
        });
        return this.findOneEquip(id);
    }
    removeEquip(id: number) { return this.equipRepo.delete(id); }
}
