<script setup lang="ts">
import type { Config } from '~/types';
import { useI18n } from '~/composables/useI18n';

const { config } = defineProps<{
  config: Config
}>()

const { t } = useI18n()
</script>

<template>
  <div float-left w-100 mt="0" pt-2 border-1 border-rd>
    <div i-material-symbols-add-photo-alternate-rounded inline-block text-3xl /> 
    <div i-carbon-add inline-block text-3xl /> 
    <div i-material-symbols:picture-as-pdf inline-block text-3xl />
    <p>
        {{ t.title }}
    </p>
    <p>
      <em text-sm op75>{{ t.description }}</em>
    </p>

    <div py-2 />
    
    <div px-5>
      <TheInput v-for="(val, key) in config" :property="key" :value="val" @update:value="(val: string | number | boolean) => $emit('update', key, val)"/>
    </div>
    
    <div py-4 />
    <p>
      <em text-sm op75>{{ t.noServerSafe }}</em>
    </p>
    <TheFooter />
  </div>
</template>