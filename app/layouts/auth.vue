<template>
  <div class="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] px-4 py-8">
    <!-- Subtle background pattern -->
    <div
      class="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary)/0.03)] via-transparent to-[hsl(var(--accent)/0.05)] pointer-events-none"
    />

    <div class="relative w-full max-w-md">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// Simple centered layout for authentication pages with warm refined styling
</script>
