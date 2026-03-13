import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fornecedor } from './fornecedor.entity';
import { FornecedoresService } from './fornecedores.service';
import { FornecedoresController } from './fornecedores.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Fornecedor])],
    controllers: [FornecedoresController],
    providers: [FornecedoresService],
    exports: [TypeOrmModule, FornecedoresService],
})
export class FornecedoresModule {}
