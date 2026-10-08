"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { setStudyContentDir, writeLauncherSettings } from "@/lib/settings";
import { runBackup } from "@/lib/backup";

export async function saveSettingsAction(formData: FormData) {
  const dir = formData.get("studyContentDir");
  setStudyContentDir(getDb(), typeof dir === "string" ? dir : null);
  revalidatePath("/settings");
}

export async function saveNetworkAction(formData: FormData) {
  writeLauncherSettings({ networkAccess: formData.get("networkAccess") === "on" });
  revalidatePath("/settings");
}

export async function backupNowAction() {
  await runBackup();
  revalidatePath("/settings");
}
