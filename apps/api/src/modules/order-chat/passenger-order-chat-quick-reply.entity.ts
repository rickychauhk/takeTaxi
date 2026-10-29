import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type PassengerChatQuickReplyAction = 'message' | 'cancel_order' | 'release_to_hall';

@Entity('passenger_order_chat_quick_replies')
export class PassengerOrderChatQuickReplyEntity {
  @PrimaryGeneratedColumn({ unsigned: true })
  id!: number;

  @Column({ name: 'label_zh', length: 255 })
  labelZh!: string;

  @Column({ name: 'label_en', type: 'varchar', length: 255, nullable: true })
  labelEn!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @Column({
    name: 'action_type',
    type: 'enum',
    enum: ['message', 'cancel_order', 'release_to_hall'],
    default: 'message',
  })
  actionType!: PassengerChatQuickReplyAction;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
