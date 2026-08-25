<template>
  <div class="w-full max-w-md space-y-3 animate-[fade-in_0.4s_ease_both]">
    <div class="flex justify-end">
      <USkeleton
        class="h-12 w-[50%] !bg-[hsl(var(--muted-foreground)/0.08)]"
        style="border-radius: var(--config-message-border-radius)"
      />
    </div>
    <div class="flex justify-start">
      <USkeleton
        class="h-28 w-[70%] !bg-[hsl(var(--muted-foreground)/0.08)]"
        style="border-radius: var(--config-message-border-radius)"
      />
    </div>
  </div>
</template>
