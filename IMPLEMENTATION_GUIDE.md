# 实现指南 - 角色库 + Remotion

## 🎯 已完成功能

### ✅ 任务 #1: 全局角色库基础
- [x] 数据类型定义 (`lib/types/character-library.ts`)
- [x] 本地存储管理器 (`lib/db/character-library-storage.ts`)
- [x] 角色库管理页面 (`app/characters/page.tsx`)
- [x] 首页增加「角色库」入口

**访问方式**: http://localhost:3000/characters

### ✅ 任务 #3: Remotion 基础架构
- [x] 安装依赖配置 (`package.json`)
- [x] Remotion 配置 (`remotion.config.ts`)
- [x] 视频组件结构 (`remotion/` 目录)
  - `Root.tsx` - 根组件
  - `StoryboardVideo.tsx` - 主视频合成
  - `SceneComponent.tsx` - 场景渲染
  - `TransitionComponent.tsx` - 转场效果
- [x] 本地渲染 API (`app/api/remotion/render/route.ts`)

---

## 🚀 立即开始

### 1. 安装依赖

```bash
npm install
```

这会安装：
- `remotion` - Remotion 核心库
- `@remotion/cli` - 命令行工具
- `@remotion/bundler` - 打包工具
- `@remotion/renderer` - 渲染引擎

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 测试角色库

1. 访问 http://localhost:3000
2. 点击右上角「角色库」按钮
3. 目前显示空状态（创建功能待完成）

### 4. 测试 Remotion 渲染（可选）

```bash
# 打开 Remotion Studio（可视化预览）
npm run remotion:studio

# 或直接渲染（需要先有项目数据）
npm run remotion:render
```

---

## 📋 待完成任务

### 🔨 任务 #2: 增强角色选择功能
**预计时间**: 20分钟

需要实现：
1. 创建角色创建/编辑对话框组件
2. 修改 `StoryPromptInput` 增加「从角色库选择」按钮
3. 创建角色选择器对话框
4. 实现「将临时角色加入库」功能

**文件清单**:
- `components/character-library/CharacterCreateDialog.tsx` (新建)
- `components/character-library/CharacterSelector.tsx` (新建)
- `components/storyboard/StoryPromptInput.tsx` (修改)

### 🎬 任务 #4: Remotion 合成优化
**预计时间**: 30分钟

需要改进：
1. 支持更多转场效果
2. 优化字幕显示样式
3. 添加背景音乐轨道（可选）
4. Ken Burns 效果参数调整

### 🎨 任务 #5: 导出页面双模式
**预计时间**: 30分钟

需要实现：
1. 在 `app/project/[projectId]/export/page.tsx` 增加渲染模式选择
2. 创建 Remotion 渲染按钮
3. 显示渲染进度
4. 保留原有 Blender 脚本导出功能

---

## 🔥 使用场景对比

### 场景 A：既有 IP 角色（推荐角色库）
```
工作流程：
1. 预先在角色库上传公司吉祥物多视角图
2. 创建新项目时从角色库选择角色
3. AI 自动引用角色生成剧本
4. 生成图片/视频时保持角色一致性
```

**适用**: 公司IP、长期使用的角色、多项目复用

### 场景 B：一次性角色（保留临时上传）
```
工作流程：
1. 创建项目
2. 在分镜脚本页面临时上传参考图
3. 生成完成后可选择「加入角色库」
```

**适用**: 单次项目、测试角色、不常用资源

---

## 🎯 Remotion vs Blender 选择建议

### 使用 Remotion（快速渲染）当：
- ✅ 需要快速出片（一键渲染）
- ✅ 转场简单（Cut/Dissolve/Fade）
- ✅ 不需要复杂特效
- ✅ 希望在代码中管理视频逻辑

### 使用 Blender（专业导出）当：
- ✅ 需要复杂特效（Compositor）
- ✅ 需要手动精修
- ✅ 需要高级调色
- ✅ 已有 Blender 工作流程

**建议**: 两者共存，给用户选择权！

---

## 💡 快速测试建议

### 测试角色库
```bash
# 1. 启动服务
npm run dev

# 2. 访问角色库页面
# http://localhost:3000/characters

# 3. 尝试创建第一个角色（待实现创建对话框）
```

### 测试 Remotion 渲染
```bash
# 1. 创建测试项目并生成分镜
# 2. 生成至少2个场景的图片或视频
# 3. 在导出页面调用 Remotion 渲染 API（待实现UI）

# 或使用 Remotion Studio 预览：
npm run remotion:studio
```

---

## 🐛 已知限制

1. **角色库创建对话框**: 目前是占位符，需要实现完整的多视角上传功能
2. **Remotion 渲染按钮**: Export 页面尚未集成，需要手动调用 API
3. **渲染进度显示**: 当前只在服务器日志，需要实现实时进度通知
4. **视频下载**: 渲染完成后需要从 `/renders/` 目录手动获取

---

## 📚 参考资料

- [Remotion 官方文档](https://www.remotion.dev/docs)
- [Remotion 本地渲染](https://www.remotion.dev/docs/renderer)
- [Fal AI 文档](https://fal.ai/docs)

---

## 🤝 下一步行动

**立即可做**:
1. 运行 `npm install` 安装新依赖
2. 测试角色库页面访问
3. 继续实现任务 #2（角色创建功能）

**并行开发**:
- 前端：完成角色创建对话框和选择器
- 后端：Remotion 渲染 API 已就绪
- 集成：Export 页面添加 Remotion 渲染按钮

需要我继续实现剩余任务吗？
