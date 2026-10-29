import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync } from 'fs';
import { basename } from 'path';
import { Repository } from 'typeorm';
import { MobileAppReleaseEntity } from './mobile-app-release.entity';

export type MobileAppReleaseRow = MobileAppReleaseEntity & {
  downloadUrl: string;
  fileName: string;
};

@Injectable()
export class MobileAppReleasesService {
  constructor(
    @InjectRepository(MobileAppReleaseEntity)
    private readonly repo: Repository<MobileAppReleaseEntity>,
  ) {}

  private enrich(row: MobileAppReleaseEntity): MobileAppReleaseRow {
    return {
      ...row,
      fileName: basename(row.filePath),
      downloadUrl: `/api/v1/admin/mobile-app-releases/${row.id}/download`,
    };
  }

  list() {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: 100 }).then((rows) => rows.map((r) => this.enrich(r)));
  }

  async create(input: {
    app: MobileAppReleaseEntity['app'];
    version: string;
    releaseNotes?: string | null;
    filePath: string;
    fileSizeBytes: number;
    uploadedByAdminId: number;
  }) {
    const row = await this.repo.save(
      this.repo.create({
        app: input.app,
        version: input.version.trim(),
        releaseNotes: input.releaseNotes?.trim() || null,
        filePath: input.filePath,
        fileSizeBytes: String(input.fileSizeBytes),
        uploadedByAdminId: input.uploadedByAdminId,
      }),
    );
    return this.enrich(row);
  }

  async deploy(id: string, environment: 'uat' | 'prod') {
    const row = await this.repo.findOneBy({ id });
    if (!row) throw new NotFoundException('Release not found');

    await this.repo.update(
      { app: row.app },
      environment === 'uat' ? { isActiveUat: false } : { isActiveProd: false },
    );

    if (environment === 'uat') {
      row.isActiveUat = true;
      row.deployedUatAt = new Date();
    } else {
      row.isActiveProd = true;
      row.deployedProdAt = new Date();
    }
    await this.repo.save(row);
    return this.enrich(row);
  }

  async openDownloadStream(id: string) {
    const row = await this.repo.findOneBy({ id });
    if (!row) throw new NotFoundException('Release not found');
    if (!existsSync(row.filePath)) throw new NotFoundException('APK file missing on server');
    const stream = createReadStream(row.filePath);
    const fileName = `${row.app}-${row.version}.apk`;
    return { stream, fileName, size: Number(row.fileSizeBytes) || undefined };
  }
}
