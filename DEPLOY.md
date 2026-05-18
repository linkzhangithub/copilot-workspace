# AI 写作助手部署指南

## 部署架构

```
write.link2ai.online
│
├── 前端（EdgeOne Pages 静态托管）- Vue 3
└── 后端（EdgeOne Pages Node Functions）- Express API
```

**完全不需要云函数！** 前后端都在 EdgeOne Pages 搞定！

---

## 部署步骤

### 1. 打开 EdgeOne Pages 控制台

访问：https://console.cloud.tencent.com/edgeone/pages

### 2. 创建新项目

- 选择「导入 Git 仓库」
- 授权 GitHub，选择你的仓库 `linkzhangithub/copilot-workspace`
- 分支选择 `master`

### 3. 配置构建

```
框架预设：Vue.js
构建命令：npm install && npm run build
输出目录：dist
Node.js 版本：20.x
```

### 4. 配置环境变量

在项目设置 → 环境变量中添加：

```
ZHIPU_API_KEY=你的智谱 API Key
```

### 5. 启动部署

点击「开始部署」，等待自动构建完成。

### 6. 配置自定义域名

- 进入项目 → 域名管理 → 添加自定义域名
- 输入：`write.link2ai.online`
- EdgeOne 会生成一个 CNAME 地址

### 7. 配置 DNS 解析

在腾讯云 DNS 控制台（或你的域名服务商）：

- 添加 CNAME 记录
- 主机记录：`write`
- 记录类型：`CNAME`
- 记录值：EdgeOne 提供的 CNAME 地址

### 8. 等待生效

- DNS 解析通常几分钟内生效
- SSL 证书会自动申请

---

## 本地开发

```bash
npm install
npm run dev  # 前端
node server.js  # 后端
```

访问：http://localhost:5173

---

## 费用说明

| 服务 | 免费额度 |
|------|---------|
| EdgeOne Pages | 公测期间免费 |
| 超出后 | 按实际用量计费 |

个人项目基本免费！
