import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { readSecret } from '../../config/read-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: readSecret('JWT_SECRET'),
        });
    }

    async validate(payload: any) {
        return { id: payload.sub, email: payload.email, role: payload.role, nome: payload.nome };
    }
}
