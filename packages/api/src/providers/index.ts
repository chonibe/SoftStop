/**
 * @governor/api - Provider Factory
 * 
 * Factory for creating message provider instances.
 */

import { Env } from '../types';
export { MessageProvider, ProviderError } from './types';
export { ResendProvider } from './resend';

export function createMessageProvider(env: Env): MessageProvider {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }
  
  const { ResendProvider } = require('./resend');
  return new ResendProvider(env.RESEND_API_KEY);
}
