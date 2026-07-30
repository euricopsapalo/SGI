import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ConfiguracaoModule } from '../configuracao/configuracao.module';

@Module({
    imports: [TypeOrmModule.forFeature([User]), ConfiguracaoModule],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [TypeOrmModule, UsersService],
})
export class UsersModule { }
