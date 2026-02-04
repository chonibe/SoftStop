/**
 * @governor/api - Resend Provider
 * 
 * Email provider implementation using Resend API.
 */

import { MessagePayload } from '@governor/core';
import { MessageProvider, ProviderError } from './types';

export class ResendProvider implements MessageProvider {
  name = 'resend';

  constructor(private apiKey: string) {}

  async send(payload: MessagePayload): Promise<{ messageId: string }> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: payload.from || 'onboarding@resend.dev',
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        reply_to: payload.replyTo
      })
    });

    if (!response.ok) {
      const error = await response.text();
      const providerError = new Error(`Resend API error: ${error}`) as ProviderError;
      providerError.provider = this.name;
      providerError.statusCode = response.status;
      throw providerError;
    }

    const data = await response.json() as { id: string };
    return { messageId: data.id };
  }
}
