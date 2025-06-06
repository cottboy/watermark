<script setup lang="ts">
import type { Config, HTMLInputEvent } from '~/types'
import { generateCanvas, downloadImage, loadPdf, img2Pdf } from '~/util'
import { useI18n } from '~/composables/useI18n'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import * as pdf from 'pdfjs-dist'

const { config } = defineProps<{
  config: Config
}>()

const { t } = useI18n()

// 单个文件处理相关
let loadInit = false
let type = ''
let name = ''
let img: HTMLImageElement | null
const canvas = ref()
const preview = ref()
const url = ref('')
const pdfUrl = ref('')
const loading = ref(false)
const wrap = ref() as Ref<HTMLElement>

// 批量文件处理相关
interface ProcessedFile {
  id: string
  name: string
  originalFile: File
  type: 'image' | 'pdf'
  processedDataUrl?: string
  pdfPages?: string[]
  originalImage?: HTMLImageElement
  width: number
  height: number
}

const files = ref<ProcessedFile[]>([])
const processingProgress = ref(0)

// 计算属性：是否为批量模式
const isBatchMode = computed(() => files.value.length > 1)
const hasFiles = computed(() => files.value.length > 0 || url.value !== '' || pdfUrl.value !== '')

// 防抖处理
let reprocessTimer: NodeJS.Timeout | null = null

watch(config, configChange)

function configChange() {
  loadInit = false
  // 单个文件处理
  if(img)
    preview.value.src = generateCanvas(config, img, loadInit ).src
  if(pdfUrl.value)
    loadPdf(pdfUrl.value, config, wrap, loading, loadInit)
  
  // 批量文件处理 - 添加防抖
  if (files.value.length > 0) {
    // 清除之前的定时器
    if (reprocessTimer) {
      clearTimeout(reprocessTimer)
    }
    
    // 设置新的定时器，300ms后执行重新处理
    reprocessTimer = setTimeout(() => {
      reprocessAllFiles()
    }, 300)
  }
}

// 文件加载处理
function load(e: Event) {
  const fileList = (e as HTMLInputEvent).target.files
  if (!fileList || fileList.length === 0) return
  
  // 清空之前的状态
  reLoad()
  files.value = []
  
  if (fileList.length === 1) {
    // 单个文件处理
    loadSingleFile(fileList[0])
  } else {
    // 多个文件批量处理
    loadBatchFiles(fileList)
  }
}

// 单个文件处理
function loadSingleFile(file: File) {
  loadInit = true
  type = file.type
  name = file.name
  
  if(type.startsWith("image/")) 
    resolveImage(file)
  if(type === "application/pdf") {
    loading.value = true
    resolvePDF(file)
  }
}

// 批量文件处理
function loadBatchFiles(fileList: FileList) {
  loading.value = true
  processingProgress.value = 0
  
  const supportedFiles = Array.from(fileList).filter(file => 
    file.type.startsWith('image/') || file.type === 'application/pdf'
  )
  
  Promise.all(supportedFiles.map(processFile))
    .then(processedFiles => {
      files.value = processedFiles.filter(file => file !== null) as ProcessedFile[]
      loading.value = false
    })
    .catch(error => {
      console.error('批量处理失败:', error)
      loading.value = false
    })
}

function reLoad(){
  if(img) img = null
  if(url.value) url.value = ''
  if(pdfUrl.value) pdfUrl.value = ''
  if(wrap.value) wrap.value.innerHTML = ''
}

function resolveImage(file: Blob){
  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onload = () => {
    const image = new Image()
    image.src = reader.result as string
    img = image
    image.onload = () => {
      config.width = image.width
      config.height = image.height
      preview.value.src = generateCanvas(config, image, loadInit).src
    }
  }
  reader.onloadend = () => {
    url.value = reader.result as string
  }
}

function resolvePDF(file: Blob){
  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onloadend = () => {
    pdfUrl.value = reader.result as string
    loadPdf(pdfUrl.value, config , wrap, loading, loadInit)
  }
}

// 批量处理相关函数
function processFile(file: File): Promise<ProcessedFile | null> {
  if (file.type.startsWith('image/')) {
    return processImage(file)
  } else if (file.type === 'application/pdf') {
    return processPDF(file)
  }
  return Promise.resolve(null)
}

function processImage(file: File): Promise<ProcessedFile | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        try {
          const canvas = generateCanvas(config, image, true)
          const processedFile: ProcessedFile = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            originalFile: file,
            type: 'image',
            originalImage: image,
            processedDataUrl: canvas.src,
            width: image.width,
            height: image.height
          }
          resolve(processedFile)
          processingProgress.value += 1
        } catch (error) {
          console.error(`处理图片 ${file.name} 失败:`, error)
          resolve(null)
        }
      }
      image.onerror = () => {
        console.error(`加载图片 ${file.name} 失败`)
        resolve(null)
      }
      image.src = reader.result as string
    }
    reader.onerror = () => {
      console.error(`读取文件 ${file.name} 失败`)
      resolve(null)
    }
    reader.readAsDataURL(file)
  })
}

function processPDF(file: File): Promise<ProcessedFile | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const loadingTask = pdf.getDocument({
          data: reader.result as ArrayBuffer,
          disableRange: true
        })
        
        const pdfDoc = await loadingTask.promise
        const totalPages = pdfDoc.numPages
        const pdfPages: string[] = []
        
        for (let i = 1; i <= totalPages; i++) {
          const page = await pdfDoc.getPage(i)
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
          const viewport = page.getViewport({ scale: 1 })
          
          canvas.width = viewport.width
          canvas.height = viewport.height
          
          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise
          
          const watermarkedCanvas = generateCanvas(config, canvas, true)
          pdfPages.push(watermarkedCanvas.src)
        }
        
        const processedFile: ProcessedFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          originalFile: file,
          type: 'pdf',
          pdfPages,
          width: 0,
          height: 0
        }
        
        resolve(processedFile)
        processingProgress.value += 1
      } catch (error) {
        console.error(`处理PDF ${file.name} 失败:`, error)
        resolve(null)
      }
    }
    reader.onerror = () => {
      console.error(`读取PDF文件 ${file.name} 失败`)
      resolve(null)
    }
    reader.readAsArrayBuffer(file)
  })
}

function reprocessAllFiles() {
  if (files.value.length === 0) return
  
  // 只对图片文件显示简短的加载状态，PDF文件才显示完整加载
  const hasOnlyImages = files.value.every(file => file.type === 'image')
  
  if (!hasOnlyImages) {
    loading.value = true
    processingProgress.value = 0
  }
  
  const processPromises = files.value.map(async (file, index) => {
    try {
      if (file.type === 'image' && file.originalImage) {
        // 图片处理很快，直接同步处理
        const canvas = generateCanvas(config, file.originalImage, true)
        file.processedDataUrl = canvas.src
        if (!hasOnlyImages) {
          processingProgress.value += 1
        }
        return Promise.resolve()
      } else if (file.type === 'pdf') {
        // PDF处理较慢，需要异步处理
        return new Promise<void>((resolve) => {
          const reader = new FileReader()
          reader.onload = async () => {
            try {
              const loadingTask = pdf.getDocument({
                data: reader.result as ArrayBuffer,
                disableRange: true
              })
              
              const pdfDoc = await loadingTask.promise
              const totalPages = pdfDoc.numPages
              const newPdfPages: string[] = []
              
              for (let i = 1; i <= totalPages; i++) {
                const page = await pdfDoc.getPage(i)
                const canvas = document.createElement('canvas')
                const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
                const viewport = page.getViewport({ scale: 1 })
                
                canvas.width = viewport.width
                canvas.height = viewport.height
                
                await page.render({
                  canvasContext: ctx,
                  viewport,
                }).promise
                
                const watermarkedCanvas = generateCanvas(config, canvas, true)
                newPdfPages.push(watermarkedCanvas.src)
              }
              
              file.pdfPages = newPdfPages
              processingProgress.value += 1
              resolve()
            } catch (error) {
              console.error(`重新处理PDF ${file.name} 失败:`, error)
              resolve()
            }
          }
          reader.onerror = () => {
            console.error(`读取PDF文件 ${file.name} 失败`)
            resolve()
          }
          reader.readAsArrayBuffer(file.originalFile)
        })
      }
    } catch (error) {
      console.error(`重新处理文件 ${file.name} 失败:`, error)
      return Promise.resolve()
    }
  })
  
  // 等待所有处理完成
  Promise.all(processPromises).then(() => {
    loading.value = false
  }).catch((error) => {
    console.error('批量重新处理失败:', error)
    loading.value = false
  })
}

// 下载功能
function download() {
  if (isBatchMode.value) {
    downloadAll()
  } else {
    downloadSingle()
  }
}

function downloadSingle() {
  if(url.value === '' && pdfUrl.value === '') return
  
  if(type.startsWith("image/") && img) {
    const src = generateCanvas(config, img, loadInit).src
    downloadImage(src, config, name)
  }
  if(type === "application/pdf") {
    img2Pdf(name, loading)
  }
}

async function downloadAll() {
  if (files.value.length === 0) return
  
  loading.value = true
  
  try {
    const zip = new JSZip()
    
    for (const file of files.value) {
      if (file.type === 'image' && file.processedDataUrl) {
        const dataUrl = file.processedDataUrl
        const arr = dataUrl.split(',')
        const mime = arr[0].match(/:(.*?);/)![1]
        const bstr = atob(arr[1])
        let n = bstr.length
        const u8arr = new Uint8Array(n)
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n)
        }
        const blob = new Blob([u8arr], { type: mime })
        
        const fileName = file.name.replace(/\.[^/.]+$/, '') + '_watermarked.png'
        zip.file(fileName, blob)
      } else if (file.type === 'pdf' && file.pdfPages) {
        try {
          const { PDFDocument } = await import('pdf-lib')
          const pdfDoc = await PDFDocument.create()
          
          for (const pageDataUrl of file.pdfPages) {
            const pngImage = await pdfDoc.embedPng(pageDataUrl)
            const page = pdfDoc.addPage([pngImage.width, pngImage.height])
            page.drawImage(pngImage, {
              x: 0,
              y: 0,
              width: pngImage.width,
              height: pngImage.height,
            })
          }
          
          const pdfBytes = await pdfDoc.save()
          const blob = new Blob([pdfBytes], { type: 'application/pdf' })
          
          const fileName = file.name.replace(/\.[^/.]+$/, '') + '_watermarked.pdf'
          zip.file(fileName, blob)
        } catch (error) {
          console.error(`处理PDF ${file.name} 失败:`, error)
        }
      }
    }
    
    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, 'watermarked_files.zip')
  } catch (error) {
    console.error('批量下载失败:', error)
  } finally {
    loading.value = false
  }
}

async function downloadSingleFromBatch(file: ProcessedFile) {
  loading.value = true
  
  try {
    if (file.type === 'image' && file.processedDataUrl) {
      const dataUrl = file.processedDataUrl
      const arr = dataUrl.split(',')
      const mime = arr[0].match(/:(.*?);/)![1]
      const bstr = atob(arr[1])
      let n = bstr.length
      const u8arr = new Uint8Array(n)
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
      }
      const blob = new Blob([u8arr], { type: mime })
      
      const fileName = file.name.replace(/\.[^/.]+$/, '') + '_watermarked.png'
      saveAs(blob, fileName)
    } else if (file.type === 'pdf' && file.pdfPages) {
      const { PDFDocument } = await import('pdf-lib')
      const pdfDoc = await PDFDocument.create()
      
      for (const pageDataUrl of file.pdfPages) {
        const pngImage = await pdfDoc.embedPng(pageDataUrl)
        const page = pdfDoc.addPage([pngImage.width, pngImage.height])
        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: pngImage.width,
          height: pngImage.height,
        })
      }
      
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      
      const fileName = file.name.replace(/\.[^/.]+$/, '') + '_watermarked.pdf'
      saveAs(blob, fileName)
    }
  } catch (error) {
    console.error('下载失败:', error)
  } finally {
    loading.value = false
  }
}

function removeFile(id: string) {
  files.value = files.value.filter(file => file.id !== id)
  
  // 如果删除后只剩一个文件，切换到单文件模式
  if (files.value.length === 1) {
    const remainingFile = files.value[0]
    loadSingleFile(remainingFile.originalFile)
    files.value = []
  }
}

function clearAll() {
  files.value = []
  reLoad()
}
</script>

<template>
  <div pl-100>
    <!-- 文件选择和操作按钮 -->
    <div relative h-10>
      <input 
        id="load" 
        absolute left-0 m-3 w-16 opacity-0 
        type="file" 
        accept="image/*, application/pdf" 
        multiple 
        @change="load"
      >
      <label absolute left-0 for="load">
        <span class="m-3 text-sm btn">
          {{ isBatchMode ? t.loadBatch : t.load }}
        </span>
      </label>
      <button
        absolute left-25
        class="m-3 text-sm btn"
        :disabled="!hasFiles"
        @click="download"
      >
        {{ isBatchMode ? t.downloadAll : t.download }}
      </button>
      
      <button
        v-if="isBatchMode"
        absolute left-50
        class="m-3 text-sm btn bg-red-500 hover:bg-red-600"
        @click="clearAll"
        :disabled="loading"
      >
        {{ t.clear }}
      </button>
    </div>

    <!-- 处理进度 -->
    <div v-if="loading && isBatchMode" mb-4>
      <div text-sm text-gray-600 mb-2>
        {{ t.processing }} {{ processingProgress }} / {{ files.length }}
      </div>
      <div class="progress-bar" w-full h-2 bg-gray-200 rounded>
        <div 
          class="progress-fill" 
          h-full bg-blue-500 rounded transition-all
          :style="{ width: files.length > 0 ? (processingProgress / files.length * 100) + '%' : '0%' }"
        ></div>
      </div>
    </div>

    <!-- 单个文件预览 -->
    <div v-if="!isBatchMode">
      <div m-3 w-fit border-1 border-rd p-3 mr-5>
        <div v-if="url">
          <img ref="preview" :src="url" :style="`width: ${config.width}px;height: ${config.height}px;max-width: unset;`">
          <canvas ref="canvas" display-none></canvas>
        </div>
        <div v-else-if="pdfUrl">
          <div ref="wrap"></div>
        </div>
        <div v-else w-200 h-168 flex justify-center flex-items-center>
          <label for="load" border-1 border-dashed>
            <span icon-btn text-10 display-block i-carbon:task-add/>
          </label>
        </div>
      </div>
    </div>
    
    <!-- 批量文件网格 -->
    <div v-else-if="hasFiles" class="file-grid" grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 m-3>
      <div 
        v-for="file in files" 
        :key="file.id"
        class="file-item" 
        border="1 solid gray-200" 
        rounded p-2 relative
      >
        <!-- 删除按钮 -->
        <button
          @click="removeFile(file.id)"
          class="delete-btn"
          absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full
          hover:bg-red-600 transition-colors text-xs
        >
          ×
        </button>
        
        <!-- 文件预览 -->
        <div v-if="file.type === 'image'" class="preview-container">
          <img 
            :src="file.processedDataUrl" 
            :alt="file.name"
            class="preview-image"
            w-full h-32 object-cover rounded mb-2
          >
        </div>
        <div v-else-if="file.type === 'pdf'" class="preview-container">
          <div class="pdf-preview" w-full h-32 bg-gray-100 rounded mb-2 flex items-center justify-center>
            <div text-center>
              <div text-2xl mb-1>📄</div>
              <div text-xs text-gray-600>PDF</div>
              <div text-xs text-gray-600 v-if="file.pdfPages">{{ file.pdfPages.length }} {{ t.pages }}</div>
            </div>
          </div>
        </div>
        
        <!-- 文件信息 -->
        <div text-xs text-gray-600 mb-2>
          <div truncate :title="file.name">{{ file.name }}</div>
          <div v-if="file.type === 'image'">{{ file.width }} × {{ file.height }}</div>
          <div v-else-if="file.type === 'pdf'">{{ t.pdfDocument }}</div>
        </div>
        
        <!-- 下载按钮 -->
        <button
          @click="downloadSingleFromBatch(file)"
          class="download-btn btn text-xs w-full"
          :disabled="loading"
        >
          {{ t.download }}
        </button>
      </div>
    </div>

    <!-- 空状态（批量模式且无文件） -->
    <div v-else-if="isBatchMode && !loading" class="empty-state" text-center py-8 text-gray-500 m-3>
      <div text-4xl mb-2>📁</div>
      <div>{{ t.batchEmptyHint.replace('{loadBatch}', t.loadBatch) }}</div>
    </div>
    
    <!-- 加载状态 -->
    <div v-show="loading" position='fixed' left-0 top-0 right-0 bottom-0 flex items-center justify-center bg-teal-100 >
      <span class="loading btn" i-carbon-3rd-party-connected text-4xl></span>
    </div>
  </div>
</template>

<style scoped>
.file-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn {
  opacity: 0.7;
  transition: opacity 0.2s;
}
</style>
