<script setup lang="ts">
import type { ConfigKey } from '~/types'
import { useI18n } from '~/composables/useI18n'
import ColorPicker from './ColorPicker.vue'
import { fontOptions } from '~/const'

const { property } = defineProps<{
  property: ConfigKey
}>()

const { value } = defineModels<{
  value: string | number | boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div pb-1 flex justify-between flex-items-center>
    <label :for="property">
      {{ t[property] }} 
      <span i-carbon-help inline-block text-sm float-right mt1 ml1 :title="t.tooltips[property]"></span>
    </label>
    <div v-if="property === 'saveConfig'">
      <TheSwitch :value="value" @update:value="(val: boolean) => $emit('update:value', val)"/>
    </div>
    <div v-else-if="property === 'color' && typeof value === 'string'">
      <ColorPicker v-model:value="value" />
    </div>
    <div v-else-if="property === 'fontFamily' && typeof value === 'string'">
      <select
        v-model="value"
        p="x-2 y-1"
        w-58
        bg="transparent"
        border="~ rounded gray-200 dark:gray-700"
        outline="none active:none"
        cursor-pointer
      >
        <option v-for="font in fontOptions" :key="font.value" :value="font.value">
          {{ font.label }}
        </option>
      </select>
    </div>
    <div v-else-if="property === 'words' && typeof value === 'string'">
      <textarea  
        :id="property"
        v-model="value"
        px-1.5
        cols="25" 
        rows="2"
        bg="transparent"
        border="~ rounded gray-200 dark:gray-700"
        outline="none active:none">
      </textarea>
    </div>
    <div v-else-if="property === 'compression'" pt3>
      <input 
        w-58
        class="range"
        :title="t.compressionTitle" 
        type="range" min="0" max="1" 
        v-model="value" 
        step="0.1"/>
      <p py-2>{{ value }} </p>
    </div>
    <div v-else-if="typeof value === 'number'" >
      <input
        :id="property"
        v-model="value"
        type="number"
        p="x-0 y-1"
        w-58
        text="center"
        bg="transparent"
        border="~ rounded gray-200 dark:gray-700"
        outline="none active:none"
      >
    </div>
    <div v-else >
      <input
        :id="property"
        v-model="value"
        type="text"
        p="x-0 y-1"
        w-58
        text="center"
        bg="transparent"
        border="~ rounded gray-200 dark:gray-700"
        outline="none active:none"
      >
    </div>
  </div>
</template>
