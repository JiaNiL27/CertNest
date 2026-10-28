# CertNest MVP 执行指令（给 Claude Code）

版本日期：2026-10-22

## 给 Claude Code 的工作规则

这是一个从零开始的项目：CertNest，一个跨平台的个人证书收藏夹。这份文件是需求和规则的唯一来源，每次开始工作前先读一遍。

1. 一次只做一个里程碑。现在只做 M1，做完后停下来，总结改了哪些文件、做了哪些数据库改动、测试结果，等我审核后才进入下一个里程碑。
2. 每次修改代码前（不只是每个里程碑开始时），先给出简短计划：要改哪些文件、做什么。等我明确同意后才动手，没有同意就不改任何代码。
3. 「安全规则」一节优先于任何功能需求。如果某个功能和安全规则冲突，停下来问我，不要自己取舍。
4. 不要新增「M1 执行指令」里列出的技术栈以外的依赖套件，需要的话先问。
5. 所有密钥只放在服务器端环境变量。`SUPABASE_SERVICE_ROLE_KEY` 和 AI API key 绝对不能有 `NEXT_PUBLIC_` 前缀，也不能被任何 client component import。
6. 数据库的所有改动都写成 Supabase migration 文件，不要在 dashboard 上手动改。
7. 不要编造证书资料。字段没有值就留空，由界面显示“未提供”。例外（2026-10-28 用户决定）：证书上的事实（标题、机构、日期、Credential ID、链接）绝不编造；描述和技能可在用户主动按 "Suggest with AI" 时由 AI 根据标题和机构起草，只填空白字段，标示 "Written by AI, not from your certificate"，`field_sources` 记 `ai_generated`，由用户确认后保存。例外（2026-10-26 确认）：公开详情页只显示有值的部分，缺失的描述、技能直接不显示；公开页不列 Platform、Credential URL 表格，Credential ID 只在开启时显示一行。
8. 回复要短，不重复我说过的话，也不重复你之前说过的内容。计划用条列，总结只写结果和需要我决定的事，不贴大段代码，除非我要求。
9. 网站以英文为主：所有界面文字、按钮、错误讯息、空白状态、邮件模板、公开页都用英文，代码、注释、变量名也用英文。AI 生成内容默认英文，用户可以另选语言。这份文件里写的中文界面文字，实现时一律换成对应的英文，例如“未提供”是 Not provided，“此链接无效或已停用”是 This link is invalid or no longer active，Badge Status 用 Issuer link available、Expired、Status unknown，过期日期用 Does not expire 和 Expiration date not provided。
10. 开发阶段只连接 `certnest-dev` 项目。会删除资料的指令（例如 `supabase db reset --linked`）只能对开发项目执行，而且执行前先问我。

## MVP 范围

MVP 的目标是：我自己每天会用，并且可以放心把作品集链接发给别人。

| 功能 | MVP | 说明 |
| --- | --- | --- |
| 注册、登录、登出 | 做 | Supabase Auth，邮箱加密码，需验证邮箱 |
| 证书新增、编辑、删除 | 做 | 手动输入，加上传 PDF 或图片 |
| 证书库 | 做 | 搜索标题，按发证机构筛选，按最新、最旧、标题排序 |
| Dashboard | 做 | 证书总数、技能总数、最近新增，Badges 和 Skills 两个分页 |
| Badge Details 页面 | 做 | 所有字段、描述的展开，按显示规则处理缺失资料 |
| Badge Status | 做 | 只显示“有发证机构链接”“已过期”“状态未知”，不显示 Verified（“有发证机构链接”只在我自己的页面显示，公开页不显示） |
| 公开作品集链接 | 做 | 一个链接展示我所有公开的证书，只读 |
| 单张证书公开链接 | 做 | 和作品集共用同一套分享机制 |
| 分享到 LinkedIn、X、Facebook、Email | 做 | 用各平台的分享链接和 `mailto:`，不需要 API；LinkedIn 只能带网址，贴文文字靠复制 |
| 下载原始文件 | 做 | 只有本人能下载，经由短效 signed URL |
| AI 生成 LinkedIn 贴文 | 做 | 可编辑、可重新生成、可复制、可保存 |
| 其他 AI 内容类型 | 之后 | 课程摘要、技能摘要、履历条列，数据结构先预留 |
| 从 PDF、图片、URL 自动抽取资料 | 之后 | URL 抓取有 SSRF 风险，需要单独设计 |
| Open Badges 导入与验证 | 之后 | 第二期最重要的功能 |
| 浏览次数 | 之后 | 只存每天的总数，不存 IP 或访客资料 |
| Embed Code | 之后 | 需要另外设置嵌入页面的安全标头 |
| 发证机构可点击 | 之后 | 需要加 `issuer_url` 字段 |
| 品牌分享卡、grid/list 切换、按技能筛选 | 之后 | 体验优化 |
| 分享次数 | 不做 | 只知道用户按了按钮，不知道是否真的分享出去，数字会误导 |
| 生成新的证书 PDF | 不做 | 会被误认为机构颁发的官方证书 |

## 账号与公开展示原则

每个人只能登录和管理自己的账号；别人只能通过我主动开启的链接，看到我允许公开的证书资料，其他什么都看不到。

### 登录

- 每个账号只看得到、改得到自己的资料。没有团队、没有管理员代登录、没有切换账号的功能。
- 每一次服务器端操作都用 `supabase.auth.getUser()` 重新确认身份，不要只相信 cookie 里的 session。
- 除了登录、注册、重设密码和公开链接页面，其他所有页面都要求登录，由 middleware 统一拦截。
- 注册后必须验证邮箱才能使用。提供忘记密码流程。

### 公开作品集链接

- 每个用户可以开启一个作品集链接 `/p/{slug}`，展示所有没有被设为隐藏的证书。
- 页面完全只读：没有编辑按钮，没有登录入口以外的导航，也不能从这个页面跳到我的任何私人页面。
- 页面顶部显示我自己设定的展示名称，绝不显示邮箱。
- 可选的自订网址（M8，2026-10-28 新增）：可在设置页设定 `/u/{handle}`。一个作品集只有一个链接：设了自订网址，它就取代随机代码链接，原 `/p/{slug}` 作品集链接（含其证书页、图片、预览图）立刻失效，设置页只显示一个"Your link"且不显示"New link"；移除自订网址时由数据库自动产生新的随机代码链接（沿用原选项），旧随机链接永不恢复；作品集关闭时移除则不产生链接。`/b/{slug}` 单张分享链接不受影响。规则：3–30 个小写字母、数字、连字符，不能以连字符开头或结尾、不能连续两个连字符，保留字不可用，不分大小写唯一。只在作品集开启时有效；关闭作品集后 `/u/…` 立刻 404。改名或移除后，旧名称为原主人保留 90 天，防止他人冒用。自订网址页面不透露随机代码链接，反之亦然。设定时提醒"知道或猜到这个名称的人都能看到作品集"。
- Badge Wallet 和 Skills Wallet 各有自己的网址：`…/skills`。
- 访客点开某张证书时，跳到 `/p/{slug}/{public_id}`。`public_id` 是每张证书自动生成的随机公开代码（32 位，不是证书 id，也不是 Credential ID），作品集链接撤销或重新生成后，这些网址一并失效。（2026-10-26 修订，原为"同一页展开、不产生新网址"）
- 我可以：开启或关闭作品集、重新生成链接（旧链接立刻失效）、把某张证书设为“不在作品集显示”、决定是否公开 Credential ID 和证书图片、用访客身份预览。
- 默认加上 `noindex`，不让搜索引擎收录。

### 单张证书链接

- 每张证书也可以单独开启一个链接 `/b/{slug}`，规则和作品集相同，只是范围只有这一张。
- 两种链接共用同一张 `shares` 表和同一套公开读取逻辑。

### 公开页可以显示什么

| 资料 | 我自己看 | 公开页 |
| --- | --- | --- |
| 证书名称、发证机构、来源平台 | 显示 | 显示 |
| 描述、技能 | 显示 | 显示 |
| 颁发日期、过期状态 | 显示 | 显示 |
| 官方证书链接 | 显示 | 不显示（2026-10-28 决定：公开页不放 "Verify on issuer site" 链接、不显示 "Issuer link available" 标签，页尾也不提示用链接核实；我自己的页面照旧显示） |
| Credential ID | 显示 | 只在我开启时显示 |
| 证书图片 | 显示 | 只在我开启时显示，经由图片路由提供 |
| PDF 原始文件 | 显示 | 永远不公开 |
| AI 生成的内容 | 显示 | 永远不公开 |
| 隐藏的证书（hidden_from_portfolio） | 显示 | 不在作品集显示；我主动开启的单张证书链接仍可查看（2026-10-26 确认） |
| 邮箱、user id、证书 id、存储路径、账号设置 | 部分显示 | 永远不公开 |

## 数据库 schema

七张表，全部建在 `public` schema，全部开启 RLS。下面是结构要求，Claude Code 负责写成正式的 migration。

```sql
create type expiration_status as enum ('has_date', 'never', 'unknown');
create type verification_status as enum ('unverified', 'issuer_link_available', 'verified');
create type share_scope as enum ('portfolio', 'certificate');

-- 公开展示名称，绝不存邮箳
profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)

certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  issuer_name text not null check (char_length(issuer_name) between 1 and 200),
  source_platform text,
  description text check (char_length(description) <= 5000),
  credential_id text,
  credential_url text check (credential_url ~ '^https?://'),
  issued_at date,                                  -- 用 date，避免时区偏移
  expiration_status expiration_status not null default 'unknown',
  expires_at date,
  verification_status verification_status not null default 'unverified',
  field_sources jsonb not null default '{}',       -- {"title":"user"}，预留给自动抽取
  hidden_from_portfolio boolean not null default false,
  public_id text not null unique,                  -- M4 加入：随机 32 位 hex，只用于公开网址
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((expiration_status = 'has_date') = (expires_at is not null)),
  check (expires_at is null or issued_at is null or expires_at >= issued_at)
)
-- "已过期" 不存储，显示时用 expires_at < current_date 计算

certificate_files (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references certificates on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('original', 'badge_image')),
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('application/pdf','image/png','image/jpeg','image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  public_key text not null unique,                 -- 随机值，公开图片路由只认它
  created_at timestamptz not null default now()
)

shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  scope share_scope not null,
  certificate_id uuid references certificates on delete cascade,
  public_slug text not null unique,                -- 22 位 base62，约 128 bit 随机
  is_active boolean not null default true,
  show_credential_id boolean not null default false,
  show_images boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check ((scope = 'portfolio') = (certificate_id is null)),
  check (is_active or revoked_at is not null)
)
create unique index one_active_portfolio on shares (user_id) where scope = 'portfolio' and is_active;
create unique index one_active_cert_share on shares (certificate_id) where scope = 'certificate' and is_active;

skills (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  normalized_name text not null unique             -- lower(trim(name))
)

certificate_skills (
  certificate_id uuid references certificates on delete cascade,
  skill_id uuid references skills on delete cascade,
  primary key (certificate_id, skill_id)
)

generated_contents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  certificate_id uuid not null references certificates on delete cascade,
  content_type text not null check (content_type in ('linkedin_post','course_summary','skills_summary','resume_bullets')),
  language text not null default 'en',
  tone text,
  content text not null check (char_length(content) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (certificate_id, content_type, language)
)
```

补充要求：

- 新用户注册时，用 trigger 自动建立一行 `profiles`。
- 每张有 `updated_at` 的表都加 trigger 自动更新时间。
- `certificate_files.user_id` 必须等于所属证书的 `user_id`，`shares` 同理。用 trigger 或 RLS 的 `with check` 保证，防止有人把文件或分享挂到别人的证书上。

## 安全规则

原则只有一条：私人资料只靠 RLS 保护，公开资料只经过少数几个白名单函数出去，两条路不混用。

### RLS

- 七张表全部 `enable row level security`，**不给 `anon` 角色任何表的任何 policy**。
- `profiles`：只能 select 和 update 自己那一行（`id = auth.uid()`）。
- `certificates`、`certificate_files`、`shares`、`generated_contents`：select、insert、update、delete 都限定 `user_id = auth.uid()`，insert 和 update 的 `with check` 也一样。
- `certificate_skills`：通过 `exists` 检查对应的证书属于 `auth.uid()`。
- `skills`：已登录用户只能 select。写入只能经过 `security definer` 函数 `ensure_skills(names text[])`，函数负责 trim、转小写、去重，单次最多 30 个。
- 所有 `security definer` 函数都要 `set search_path = ''`，并在函数内使用完整的 schema 名称。

### Storage

- 只有一个私有 bucket `certificate-files`，不开 public。
- 路径固定为 `{user_id}/{certificate_id}/{随机 uuid}.{ext}`。
- `storage.objects` 的 policy：只有当 `(storage.foldername(name))[1] = auth.uid()::text` 时才能读、写、删。
- 删除证书时，服务器端先删除 storage 里的文件，再删数据库记录。下载原始文件时，服务器先确认证书属于当前用户，再产生 60 秒有效的 signed URL。

### 上传验证（服务器端）

- 确认用户已登录，而且证书属于他。
- 大小不超过 10 MB。
- 用文件开头的 magic bytes 判断类型，不相信扩展名和浏览器给的 MIME：PDF 是 `%PDF-`，PNG、JPEG、WebP 各按其签名。
- 图片在保存前去掉 EXIF 等 metadata（里面可能有拍摄地点），因为图片可能会被公开。

### 公开读取

- `get_public_portfolio(p_slug text)` 和 `get_public_certificate(p_slug text)`：`security definer`，回传 `jsonb`，只授权给 `anon` 和 `authenticated` 执行。
- 只在 share 存在、`is_active = true`、scope 正确时回传资料，否则回传 `null`。
- 用 `jsonb_build_object` 逐个列出「公开页可以显示什么」表里允许的字段，**禁止使用 `to_jsonb(row)` 或 `select *`**。
- 作品集排除 `hidden_from_portfolio = true` 的证书。
- 图片只回传 `public_key`，不回传 `storage_path`、证书 id 或 user id。`show_images = false` 时连 `public_key` 也不回传。
- `resolve_public_image(p_slug text, p_key text)` 回传 `storage_path`，**只授权给 `service_role`**，因为路径里含有 user id。
- 图片路由 `/p/[slug]/img/[key]` 和 `/b/[slug]/img/[key]` 在服务器端用 service role 调用上面的函数，确认有效后才从 storage 读取并串流回去。只串流图片类型，PDF 一律回 404。

### 撤销与失效

- 关闭链接 = `is_active = false` 并写入 `revoked_at`。重新开启会产生新的 slug，旧的永远失效。
- 无效、已撤销、不存在的 slug 一律显示同一个“此链接无效或已停用”页面，HTTP 404，不透露这个链接是否曾经存在。
- 公开页和图片路由不做服务器缓存（`dynamic = 'force-dynamic'`），撤销后下一次请求立即失效。Next 16 开启 Cache Components 后改用 `await connection()` 达到同样效果；无效链接由 proxy 先检查并回 404（页面开始串流后状态码就固定为 200）。
- 分享只能撤销、不能恢复：数据库 trigger 禁止把已撤销的 share 改回 active，也禁止修改 slug、拥有者和范围。
- 已知限制：LinkedIn 等平台自己缓存的链接预览，我们无法收回。在分享对话框里提醒用户这一点。

### 其他

- Slug 用服务器端的加密安全随机数产生，22 位 base62。
- 用户输入的内容一律当纯文本渲染，不使用 `dangerouslySetInnerHTML`。
- 证书链接只接受 `http` 和 `https`，打开时加 `rel="noopener noreferrer"`。
- AI 接口：确认证书属于当前用户，每个用户每小时有生成次数上限（M5 时加一张 `ai_requests` 记录表）。M5 实现：上限 10 次/小时，由数据库函数 `consume_ai_quota` 原子检查并记录；用户不能自行写入、删除或退还记录。只把证书字段送给 AI，不送姓名、邮箱、链接和 Credential ID。
- AI 供应商（2026-10-27 决定）：开发阶段用 Gemini 免费版（只用测试资料），正式上线前必须换成付费供应商（Gemini 付费版或 Claude）；正式环境默认拒绝使用 Gemini 免费版。

## 页面与路由

需要登录的页面只读写自己的资料；公开页面只经过公开读取函数，不使用用户 session。

| 路由 | 需要登录 | 用途 | 里程碑 |
| --- | --- | --- | --- |
| `/login`、`/signup`、`/reset-password` | 否 | 登录、注册、重设密码 | M1 |
| `/auth/callback` | 否 | 邮箱验证和重设密码的回调 | M1 |
| `/dashboard` | 是 | 证书数、技能数、最近新增、新增按钮，Badges 和 Skills 两个分页 | M1 空壳，M2 完成 |
| `/certificates` | 是 | 证书库：搜索、筛选、排序（放在 searchParams） | M2 |
| `/certificates/new` | 是 | 新增证书 | M2 |
| `/certificates/[id]` | 是 | Badge Details、分享对话框、AI 面板 | M3 |
| `/certificates/[id]/edit` | 是 | 编辑证书 | M2 |
| `/settings/sharing` | 是 | 展示名称、作品集开关、重新生成链接、预览 | M4 |
| `/api/files` | 是 | 上传文件，以及本人下载原始文件（route handler） | M2 |
| `/api/ai/generate` | 是 | 生成 AI 内容，串流回传 | M5 |
| `/p/[slug]` | 否 | 公开作品集，只读 | M4 |
| `/p/[slug]/skills` | 否 | 公开作品集的 Skills Wallet | M8 |
| `/u/[handle]`、`/u/[handle]/skills` | 否 | 自订网址的公开作品集（Badge / Skills Wallet） | M8 |
| `/u/[handle]/badges/[publicId]` | 否 | 自订网址下的单张证书详情 | M8 |
| `/u/[handle]/img/[key]`、`/u/[handle]/og` | 否 | 自订网址的证书图片和分享预览图 | M8 |
| `/p/[slug]/[publicId]` | 否 | 作品集中单张证书的公开详情页，只读 | M4 |
| `/b/[slug]` | 否 | 单张证书公开页，只读 | M4 |
| `/p/[slug]/img/[key]`、`/b/[slug]/img/[key]` | 否 | 公开图片串流 | M4 |

`/certificates/[id]` 这类私人路由，如果 id 不存在或不属于当前用户，一律回 404，不区分两种情况。

## 里程碑总览

先把账号和权限打牢，再做功能；每个里程碑结束时，测试必须全部通过才进入下一个。

1. **M1 地基：** 项目骨架、登录注册、所有数据表的 migration、RLS 和 storage policy、权限测试。
2. **M2 证书管理：** 新增、编辑、删除证书，上传和下载原始文件，证书库，Dashboard（含 Badges 和 Skills 分页）。
3. **M3 Badge Details：** 详情页和所有显示规则，描述的展开，Badge Status 标签，复制 Credential ID，打开官方链接。
4. **M4 分享：** 公开读取函数、作品集页、单张证书页、图片路由、开关和撤销、访客预览、OG 预览标签，分享到 LinkedIn、X、Facebook、Email。
5. **M5 AI 贴文：** 生成、编辑、重新生成、复制、保存 LinkedIn 贴文，资料不足时提示，次数上限。
6. **M6 打磨：** 加载、错误、空白状态，手机版，键盘操作和对比度，Playwright 端到端测试。
7. **M7 从文件自动填写（2026-10-27 新增）：** 新增或编辑证书时选了 PDF 或图片后，按 "Fill from file" 才把文件送给 AI（不自动送出），读出标题、发证机构、日期、Credential ID、证书链接、技能，填入表单（AI 有读到的字段会覆盖已填内容，读不到的字段保持原样），标示"Suggested by AI, please check"，由用户确认后才保存；`field_sources` 记为 AI 建议；与贴文共用每小时次数上限。只做文件和图片，不做 URL 抓取（SSRF 风险）。这一步不保存文件；图片送出前先去 EXIF。开发阶段（2026-10-28 用户决定）可用 Gemini 免费版，但只能用假证书或已公开的测试文件；上线前必须换成付费 AI 供应商（证书原件含全名等个人资料，不能送到会用于训练的免费版）。
8. **M8 自订网址（2026-10-28 新增，先于 M7 完成）：** 可选的 `/u/{handle}`（取代随机作品集链接，移除后产生新随机链接），Skills Wallet 独立网址，旧名称保留 90 天；规则见"公开作品集链接"。

## 上线前清单（2026-10-27 新增）

以下全部完成前不对外开放注册：

- [ ] 建立正式 Supabase 项目（与 `certnest-dev` 分开），套用全部 migration，确认 RLS 和 storage policy。
- [ ] AI 换成付费供应商（Gemini 付费版或 Claude），设定 `AI_PROVIDER` 和对应 key；正式环境不设 `AI_ALLOW_GEMINI_IN_PRODUCTION`，除非用的是付费 key。
- [ ] 接入自己的 SMTP（例如 Resend + 自己的域名，SPF/DKIM），调高 Supabase 寄信上限，自订英文邮件模板。
- [ ] 部署（例如 Vercel）：设定 `SITE_URL`、Supabase Auth 的 Site URL 和 Redirect URLs；所有密钥只放服务器环境变量。
- [ ] 确认 Confirm email 已开启。
- [ ] 在正式网址测一次 LinkedIn 分享预览和 Add to Profile。
- [ ] 跑完全部测试（unit、DB、app、E2E），并人工测注册、验证邮箱、重设密码。
- [ ] 隐私政策与服务条款页面（若对外开放）。

## M1 执行指令

M1 完成时，应用里只有登录和一个空的 Dashboard，但数据库、权限和测试已经完整；公开读取函数留到 M4。

### 技术栈

- Next.js（最新稳定版，App Router）、TypeScript strict 模式
- Tailwind CSS、shadcn/ui
- `@supabase/supabase-js`、`@supabase/ssr`、Supabase CLI（管理 migration 和连接线上项目，不需要 Docker）
- `zod` 做输入验证，`server-only` 保护服务器模块
- Vitest 做测试
- 之后才加：`sharp`（M2 处理图片）、AI SDK（M5 决定：`@google/genai`，上线前换付费供应商）、Playwright（M6）

### 步骤

1. 用 `create-next-app` 建立项目（TypeScript、Tailwind、App Router、`src/` 目录），初始化 shadcn/ui。
2. 使用我在 Supabase 线上建好的开发项目 `certnest-dev`（我会提供 project ref）。执行 `supabase init`、`supabase login`、`supabase link --project-ref <ref>`，migration 用 `supabase db push` 套用。建立 `.env.local.example`，列出 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`，确认 `.env*` 在 `.gitignore` 里；真正的密钥由我自己填进 `.env.local`。Supabase 内建邮件服务有寄送数量限制，手动测试注册时用我自己的邮箱。
3. 建立三个 Supabase client：`lib/supabase/server.ts`（带用户 session）、`lib/supabase/client.ts`（浏览器端）、`lib/supabase/admin.ts`（service role，第一行 `import 'server-only'`）。
4. 写 middleware：刷新 session，未登录访问受保护页面时转到 `/login`。
5. 做登录、注册、重设密码、登出和 `/auth/callback`。错误讯息不透露某个邮箱是否已注册。
6. 写 migration：enum、七张表、约束、`user_id` 索引、trigger（注册时建 profile、自动更新 `updated_at`、文件和分享的拥有者必须和证书一致）、全部 RLS policy、`ensure_skills` 函数、私有 bucket 和 storage policy。
7. `/dashboard` 显示展示名称和真实查询出来的证书数量（此时是 0）。
8. 写下面的测试，在开发项目上跑。测试用 admin API 建立带唯一邮箱的假用户（直接设为已验证，不寄信），跑完自动删除；测试脚本开头检查 project ref，不是开发项目就拒绝执行。
9. 写 README：如何安装、连接开发项目、套用 migration、跑测试。

### 必须通过的测试

测试时建立两个用户 A 和 B，再加上一个未登录的 anon client。

- B 查询 A 的证书得到 0 行；B 更新或删除 A 的证书影响 0 行。
- B 新增一张 `user_id` 等于 A 的证书，被拒绝。
- B 新增指向 A 证书的 `certificate_files` 或 `shares`，被拒绝。
- B 读不到 A 的 `profiles` 和 `generated_contents`。
- anon 对七张表的查询全部拿不到任何资料。
- B 和 anon 都无法读取、上传、删除 A 文件夹里的 storage 文件。
- 过期日早于颁发日、`has_date` 却没有日期、`credential_url` 是 `javascript:` 开头，全部被拒绝。
- 已登录用户不能直接 insert `skills`；`ensure_skills` 会正确 trim、转小写、去重。
- 未登录访问 `/dashboard` 会转到 `/login`。
- `next build` 之后，`.next/static` 里找不到 service role key 的值。

### 完成标准

- [ ] 可以注册、验证邮箱、登录、登出、重设密码
- [ ] 全部 migration 可以在空数据库上从头跑成功
- [ ] 上面所有测试通过
- [ ] 没有任何密钥出现在 client 代码或 git 记录里
- [ ] 提交总结：改了哪些文件、数据库改动、测试结果、发现的问题

## 开始前你需要准备

装好下面这些，再把这份文件交给 Claude Code，就可以开始 M1。

- [ ] Node.js LTS 版本
- [ ] Git，以及一个新的 GitHub repo
- [ ] Supabase 账号，并建好一个开发用的免费项目 certnest-dev（以后上线另建正式项目）
- [ ] Claude Code
- [ ] 把这份文件导出成 Markdown，放进项目的 `docs/PLAN.md`

第一次对 Claude Code 说的话可以直接用这段：

```text
请先完整阅读 docs/PLAN.md。这是一个从零开始的项目。
现在只做 M1。动手前，先列出你的执行步骤给我确认。
做完后跑完所有测试，给我总结，然后停下来等我审核，不要开始 M2。
```
