/**
 * POST {apiUrl}/api/widget/confirm — resume a paused chat turn after
 * the user clicks Approve or Reject on a confirmation card (FR-056).
 *
 * Returns 200 with the same shape as /api/widget/chat once Claude has
 * finished responding to the tool_result. Returns 409 on idempotent
 * double-submit (already decided), which the widget swallows quietly.
 */
export async function postConfirm(opts: {
  apiUrl: string;
  token: string;
  conversationId: number;
  decision: 'approve' | 'reject';
}): Promise<{ alreadyDecided: boolean }> {
  const url = `${opts.apiUrl.replace(/\/+$/, '')}/api/widget/confirm`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${opts.token}`,
    },
    body: JSON.stringify({
      conversation_id: opts.conversationId,
      decision: opts.decision,
    }),
    credentials: 'omit',
  });

  if (res.status === 409) {
    // Double-submit: the latest confirmation was already decided. The
    // widget's UI state may be out of sync with the server (e.g. the
    // user clicked twice quickly). Treat as a successful no-op so the
    // card lands in its decided state without surfacing an error.
    return { alreadyDecided: true };
  }
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.error) detail = `${detail} ${errBody.error}`;
    } catch {
      // Non-JSON body — keep status.
    }
    throw new ConfirmError(detail, res.status);
  }
  return { alreadyDecided: false };
}

export class ConfirmError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ConfirmError';
  }
}
export async function postConfirmExpire(opts: {
  apiUrl: string;
  token: string;
  conversationId: number;
}): Promise<void> {
  const url = `${opts.apiUrl.replace(/\/+$/, '')}/api/widget/confirm/expire`;

  // Best-effort by design. The server sweeps stale confirmations at the next
  // turn anyway (D-6C-3), so a failure here costs the user a slightly stale
  // card, not a stuck conversation — and surfacing an error for something
  // they did not do would be worse than the staleness.
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${opts.token}`,
      },
      body: JSON.stringify({ conversation_id: opts.conversationId }),
      credentials: 'omit',
    });
  } catch {
    // Swallowed on purpose — see above.
  }
}
