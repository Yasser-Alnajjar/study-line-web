"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { deleteAccount, exportUserData } from "@/actions/settings.mutations";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ui-system/confirm-dialog";
import useTranslate from "@/hooks/useTranslate";
import { useRouter } from "@/i18n/navigation";
import type { UserDataExport, UserSettings } from "@/lib/types/settings";

interface SettingsDataViewProps {
  data: UserSettings | null;
  email: string | null;
}

function downloadExport(data: UserDataExport) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `study-line-export-${data.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const SettingsDataView = ({ data, email }: SettingsDataViewProps) => {
  const t = useTranslate("settings.data");
  const router = useRouter();

  const [exportStatus, setExportStatus] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const exportMutation = useMutation({
    mutationFn: () => exportUserData(),
    onSuccess: (result) => {
      if (result.data) {
        downloadExport(result.data);
        setExportStatus({ kind: "success", message: t("exportSuccess") });
      } else {
        setExportStatus({
          kind: "error",
          message: result.error ?? t("genericError"),
        });
      }
    },
    onError: () => setExportStatus({ kind: "error", message: t("genericError") }),
  });

  return (
    <div className="flex justify-center">
      <div className="flex flex-col gap-4 w-full max-w-2xl mt-4">
        <div>
          <h1 className="text-foreground text-xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>

        {!data && (
          <p role="alert" className="text-destructive text-sm">
            {t("missingSettings")}
          </p>
        )}

        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-semibold">{t("exportTitle")}</h2>
            <p className="text-muted-foreground text-sm">{t("exportDescription")}</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setExportStatus(null);
                exportMutation.mutate();
              }}
              disabled={exportMutation.isPending}
            >
              <Download />
              {exportMutation.isPending ? t("exporting") : t("exportButton")}
            </Button>
            {exportStatus && (
              <p
                role="status"
                className={
                  exportStatus.kind === "error"
                    ? "text-destructive text-sm"
                    : "text-sm"
                }
              >
                {exportStatus.message}
              </p>
            )}
          </div>
        </section>

        <Separator />

        <section className="border-destructive/40 flex flex-col gap-3 rounded-md border p-4">
          <div>
            <h2 className="text-destructive text-sm font-semibold">
              {t("dangerZoneTitle")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {email
                ? t("deleteAccountDescription", { email })
                : t("deleteAccountDescriptionNoEmail")}
            </p>
          </div>

          {deleteError && (
            <p role="alert" className="text-destructive text-sm">
              {deleteError}
            </p>
          )}

          <ConfirmDialog
            trigger={
              <Button type="button" variant="destructive" className="w-fit">
                {t("deleteAccountButton")}
              </Button>
            }
            title={t("deleteConfirmTitle")}
            description={t("deleteConfirmDescription")}
            confirmLabel={t("deleteConfirmButton")}
            cancelLabel={t("deleteCancelButton")}
            variant="destructive"
            onConfirm={async () => {
              setDeleteError(null);
              const result = await deleteAccount();
              if (!result.success) {
                const message = result.error ?? t("genericError");
                setDeleteError(message);
                throw new Error(message);
              }
              router.push("/");
              router.refresh();
            }}
          />
        </section>
      </div>
    </div>
  );
};
