// Reading and writing map.json files. Server only.

import fs from "node:fs";
import path from "node:path";
import { CONTENT_ROOT } from "./loader";
import { isSlug } from "../slug";
import { EMPTY_MAP, normaliseMap, type MapFile } from "./mapschema";

export * from "./mapschema";

export function mapFilePath(courseSlug: string, unitSlug?: string): string {
  if (!isSlug(courseSlug) || (unitSlug !== undefined && !isSlug(unitSlug))) throw new Error("bad course or unit slug");
  return unitSlug ? path.join(CONTENT_ROOT, courseSlug, unitSlug, "map.json") : path.join(CONTENT_ROOT, courseSlug, "map.json");
}

export function readMap(courseSlug: string, unitSlug?: string): { map: MapFile; problems: string[]; exists: boolean } {
  const file = mapFilePath(courseSlug, unitSlug);
  if (!fs.existsSync(file)) return { map: { ...EMPTY_MAP }, problems: [], exists: false };
  try {
    const { map, problems } = normaliseMap(JSON.parse(fs.readFileSync(file, "utf8")));
    return { map, problems, exists: true };
  } catch (e) {
    return { map: { ...EMPTY_MAP }, problems: [`map.json could not be parsed: ${(e as Error).message}`], exists: true };
  }
}

export function writeMap(courseSlug: string, unitSlug: string | undefined, map: MapFile): string {
  const file = mapFilePath(courseSlug, unitSlug);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(map, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, file);
  return path.relative(CONTENT_ROOT, file).split(path.sep).join("/");
}

/** Every map in the course: the course map and each unit map, with their file-relative keys. */
export function allMapsForCourse(courseSlug: string, unitSlugs: string[]): { key: string; unitSlug?: string; map: MapFile }[] {
  const out: { key: string; unitSlug?: string; map: MapFile }[] = [{ key: `${courseSlug}/map.json`, map: readMap(courseSlug).map }];
  for (const u of unitSlugs) out.push({ key: `${courseSlug}/${u}/map.json`, unitSlug: u, map: readMap(courseSlug, u).map });
  return out;
}
