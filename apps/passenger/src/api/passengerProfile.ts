import { getOrCreatePassengerClientId } from '../storage/passengerClientId';
import { passengerApiErrorMessage, passengerFetch } from './passengerClient';

export type PassengerMemberProfile = {
  id: string;
  displayName: string | null;
  phone: string | null;
  pointsBalance?: number;
  pointsHkdPerPoint?: number;
  pointsRedeemEnabled?: boolean;
};

export async function fetchPassengerMemberProfile(): Promise<PassengerMemberProfile> {
  const appClientId = await getOrCreatePassengerClientId();
  const res = await passengerFetch(
    `/passenger/auth/me?appClientId=${encodeURIComponent(appClientId)}`,
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(passengerApiErrorMessage(res.status, text));
  }
  return (await res.json()) as PassengerMemberProfile;
}
