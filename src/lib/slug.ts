// Pure slug helpers, safe to import from client components.

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export function isSlug(s: string): boolean {
  return SLUG_RE.test(s) && s.length <= 100;
}

/** Turn a human name into a filename slug: "Van Valkenburgh v. Lutz" -> "van-valkenburgh-v-lutz". */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}
