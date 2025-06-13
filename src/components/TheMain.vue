<script setup lang="ts">
import type { Config, HTMLInputEvent } from '~/types'
import { generateCanvas, downloadImage, loadPdf, loadPdfPreview, img2Pdf, img2PdfWithData } from '~/util'
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

// 文件输入引用
const fileInput = ref<HTMLInputElement>()

// 计算属性：是否为批量模式
const isBatchMode = computed(() => files.value.length > 1)
const hasFiles = computed(() => files.value.length > 0 || url.value !== '' || pdfUrl.value !== '')

// 防抖处理
let reprocessTimer: NodeJS.Timeout | null = null

watch(config, configChange)

function configChange() {
  loadInit = false
  // 单个文件处理 - 预览模式使用快速渲染
  if(img)
    preview.value.src = generateCanvas(config, img, loadInit, false, true).src
  if(pdfUrl.value)
    loadPdfPreview(pdfUrl.value, config, wrap, loading, loadInit)
  
  // 批量文件处理 - 添加防抖
  if (files.value.length > 0) {
    // 清除之前的定时器
    if (reprocessTimer) {
      clearTimeout(reprocessTimer)
    }
    
    // 设置新的定时器，300ms后执行重新处理
    reprocessTimer = setTimeout(() => {
      reprocessAllFilesPreview()
    }, 300)
  }
}

// 文件加载处理
function load(e: Event) {
  const fileList = (e as HTMLInputEvent).target.files
  if (!fileList || fileList.length === 0) return
  
  // 如果当前没有文件，或者是单文件模式，则清空状态
  const hasExistingFiles = files.value.length > 0 || url.value !== '' || pdfUrl.value !== ''
  
  if (!hasExistingFiles) {
    // 没有现有文件，清空状态
    reLoad()
    files.value = []
  } else {
    // 有现有文件，只清空单文件模式的状态，保留批量文件
    if (url.value !== '' || pdfUrl.value !== '') {
      // 如果当前是单文件模式，需要先将单文件转换为批量文件
      if (url.value !== '' && img) {
        // 将当前单文件图片转换为批量文件项
        const canvas = generateCanvas(config, img, true)
        const singleFileItem: ProcessedFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: name || 'current_image.png',
          originalFile: new File([dataURLToBlob(url.value)], name || 'current_image.png'),
          type: 'image',
          originalImage: img,
          processedDataUrl: canvas.src,
          width: img.width,
          height: img.height
        }
        files.value = [singleFileItem]
        
        // 清空单文件状态
        if(img) img = null
        if(url.value) url.value = ''
        if(wrap.value) wrap.value.innerHTML = ''
      } else if (pdfUrl.value !== '') {
        // 对于PDF文件，先将其转换为批量模式，然后再添加新文件
        console.log('将当前单个PDF文件转换为批量模式')
        
        const tempPdfBlob = dataURLToBlob(pdfUrl.value)
        const tempPdfFile = new File([tempPdfBlob], name || 'current_document.pdf', { type: 'application/pdf' })
        
        // 清空单文件状态
        const tempPdfUrl = pdfUrl.value
        const tempName = name
        if(pdfUrl.value) pdfUrl.value = ''
        if(wrap.value) wrap.value.innerHTML = ''
        
        // 先处理当前PDF文件，然后添加新文件
        loading.value = true
        processPDF(tempPdfFile).then(processedPdf => {
          if (processedPdf) {
            files.value = [processedPdf]
            console.log('PDF文件已转换为批量模式，现在添加新文件')
            // 现在添加新文件
            addFilesToBatch(fileList)
          } else {
            console.error('PDF转换失败，直接处理新文件')
            addFilesToBatch(fileList)
          }
        }).catch(error => {
          console.error('转换PDF文件到批量模式失败:', error)
          addFilesToBatch(fileList)
        })
        
        // 直接返回，因为addFilesToBatch会在PDF处理完成后调用
        return
      }
    }
  }
  
  // 处理新文件
  if (fileList.length === 1 && files.value.length === 0) {
    // 如果选择了一个文件且当前没有其他文件，进入单文件模式
    loadSingleFile(fileList[0])
  } else {
    // 否则进入批量模式，将新文件添加到现有列表中
    addFilesToBatch(fileList)
  }
}

// 新增函数：将文件添加到批量列表中
function addFilesToBatch(fileList: FileList) {
  loading.value = true
  
  const supportedFiles = Array.from(fileList).filter(file => {
    // 检查是否已经存在相同名称的文件
    const exists = files.value.some(existingFile => existingFile.name === file.name)
    if (exists) {
      console.log(`文件 ${file.name} 已存在，跳过`)
      return false
    }
    return file.type.startsWith('image/') || file.type === 'application/pdf'
  })
  
  if (supportedFiles.length === 0) {
    loading.value = false
    console.log('没有新的文件需要添加')
    return
  }
  
  console.log(`添加 ${supportedFiles.length} 个新文件到现有的 ${files.value.length} 个文件中`)
  
  // 重置进度（仅针对新文件）
  const currentFileCount = files.value.length
  processingProgress.value = currentFileCount
  
  Promise.all(supportedFiles.map(processFile))
    .then(processedFiles => {
      const validFiles = processedFiles.filter(file => file !== null) as ProcessedFile[]
      // 将新文件追加到现有列表中
      files.value = [...files.value, ...validFiles]
      loading.value = false
      console.log(`成功添加 ${validFiles.length} 个文件，当前总文件数: ${files.value.length}`)
    })
    .catch(error => {
      console.error('添加文件失败:', error)
      loading.value = false
    })
}

// 辅助函数：将dataURL转换为Blob（使用简化版本）
function dataURLToBlob(dataURL: string): Blob {
  const [header, data] = dataURL.split(',')
  const mime = header.split(':')[1].split(';')[0]
  const bytes = atob(data)
  const u8arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    u8arr[i] = bytes.charCodeAt(i)
  }
  return new Blob([u8arr], { type: mime })
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
    // 初始加载时使用预览模式以提高速度
    loadPdfPreview(pdfUrl.value, config , wrap, loading, loadInit)
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
          
          // 初始处理时使用低分辨率以提高速度
          const scale = 1
          const viewport = page.getViewport({ scale })
          
          canvas.width = viewport.width
          canvas.height = viewport.height
          
          // 启用图像平滑
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'medium'
          
          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise
          
          // 初始处理时使用预览模式以提高速度
          const watermarkedCanvas = generateCanvas(config, canvas, true, true, true)
          // 确保生成的 dataURL 是PNG格式
          const pngDataUrl = watermarkedCanvas.newCanvas.toDataURL('image/png', 0.8)
          pdfPages.push(pngDataUrl)
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

// 预览模式的批量重新处理函数（快速响应）
function reprocessAllFilesPreview() {
  if (files.value.length === 0) return
  
  // 预览模式不显示加载状态，直接快速处理
  const processPromises = files.value.map(async (file, index) => {
    try {
      if (file.type === 'image' && file.originalImage) {
        // 图片处理 - 预览模式
        const canvas = generateCanvas(config, file.originalImage, true, false, true)
        file.processedDataUrl = canvas.src
        return Promise.resolve()
      } else if (file.type === 'pdf') {
        // PDF处理 - 预览模式使用低分辨率
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
                
                // 预览模式使用低分辨率
                const scale = 1
                const viewport = page.getViewport({ scale })
                
                canvas.width = viewport.width
                canvas.height = viewport.height
                
                // 预览模式使用中等质量
                ctx.imageSmoothingEnabled = true
                ctx.imageSmoothingQuality = 'medium'
                
                await page.render({
                  canvasContext: ctx,
                  viewport,
                }).promise
                
                // 使用预览模式生成canvas
                const watermarkedCanvas = generateCanvas(config, canvas, true, true, true)
                const pngDataUrl = watermarkedCanvas.newCanvas.toDataURL('image/png', 0.8)
                newPdfPages.push(pngDataUrl)
              }
              
              file.pdfPages = newPdfPages
              resolve()
            } catch (error) {
              console.error(`预览模式重新处理PDF ${file.name} 失败:`, error)
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
      console.error(`预览模式重新处理文件 ${file.name} 失败:`, error)
      return Promise.resolve()
    }
  })
  
  // 等待所有处理完成（预览模式不显示加载状态）
  Promise.all(processPromises).catch((error) => {
    console.error('预览模式批量重新处理失败:', error)
  })
}

// 高质量模式的批量重新处理函数（用于下载）
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
                
                // 使用更高的缩放比例来提高渲染质量
                const scale = Math.max(2, window.devicePixelRatio || 1)
                const viewport = page.getViewport({ scale })
                
                canvas.width = viewport.width
                canvas.height = viewport.height
                
                // 启用图像平滑
                ctx.imageSmoothingEnabled = true
                ctx.imageSmoothingQuality = 'high'
                
                await page.render({
                  canvasContext: ctx,
                  viewport,
                }).promise
                
                const watermarkedCanvas = generateCanvas(config, canvas, true, true, false)
                // 确保生成的 dataURL 是PNG格式
                const pngDataUrl = watermarkedCanvas.newCanvas.toDataURL('image/png')
                newPdfPages.push(pngDataUrl)
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

async function downloadSingle() {
  if(url.value === '' && pdfUrl.value === '') return
  
  if(type.startsWith("image/") && img) {
    // 下载时使用高质量模式
    const src = generateCanvas(config, img, loadInit, false, false).src
    downloadImage(src, config, name)
  }
  if(type === "application/pdf") {
    // PDF下载时需要重新生成高质量版本
    loading.value = true
    try {
      await generateHighQualityPdfForDownload()
    } catch (error) {
      console.error('PDF下载失败:', error)
      loading.value = false
    }
  }
}

// 为下载生成高质量PDF
async function generateHighQualityPdfForDownload() {
  if (!pdfUrl.value) {
    loading.value = false
    return
  }
  
  try {
    console.log('开始生成高质量PDF...')
    const loadingTask = pdf.getDocument({
      url: pdfUrl.value,
      disableRange: true
    });

    const pdfDoc = await loadingTask.promise
    const totalPages = pdfDoc.numPages;
    console.log(`PDF总页数: ${totalPages}`)
    const highQualityImgData: any[] = []
    
    for (let i = 1; i <= totalPages; i++) {
      console.log(`正在处理第 ${i}/${totalPages} 页...`)
      const page = await pdfDoc.getPage(i)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      
      // 下载时使用高分辨率
      const scale = Math.max(2, window.devicePixelRatio || 1);
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width
      canvas.height = viewport.height

      // 启用高质量图像平滑
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise

      // 使用高质量模式生成canvas，下载时使用JPEG格式
      const { src } = generateCanvas(config, canvas, true, true, false, true)
      highQualityImgData.push({src, width: canvas.width, height: canvas.height})
    }
    
    console.log('页面处理完成，开始生成PDF文件...')
    // 使用高质量数据生成PDF，注意这个函数会自动处理loading状态
    await img2PdfWithData(name, loading, highQualityImgData)
  } catch (error) {
    console.error('生成高质量PDF失败:', error)
    loading.value = false
    throw error // 重新抛出错误，让调用者知道失败了
  }
}

async function downloadAll() {
  if (files.value.length === 0) return
  
  console.log('开始批量下载，总文件数:', files.value.length)
  console.log('文件列表:', files.value.map(f => ({ name: f.name, type: f.type, hasPdfPages: !!f.pdfPages, pdfPagesCount: f.pdfPages?.length })))
  
  loading.value = true
  
  try {
    const zip = new JSZip()
    
    // 使用 for...of 循环确保 PDF 文件按顺序处理
    for (const file of files.value) {
      console.log(`正在处理文件: ${file.name}, 类型: ${file.type}`)
      
      try {
        if (file.type === 'image' && file.originalImage) {
          console.log(`处理图片文件: ${file.name}`)
          // 重新生成高质量图片
          const highQualityCanvas = generateCanvas(config, file.originalImage, true, false, false)
          const dataUrl = highQualityCanvas.src
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
          console.log(`图片文件 ${file.name} 处理完成`)
        } else if (file.type === 'pdf' && file.originalFile) {
          console.log(`处理PDF文件: ${file.name}`)
          
          // 重新生成高质量PDF
          const reader = new FileReader()
          await new Promise<void>((resolve, reject) => {
            reader.onload = async () => {
              try {
                const loadingTask = pdf.getDocument({
                  data: reader.result as ArrayBuffer,
                  disableRange: true
                })
                
                const pdfDoc = await loadingTask.promise
                const totalPages = pdfDoc.numPages
                const highQualityPages: string[] = []
                
                // 重新生成高质量页面
                for (let i = 1; i <= totalPages; i++) {
                  const page = await pdfDoc.getPage(i)
                  const canvas = document.createElement('canvas')
                  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
                  
                  // 使用高分辨率
                  const scale = Math.max(2, window.devicePixelRatio || 1)
                  const viewport = page.getViewport({ scale })
                  
                  canvas.width = viewport.width
                  canvas.height = viewport.height
                  
                  ctx.imageSmoothingEnabled = true
                  ctx.imageSmoothingQuality = 'high'
                  
                  await page.render({
                    canvasContext: ctx,
                    viewport,
                  }).promise
                  
                  // 使用高质量模式生成canvas，下载时使用JPEG格式
                  const watermarkedCanvas = generateCanvas(config, canvas, true, true, false, true)
                  const jpegDataUrl = watermarkedCanvas.src  // 直接使用generateCanvas返回的格式化数据
                  highQualityPages.push(jpegDataUrl)
                }
                
                // 使用pdf-lib创建新PDF
          const { PDFDocument } = await import('pdf-lib')
                const newPdfDoc = await PDFDocument.create()
          
          // 按顺序处理每一页
                for (let i = 0; i < highQualityPages.length; i++) {
                  const pageDataUrl = highQualityPages[i]
            
            try {
              // 提取图片数据
              const imageData = pageDataUrl.split(',')[1]
                    if (!imageData) continue
              
              // 将 base64 转换为 Uint8Array
              const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0))
              
                    // 根据数据URL格式选择嵌入方式
                    let embeddedImage
                    if (pageDataUrl.startsWith('data:image/jpeg')) {
                      embeddedImage = await newPdfDoc.embedJpg(imageBytes)
                    } else {
                      embeddedImage = await newPdfDoc.embedPng(imageBytes)
                    }
                    const page = newPdfDoc.addPage([embeddedImage.width, embeddedImage.height])
                    page.drawImage(embeddedImage, {
                x: 0,
                y: 0,
                      width: embeddedImage.width,
                      height: embeddedImage.height,
              })
              
              console.log(`PDF ${file.name} 第 ${i + 1} 页处理完成`)
            } catch (pageError) {
              console.error(`处理PDF ${file.name} 第 ${i + 1} 页失败:`, pageError)
              continue
            }
          }
          
                // 保存PDF，启用压缩以减小文件大小
                if (newPdfDoc.getPages().length > 0) {
                  const pdfBytes = await newPdfDoc.save({
                    useObjectStreams: false,  // 禁用对象流以提高兼容性
                    addDefaultPage: false,    // 不添加默认页面
                    objectsPerTick: 50,       // 每次处理的对象数量
                  })
            const blob = new Blob([pdfBytes], { type: 'application/pdf' })
            
            const fileName = file.name.replace(/\.[^/.]+$/, '') + '_watermarked.pdf'
            zip.file(fileName, blob)
                  console.log(`PDF文件 ${file.name} 处理完成，页数: ${newPdfDoc.getPages().length}`)
          } else {
            console.error(`PDF ${file.name} 处理后没有有效页面`)
          }
                
                resolve()
              } catch (error) {
                console.error(`重新生成高质量PDF ${file.name} 失败:`, error)
                reject(error)
              }
            }
            reader.onerror = () => reject(new Error(`读取PDF文件 ${file.name} 失败`))
            reader.readAsArrayBuffer(file.originalFile)
          })
        }
      } catch (fileError) {
        console.error(`处理文件 ${file.name} 时发生错误:`, fileError)
        // 继续处理下一个文件，不中断整个批量下载
        continue
      }
    }
    
    // 检查是否有文件被成功添加到ZIP
    const fileNames = Object.keys(zip.files)
    if (fileNames.length === 0) {
      throw new Error('没有文件被成功处理，无法创建下载包')
    }
    
    console.log(`成功处理了 ${fileNames.length} 个文件:`, fileNames)
    
    const content = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6
      }
    })
    
    console.log('ZIP包生成完成，大小:', content.size, 'bytes')
    saveAs(content, 'watermarked_files.zip')
  } catch (error) {
    console.error('批量下载失败:', error)
    alert('批量下载失败，请检查控制台了解详细错误信息')
  } finally {
    loading.value = false
  }
}

async function downloadSingleFromBatch(file: ProcessedFile) {
  loading.value = true
  
  try {
    if (file.type === 'image' && file.originalImage) {
      // 重新生成高质量图片
      const highQualityCanvas = generateCanvas(config, file.originalImage, true, false, false)
      const dataUrl = highQualityCanvas.src
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
    } else if (file.type === 'pdf' && file.originalFile) {
      // 重新生成高质量PDF
      console.log(`开始处理PDF文件: ${file.name}`)
      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = async () => {
          try {
            const loadingTask = pdf.getDocument({
              data: reader.result as ArrayBuffer,
              disableRange: true
            })
            
            const pdfDoc = await loadingTask.promise
            const totalPages = pdfDoc.numPages
            console.log(`PDF ${file.name} 总页数: ${totalPages}`)
            const highQualityPages: string[] = []
            
            // 重新生成高质量页面
            for (let i = 1; i <= totalPages; i++) {
              console.log(`正在处理PDF ${file.name} 第 ${i}/${totalPages} 页...`)
              const page = await pdfDoc.getPage(i)
              const canvas = document.createElement('canvas')
              const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
              
              // 使用高分辨率
              const scale = Math.max(2, window.devicePixelRatio || 1)
              const viewport = page.getViewport({ scale })
              
              canvas.width = viewport.width
              canvas.height = viewport.height
              
              ctx.imageSmoothingEnabled = true
              ctx.imageSmoothingQuality = 'high'
              
              await page.render({
                canvasContext: ctx,
                viewport,
              }).promise
              
              // 使用高质量模式生成canvas，下载时使用JPEG格式
              const watermarkedCanvas = generateCanvas(config, canvas, true, true, false, true)
              const jpegDataUrl = watermarkedCanvas.src  // 直接使用generateCanvas返回的格式化数据
              highQualityPages.push(jpegDataUrl)
            }
            
            console.log(`PDF ${file.name} 页面处理完成，开始生成PDF文件...`)
            // 使用pdf-lib创建新PDF
      const { PDFDocument } = await import('pdf-lib')
            const newPdfDoc = await PDFDocument.create()
      
      // 按顺序处理每一页
            for (let i = 0; i < highQualityPages.length; i++) {
              const pageDataUrl = highQualityPages[i]
        
        try {
          // 提取图片数据
          const imageData = pageDataUrl.split(',')[1]
                if (!imageData) continue
          
          // 将 base64 转换为 Uint8Array
          const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0))
          
                // 根据数据URL格式选择嵌入方式
                let embeddedImage
                if (pageDataUrl.startsWith('data:image/jpeg')) {
                  embeddedImage = await newPdfDoc.embedJpg(imageBytes)
                } else {
                  embeddedImage = await newPdfDoc.embedPng(imageBytes)
                }
                const page = newPdfDoc.addPage([embeddedImage.width, embeddedImage.height])
                page.drawImage(embeddedImage, {
            x: 0,
            y: 0,
                  width: embeddedImage.width,
                  height: embeddedImage.height,
          })
        } catch (pageError) {
          console.error(`处理PDF ${file.name} 第 ${i + 1} 页失败:`, pageError)
          continue
        }
      }
      
            // 保存PDF，启用压缩以减小文件大小
            if (newPdfDoc.getPages().length > 0) {
              const pdfBytes = await newPdfDoc.save({
                useObjectStreams: false,  // 禁用对象流以提高兼容性
                addDefaultPage: false,    // 不添加默认页面
                objectsPerTick: 50,       // 每次处理的对象数量
              })
        const blob = new Blob([pdfBytes], { type: 'application/pdf' })
        
        const fileName = file.name.replace(/\.[^/.]+$/, '') + '_watermarked.pdf'
        saveAs(blob, fileName)
              console.log(`PDF文件 ${file.name} 下载完成`)
              resolve()
      } else {
              reject(new Error(`PDF ${file.name} 处理后没有有效页面`))
            }
          } catch (error) {
            console.error(`重新生成高质量PDF ${file.name} 失败:`, error)
            reject(error)
          }
        }
        reader.onerror = () => {
          reject(new Error(`读取PDF文件 ${file.name} 失败`))
        }
        reader.readAsArrayBuffer(file.originalFile)
      })
    }
  } catch (error) {
    console.error('下载失败:', error)
    alert(`下载失败: ${error.message || '未知错误'}`)
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
  } else if (files.value.length === 0) {
    // 如果删除后没有文件了，回到初始状态
    reLoad()
  }
}

function clearAll() {
  files.value = []
  reLoad()
  
  // 重置文件输入的值，确保可以重新选择相同的文件
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  
  // 重置所有全局状态变量
  processingProgress.value = 0
  loadInit = false
  type = ''
  name = ''
  img = null
  
  // 清除防抖定时器
  if (reprocessTimer) {
    clearTimeout(reprocessTimer)
    reprocessTimer = null
  }
  
  // 确保loading状态为false
  loading.value = false
  
  console.log('所有文件和状态已清空')
}

// 触发文件选择
function triggerFileSelect() {
  fileInput.value?.click()
}
</script>

<template>
  <div pl-100>
    <!-- 文件选择和操作按钮 -->
    <div class="flex items-center gap-4 p-3">
      <!-- 隐藏的文件输入，不与按钮重叠 -->
      <input 
        ref="fileInput"
        style="display: none"
        type="file" 
        accept="image/*, application/pdf" 
        multiple 
        @change="load"
      >
      
      <button 
        @click="triggerFileSelect"
        class="text-sm btn"
      >
        {{ hasFiles ? t.addMoreFiles : (isBatchMode ? t.loadBatch : t.load) }}
      </button>
      
      <button
        class="text-sm btn"
        :disabled="!hasFiles"
        @click="download"
      >
        {{ isBatchMode ? t.downloadAll : t.download }}
      </button>
      
      <button
        v-if="hasFiles"
        class="text-sm btn bg-red-500 hover:bg-red-600"
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
          <button @click="triggerFileSelect" border-1 border-dashed>
            <span icon-btn text-10 display-block i-carbon:task-add/>
          </button>
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
          absolute top-0 right-1 w-8 h-8 text-red-500 
          hover:text-red-600 transition-colors text-2xl font-bold z-20
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
          <div v-if="file.pdfPages && file.pdfPages.length > 0" class="pdf-preview-with-image">
            <img 
              :src="file.pdfPages[0]" 
              :alt="`${file.name} 第一页预览`"
              class="preview-image"
              w-full h-32 object-cover rounded mb-2
            >
            <!-- PDF标识覆盖层 -->
            <div class="pdf-overlay" absolute top-1 left-1 bg-black bg-opacity-60 text-white text-xs px-1 rounded>
              PDF
            </div>
          </div>
          <div v-else class="pdf-preview" w-full h-32 bg-gray-100 rounded mb-2 flex items-center justify-center>
            <div text-center>
              <div text-2xl mb-1>📄</div>
              <div text-xs text-gray-600>PDF</div>
              <div text-xs text-gray-600>{{ t.processing }}...</div>
            </div>
          </div>
        </div>
        
        <!-- 文件信息 -->
        <div text-xs text-gray-600 mb-2>
          <div truncate :title="file.name">{{ file.name }}</div>
          <div v-if="file.type === 'image'">{{ file.width }} × {{ file.height }}</div>
          <div v-else-if="file.type === 'pdf'">
            <span>{{ t.pdfDocument }}</span>
            <span v-if="file.pdfPages && file.pdfPages.length > 0"> · {{ file.pdfPages.length }} {{ t.pages }}</span>
          </div>
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
    <div v-show="loading" class="loading-overlay" position='fixed' left-0 top-0 right-0 bottom-0 flex items-center justify-center bg-teal-100 z-50 >
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
  z-index: 20;
  text-shadow: 0 0 3px rgba(255, 255, 255, 0.8);
}

.pdf-preview-with-image {
  position: relative;
  z-index: 1;
}

.pdf-overlay {
  backdrop-filter: blur(2px);
  z-index: 2;
}

.preview-container {
  position: relative;
  z-index: 1;
}

/* 确保加载层在最顶层 */
.loading-overlay {
  z-index: 50 !important;
}
</style>
