import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales invalidas');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Usuario inactivo');
    }

    const safeUser = { id: user.id, name: user.name, email: user.email, isActive: user.isActive };
    return {
      accessToken: await this.jwtService.signAsync({ sub: user.id, email: user.email }),
      user: safeUser,
    };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Password actual invalida');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Usuario inactivo');
    }

    return this.usersService.updatePassword(user.id, await bcrypt.hash(dto.newPassword, 10));
  }
}
