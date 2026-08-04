import type { MintedToken } from '../types';

/**
 * In-memory JWT cache. We re-mint when the token is within `REFRESH_BUFFER_MS`
 * of expiry so the next call doesn't race the orchestrator's TTL check.
 *
 * The token NEVER lives in localStorage. If a customer navigates away, the
 * widget mints fresh on next open — costs one extra round-trip, gains us
 * not persisting a bearer credential where XSS could lift it.
 */
const REFRESH_BUFFER_MS = 30_000;

let cached: MintedToken | null = null;
let inflight: Promise<MintedToken> | null = null;

export function clearTokenCache(): void {
  cached = null;
  inflight = null;
}

export async function getToken(opts: {
  tokenEndpoint: string;
  sessionId: string;
  endUserId: string | null;
  agent: string | null;
}): Promise<MintedToken> {
  if (cached && cached.expires_at * 1000 - Date.now() > REFRESH_BUFFER_MS) {
    return cached;
  }
  if (inflight) {
    return inflight;
  }

  inflight = mint(opts)
    .then((tok) => {
      cached = tok;
      return tok;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

async function mint(opts: {
  tokenEndpoint: string;
  sessionId: string;
  endUserId: string | null;
  agent: string | null;
}): Promise<MintedToken> {
  const body: Record<string, string> = { session_id: opts.sessionId };
  if (opts.endUserId) {
    body.end_user_id = opts.endUserId;
  }
  // Scoped Agents (AG5) — the orchestrator resolves the slug or degrades
  // to the default widget; the widget never hard-fails on a bad slug.
  if (opts.agent) {
    body.agent = opts.agent;
  }

  const res = await fetch(opts.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.error) detail = `${detail} ${errBody.error}`;
    } catch {
      // Body wasn't JSON — fine, keep the status.
    }
    throw new TokenMintError(detail, res.status);
  }

  const payload = (await res.json()) as Partial<MintedToken>;
  if (
    typeof payload.token !== 'string' ||
    typeof payload.expires_at !== 'number' ||
    !payload.ws ||
    typeof payload.ws.key !== 'string'
  ) {
    throw new TokenMintError('Mint endpoint response missing token / expires_at / ws fields.', res.status);
  }
  return {
    token: payload.token,
    expires_at: payload.expires_at,
    ws: payload.ws,
    // theme + welcome are optional in the mint contract — null when the
    // customer hasn't used the dashboard editors. Pass through as-is;
    // the widget bootstrap applies precedence (SDK Blade attrs > mint > defaults).
    theme: payload.theme ?? null,
    welcome: payload.welcome ?? null,
    agent: payload.agent ?? null,
  };
}

export class TokenMintError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'TokenMintError';
  }
}
