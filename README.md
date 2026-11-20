# railway-weather-api 🚂

一个部署在 [Railway](https://railway.app) 上的后端小应用：

- ⏰ **每小时整点**自动从公共 API（[Open-Meteo](https://open-meteo.com)，免费无需注册）获取北京的实时天气
- 🗄️ 数据存入 **PostgreSQL** 数据库
- 📡 提供接口查询**最近一次**及**历史**数据

技术栈：Node.js + Express + pg（PostgreSQL 客户端）+ node-cron（定时任务）

---

## 项目结构

```
railway-weather-api/
├── package.json        # 项目信息和依赖清单
├── .gitignore          # 告诉 git 哪些文件不要上传（node_modules、.env 等）
├── .env.example        # 环境变量模板（复制为 .env 使用）
└── src/
    ├── index.js        # 入口：Express 服务 + 每小时定时任务
    ├── db.js           # 数据库连接和建表
    └── fetcher.js      # 从公共 API 获取数据并存入数据库
```

## API 接口

| 接口 | 说明 |
|---|---|
| `GET /` | 接口列表说明 |
| `GET /health` | 健康检查 |
| `GET /api/latest` | **最近一次**获取到的数据 |
| `GET /api/history?limit=10` | 最近 N 条历史记录（最多 100） |

---

# 新手完整部署教程

整个流程分三大步：**① 推送到 GitHub → ② 在 Railway 部署 → ③ 连接数据库**。

## 第 1 步：把代码推送到 GitHub

如果还没有帮你在本机执行过 git 操作，在终端（项目文件夹内）运行：

```bash
cd ~/Desktop/Railway\ 相关/railway-weather-api

# 1. 初始化 git 仓库（只需执行一次）
git init

# 2. 把所有文件加入暂存区（node_modules 会被 .gitignore 自动排除）
git add .

# 3. 提交
git commit -m "初始提交：天气定时抓取 API"

# 4. 用 gh 命令在 GitHub 上创建仓库并推送
gh repo create railway-weather-api --public --source=. --push
```

完成后打开 https://github.com 就能看到你的仓库。

> 💡 不想用命令行？也可以在 GitHub 网页上点 **New repository** 创建空仓库，然后按页面提示 `git remote add origin ...` + `git push -u origin main`。

## 第 2 步：在 Railway 上部署

1. 打开 https://railway.app ，点右上角 **Login** → 选择 **Login with GitHub**（首次会要求授权 Railway 访问你的 GitHub 账号，点 **Authorize Railway App**）
2. 登录后进入 Dashboard，点 **New Project**（新建项目）
3. 选择 **Deploy from GitHub repo**（从 GitHub 仓库部署）
4. 选中 `railway-weather-api` 这个仓库 → Railway 会自动开始构建部署
5. 稍等 1～2 分钟，出现绿色 ● 表示部署成功；如果失败，点进服务 → **Logs**（日志）标签页查看报错原因

> Railway 会自动识别 Node.js 项目，执行 `npm install` 和 `npm start`，无需任何配置文件。

## 第 3 步：添加 PostgreSQL 数据库

部署的服务目前连不上数据库（日志里会有 `未配置 DATABASE_URL` 警告），现在来加数据库：

1. 在项目页面（Project Canvas 画布）点右上角 **New** → **Database** → **Add PostgreSQL**
2. Railway 会自动创建一个 PostgreSQL 数据库，画布上会多出一个 Postgres 的方块
3. 现在把数据库和服务连接起来：点击你的 **服务方块**（railway-weather-api）→ 上方切到 **Variables**（变量）标签 → 点 **New Variable**
4. 选择 **Add reference**（添加引用），在弹出的列表里展开 **Postgres**，选择 **DATABASE_URL**
5. 保存后 Railway 会自动重新部署服务

> 也可以手动添加变量，Name 填 `DATABASE_URL`，Value 填 `${{Postgres.DATABASE_URL}}` —— 这两种方式效果一样，都是"引用 Postgres 数据块的连接串"，数据库密码变了也会自动跟着变。

### 环境变量说明

| 变量名 | 必需？ | 说明 |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL 连接串，用上面的引用方式填 `${{Postgres.DATABASE_URL}}` |
| `PORT` | ❌ | Railway **自动注入**，代码里已自动读取，**不需要手动配置** |

## 第 4 步：生成公开访问域名

服务默认无法从外网访问，需要生成一个域名：

1. 点击服务方块 → 上方 **Settings**（设置）标签
2. 找到 **Networking** 区域 → 点 **Generate Domain**（生成域名）
3. Railway 会给你一个类似 `railway-weather-api-production-xxxx.up.railway.app` 的网址
4. 在浏览器打开它，看到 JSON 就成功了！🎉

然后试试：

```
https://你的域名/api/latest    ← 最近一次抓到的天气数据
https://你的域名/api/history   ← 历史记录
```

## 第 5 步：验证定时任务

1. 点进服务 → **Logs** 标签，应该能看到：
   ```
   🚀 服务已启动，端口: xxxx
   🗄️  数据表已就绪 (weather_reads)
   ✅ 数据已入库: 温度 x.x°C, 风速 x.x km/h, 时间 ...
   ⏰ 定时任务已启动: 每小时整点抓取一次
   ```
2. 服务**启动时会立即抓取一次**（不用干等一小时），之后每小时整点抓取
3. 想验证数据在持续入库？过一小时再看 `/api/history`，记录会变成两条

---

## 本地开发（可选）

需要本地装有 PostgreSQL，然后在项目目录：

```bash
cp .env.example .env    # 复制模板
# 编辑 .env，填入本地数据库连接串，例如：
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/weather
npm install
npm start
```

浏览器打开 http://localhost:3000/api/latest 即可测试。

## 常见问题排查

**Q: 部署失败怎么办？**
→ 点进服务 → Logs 标签看具体报错。最常见是 `npm install` 失败（网络问题，重试 Deploy 即可）。

**Q: 日志里出现 `未配置 DATABASE_URL`？**
→ 说明第 3 步没做完，服务没有连上数据库，按第 3 步添加变量引用。

**Q: 日志里出现数据库连接失败 / SSL 错误？**
→ 确认 `DATABASE_URL` 是用 `${{Postgres.DATABASE_URL}}` 引用（而不是复制粘贴了旧密码的明文连接串）。

**Q: 打开域名 404 或无法访问？**
→ 确认按第 4 步 Generate Domain 生成了域名；检查根路径 `/` 是否返回 JSON。

**Q: 定时任务会影响 Railway 费用吗？**
→ Railway 按用量计费（有免费额度）。每小时一次的抓取开销极小，可忽略。

**Q: 想改成每半小时 / 每天 8 点执行？**
→ 修改 `src/index.js` 里的 cron 表达式 `0 * * * *`：
> - `*/30 * * * *` 每 30 分钟；`0 8 * * *` 每天 8 点；`0 */2 * * *` 每 2 小时
> 格式为：`分 时 日 月 周`，改完 push 到 GitHub，Railway 会自动重新部署。
