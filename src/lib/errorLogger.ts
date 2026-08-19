import { supabase } from "@/lib/supabase";
import { getInitData } from "@/lib/telegram";

export type ErrorSource = "frontend_render" | "frontend_query" | "frontend_mutation" | "frontend_unhandled";

/**
 * Fire-and-forget error telemetry. Never throws, never awaited by callers —
 * a failure here must not compound whatever already went wrong.
 */
export function logError(error: unknown, source: ErrorSource, context?: string): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  supabase
    .rpc("log_client_error", {
      p_init_data: getInitData(),
      p_source: source,
      p_context: context ?? null,
      p_message: message,
      p_stack: stack ?? null,
      p_metadata: null,
    })
    .then(undefined, () => {
      // swallow — logging must never itself throw
    });
}
