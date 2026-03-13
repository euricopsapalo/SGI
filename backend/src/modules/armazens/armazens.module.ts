import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Armazem } from './armazem.entity';
import { ArmazensService } from './armazens.service';
import { ArmazensController } from './armazens.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Armazem])],
    controllers: [ArmazensController],
    providers: [ArmazensService],
    exports: [TypeOrmModule, ArmazensService],
})
export class ArmazensModule {}
