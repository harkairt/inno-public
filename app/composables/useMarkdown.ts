import MarkdownIt from 'markdown-it'

let markdownInstance: MarkdownIt | null = null

export const useMarkdown = () => {
  if (!markdownInstance) {
    markdownInstance = new MarkdownIt({
      html: false, // Security: disable raw HTML
      linkify: true, // Auto-convert URLs to links
      typographer: true, // Smart quotes, dashes
      breaks: true, // Convert \n to <br>
    })
  }

  return {
    parse: (markdown: string): string => {
      try {
        return markdownInstance!.render(markdown)
      } catch (error) {
        console.error('Markdown parsing failed:', error)
        return markdown // Fallback to raw text
      }
    },
  }
}
