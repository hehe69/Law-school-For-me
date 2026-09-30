import ReactMarkdown from "react-markdown";

/** Optional free-text markdown below a note's frontmatter. */
export default function NoteBody({ body }: { body: string }) {
  if (!body) return null;
  return (
    <div className="prose-sm mt-3 border-t border-gray-200 pt-3 text-gray-800 [&_a]:underline [&_li]:ml-5 [&_ul]:list-disc [&_ol]:list-decimal [&_p]:my-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_code]:font-mono [&_code]:text-sm [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600">
      <ReactMarkdown>{body}</ReactMarkdown>
    </div>
  );
}
