import ReactMarkdown from "react-markdown";

/** Renders issue Markdown with the Velo type scale. Raw HTML is not rendered. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="max-w-[72ch] text-[13px] leading-5 [&_a]:text-brand-ink [&_a]:underline [&_blockquote]:border-l [&_blockquote]:border-rule [&_blockquote]:pl-3 [&_code]:rounded-[2px] [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
