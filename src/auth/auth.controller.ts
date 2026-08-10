import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { RequestUser } from '../common/types/request-user';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  me(@Req() request: Request & { user: RequestUser }) {
    return request.user;
  }

  @Patch('change-password')
  changePassword(@Req() request: Request & { user: RequestUser }, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(request.user.id, dto);
  }
}
