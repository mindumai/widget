/**
 * POST {apiUrl}/api/widget/chat/stop — arm the W4 cancellation flag for
 * this session's in-flight turn. Best-effort fire-and-forget: the
 * orchestrator finalizes the turn as 'cancelled' and the regular
 * widget.message broadcast / HTTP response closes the bubble. Failures
 * are swallowed — worst case the reply simply finishes normally.
 */
export async function postStop(opts: { apiUrl: string; token: string }): Promise<void> {
  try {
    await fetch(`${opts.apiUrl.replace(/\/+$/, '')}/api/widget/chat/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${opts.token}`,
      },
      credentials: 'omit',
    });
  } catch {
    /* network hiccup — the turn will finish on its own */
  }
}
