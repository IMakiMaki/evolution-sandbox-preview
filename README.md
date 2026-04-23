# Evolution Sandbox

一个可以直接部署到 **GitHub Pages** 的生物进化模拟器 Web 预览版。  
目标是把“环境 Agent + 生物策略 Agent + 规则仿真引擎”的架构，先做成一个 **无需后端、打开即跑** 的在线演示版本。

## 在线预览

部署后访问：

```text
https://IMakiMaki.github.io/evolution-sandbox-preview/
```

你可以把这个链接放到 README 顶部，这样别人打开仓库主页就能直接点进去看预览。

---

## 当前版本能力

- 纯前端静态部署，可直接托管到 GitHub Pages
- 环境层：气候、湿度、资源、风险动态变化
- 物种层：多个物种基于当前环境做演化策略调整
- 规则层：资源结算、繁殖、死亡、种群变化
- 可视化层：生态地图、环境日志、策略日志、种群趋势

## 当前 LLM 说明

当前仓库默认是 **可离线运行** 的：

- 默认启用 `Mock LLM`，用于模拟“策略层推理输出”
- 不依赖真实 API Key
- 这样 GitHub Pages 才能稳定在线预览

### 后续接真实免费 LLM 的推荐方式

如果你后面想接免费的或低成本的模型，建议不要把 Key 直接放前端，而是采用：

- 本地开发：前端 + 一个极简 Node 代理
- 或 Cloudflare Worker / Vercel Serverless 做代理
- 可接 OpenRouter、Gemini、兼容 OpenAI 的任意供应商

---

## 本地运行

因为是纯静态项目，最简单方式：

### 方式 1：直接打开
直接双击 `index.html` 即可。

### 方式 2：本地静态服务
```bash
npx serve .
```

---

## 部署到 GitHub Pages

### 1. 推送到仓库
把本项目推到一个公开仓库。

### 2. 打开 GitHub Pages
进入仓库：

- `Settings`
- `Pages`
- `Build and deployment`
- `Source` 选择 `Deploy from a branch`
- 分支选择默认分支（如 `main`）
- 文件夹选择 `/ (root)`
- 保存

### 3. 等待部署完成
完成后会得到：

```text
https://IMakiMaki.github.io/evolution-sandbox-preview/
```

---

## 项目结构

```text
.
├── index.html
├── styles.css
├── README.md
└── src
    ├── main.js
    ├── render.js
    ├── simulation.js
    └── strategy.js
```

---

## 你这个版本为什么适合先做在线预览

因为你的原始设想里有“环境主线 LLM + 多个生物进化 LLM”，但这类系统如果一开始就：

- 接后端
- 接数据库
- 接真实多 Agent 编排
- 接真实 LLM API

会立刻变重，不能满足“GitHub 仓库首页就能直接看效果”的要求。

所以这个版本先把系统拆成：

- **环境变化**
- **物种策略**
- **规则结算**
- **可视化展示**

先用纯前端跑通交互闭环。

---

## 下一步可扩展方向

### 1. 接入真实 LLM
把 `src/strategy.js` 改成：
- 一个本地 mock provider
- 一个真实 API provider
- 通过 UI 切换

### 2. 引入网格地图
当前地图是抽象画布，下一步可以扩成：
- 地块资源分布
- 地形阻挡
- 物种迁移路径

### 3. 引入谱系分化
当某物种长期突变累积到阈值后，分裂成新物种。

### 4. 加入真正的环境事件 Agent
例如：
- 干旱季
- 冰川期
- 疫病
- 外来物种入侵

---

## License

MIT
