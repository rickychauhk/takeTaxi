import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { basename } from 'path';
import { Repository } from 'typeorm';
import { DocumentEntity } from './document.entity';

@Injectable()
export class DocumentsService {
  constructor(@InjectRepository(DocumentEntity) private readonly repo: Repository<DocumentEntity>) {}

  uploadPublicUrl(filePath: string): string {
    const name = basename(filePath.replace(/\\/g, '/'));
    return `/api/v1/uploads/${name}`;
  }

  listForDriver(driverId: string) {
    return this.repo.find({ where: { driverId }, order: { createdAt: 'DESC' } });
  }

  findById(id: string) {
    return this.repo.findOneBy({ id });
  }

  listPending() {
    return this.repo.find({ where: { reviewStatus: 'pending' }, order: { createdAt: 'ASC' } });
  }

  registerUpload(driverId: string, docType: DocumentEntity['docType'], filePath: string) {
    return this.repo.save(this.repo.create({ driverId, docType, filePath, reviewStatus: 'pending' }));
  }

  async review(adminId: number, id: string, status: DocumentEntity['reviewStatus'], note?: string) {
    await this.repo.update({ id }, { reviewStatus: status, reviewedByAdminId: adminId, reviewNote: note ?? null });
    return this.repo.findOneByOrFail({ id });
  }
}
