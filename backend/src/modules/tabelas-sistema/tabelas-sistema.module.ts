import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TipoTrabalho } from './tipo-trabalho.entity';
import { TipoDocumento } from './tipo-documento.entity';
import { TipoOT } from './tipo-ot.entity';
import { FuncaoTecnico } from './funcao-tecnico.entity';
import { Moeda } from './moeda.entity';
import { Pais } from './pais.entity';
import { Provincia } from './provincia.entity';
import { Municipio } from './municipio.entity';
import { TaxaIva } from './taxa-iva.entity';
import { ClasseArtigo } from './classe-artigo.entity';
import { FamiliaArtigo } from './familia-artigo.entity';
import { DocumentoCompra } from './documento-compra.entity';
import { CondicaoPagamento } from './condicao-pagamento.entity';
import { ModoPagamento } from './modo-pagamento.entity';
import { TabelasSistemaService } from './tabelas-sistema.service';
import { ClassesArtigoController } from './classes-artigo.controller';
import { FamiliasArtigoController } from './familias-artigo.controller';
import { DocumentosCompraController } from './documentos-compra.controller';
import { CondicoesPagamentoController } from './condicoes-pagamento.controller';
import { ModosPagamentoController } from './modos-pagamento.controller';
import { TiposTrabalhoController } from './tipos-trabalho.controller';
import { TiposDocumentoController } from './tipos-documento.controller';
import { TiposOTController } from './tipos-ot.controller';
import { FuncoesTecnicoController } from './funcoes-tecnico.controller';
import { MoedasController } from './moedas.controller';
import { PaisesController } from './paises.controller';
import { ProvinciasController } from './provincias.controller';
import { MunicipiosController } from './municipios.controller';
import { TaxasIvaController } from './taxas-iva.controller';

@Module({
    imports: [TypeOrmModule.forFeature([TipoTrabalho, TipoDocumento, TipoOT, FuncaoTecnico, Moeda, Pais, Provincia, Municipio, TaxaIva, ClasseArtigo, FamiliaArtigo, DocumentoCompra, CondicaoPagamento, ModoPagamento])],
    controllers: [
        TiposTrabalhoController,
        TiposDocumentoController,
        TiposOTController,
        FuncoesTecnicoController,
        MoedasController,
        PaisesController,
        ProvinciasController,
        MunicipiosController,
        TaxasIvaController,
        ClassesArtigoController,
        FamiliasArtigoController,
        DocumentosCompraController,
        CondicoesPagamentoController,
        ModosPagamentoController,
    ],
    providers: [TabelasSistemaService],
    exports: [TypeOrmModule, TabelasSistemaService],
})
export class TabelasSistemaModule {}
