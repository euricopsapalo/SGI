import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vendedor } from './vendedor.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Vendedor])],
    exports: [TypeOrmModule],
})
export class VendedoresModule { }
