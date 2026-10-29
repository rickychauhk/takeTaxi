import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PassengerPushInboxEntity } from './passenger-push-inbox.entity';

@Injectable()
export class PassengerPushInboxService {
  private readonly log = new Logger(PassengerPushInboxService.name);

  constructor(
    @InjectRepository(PassengerPushInboxEntity)
    private readonly repo: Repository<PassengerPushInboxEntity>,
  ) {}

  async recordDeliveries(
    passengerIds: string[],
    title: string,
    body: string,
    crmMessageId: string | null,
  ): Promise<void> {
    const ids = [...new Set(passengerIds.map((id) => String(id).trim()).filter(Boolean))];
    if (!ids.length) return;

    const chunkSize = 400;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const rows = chunk.map((passengerId) =>
        this.repo.create({
          passengerId,
          title,
          body,
          crmMessageId,
        }),
      );
      try {
        await this.repo.insert(rows);
      } catch (e) {
        this.log.warn(`passenger_push_inbox insert 失敗 (${chunk.length} 筆): ${String(e)}`);
      }
    }
  }

  listForPassenger(passengerId: string, take = 200) {
    return this.repo.find({
      where: { passengerId: String(passengerId) },
      order: { createdAt: 'DESC' },
      take,
    });
  }
}
