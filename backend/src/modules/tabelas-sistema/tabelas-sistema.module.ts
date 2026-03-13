import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TipoTrabalho } from './tipo-trabalho.entity';
import { TipoDocumento } from './tipo-documento.entity';
import { FuncaoTecnico } from './funcao-tecnico.entity';
import { Moeda } from './moeda.entity';
import { Pais } from './pais.entity';
import { Provincia } from './provincia.entity';
import { Municipio } from './municipio.entity';
import { TabelasSistemaService } from './tabelas-sistema.service';
import { TiposTrabalhoController } from './tipos-trabalho.controller';
import { TiposDocumentoController } from './tipos-documento.controller';
import { FuncoesTecnicoController } from './funcoes-tecnico.controller';
import { MoedasController } from './moedas.controller';
import { PaisesController } from './paises.controller';
import { ProvinciasController } from './provincias.controller';
import { MunicipiosController } from './municipios.controller';

@Module({
    imports: [TypeOrmModule.forFeature([TipoTrabalho, TipoDocumento, FuncaoTecnico, Moeda, Pais, Provincia, Municipio])],
    controllers: [
        TiposTrabalhoController,
        TiposDocumentoController,
        FuncoesTecnicoController,
        MoedasController,
        PaisesController,
        ProvinciasController,
        MunicipiosController,
    ],
    providers: [TabelasSistemaService],
    exports: [TypeOrmModule, TabelasSistemaService],
})
export class TabelasSistemaModule {}
