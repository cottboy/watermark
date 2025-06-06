<script setup lang="ts">
import { useI18n } from '~/composables/useI18n'

const { t } = useI18n()
</script>

<template>
  <div class="footer-container">
  <nav mt-6 inline-flex gap-2 text-xl>
    <button icon-btn @click="toggleDark()">
      <div i-carbon-sun dark:i-carbon-moon />
    </button>

    <a
      i-carbon-logo-github icon-btn
      rel="noreferrer"
      href="https://github.com/Efrice/watermark"
      target="_blank"
      :title="t.originalProject"
    />
    
    <a
      i-carbon-branch icon-btn
      rel="noreferrer"
      href="https://github.com/cottboy/watermark"
      target="_blank"
      :title="t.forkWithEnhancements"
    />
  </nav>
  </div>
</template>
