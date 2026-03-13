import { sanitizeHTML } from "@/app/utils/sanitize";
import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import katex from "katex";

let markdownInstance: MarkdownIt | null = null;

export const useMarkdown = () => {
  markdownInstance ??= new MarkdownIt({
    html: false, // Security: disable raw HTML
    linkify: true, // Auto-convert URLs to links
    typographer: true, // Smart quotes, dashes
    breaks: true, // Convert \n to <br>
  }).use(texmath, {
    engine: katex,
    delimiters: ["dollars", "brackets"], // $...$ and \[...\]
    katexOptions: { throwOnError: false },
  });

  return {
    parse: (markdown: string): string => {
      try {
        return markdownInstance!.render(markdown);
      } catch {
        return sanitizeHTML(markdown); // Fallback to sanitized text
      }
    },
  };
};
