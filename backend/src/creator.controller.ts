import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser, SessionUser } from './auth';
import { EarningsService } from './earnings.service';
import { WithdrawalDto } from './dto';

@Controller('creator')
@UseGuards(AuthGuard)
export class CreatorController {
  constructor(private readonly earnings: EarningsService) {}

  @Get('earnings') summary(@CurrentUser() user: SessionUser) {
    return this.earnings.summary(user.id);
  }

  @Post('earnings/sync') sync(@CurrentUser() user: SessionUser) {
    return this.earnings.syncOwner(user.id);
  }

  @Post('withdrawals') request(
    @CurrentUser() user: SessionUser,
    @Body() dto: WithdrawalDto,
  ) {
    return this.earnings.requestWithdrawal(user.id, dto.amount, dto.requestId);
  }

  @Delete('withdrawals/:id') cancel(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.earnings.cancelWithdrawal(user.id, id);
  }
}
