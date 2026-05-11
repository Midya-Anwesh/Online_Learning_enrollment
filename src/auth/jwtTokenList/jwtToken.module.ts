import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from 'src/users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtTokenSerive } from './jwtTokenService';
import { JwtTokenList } from './jwtTokenList.entity';

@Module({
  imports: [TypeOrmModule.forFeature([JwtTokenList]), UsersModule, PassportModule],
  providers: [JwtTokenSerive],
  exports: [JwtTokenSerive]
})
export class JwtTokenModule {}
