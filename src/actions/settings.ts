import "server-only";

import { parseNotificationPreferences } from "@/lib/notifications/preferences";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, MutationResult } from "@/lib/types/common";
import type { ThemeMode, UserSettings } from "@/lib/types/settings";
import { THEME_MODES } from "@/lib/types/settings";
import { deleteAccount, exportUserData, updateNotificationPreferences } from "./settings.mutations";

function toThemeMode(value: string): ThemeMode {
  return (THEME_MODES as readonly string[]).includes(value) ? (value as ThemeMode) : "system";
}

export const settingsActions = {
  /**
   * Implemented ahead of Phase 16 because Phase 14 needs
   * `notificationPreferences` to decide what to generate and how to deliver it.
   */
  async get(): Promise<ActionResult<UserSettings>> {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return { data: null, error: null };
    }

    const { data: row, error } = await supabase
      .from("settings")
      .select("*")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }

    if (!row) {
      return { data: null, error: null };
    }

    return {
      data: {
        userId: row.user_id,
        theme: toThemeMode(row.theme),
        locale: row.locale,
        notificationPreferences: parseNotificationPreferences(row.notification_preferences),
      },
      error: null,
    };
  },

  updateNotificationPreferences,
  exportData: exportUserData,
  deleteAccount,

  /** TODO(Phase 16 — Settings): replace stub with a Supabase update (theme/locale). */
  async update(_input: Partial<UserSettings>): Promise<MutationResult> {
    return { success: false, error: "Not implemented until Phase 16." };
  },
};
