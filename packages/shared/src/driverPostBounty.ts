export const DRIVER_POST_BOUNTY_OPTIONS = [0, 3, 5, 8, 12] as const;
export type DriverPostBountyPoints = (typeof DRIVER_POST_BOUNTY_OPTIONS)[number];

export function isDriverPostBountyPoints(n: number): n is DriverPostBountyPoints {
  return (DRIVER_POST_BOUNTY_OPTIONS as readonly number[]).includes(n);
}
