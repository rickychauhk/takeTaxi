import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BookingOptionEntity } from './booking-option.entity';

@Entity('booking_option_categories')
export class BookingOptionCategoryEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true, length: 64 })
  code!: string;

  @Column({ name: 'label_zh', length: 128 })
  labelZh!: string;

  @Column({ name: 'label_en', length: 128 })
  labelEn!: string;

  @Column({ name: 'selection_mode', type: 'enum', enum: ['single', 'multi'] })
  selectionMode!: 'single' | 'multi';

  @Column({ name: 'display_style', type: 'enum', enum: ['chip', 'tunnel', 'vehicle'] })
  displayStyle!: 'chip' | 'tunnel' | 'vehicle';

  @Column({ name: 'screen_group', type: 'enum', enum: ['preferences', 'extras'] })
  screenGroup!: 'preferences' | 'extras';

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @OneToMany(() => BookingOptionEntity, (o) => o.category)
  options?: BookingOptionEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
