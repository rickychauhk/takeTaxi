import { messageFromPassengerApiErrorBody } from './parsePassengerApiError';
import { passengerApiErrorMessage, passengerFetch } from './passengerClient';

export type SubmitFeedbackInput = {
  senderName: string;
  senderPhone: string;
  message: string;
};

export async function submitPassengerFeedback(input: SubmitFeedbackInput): Promise<void> {
  const res = await passengerFetch('/public/feedbacks', {
    method: 'POST',
    body: JSON.stringify({
      senderName: input.senderName.trim(),
      senderPhone: input.senderPhone.trim(),
      message: input.message.trim(),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    const parsed = messageFromPassengerApiErrorBody(text);
    throw new Error(parsed ?? passengerApiErrorMessage(res.status, text));
  }
}
