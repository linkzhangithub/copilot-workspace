# AI 写作助手

一个基于 Vue 3 + Express + 智谱 AI 的智能写作助手应用。

## 功能特性

- 🎯 智能大纲生成
- ✍️ 流式内容生成
- 🔄 内容润色/扩写/缩写
- 📊 文章质量检测
- 💾 本地项目管理

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

必需配置：
- `ZHIPU_API_KEY`: 智谱 AI 的 API Key

### 3. 启动应用

#### 方式一：同时启动前后端（推荐）

```bash
npm start
```

这个命令会同时启动：
- 后端服务器（蓝色标签）
- 前端开发服务器（绿色标签）

#### 方式二：分别启动

终端 1 - 启动后端：
```bash
npm run server
```

终端 2 - 启动前端：
```bash
npm run dev
```

### 4. 访问应用

打开浏览器访问：http://localhost:5173

## 生产环境部署

### 1. 配置环境变量

```env
NODE_ENV=production
ZHIPU_API_KEY=your_production_api_key
API_KEY=your_secure_api_key
ALLOWED_ORIGINS=https://your-domain.com
```

### 2. 构建前端

```bash
npm run build
```

### 3. 启动生产服务器

```bash
NODE_ENV=production npm run server
```

## 安全说明

### 开发环境
- CORS 允许 localhost 访问
- 无需 API Key 鉴权

### 生产环境
- CORS 限制为配置的域名
- 所有 API 请求需要 API Key 鉴权
- 通过 `x-api-key` 请求头或 `apiKey` 查询参数传递

## API 使用示例

### 开发环境

```javascript
fetch('http://localhost:3000/api/ai/generate-outline', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ topic: '你的主题' })
})
```

### 生产环境

```javascript
fetch('https://your-domain.com/api/ai/generate-outline', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'x-api-key': 'your_api_key'
  },
  body: JSON.stringify({ topic: '你的主题' })
})
```

## 技术栈

- **前端**: Vue 3 + Vite + Tailwind CSS
- **后端**: Express + 智谱 AI API
- **存储**: localStorage（本地项目数据）

## 项目结构

```
copilot-workspace/
├── src/                 # 前端源码
│   ├── components/      # Vue 组件
│   ├── composables/     # 组合式函数
│   └── App.vue         # 根组件
├── services/           # 后端服务
│   └── aiService.js    # AI 服务封装
├── server.js           # Express 服务器
├── .env.example        # 环境变量示例
└── package.json        # 项目配置
```

## 常见问题

### Q: 启动后接口请求失败？
A: 确保后端服务已启动（使用 `npm start` 或 `npm run server`）

### Q: 如何获取智谱 AI API Key？
A: 访问 [智谱 AI 开放平台](https://open.bigmodel.cn/) 注册并创建应用

### Q: 生产环境如何保护 API Key？
A: 
1. 设置 `NODE_ENV=production`
2. 配置强密码作为 `API_KEY`
3. 限制 `ALLOWED_ORIGINS` 为你的域名
4. 使用 HTTPS

## License

MIT
