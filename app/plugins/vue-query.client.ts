import { VueQueryPlugin, type VueQueryPluginOptions } from '@tanstack/vue-query'
import { getQueryClient } from '@/lib/queryClientSingleton'

export default defineNuxtPlugin({
  name: 'vue-query',
  enforce: 'pre', // Load this plugin before others
  setup(nuxtApp) {
    const queryClient = getQueryClient()

    const options: VueQueryPluginOptions = {
      queryClient,
      enableDevtoolsV6Plugin: true,
    }

    nuxtApp.vueApp.use(VueQueryPlugin, options)

    return {
      provide: {
        queryClient,
      },
    }
  },
})
