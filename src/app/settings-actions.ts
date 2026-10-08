"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { setStudyContentDir } from "@/lib/settings";

export async function saveSettingsAction(formData: FormData) {
  const dir = formData.get("studyContentDir");
  setStudyContentDir(getDb(), typeof dir === "string" ? dir : null);
  revalidatePath("/settings");
}
