import type { Directive } from 'vue'

// strictTemplates is enabled (nuxt.config.ts → typescript.tsConfig.vueCompilerOptions).
// Vue's HTMLAttributes has no `data-*` index signature and ComponentCustomProps is
// empty, so `data-testid` (native + components) and `aria-*` (on Nuxt UI components)
// are rejected even though they are valid, spec-open-ended attributes that fall
// through to the DOM at runtime. Namespacing the index signatures to the `data-`/
// `aria-` prefixes keeps real prop/typo checking intact everywhere else.
declare module 'vue' {
  interface HTMLAttributes {
    [key: `data-${string}`]: unknown
  }

  // On components vue-tsc camelCases unknown attrs (`data-testid` → `dataTestid`),
  // so match `data${string}` to cover both the camelCased and kebab forms. Predefined
  // `aria-*` props stay kebab, so `aria-${string}` is enough for those.
  interface ComponentCustomProps {
    [key: `data${string}`]: unknown
    [key: `aria-${string}`]: unknown
  }

  // Global directive registered in app/plugins/viewer.client.ts (vueApp.use(VueViewer)).
  interface GlobalDirectives {
    vViewer: Directive<HTMLElement, Record<string, unknown> | boolean>
  }
}

export {}
