import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from 'src/users/users.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtTokenModule } from './jwtTokenList/jwtToken.module';
import { jwtValidationStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [JwtTokenModule, UsersModule, PassportModule],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, jwtValidationStrategy]
})
export class AuthModule {}
