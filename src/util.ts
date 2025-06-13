import type { Config, imgData } from '~/types'
import type { Ref } from 'vue'
import * as pdf from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.js?url'
import { saveAs } from 'file-saver'

// 声明全局PDFDocument类型
declare global {
  const PDFDocument: any
  const blobStream: any
}

export function generateCanvas(config: Config, image: HTMLImageElement | HTMLCanvasElement, loadInit: boolean, isPdf: boolean = false, isPreview: boolean = false, forDownload: boolean = false) {
  const { width, height, words, compression } = config
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  
  // 根据模式选择不同的分辨率策略
  let scale = 1
  if (isPdf) {
    // PDF模式：预览时使用1倍，下载时使用高分辨率
    scale = isPreview ? 1 : Math.max(2, window.devicePixelRatio || 1)
  }
  
  canvas.width = (loadInit ? image.width : width) * scale
  canvas.height = (loadInit ? image.height : height) * scale
  
  // 设置canvas样式尺寸（显示尺寸）
  if (isPdf && scale > 1) {
    canvas.style.width = (loadInit ? image.width : width) + 'px'
    canvas.style.height = (loadInit ? image.height : height) + 'px'
  }
  
  // 缩放上下文以匹配设备像素比
  if (scale > 1) {
    context.scale(scale, scale)
  }
  
  // 启用图像平滑以获得更好的质量
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = isPreview ? 'medium' : 'high'
  
  context.drawImage(image, 0, 0, loadInit ? image.width : width, loadInit ? image.height : height)
  if(words.trim().length > 0) addWaterMark(config, context, scale)
  
  // 根据模式选择格式和质量
  let format = 'image/jpeg'
  let quality = compression
  
  if (isPdf) {
    if (forDownload) {
      // 下载时使用JPEG格式以减小文件大小，使用最高质量
      format = 'image/jpeg'
      quality = 1  // 使用最高质量
    } else if (isPreview) {
      // 预览时使用JPEG格式，较低质量以提高速度
      format = 'image/jpeg'
      quality = 0.8  // 预览时使用固定质量
    } else {
      // 其他情况使用PNG
      format = 'image/png'
      quality = 1
    }
  }
  
  return {
    src: canvas.toDataURL(format, quality),
    newCanvas: canvas
  }
}

function addWaterMark(config: Config, context: CanvasRenderingContext2D, scale: number = 1) {
  const { width, height, words, fontSize, color, rotate, row, col, startX, startY, offsetX, offsetY, fontFamily } = config
  context.fillStyle = 'rgba(255, 255, 255, 0.2)'
  context.fillRect(0, 0, width, height)
  context.rotate(parseInt(rotate.toString()) * Math.PI / 180)
  context.fillStyle = color
  context.font = `normal ${fontSize}px ${fontFamily}`
  Array.from({length: row}).forEach((_, index)=>{
    Array.from({length: col}).forEach((_, idx) => {
      if(words.includes('\n')) {
        multipleWords(context, index, idx, words, fontSize, startX.toString(), startY.toString(), offsetX, offsetY)
      }else {
        const x = +startX + idx * (words.length * fontSize + offsetX)
        const y = +startY + index * (offsetY + fontSize)
        context.fillText(words, x, y)
      }
    })
  })
}

function multipleWords(context: CanvasRenderingContext2D, index: number, idx: number, words: string, fontSize: number, startX: string, startY: string, offsetX: number, offsetY: number) {
  const wordsArr = words.split("\n")
  const len = wordsArr.length, maxLen = Math.max(...wordsArr.map(item => item.length))
  for (let i = 0; i < len; i++) {
    const x = +startX + idx * (maxLen * fontSize + offsetX) + (maxLen - wordsArr[i].length) / 2 * fontSize 
    const y = +startY + index * offsetY + fontSize * 1.3 * (i + len * index)
    context.fillText(wordsArr[i], x, y)
  }
}

export function downloadImage(url: string, config: Config, name: string) {
  const img = new Image()
  img.src = url

  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = +config.width
    canvas.height = +config.height

    const ctx = canvas.getContext('2d')
    ctx?.drawImage(img, 0, 0)

    const dataURL = canvas.toDataURL('image/png')
    const blob = dataURLToBlob(dataURL)

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = name 
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

function dataURLToBlob(dataURL: string) {
  const parts = dataURL.split(';base64,')
  const contentType = parts[0].split(':')[1]
  const raw = window.atob(parts[1])
  const rawLength = raw.length
  const uInt8Array = new Uint8Array(rawLength)
  for (let i = 0; i < rawLength; ++i)
    uInt8Array[i] = raw.charCodeAt(i)

  return new Blob([uInt8Array], { type: contentType })
}

pdf.GlobalWorkerOptions.workerSrc = pdfWorker;

const imgData: imgData[] = []
export async function loadPdf(url: string, config: Config, wrap: Ref<HTMLElement>, loading: Ref<boolean>, loadInit: boolean) {
  const loadingTask = pdf.getDocument({
    url,
    disableRange: true
  });

  imgData.length = 0

  loadingTask.promise.then((pdfDoc) => {
    if(wrap.value) wrap.value.innerHTML = ''
    const totalPages = pdfDoc.numPages;
    for (let i = 1; i <= totalPages; i++) {
      pdfDoc.getPage(i).then((page) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        
        // 使用更高的缩放比例来提高渲染质量
        const scale = Math.max(2, window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width
        canvas.height = viewport.height

        // 更新配置中的尺寸（使用缩放后的尺寸）
        config.width = viewport.width
        config.height = viewport.height

        // 启用图像平滑
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        const renderContext = {
          canvasContext: ctx,
          viewport,
        }

        const renderTask = page.render(renderContext);

        renderTask.promise.then(function () {
          const { newCanvas, src } = generateCanvas(config, canvas, loadInit, true)
          wrap.value.appendChild(newCanvas)
          imgData.push({src, width: canvas.width, height: canvas.height})
          if(imgData.length === totalPages){
            loading.value = false
          }
        })
      })
    }
  })
}

export function img2Pdf(name: string, loading: Ref<boolean>) {
  const options = {
    autoFirstPage: false,
    compress: false
  }

  const doc = new PDFDocument(options)
  const stream = doc.pipe(blobStream())

  for (let i = 0; i < imgData.length; i++) {
    const {src, width, height} = imgData[i]
    doc.addPage({
      size: [width, height],
    });
    doc.image(src, 0, 0)
  }

  doc.end()

  stream.on("finish", function () {
    var output_blob = stream.toBlob("application/pdf")
    saveAs(output_blob, name)
    loading.value = false
  });
}

// 预览用的PDF加载函数（低分辨率，快速响应）
export async function loadPdfPreview(url: string, config: Config, wrap: Ref<HTMLElement>, loading: Ref<boolean>, loadInit: boolean) {
  const loadingTask = pdf.getDocument({
    url,
    disableRange: true
  });

  loadingTask.promise.then((pdfDoc) => {
    if(wrap.value) wrap.value.innerHTML = ''
    const totalPages = pdfDoc.numPages;
    let processedPages = 0;
    
    for (let i = 1; i <= totalPages; i++) {
      pdfDoc.getPage(i).then((page) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        
        // 预览时使用较低的缩放比例以提高速度
        const scale = 1;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width
        canvas.height = viewport.height

        // 更新配置中的尺寸
        config.width = viewport.width
        config.height = viewport.height

        // 预览时使用较低的图像平滑质量
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'medium'

        const renderContext = {
          canvasContext: ctx,
          viewport,
        }

        const renderTask = page.render(renderContext);

        renderTask.promise.then(function () {
          // 使用预览模式生成canvas
          const { newCanvas } = generateCanvas(config, canvas, loadInit, true, true)
          wrap.value.appendChild(newCanvas)
          
          processedPages++;
          if(processedPages === totalPages){
            loading.value = false
          }
        })
      })
    }
  })
}

export async function img2PdfWithData(name: string, loading: Ref<boolean>, customImgData: imgData[]) {
  try {
    // 使用pdf-lib创建PDF以获得更好的压缩
    const { PDFDocument } = await import('pdf-lib')
    const pdfDoc = await PDFDocument.create()

    for (let i = 0; i < customImgData.length; i++) {
      const {src, width, height} = customImgData[i]
      
      // 提取图片数据
      const imageData = src.split(',')[1]
      if (!imageData) continue
      
      // 将 base64 转换为 Uint8Array
      const imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0))
      
      // 根据数据URL格式选择嵌入方式
      let embeddedImage
      if (src.startsWith('data:image/jpeg')) {
        embeddedImage = await pdfDoc.embedJpg(imageBytes)
      } else {
        embeddedImage = await pdfDoc.embedPng(imageBytes)
      }
      
      const page = pdfDoc.addPage([embeddedImage.width, embeddedImage.height])
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: embeddedImage.width,
        height: embeddedImage.height,
      })
    }

    // 保存PDF，启用压缩以减小文件大小
    const pdfBytes = await pdfDoc.save({
      useObjectStreams: false,  // 禁用对象流以提高兼容性
      addDefaultPage: false,    // 不添加默认页面
      objectsPerTick: 50,       // 每次处理的对象数量
    })
    
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    saveAs(blob, name)
    loading.value = false
  } catch (error) {
    console.error('生成PDF失败:', error)
    loading.value = false
    throw error
  }
}
