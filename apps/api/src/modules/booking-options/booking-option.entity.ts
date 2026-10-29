import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BookingOptionCategoryEntity } from './booking-option-category.entity';

@Entity('booking_options')
export class BookingOptionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'category_id' })
  categoryId!: number;

  @ManyToOne(() => BookingOptionCategoryEntity, (c) => c.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category!: BookingOptionCategoryEntity;

  @Column({ length: 64 })
  code!: string;

  @Column({ name: 'label_zh', length: 128 })
  labelZh!: string;

  @Column({ name: 'label_en', length: 128 })
  labelEn!: string;

  @Column({ name: 'icon_key', type: 'varchar', length: 64, nullable: true })
  iconKey!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
