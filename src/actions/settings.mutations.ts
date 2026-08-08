"use server";

/**
 * Client-invokable settings Server Actions. Theme/locale persistence to the
 * `settings` table (`Actions.Settings.update`) still lands in Phase 16 — see
 * the stub in `src/actions/settings.ts`.
 */

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, MutationResult } from "@/lib/types/common";
import type { NotificationPreferences, UserDataExport } from "@/lib/types/settings";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function getAuthedUserId(
  supabase: SupabaseServerClient,
): Promise<{ userId: string } | { error: string }> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { error: "You must be signed in." };
  }
  return { userId: data.user.id };
}

export async function updateNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<MutationResult> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return { success: false, error: "You must be signed in." };
  }

  // Whole-object write rather than a jsonb merge: the UI always submits the
  // complete, defaults-filled shape (see parseNotificationPreferences), so
  // there's no partial state to preserve.
  const { error } = await supabase
    .from("settings")
    .update({ notification_preferences: { ...preferences } })
    .eq("user_id", authData.user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/", "layout");
  return { success: true, error: null };
}

/**
 * Assembles every row the signed-in user owns into one JSON-serializable
 * snapshot for the "download my data" button. Attachment binaries aren't
 * bundled — each attachment row keeps its existing public storage URL, which
 * is enough to re-download the file separately.
 */
export async function exportUserData(): Promise<ActionResult<UserDataExport>> {
  const supabase = await createClient();
  const auth = await getAuthedUserId(supabase);
  if ("error" in auth) return { data: null, error: auth.error };
  const { userId } = auth;

  const [
    profileRes,
    settingsRes,
    subjectsRes,
    tagsRes,
    lessonsRes,
    lessonNotesRes,
    attachmentsRes,
    studySessionsRes,
    homeworkRes,
    examsRes,
    goalsRes,
    achievementsRes,
    notificationsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("subjects").select("*").eq("user_id", userId),
    supabase.from("tags").select("*").eq("user_id", userId),
    supabase.from("lessons").select("*").eq("user_id", userId),
    supabase.from("lesson_notes").select("*").eq("user_id", userId),
    supabase.from("attachments").select("*").eq("user_id", userId),
    supabase.from("study_sessions").select("*").eq("user_id", userId),
    supabase.from("homework").select("*").eq("user_id", userId),
    supabase.from("exams").select("*").eq("user_id", userId),
    supabase.from("goals").select("*").eq("user_id", userId),
    supabase.from("user_achievements").select("*").eq("user_id", userId),
    supabase.from("notifications").select("*").eq("user_id", userId),
  ]);

  const firstError = [
    profileRes.error,
    settingsRes.error,
    subjectsRes.error,
    tagsRes.error,
    lessonsRes.error,
    lessonNotesRes.error,
    attachmentsRes.error,
    studySessionsRes.error,
    homeworkRes.error,
    examsRes.error,
    goalsRes.error,
    achievementsRes.error,
    notificationsRes.error,
  ].find((error): error is NonNullable<typeof error> => Boolean(error));
  if (firstError) return { data: null, error: firstError.message };

  // No `user_id` column on the join table — scope it through the lessons just fetched.
  let lessonTags: UserDataExport["lessonTags"] = [];
  const lessonIds = (lessonsRes.data ?? []).map((lesson) => lesson.id);
  if (lessonIds.length > 0) {
    const { data, error } = await supabase
      .from("lesson_tags")
      .select("*")
      .in("lesson_id", lessonIds);
    if (error) return { data: null, error: error.message };
    lessonTags = data ?? [];
  }

  return {
    data: {
      exportedAt: new Date().toISOString(),
      profile: profileRes.data,
      settings: settingsRes.data,
      subjects: subjectsRes.data ?? [],
      tags: tagsRes.data ?? [],
      lessons: lessonsRes.data ?? [],
      lessonTags,
      lessonNotes: lessonNotesRes.data ?? [],
      attachments: attachmentsRes.data ?? [],
      studySessions: studySessionsRes.data ?? [],
      homework: homeworkRes.data ?? [],
      exams: examsRes.data ?? [],
      goals: goalsRes.data ?? [],
      achievements: achievementsRes.data ?? [],
      notifications: notificationsRes.data ?? [],
    },
    error: null,
  };
}

/**
 * Permanently deletes the signed-in user's account. Every `user_id`-owned
 * table cascades at the DB level once the `auth.users` row is gone (see the
 * migrations), but Storage objects don't — those are removed explicitly
 * first, from the paths already recorded on each `attachments` row.
 *
 * `auth.admin.deleteUser` only exists on the service-role client: a user has
 * no self-delete endpoint in Supabase Auth, so `createAdminClient()` is
 * required here (a second legitimate use beyond the one documented on it).
 */
export async function deleteAccount(): Promise<MutationResult> {
  const supabase = await createClient();
  const auth = await getAuthedUserId(supabase);
  if ("error" in auth) return { success: false, error: auth.error };
  const { userId } = auth;

  const { data: attachmentRows } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("user_id", userId);

  const storagePaths = (attachmentRows ?? []).map((row) => row.storage_path);
  if (storagePaths.length > 0) {
    await supabase.storage.from("attachments").remove(storagePaths);
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { success: false, error: error.message };

  await supabase.auth.signOut();
  return { success: true, error: null };
}
