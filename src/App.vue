<script setup lang="ts">
import { Button } from '@/components/ui/button'
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <main class="container mx-auto p-8 space-y-6">
      <div>
        <h1 class="text-4xl font-bold mb-2">Chess Roulette</h1>
        <p class="text-muted-foreground">Vue + Tailwind CSS + shadcn-vue</p>
      </div>

      <div class="flex gap-3 flex-wrap">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
    </main>
  </div>
</template>
