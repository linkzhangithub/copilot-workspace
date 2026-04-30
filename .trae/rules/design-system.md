# 设计系统规范

## 主题切换

每次开发新项目时，在指令中指定 `主题：[主题名]`。未指定时 AI 根据项目类型自动选择：工具类→Vercel蓝，AI/SaaS→Stripe靛蓝，文档/知识库→Linear静谧蓝。

## 主题一：Vercel 蓝

适用：AI 工具、开发者工具

- --primary: #0070F3 / hover: #0050D4 / light: #0070F3/10
- --accent: #7928CA
- --bg-page: #F5F5F7 / --bg-primary: #FFFFFF / --bg-secondary: #FFFFFF / --bg-tertiary: #F0F0F2
- --text-primary: #1D1D1F / --text-secondary: #86868B / --text-tertiary: #AEAEB2
- --border: #E5E5EA / --border-hover: #D1D1D6
- --success: #30D158 / --warning: #FF9F0A / --danger: #FF453A
- 渐变：linear-gradient(135deg, #0070F3, #7928CA)
- 布局：页面底色 #F5F5F7，白色面板浮在上面，阴影+圆角分离层次

## 主题二：Stripe 靛蓝

适用：AI 应用、SaaS 产品

- --primary: #635BFF / hover: #5851DB / light: #635BFF/15
- --accent: #22D3EE
- --bg-page: #0B1120 / --bg-primary: #111827 / --bg-secondary: #0F172A / --bg-tertiary: #1E293B
- --text-primary: #F1F5F9 / --text-secondary: #94A3B8 / --text-tertiary: #64748B
- --border: #1E293B / --border-hover: #334155
- --success: #34D399 / --warning: #FBBF24 / --danger: #F87171
- 渐变：linear-gradient(135deg, #635BFF, #22D3EE)
- 布局：三层深色递进（#0B1120 → #0F172A → #111827），边框+阴影分离
- 浅色变体：--bg-page: #F5F5F7 / --bg-primary: #FFFFFF / --bg-secondary: #F6F9FC / --bg-tertiary: #EEF2F6 / --text-primary: #0A2540 / --text-secondary: #5E6C84 / --text-tertiary: #8792A2 / --border: #E3E8EF

## 主题三：Linear 静谧蓝

适用：文档系统、知识库、RAG 项目

- --primary: #5E6AD2 / hover: #4F5BBF / light: #5E6AD2/10
- --accent: #D4A843
- --bg-page: #F7F7F8 / --bg-primary: #FFFFFF / --bg-secondary: #FFFFFF / --bg-tertiary: #F7F7F8
- --text-primary: #1A1A2E / --text-secondary: #7C7C8A / --text-tertiary: #B0B4C8
- --border: #E5E5EA / --border-hover: #D1D3DB
- --success: #4DAB9A / --warning: #D4A843 / --danger: #E5534B
- 不使用渐变，强调纯色和微妙阴影

## 3D 透视倾斜

主内容卡片支持鼠标跟随的轻微 3D 倾斜效果（perspective + rotateX/Y），增强悬浮感。

- Vercel蓝：最大 2 度 / Linear蓝：最大 1.5 度 / Stripe靛蓝：最大 3 度
- 阴影跟随倾斜方向偏移，回弹用 ease-out 0.3s
- 仅主内容卡片生效，侧边栏/弹窗/按钮不加
- 移动端禁用（@media hover:none）
- 使用 will-change:transform + requestAnimationFrame 优化性能

## 通用规范

### 字体
- 正文：-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif
- 代码：'JetBrains Mono', 'Fira Code', monospace
- H1: 24px/600 / H2: 20px/600 / H3: 16px/600 / 正文: 14px/400/1.6 / 辅助: 12px/400

### 间距（4px 网格）
- 组件内: 12-16px / 组件间: 16-24px / 页面边距: 24-32px / 卡片内: 20-24px

### 圆角
- 小元素: 4px / 按钮/输入框: 8px / 卡片/弹窗: 12px / 头像: 9999px

### 阴影
- sm: 0 1px 3px rgba(0,0,0,0.06) / md: 0 4px 12px rgba(0,0,0,0.08) / lg: 0 12px 24px rgba(0,0,0,0.1) / xl: 0 20px 40px rgba(0,0,0,0.12)
- 深色主题阴影加重 30%

### 动画
- 默认: transition-all duration-200 ease-in-out
- 禁止: bounce、spin（加载图标除外）、闪烁

### 组件
- 按钮: 高度 40px / 圆角 8px / padding 0 16px / 主按钮用 --primary 背景
- 输入框: 高度 40px / 圆角 8px / focus 时 --primary 边框 + ring
- 卡片: 圆角 12px / padding 20-24px / --bg-primary 背景 / shadow-sm / 应用 3D 倾斜
- 对话气泡: 用户右对齐 --primary 背景 / AI 左对齐 --bg-tertiary 背景 / rounded-2xl / max-width 75%
- 侧边栏: 宽度 260px / --bg-secondary 背景 / 不加 3D 倾斜
- 加载: 骨架屏 animate-pulse，禁止纯文字"加载中"
- 弹窗: 遮罩 bg-black/50 backdrop-blur-sm / 不加 3D 倾斜
- 空状态: 居中 padding 48px / 图标 48px / 标题 16px/500 / 描述 14px

### 布局
- 最大宽度 1280px 居中 / 侧边栏固定 260px + 主内容 flex-1 / 导航栏 56-64px
- 页面底色用 --bg-page，内容面板用 --bg-primary，形成层次

### 响应式
- ≥1024px: 完整布局 + 3D 倾斜 / 768-1023px: 侧边栏可收起 / <768px: 侧边栏隐藏 + 禁用 3D 倾斜
- 可点击元素最小 44px × 44px

### 深色/浅色
- Stripe 默认深色，其他默认浅色，都支持切换
- 切换方式: class="dark" + CSS 变量覆盖
- 深色模式阴影加重 30%，3D 倾斜阴影偏移加大 50%
