import ReactMarkdown from "react-markdown";
import { fileUrl } from "@/lib/content/loader";

/**
 * Optional free-text markdown below a note's frontmatter. Image links written relative to the unit
 * ("images/map.png") are served from the unit's images folder.
 */
export default function NoteBody({ body, courseSlug, unitSlug }: { body: string; courseSlug: string; unitSlug: string }) {
  if (!body) return null;
  const resolve = (src: string) => (/^(https?:)?\/\//.test(src) || src.startsWith("/") ? src : fileUrl(courseSlug, unitSlug, src.replace(/^\.\//, "")));
  return (
    <div className="prose-sm mt-3 border-t border-gray-200 pt-3 text-gray-800 [&_a]:underline [&_li]:ml-5 [&_ul]:list-disc [&_ol]:list-decimal [&_p]:my-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_code]:font-mono [&_code]:text-sm [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600">
      <ReactMarkdown
        urlTransform={(url) => url}
        components={{
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ src, alt }) => <img src={resolve(String(src ?? ""))} alt={alt ?? ""} className="my-2 max-h-96 max-w-full rounded border border-gray-200" />,
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
