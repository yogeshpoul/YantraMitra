import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ENV, type Env } from '../../config/env.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LoginThrottleService } from './login-throttle.service.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';

const TOKEN = { issuer: 'yantramitra', audience: 'yantramitra-api' };

@Global()
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        secret: env.JWT_SECRET,
        signOptions: { ...TOKEN, algorithm: 'HS256', expiresIn: env.ACCESS_TOKEN_TTL_SECONDS },
        verifyOptions: { ...TOKEN, algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionService, LoginThrottleService],
  exports: [PasswordService, SessionService],
})
export class AuthModule {}
