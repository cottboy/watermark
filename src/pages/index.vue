<script setup lang="ts">
import type { ConfigKey, Config } from '~/types'
import { WATERMWRK_KEY, defaultConfig } from '~/const'

const storageConfig = localStorage.getItem(WATERMWRK_KEY)
const userConfig = storageConfig && JSON.parse(storageConfig)

const config = reactive<Config>(formatUserConfig(userConfig) || defaultConfig)
function formatUserConfig(config: Config){
  if(!config) return
  const { rotate, startX, startY } = config
  return {
    ...config,
    rotate: Number(rotate),
    startX: Number(startX),
    startY: Number(startY),
  }
}

const stringKeys = ['words', 'fontFamily', 'color', 'rotate', 'startX', 'startY']
function update(key: ConfigKey, val: string | number | boolean){
  if(key === 'saveConfig') 
    config[key] = Boolean(val)
  else if(stringKeys.includes(key)) 
    config[key] = val
  else 
    config[key] = +val

  if(key === 'saveConfig' && val === false) 
    localStorage.setItem(WATERMWRK_KEY, '')
  else 
    config['saveConfig'] && localStorage.setItem(WATERMWRK_KEY, JSON.stringify(config))
}
</script>

<template>
  <div>
    <TheControl
      :config="config"
      @update="update"
    />

    <TheMain 
      :config="config"
    />
  </div>
</template>
