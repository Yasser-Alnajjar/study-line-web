import type { UUID } from "./common";
import type { Database } from "./database";
import type { NotificationType } from "./notification";

type Tables = Database["public"]["Tables"];

export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export interface NotificationPreferences {
  enabledInBrowser: boolean;
  enabledInEmail: boolean;
  types: Record<NotificationType, boolean>;
}

/** Mirrors the `settings.notification_preferences` jsonb column default. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabledInBrowser: true,
  enabledInEmail: false,
  types: {
    upcoming_lesson: true,
    homework_due: true,
    daily_reminder: true,
    review_reminder: true,
  },
};

export interface UserSettings {
  userId: UUID;
  theme: ThemeMode;
  locale: string;
  notificationPreferences: NotificationPreferences;
}

/** Full snapshot of one user's rows, assembled for the "export my data" download. */
export interface UserDataExport {
  exportedAt: string;
  profile: Tables["profiles"]["Row"] | null;
  settings: Tables["settings"]["Row"] | null;
  subjects: Tables["subjects"]["Row"][];
  tags: Tables["tags"]["Row"][];
  lessons: Tables["lessons"]["Row"][];
  lessonTags: Tables["lesson_tags"]["Row"][];
  lessonNotes: Tables["lesson_notes"]["Row"][];
  attachments: Tables["attachments"]["Row"][];
  studySessions: Tables["study_sessions"]["Row"][];
  homework: Tables["homework"]["Row"][];
  exams: Tables["exams"]["Row"][];
  goals: Tables["goals"]["Row"][];
  achievements: Tables["user_achievements"]["Row"][];
  notifications: Tables["notifications"]["Row"][];
}
