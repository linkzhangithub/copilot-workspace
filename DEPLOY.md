# AI 写作助手部署指南

## 部署架构

```
write.link2ai.online
         │
         ├── 前端（EdgeOne Pages 静态托管）
         │   └── Vue 3 构建产物
         │
         └── 后端 API（云函数 SCF Web 函数）
             └── Node.js Express 服务
```

## 免费额度

| 服务 | 免费额度 | 说明 |
|------|----------|------|
| EdgeOne Pages | 公测期间免费 | 静态网站托管 |
| 云函数 SCF | 前3个月每月100万次调用 | 3个月后按量计费 |

---

## 第一步：安装云函数依赖

```bash
npm install tencentcloud-serverless-nodejs --save
```

---

## 第二步：部署后端到云函数 SCF

### 2.1 进入云函数控制台

访问：https://console.cloud.tencent.com/scf

### 2.2 创建 Web 函数

1. 点击「新建」→「Web 函数」
2. 填写基本信息：
   - 函数名称：`ai-writer-api`
   - 运行环境：`Node.js 20.13`
   - 地域：选择「广州」或「上海」

### 2.3 上传代码

方式一：通过 Git 部署（推荐）
- 选择「代码源」→「GitHub」
- 授权 GitHub 并选择仓库：`linkzhangithub/copilot-workspace`
- 分支：`master`

方式二：本地上传
- 选择「代码源」→「本地上传」
- 将整个项目打包为 ZIP 上传

### 2.4 配置环境变量

在「函数配置」→「环境变量」中添加：

| 变量名 | 变量值 |
|--------|--------|
| NODE_ENV | production |
| ZHIPU_API_KEY | 你的智谱 API Key |
| XUNFEI_APP_ID | 你的讯飞 APP ID |
| XUNFEI_API_KEY | 你的讯飞 API Key |
| XUNFEI_API_SECRET | 你的讯飞 API Secret |
| ALLOWED_ORIGINS | https://write.link2ai.online |

### 2.5 配置触发器

1. 在「触发管理」中添加触发器
2. 选择「API 网关触发器」
3. 配置：
   - 请求路径：`/`
   - 请求方法：`ANY`
   - 鉴权方式：免鉴权

### 2.6 记录 API 地址

部署成功后，记录 API 网关地址，格式如：
```
https://service-xxx-1234567890.gz.apigw.tencentcs.com
```

---

## 第三步：部署前端到 EdgeOne Pages

### 3.1 进入 EdgeOne 控制台

访问：https://console.cloud.tencent.com/edgeone

### 3.2 创建 Pages 项目

1. 切换到「Pages」标签页
2. 点击「创建 Pages 项目」→「导入 Git 仓库」
3. 授权 GitHub 并选择仓库：`linkzhangithub/copilot-workspace`

### 3.3 配置构建设置

| 配置项 | 值 |
|--------|-----|
| 框架预设 | Vue.js |
| 构建命令 | npm install && npm run build |
| 输出目录 | dist |
| Node.js 版本 | 20.x |

### 3.4 配置环境变量

在「环境变量」中添加：

| 变量名 | 变量值 |
|--------|--------|
| VITE_API_BASE_URL | 你的云函数 API 地址 |

### 3.5 开始部署

点击「开始部署」，等待构建完成。

---

## 第四步：配置子域名

### 4.1 在 EdgeOne Pages 添加自定义域名

1. 进入项目详情页 → 「域名管理」
2. 点击「添加自定义域名」
3. 输入：`write.link2ai.online`
4. EdgeOne 会生成一个 CNAME 地址

### 4.2 配置 DNS 解析

在腾讯云 DNS 解析控制台：

1. 进入 [DNS 解析控制台](https://console.cloud.tencent.com/cns)
2. 找到 `link2ai.online` 域名
3. 添加记录：
   - 主机记录：`write`
   - 记录类型：`CNAME`
   - 记录值：EdgeOne 提供的 CNAME 地址
   - TTL：600

### 4.3 等待 SSL 证书

EdgeOne 会自动为域名申请免费 SSL 证书，通常几分钟内完成。

---

## 第五步：验证部署

1. 访问 https://write.link2ai.online
2. 测试 AI 写作功能是否正常

---

## 常见问题

### Q: 云函数调用失败？

检查环境变量是否正确配置，特别是 `ZHIPU_API_KEY`。

### Q: 前端无法调用后端 API？

1. 检查 CORS 配置
2. 确认 `ALLOWED_ORIGINS` 包含 `https://write.link2ai.online`

### Q: 域名无法访问？

1. 检查 DNS 解析是否生效（通常需要几分钟）
2. 检查 SSL 证书是否已颁发

---

## 费用预估

| 项目 | 费用 |
|------|------|
| EdgeOne Pages | 免费（公测期间） |
| 云函数 SCF（前3个月） | 免费 |
| 云函数 SCF（3个月后） | 按量计费，个人项目通常 < 10元/月 |
| **总计** | **前3个月免费，之后约10元/月** |
