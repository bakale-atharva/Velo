import ReactMarkdown from "react-markdown";

/** Renders issue Markdown with the Velo type scale. Raw HTML is not rendered. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="max-w-[72ch] text-[14.5px] leading-[1.65] [&_a]:text-foreground [&_a]:underline [&_blockquote]:border-l [&_blockquote]:border-rule [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:border [&_code]:border-border [&_code]:px-1 [&_code]:font-mono [&_code]:text-[12px] [&_h1]:mt-6 [&_h1]:text-[20px] [&_h1]:font-semibold [&_h1]:tracking-[-0.02em] [&_h2]:mt-5 [&_h2]:text-[16px] [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-rule [&_pre]:p-3 [&_pre_code]:border-0 [&_pre_code]:p-0 [&_ul]:list-disc">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
