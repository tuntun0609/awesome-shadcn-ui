"use client";

import { CopyIcon } from "lucide-react";
import { type ComponentProps, memo, useCallback, useRef } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import styles from "./chat-markdown.module.css";

function CodeBlock({ children }: ComponentProps<"pre">) {
  const codeRef = useRef<HTMLPreElement>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codeRef.current?.textContent ?? "");
      toast.success("代码已复制");
    } catch {
      toast.error("复制失败，请选中代码手动复制");
    }
  }, []);

  return (
    <div className="my-2 min-w-0 overflow-hidden rounded-lg border bg-background/70">
      <div className="flex justify-end border-b px-2 py-1">
        <Button onClick={handleCopy} size="sm" type="button" variant="ghost">
          <CopyIcon />
          复制代码
        </Button>
      </div>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: 横向滚动区需要键盘聚焦，以便用方向键阅读长代码。 */}
      <section aria-label="代码" className={styles.codeScroll} tabIndex={0}>
        <pre ref={codeRef}>{children}</pre>
      </section>
    </div>
  );
}

const components: Components = {
  a: ({ children, href, title }) => (
    <a href={href} rel="noopener noreferrer" target="_blank" title={title}>
      {children}
    </a>
  ),
  img: ({ alt }) => <span className="text-muted-foreground">{alt}</span>,
  pre: CodeBlock,
  table: ({ children }) => (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: 横向滚动区需要键盘聚焦，以便用方向键阅读宽表格。
    <section aria-label="表格" className={styles.tableScroll} tabIndex={0}>
      <table>{children}</table>
    </section>
  ),
};

const remarkPlugins = [remarkGfm];

/** 对话和资料共用的紧凑 Markdown；随流式文本更新，不执行原始 HTML。 */
export const ChatMarkdown = memo(function MarkdownContent({
  children,
}: {
  children: string;
}) {
  return (
    <div className={styles.markdown}>
      <Markdown components={components} remarkPlugins={remarkPlugins} skipHtml>
        {children}
      </Markdown>
    </div>
  );
});
