# 色彩密语 · Color Whisper

把文字变成类似色觉检测图的点彩图片。纯静态网页，可部署到 GitHub Pages，无后端、无 API Key。

线上地址：https://dreamthreebs.github.io/colorblind/

## 功能

- 中文、英文、数字、聊天内容输入，最多 600 个 UTF-16 代码单元；长内容自动分页。
- 绿色觉（Deutan）、红色觉（Protan）、蓝色觉（Tritan）三个配色方向。
- 原始色彩、近似色觉模拟、高对比揭晓；模拟程度 0–100%。
- 两款随站托管的字体（Noto Sans SC 可变黑体、站酷快乐体），三种排版预设，可调笔画粗细、目标字号和字间留白；文字过长时自动缩小。
- 默认使用缤纷彩点与大圆点：黄、绿、蓝等多种颜色交错，大小错落；可切回经典双色，颗粒大小独立调节。
- 五种可选花纹（收在“其他形状”中）：经典圆点、小花花、星星糖、爱心雨、混搭彩屑；可展开局部特写，导出保留所选样式。切换花纹保留字号、笔画和颗粒大小，可单独选择“看看大花纹”。
- 四种圆点密度（含适合复杂字的“微点”档）与随机排列；下载当前页的 1000 × 1000 PNG。
- PNG 附带完整聊天原文，可在“读回密语”中恢复。所有处理在浏览器内进行。
- 手机布局、键盘操作、无颜色依赖的文字标签。

## 本地运行

需要 Node.js 18 或更新版本，不需要安装 npm 依赖。

```sh
npm run dev
```

访问 http://127.0.0.1:4173 。执行 `npm test` 验证配色模拟、聊天分页和 PNG 数据往返。

## GitHub Pages

仓库包含 `.github/workflows/pages.yml`。在 GitHub 仓库 Settings → Pages → Build and deployment 中选择 **GitHub Actions**，推送到 `main` 后自动测试并发布 `public/`。所有站内资源使用相对地址，可部署到项目子路径。

若发布到自己的仓库，请修改页面 GitHub 链接与本文件中的线上地址。也可以将 `public/` 目录部署到任意静态托管平台。

## 模型与限制

使用 Machado 等人的色觉模拟矩阵，在**线性 RGB** 中计算，再编码回 sRGB。配色沿各类型 100% 模拟矩阵的最小奇异值方向生成。Protan 与 Deutan 在端点处的两组颜色基本重合；Tritan 仍有残余差异。随机明暗变化让点彩更自然，但这不是经临床验证的假同色图。

色弱程度、屏幕、字体、环境光与个人差异都会影响可读性，不能保证特定用户看不出文字。程度滑块表示模型参数，不是个人诊断；蓝黄色觉模拟尤其只是近似。没有提供“全色盲保证隐藏”模式。

PNG 使用私有附属块 `cwHt` 存储 UTF-8 JSON（含格式版本和原文），有 PNG CRC 校验。这是**明文附带数据，不是加密，不是 OCR**。每页 PNG 附带整段输入原文。截图、图片编辑或社交平台压缩可能移除这份数据。导出始终保存原始色彩，模拟和揭晓只用于预览。

输入和图片不会上传。密语字体随网站本地托管，无需访问 Google Fonts；字体加载完成后会重新生成当前卡片，失败时会提示并回退到系统字体。界面使用系统字体。表情的表现取决于设备字体。目标字号以 1000 × 1000 输出画布为准；排版面板同时显示适配后的实际字号。字间留白按字号百分比计算。

参考：

- [Machado, Oliveira, Fernandes (2009), A Physiologically-based Model for Simulation of Color Vision Deficiency](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html)
- [Colour Science 的预计算矩阵实现](https://github.com/colour-science/colour/blob/develop/colour/blindness/datasets/machado2010.py)
- [GitHub Pages 官方发布指南](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

矩阵数据许可见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

笔画粗细：黑体使用真实可变字重 400–900，默认 500，并默认使用微点，取消额外描边。圆体为固定字重，通过小幅轮廓收缩/扩张调节；过细时可向右回调，避免细笔画断裂。圆点位置与大小不依赖文字笔画，调细只改变文字颜色掩膜。

花纹的形状、转角仅由粒子位置决定，与文字掩膜无关，避免通过形状泄露字形。混搭包含圆点、花朵、星星、爱心、菱形、短条和圆环。所有花纹使用原有色觉配色与模拟；较大颗粒更适合欣赏花纹，复杂字建议微点。

缤纷配色使用六组共享的线性 RGB 色彩基准。每颗圆点的色组由坐标决定，与文字掩膜无关；文字与背景只沿目标色觉方向偏移，并共同限制幅度避免色域裁切。预览、模拟、局部特写与 PNG 导出使用同一配色。多色与大颗粒会增加读字难度，复杂字可使用经典双色或细颗粒。
