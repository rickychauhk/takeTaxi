import { Injectable, UnauthorizedException } from '@nestjs/common';
import { normalizePhoneE164 } from './phone.util';

type FirebaseLookupUser = {
  localId: string;
  phoneNumber?: string;
};

@Injectable()
export class FirebaseTokenService {
  private firebaseApiKeys(): string[] {
    const keys = [
      process.env.FIREBASE_WEB_API_KEY,
      process.env.PASSENGER_FIREBASE_WEB_API_KEY,
    ].filter((k): k is string => Boolean(k?.trim()));
    return [...new Set(keys.map((k) => k.trim()))];
  }

  async verifyIdToken(idToken: string): Promise<{ uid: string; phone: string }> {
    const keys = this.firebaseApiKeys();
    if (!keys.length) {
      throw new UnauthorizedException('Firebase 未設定（FIREBASE_WEB_API_KEY）');
    }

    let lastError = 'Firebase token 無效';
    for (const apiKey of keys) {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        },
      );
      const data = (await res.json()) as {
        users?: FirebaseLookupUser[];
        error?: { message: string };
      };
      if (res.ok && data.users?.[0]) {
        const user = data.users[0];
        if (!user.phoneNumber) {
          throw new UnauthorizedException('此 Firebase 帳號沒有電話號碼');
        }
        return { uid: user.localId, phone: normalizePhoneE164(user.phoneNumber) };
      }
      if (data.error?.message) lastError = data.error.message;
    }

    throw new UnauthorizedException(lastError);
  }
}
