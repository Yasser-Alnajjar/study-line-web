import { Actions } from "@/actions";
import { SettingsDataView } from "../csr/SettingsDataView";

export const SettingsData = async () => {
  const [{ data: settings }, { data: session }] = await Promise.all([
    Actions.Settings.get(),
    Actions.Auth.getSession(),
  ]);

  return <SettingsDataView data={settings ?? null} email={session?.email ?? null} />;
};
