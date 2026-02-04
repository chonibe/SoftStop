/**
 * @governor/api - Provider Types
 * 
 * Type definitions for message providers.
 */

import { MessagePayload } from '@governor/core';

export interface MessageProvider {
  name: string;
  send(payload: MessagePayload): Promise<{ messageId: string }>;
}

export interface ProviderError extends Error {
  provider: string;
  statusCode?: number;
}
