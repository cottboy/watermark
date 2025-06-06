# Watermark

> 基于 [Efrice/watermark](https://github.com/Efrice/watermark) 修改  
> Based on [Efrice/watermark](https://github.com/Efrice/watermark)  

Add watermark to image/pdf, or compression.

## 🆕 新增功能 / Enhancements

- 🌐 **国际化支持** - 中文/英文自动切换 (Internationalization - Auto Chinese/English switching)
- 🎨 **可视化颜色选择器** - 可视化选择颜色 (Visual selection of colors)
- 📝 **字体选择** - 支持多种中英文字体 (Font selection with Chinese/English fonts)
- 📁 **批量处理** - 支持多文件同时处理 (Batch processing for multiple files)

# Features

- 🍭 No sever, so safe.
- 🧂  Save the config for next use or not.
- 🌭 Add any number of watermarks you like by row and col.
- 🍰 Set the watermark anywhere you want by startX, startY and offsetX, offsetY.
- 🍤 Change image width and height, also can compress if you need.
- 🍤 Comprss pdf without watermark, simple repo [compress-pdf](https://efrice.github.io/compress-pdf/).

## Config

| parameter   | description                                                  |
| ----------- | ------------------------------------------------------------ |
| saveConfig  | save the config for next use.                                |
| words       | the words of watermark,  use enter key to wrap lines.        |
| fontFamily  | the font family for the watermark text.                      |
| width       | the width of image, pdf is not useful.                                      |
| height      | the height of image, pdf is not useful.                                     |
| fontSize    | the font size of the watermark.                              |
| color       | the color of the watermark, rgba is three-primary color, last parameter is opacity. |
| rotate      | the rotation angle of watermark.                             |
| row         | the rows of watermarks.                                      |
| col         | the columns of watermarks.                                   |
| startX      | the position along the X axis of first watermark.            |
| startY      | the position along the Y axis of first watermark.            |
| offsetX     | the offset along the X axis between two watermarks.          |
| offsetY     | the offset along the Y axis between two watermarks.          |
| compression | the level for compression.                                   |

## 📄 License

MIT License - 详见 [LICENSE](./LICENSE) 文件

- 原始项目版权归 [Efrice](https://github.com/Efrice) 所有
- 修改和增强功能版权归 [cottboy](https://github.com/cottboy) 所有