<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '~/composables/useI18n'

const { value } = defineModels<{
  value: string
}>()

const { t } = useI18n()

// 解析rgba颜色值
const parseRgba = (rgba: string) => {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
      a: match[4] ? parseFloat(match[4]) : 1
    }
  }
  return { r: 0, g: 0, b: 0, a: 0.2 }
}

// 将rgb转换为hex
const rgbToHex = (r: number, g: number, b: number) => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

// 将hex转换为rgb
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 }
}

// 当前颜色值
const currentColor = computed(() => parseRgba(value.value))

// 颜色选择器的hex值
const colorHex = computed({
  get: () => rgbToHex(currentColor.value.r, currentColor.value.g, currentColor.value.b),
  set: (hex: string) => {
    const rgb = hexToRgb(hex)
    updateColor(rgb.r, rgb.g, rgb.b, currentColor.value.a)
  }
})

// 透明度值
const opacity = computed({
  get: () => currentColor.value.a,
  set: (a: number) => {
    updateColor(currentColor.value.r, currentColor.value.g, currentColor.value.b, a)
  }
})

// 更新颜色值
const updateColor = (r: number, g: number, b: number, a: number) => {
  value.value = `rgba(${r}, ${g}, ${b}, ${a})`
}


</script>

<template>
  <div class="color-picker" w-58>
    <!-- 颜色选择器和透明度滑块 -->
    <div flex items-center gap-3>
      <!-- 颜色选择器 -->
      <div>
        <input
          v-model="colorHex"
          type="color"
          class="color-input"
          w-10 h-10 border="1 solid gray-300" rounded cursor-pointer
        >
      </div>
      
      <!-- 透明度滑块 -->
      <div flex-1>
        <label text-sm text-gray-600 mb-0.5 block>{{ t.opacity }}: {{ Math.round(opacity * 100) }}%</label>
        <input
          v-model.number="opacity"
          type="range"
          min="0"
          max="1"
          step="0.01"
          class="opacity-slider"
          :style="{ '--current-color': colorHex }"
          w-full
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.color-input {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  cursor: pointer;
}

.color-input::-webkit-color-swatch-wrapper {
  padding: 0;
  border: none;
  border-radius: 4px;
}

.color-input::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.color-input::-moz-color-swatch {
  border: none;
  border-radius: 4px;
}

.opacity-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right, transparent, var(--current-color, #000));
  outline: none;
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #ddd;
  cursor: pointer;
}

.opacity-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #ddd;
  cursor: pointer;
}
</style> 