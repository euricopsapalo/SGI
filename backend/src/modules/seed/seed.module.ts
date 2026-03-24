import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { TaxaIva } from '../tabelas-sistema/taxa-iva.entity';
import { SeedService } from './seed.service';

@Module({
    imports: [TypeOrmModule.forFeature([User, TaxaIva])],
    providers: [SeedService],
})
export class SeedModule {}
