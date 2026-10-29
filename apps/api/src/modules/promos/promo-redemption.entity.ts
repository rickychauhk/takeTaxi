import { CreateDateColumn, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('promo_code_redemptions')
export class PromoRedemptionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ name: 'promo_code_id', type: 'int' })
  promoCodeId!: number;

  @Column({ name: 'driver_id', type: 'bigint' })
  driverId!: string;

  @CreateDateColumn({ name: 'redeemed_at' })
  redeemedAt!: Date;
}
