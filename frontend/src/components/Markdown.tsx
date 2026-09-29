import { forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "../lib/utils";

/** Renders LLM output that may be Markdown, HTML, or a mix — sanitized. */
export const Markdown = forwardRef<HTMLDivElement, { children: string; className?: string }>(function Markdown(
  { children, className },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "prose max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-brand-600 dark:prose-a:text-brand-400 prose-img:rounded-xl",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
        {children}
      </ReactMarkdown>
    </div>
  );
});
