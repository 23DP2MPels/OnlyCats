import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, SessionUser } from './auth';
import { EarningsService } from './earnings.service';

@Controller('account/transactions')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private readonly earnings: EarningsService) {}

  @Get() history(@CurrentUser() user: SessionUser) {
    return this.earnings.transactions(user.id);
  }

  @Post('sync') sync(@CurrentUser() user: SessionUser) {
    return this.earnings.syncTransactions(user.id);
  }
}
