import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('advertisements')
export class AdEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'target_app', type: 'enum', enum: ['passenger', 'driver', 'both'] })
  targetApp!: 'passenger' | 'driver' | 'both';

  @Column({ type: 'enum', enum: ['splash', 'banner'], default: 'splash' })
  placement!: 'splash' | 'banner';

  @Column({ name: 'image_path', type: 'varchar', length: 512, nullable: true })
  imagePath!: string | null;

  @Column({ name: 'html_content', type: 'longtext', nullable: true })
  htmlContent!: string | null;

  @Column({ name: 'link_url', type: 'varchar', length: 512, nullable: true })
  linkUrl!: string | null;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ name: 'max_concurrent_driver', default: 3 })
  maxConcurrentDriver!: number;

  @Column({ type: 'enum', enum: ['active', 'paused', 'removed'], default: 'active' })
  status!: 'active' | 'paused' | 'removed';

  @Column({ name: 'impression_count', type: 'bigint', default: 0 })
  impressionCount!: string;

  @Column({ name: 'click_count', type: 'bigint', default: 0 })
  clickCount!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
