import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedbackEntity } from './feedback.entity';

@Injectable()
export class FeedbacksService {
  constructor(@InjectRepository(FeedbackEntity) private readonly repo: Repository<FeedbackEntity>) {}

  createPublic(input: { senderName: string; senderPhone: string; message: string }) {
    const message = input.message?.trim() ?? '';
    if (!message) {
      throw new BadRequestException('請填寫意見內容');
    }
    const senderName = (input.senderName?.trim() || '乘客').slice(0, 128);
    const senderPhone = (input.senderPhone?.trim() || '—').slice(0, 32);
    return this.repo.save(
      this.repo.create({ senderName, senderPhone, message, status: 'new' }),
    );
  }

  listAdmin(status?: FeedbackEntity['status']) {
    return this.repo.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async updateStatus(_adminId: number, id: string, status: FeedbackEntity['status']) {
    await this.repo.update({ id }, { status });
    return this.repo.findOneByOrFail({ id });
  }
}
