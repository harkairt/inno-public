declare module 'markdown-it-texmath' {
  import type MarkdownIt from 'markdown-it'

  interface TexMathOptions {
    engine: {
      renderToString: (tex: string, options?: object) => string
    }
    delimiters?: ('dollars' | 'brackets' | 'gitlab' | 'julia' | 'kramdown')[]
    katexOptions?: {
      throwOnError?: boolean
      displayMode?: boolean
      macros?: Record<string, string>
    }
  }

  function texmath(md: MarkdownIt, options?: TexMathOptions): void

  export default texmath
}
