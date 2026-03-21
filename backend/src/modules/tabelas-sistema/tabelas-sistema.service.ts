import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoTrabalho } from './tipo-trabalho.entity';
import { TipoDocumento } from './tipo-documento.entity';
import { TipoOT } from './tipo-ot.entity';
import { FuncaoTecnico } from './funcao-tecnico.entity';
import { Moeda } from './moeda.entity';
import { Pais } from './pais.entity';
import { Provincia } from './provincia.entity';
import { Municipio } from './municipio.entity';

@Injectable()
export class TabelasSistemaService {
    constructor(
        @InjectRepository(TipoTrabalho)
        private tiposTrabalhoRepo: Repository<TipoTrabalho>,

        @InjectRepository(TipoDocumento)
        private tiposDocumentoRepo: Repository<TipoDocumento>,

        @InjectRepository(TipoOT)
        private tiposOTRepo: Repository<TipoOT>,

        @InjectRepository(FuncaoTecnico)
        private funcoesTecnicoRepo: Repository<FuncaoTecnico>,

        @InjectRepository(Moeda)
        private moedasRepo: Repository<Moeda>,

        @InjectRepository(Pais)
        private paisesRepo: Repository<Pais>,

        @InjectRepository(Provincia)
        private provinciasRepo: Repository<Provincia>,

        @InjectRepository(Municipio)
        private municipiosRepo: Repository<Municipio>,
    ) {}

    // TipoTrabalho
    findAllTiposTrabalho() { return this.tiposTrabalhoRepo.find(); }
    findOneTipoTrabalho(id: number) { return this.tiposTrabalhoRepo.findOne({ where: { id } }); }
    createTipoTrabalho(body: Partial<TipoTrabalho>) { return this.tiposTrabalhoRepo.save(this.tiposTrabalhoRepo.create(body)); }
    async updateTipoTrabalho(id: number, body: Partial<TipoTrabalho>) {
        await this.tiposTrabalhoRepo.update(id, body);
        return this.findOneTipoTrabalho(id);
    }
    removeTipoTrabalho(id: number) { return this.tiposTrabalhoRepo.delete(id); }

    // TipoOT
    findAllTiposOT() { return this.tiposOTRepo.find(); }
    findOneTipoOT(id: number) { return this.tiposOTRepo.findOne({ where: { id } }); }
    createTipoOT(body: Partial<TipoOT>) { return this.tiposOTRepo.save(this.tiposOTRepo.create(body)); }
    async updateTipoOT(id: number, body: Partial<TipoOT>) {
        await this.tiposOTRepo.update(id, body);
        return this.findOneTipoOT(id);
    }
    removeTipoOT(id: number) { return this.tiposOTRepo.delete(id); }

    // TipoDocumento
    findAllTiposDocumento() { return this.tiposDocumentoRepo.find(); }
    findOneTipoDocumento(id: number) { return this.tiposDocumentoRepo.findOne({ where: { id } }); }
    createTipoDocumento(body: Partial<TipoDocumento>) { return this.tiposDocumentoRepo.save(this.tiposDocumentoRepo.create(body)); }
    async updateTipoDocumento(id: number, body: Partial<TipoDocumento>) {
        await this.tiposDocumentoRepo.update(id, body);
        return this.findOneTipoDocumento(id);
    }
    removeTipoDocumento(id: number) { return this.tiposDocumentoRepo.delete(id); }

    // FuncaoTecnico
    findAllFuncoesTecnico() { return this.funcoesTecnicoRepo.find(); }
    findOneFuncaoTecnico(id: number) { return this.funcoesTecnicoRepo.findOne({ where: { id } }); }
    createFuncaoTecnico(body: Partial<FuncaoTecnico>) { return this.funcoesTecnicoRepo.save(this.funcoesTecnicoRepo.create(body)); }
    async updateFuncaoTecnico(id: number, body: Partial<FuncaoTecnico>) {
        await this.funcoesTecnicoRepo.update(id, body);
        return this.findOneFuncaoTecnico(id);
    }
    removeFuncaoTecnico(id: number) { return this.funcoesTecnicoRepo.delete(id); }

    // Moeda
    findAllMoedas() { return this.moedasRepo.find(); }
    findOneMoeda(id: number) { return this.moedasRepo.findOne({ where: { id } }); }
    createMoeda(body: Partial<Moeda>) { return this.moedasRepo.save(this.moedasRepo.create(body)); }
    async updateMoeda(id: number, body: Partial<Moeda>) {
        await this.moedasRepo.update(id, body);
        return this.findOneMoeda(id);
    }
    removeMoeda(id: number) { return this.moedasRepo.delete(id); }

    // Pais
    findAllPaises() { return this.paisesRepo.find(); }
    findOnePais(id: number) { return this.paisesRepo.findOne({ where: { id } }); }
    createPais(body: Partial<Pais>) { return this.paisesRepo.save(this.paisesRepo.create(body)); }
    async updatePais(id: number, body: Partial<Pais>) {
        await this.paisesRepo.update(id, body);
        return this.findOnePais(id);
    }
    removePais(id: number) { return this.paisesRepo.delete(id); }

    // Provincia
    findAllProvincias() { return this.provinciasRepo.find({ relations: ['pais'] }); }
    findByPais(paisId: number) { return this.provinciasRepo.find({ where: { pais: { id: paisId } }, relations: ['pais'] }); }
    findOneProvincia(id: number) { return this.provinciasRepo.findOne({ where: { id }, relations: ['pais'] }); }
    createProvincia(body: Partial<Provincia>) { return this.provinciasRepo.save(this.provinciasRepo.create(body)); }
    async updateProvincia(id: number, body: Partial<Provincia>) {
        await this.provinciasRepo.update(id, body);
        return this.findOneProvincia(id);
    }
    removeProvincia(id: number) { return this.provinciasRepo.delete(id); }

    // Municipio
    findAllMunicipios() { return this.municipiosRepo.find({ relations: ['provincia'] }); }
    findByProvincia(provinciaId: number) { return this.municipiosRepo.find({ where: { provincia: { id: provinciaId } }, relations: ['provincia'] }); }
    findOneMunicipio(id: number) { return this.municipiosRepo.findOne({ where: { id }, relations: ['provincia'] }); }
    createMunicipio(body: Partial<Municipio>) { return this.municipiosRepo.save(this.municipiosRepo.create(body)); }
    async updateMunicipio(id: number, body: Partial<Municipio>) {
        await this.municipiosRepo.update(id, body);
        return this.findOneMunicipio(id);
    }
    removeMunicipio(id: number) { return this.municipiosRepo.delete(id); }
}
