# CertNest

跨平台的个人证书收藏夹。完整需求、schema、安全规则和里程碑都在 `docs/PLAN.md`，每次开始工作前先读它。

## 每次都要遵守

- 一次只做一个里程碑，做完停下来等审核，不要自己开始下一个。
- 每次改代码前都先给计划（改哪些文件、做什么），等我明确同意才动手。没同意就不改任何代码。
- 回复要短：不重复我或你之前说过的内容，计划用条列，总结只写结果和待我决定的事，不贴大段代码。
- 安全规则优先于功能需求。有冲突就停下来问，不要自己取舍。
- 每个人只能登录和管理自己的账号。公开页只经过白名单函数，只显示允许公开的字段。
- 密钥只放服务器端环境变量，绝不加 `NEXT_PUBLIC_` 前缀，绝不被 client component import。
- 数据库改动一律写成 Supabase migration。
- 只连接线上开发项目 certnest-dev，不使用 Docker 或本地 Supabase。会删除资料的指令只能对开发项目执行，执行前先问我。
- 不编造证书资料，缺失就留空。
- 新增技术栈以外的依赖套件前先问。
- 网站以英文为主：界面、错误讯息、邮件、公开页、代码和注释都用英文；AI 内容默认英文。PLAN.md 里的中文界面文字实现时换成英文（对照见 PLAN.md 规则 9）。

## 进度

每完成一个里程碑，在这里更新一行：日期、里程碑、结果、遗留问题。

- 2026-10-23 M1 地基：骨架、Auth、5 个 migration 已推到 certnest-dev，DB 测试 42/42、App 测试 3/3 通过。遗留：注册/验证邮箱/重设密码需人工测试；尚未 commit；Next 16.4 默认开 Cache Components，读 cookie/searchParams 的部分要包 Suspense。
- 2026-10-23 M2 证书管理：新增/编辑/删除、上传下载（/api/files，magic bytes、10MB、sharp 去 EXIF）、证书库、Dashboard 分页、UI 换成青绿主题。Unit+DB 71/71、App 4/4 通过，浏览器实测新增/上传/删除正常。无新 migration。已通过审核。卡片不显示技能、点击暂不跳转（详情页 M3）。遗留：`skills` 表不清理已无人使用的技能。
- 2026-10-23 M3 Badge Details（已通过审核）：卡片点击弹窗（顶部 "Badge Details"、底部 Close，网址不变）+ `/certificates/[id]` 整页，状态 Expires/Expired/Does not expire/Status unknown + Issuer link available（不显示 Verified），缺失显示 Not provided，描述展开、复制 ID（含备用复制）、下载原件。Unit 18/18、DB 61/61、App 4/4 通过；浏览器实测通过，复制按钮的真实点击待人工确认。无新 migration。待 M4：公开页点证书跳到随机代码网址（如 `/b/{slug}`），版式参考用户提供的 Credly 详情页，需同步修改 PLAN「不产生新网址」一条；弹窗底部加 Share Badge 按钮。
- 2026-10-26 M4 分享（已通过审核）：migration 加 `certificates.public_id`、slug 格式约束、share 只能撤销的 trigger、`get_public_portfolio`/`get_public_certificate`/`resolve_public_image`（后者仅 service role）。公开页 `/p/{slug}`（Badge/Skills Wallet）、`/p/{slug}/{public_id}`、`/b/{slug}`、图片路由；无效链接由 proxy 回 404；noindex、no-store、OG 标签；`/settings/sharing`、Share Badge 面板（LinkedIn/X/Facebook/Email）。PLAN 已更新（隐藏只针对作品集、证书详情随机代码网址、public_id）。Unit+DB 93/93、App 8/8 通过，浏览器实测开启作品集、访客页、单张分享、关闭后 404 正常。之后追加：公开详情页只显示上半部（PLAN 规则 7 例外）；分享面板改为三步式（Add to LinkedIn profile 预填表单、公开链接与分享、下载自己的文件），Embed Code 和生成证书 PDF 不做。访客作品集页重新设计：置中 Wallet 分页、Earned from 机构筛选、点技能筛证书、搜索、排序、过期证书收起、View credential 按钮、Share 按钮、页尾、`/p/{slug}/og` 自动生成分享图、手机版。之后去掉 Public profile 标签和 Share 按钮，issuers 改为 organizations；Skills Wallet 改为可搜索、可排序（Most badges / Most recent / A–Z）的列表，每行展开显示对应证书（先 5 张，可显示全部）。遗留：公开页每次请求在 proxy 和页面各查一次（MVP 可接受）；LinkedIn 实际跳转待人工确认。
- 2026-10-27 M5 AI 贴文（已通过审核）：`@google/genai`（开发用 Gemini 免费版，`AI_PROVIDER` 可切换，正式环境默认拒绝 Gemini）；migration `ai_requests` + `consume_ai_quota`（10 次/小时，原子、不可自行重置）+ service role 专用退还；`/api/ai/generate` 串流；AI 面板（语言、语气、生成/重新生成/停止、编辑、复制、保存、剩余次数、资料不足提示）在 `/certificates/[id]` 和分享面板。详情页改为服务器端载入面板资料。Unit+DB 108/108、App 10/10 通过。已用真实 Gemini key 实测英/中/马来文生成（约 3–4 秒，未编造、未带出 Credential ID）；默认模型改为 Flash-Lite（Flash 免费版常 503），关闭 SDK 重试并加 15 秒首响应超时与切换。表单补强：已上传文件的 Remove 改成明显按钮并先确认；刚选的文件显示名称、大小并可用 × 取消。新功能"上传文件后 AI 自动填写字段"排到之后的里程碑（换付费供应商后）。遗留：**上线前必须换付费 AI 供应商**。
- 2026-10-27 M6 打磨（已通过审核）：骨架加载、`(app)/error.tsx`、站内 404、`global-error`；统一空白状态（EmptyState）；手机版（顶部搜索图标、弹窗近全屏、更大点按区）；Skip to content、全站焦点外框、减少动态效果；对比度脚本检查后加深 destructive 色、修正分页文字对比、登录等页加 h1。Playwright（desktop + Pixel 7）+ axe：19 通过、1 跳过（Tab 测试只跑桌面）；测试用 mock AI（需 `CERTNEST_E2E=true`）。Unit+DB 108/108、App 10/10。PLAN 加入 M7（从文件自动填写）和上线前清单。之后追加手机版修正：Dashboard 头部改上下排列、分享面板与详情标题完整换行、公开页分页标签占满宽度与统计自动换行；新增 `e2e/responsive.spec.ts` 检查 10 个页面在手机上不横向溢出。E2E 20 通过、2 跳过。遗留：表单的跨字段错误要等单字段错误修正后才显示。
- 2026-10-28 M8 自订网址（已通过审核）：migration（`profiles.handle` + 格式/保留字检查、`handle_reservations` 90 天保留、`get_public_portfolio_by_handle`、`resolve_public_image_by_handle` 仅 service role）；路由 `/u/{handle}`、`/skills`、`/badges/{id}`、图片、预览图，另加 `/p/{slug}/skills`；分页改成独立网址（pushState + 返回键）；proxy 对 `/u` 同样回真 404；设置页 Custom address；"View public portfolio" 优先用自订网址。Unit+DB 118/118、App 10/10、E2E 22 通过 2 跳过。之后按用户决定：公开页不显示官方证书链接、"Issuer link available" 标签和页尾核实提示（私人页面照旧），PLAN 已更新。公开读取函数仍回传 `credential_url`（公开页不使用；2026-10-28 用户决定保留，不改函数）。再按用户决定：自订网址取代随机作品集链接（migration `20261028000300`：有 handle 时 `/p/{slug}` 失效；移除 handle 由 trigger 产生新随机链接；`/b` 不受影响），设置页合并为一个 "Your link"，有自订网址时不显示 New link。Unit+DB 120/120、App 10/10、E2E 22 通过 2 跳过。
