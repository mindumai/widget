import type { ChatTurnResponse } from '../types';

/**
 * POST {apiUrl}/api/widget/chat with the JWT as bearer.
 *
 * The orchestrator reads session_id from the JWT claim, so the widget
 * never sends it in the body — even spoofed, it'd be ignored. Only
 * `message` goes over the wire.
 */
export async function postChat(opts: {
  apiUrl: string;
  token: string;
  message: string;
}): Promise<ChatTurnResponse> {
  const url = `${opts.apiUrl.replace(/\/+$/, '')}/api/widget/chat`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${opts.token}`,
    },
    body: JSON.stringify({ message: opts.message }),
    credentials: 'omit',
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.error) detail = `${detail} ${errBody.error}`;
    } catch {
      // Non-JSON body, keep status.
    }
    throw new ChatError(detail, res.status);
  }

  return (await res.json()) as ChatTurnResponse;
}

export class ChatError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ChatError';
  }
}
