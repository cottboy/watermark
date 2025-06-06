import { ref, computed } from 'vue'

// 语言类型
export type Locale = 'zh' | 'en'

// 翻译文本接口
export interface Translations {
  // 页面标题和描述
  title: string
  description: string
  noServerSafe: string
  
  // 按钮文本
  load: string
  loadBatch: string
  download: string
  downloadAll: string
  
  // 配置项标签
  words: string
  fontFamily: string
  width: string
  height: string
  fontSize: string
  color: string
  rotate: string
  row: string
  col: string
  startX: string
  startY: string
  offsetX: string
  offsetY: string
  compression: string
  saveConfig: string
  
  // 配置项提示
  tooltips: {
    words: string
    fontFamily: string
    width: string
    height: string
    fontSize: string
    color: string
    rotate: string
    row: string
    col: string
    startX: string
    startY: string
    offsetX: string
    offsetY: string
    compression: string
    saveConfig: string
  }
  
  // 其他文本
  compressionTitle: string
  
  // 颜色选择器
  opacity: string
  
  // 页脚图标提示
  originalProject: string
  forkWithEnhancements: string
  
  // 批量处理
  clear: string
  processing: string
  pages: string
  pdfDocument: string
  batchEmptyHint: string
}

// 中文翻译
const zhTranslations: Translations = {
  title: '水印工具',
  description: '为图片/PDF添加水印',
  noServerSafe: '文件不会上传，安全可靠',
  
  load: '加载文件',
  loadBatch: '批量加载',
  download: '下载',
  downloadAll: '批量下载',
  
  words: '水印文字',
  fontFamily: '字体',
  width: '图片宽度',
  height: '图片高度',
  fontSize: '字体大小',
  color: '颜色',
  rotate: '旋转角度',
  row: '行数',
  col: '列数',
  startX: '起始X坐标',
  startY: '起始Y坐标',
  offsetX: 'X轴偏移',
  offsetY: 'Y轴偏移',
  compression: '压缩质量',
  saveConfig: '保存配置',
  
  tooltips: {
    words: '水印文字内容，使用回车键换行',
    fontFamily: '水印字体',
    width: '图片宽度，对PDF无效',
    height: '图片高度，对PDF无效',
    fontSize: '水印字体大小',
    color: '水印颜色，rgba格式，最后一个参数是透明度',
    rotate: '水印旋转角度',
    row: '水印行数',
    col: '水印列数',
    startX: '第一个水印的X轴位置',
    startY: '第一个水印的Y轴位置',
    offsetX: '水印之间的X轴偏移量',
    offsetY: '水印之间的Y轴偏移量',
    compression: '压缩级别',
    saveConfig: '保存配置供下次使用'
  },
  
  compressionTitle: '数值越低，压缩越高',
  
  // 颜色选择器
  opacity: '透明度',
  
  // 页脚图标提示
  originalProject: '原始项目',
  forkWithEnhancements: '新增功能的分叉',
  
  // 批量处理
  clear: '清空',
  processing: '处理中...',
  pages: '页',
  pdfDocument: 'PDF 文档',
  batchEmptyHint: '点击"{loadBatch}"选择多张图片或PDF文件进行批量处理'
}

// 英文翻译
const enTranslations: Translations = {
  title: 'Watermark',
  description: 'Add watermark to image/pdf',
  noServerSafe: 'No server, so safe',
  
  load: 'Load',
  loadBatch: 'Batch Load',
  download: 'Download',
  downloadAll: 'Download All',
  
  words: 'Words',
  fontFamily: 'Font',
  width: 'Width',
  height: 'Height',
  fontSize: 'Font Size',
  color: 'Color',
  rotate: 'Rotate',
  row: 'Row',
  col: 'Col',
  startX: 'Start X',
  startY: 'Start Y',
  offsetX: 'Offset X',
  offsetY: 'Offset Y',
  compression: 'Compression',
  saveConfig: 'Save Config',
  
  tooltips: {
    words: 'The words of watermark, use enter key to wrap lines',
    fontFamily: 'The font family for the watermark text',
    width: 'The width of image, pdf is not useful',
    height: 'The height of image, pdf is not useful',
    fontSize: 'The font size of the watermark',
    color: 'The color of the watermark, rgba is three-primary color, last parameter is opacity',
    rotate: 'The rotation angle of watermark',
    row: 'The rows of watermarks',
    col: 'The columns of watermarks',
    startX: 'The position along the X axis of first watermark',
    startY: 'The position along the Y axis of first watermark',
    offsetX: 'The offset along the X axis between two watermarks',
    offsetY: 'The offset along the Y axis between two watermarks',
    compression: 'The level for compression',
    saveConfig: 'Save the config for next use'
  },
  
  compressionTitle: 'Lower the Value, Better the Compression',
  
  // 颜色选择器
  opacity: 'Opacity',
  
  // 页脚图标提示
  originalProject: 'Original Project',
  forkWithEnhancements: 'Fork with Enhancements',
  
  // 批量处理
  clear: 'Clear',
  processing: 'Processing...',
  pages: 'pages',
  pdfDocument: 'PDF Document',
  batchEmptyHint: 'Click "{loadBatch}" to select multiple images or PDF files for batch processing'
}

// 语言状态
const currentLocale = ref<Locale>('zh')
const translations = ref<Translations>(zhTranslations)

// 检测浏览器语言
function detectBrowserLanguage(): Locale {
  const browserLang = navigator.language || navigator.languages?.[0] || 'en'
  return browserLang.startsWith('zh') ? 'zh' : 'en'
}

// 自动设置语言
const detectedLang = detectBrowserLanguage()
currentLocale.value = detectedLang
translations.value = detectedLang === 'zh' ? zhTranslations : enTranslations

export function useI18n() {
  return {
    t: computed(() => translations.value),
    locale: computed(() => currentLocale.value)
  }
} 