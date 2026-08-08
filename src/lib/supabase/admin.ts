import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";
import type { Database } from "@/lib/types/database";

/**
 * Service-role Supabase client. **Bypasses Row Level Security entirely** — it
 * can read and write every user's rows, so every query made through it must
 * scope itself by `user_id` by hand.
 *
 * Two legitimate callers:
 *  - `src/actions/notifications.jobs.ts` — `notifications` grants
 *    `authenticated` no insert policy, since notification rows are derived
 *    from a user's data by a scheduled job rather than created by the user.
 *    Reached through the cron-secret-protected route handler.
 *  - `src/actions/settings.mutations.ts` (`deleteAccount`) — Supabase Auth
 *    has no self-delete endpoint; `auth.admin.deleteUser` only exists on the
 *    service-role client.
 *
 * Never import this from a Client Component, and never reach for it to work
 * around an RLS policy that is doing its job — use `createClient()` from
 * `./server.ts` for anything acting on behalf of the signed-in user.
 */
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — the notifications job cannot run without it.",
    );
  }

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
