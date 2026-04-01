# Mission Control 更新日志

## v1.0.6 (2026-04-01)

### 🐛 问题修复
- 修复员工模块名称显示为ID的问题（员工名称中文名优先从硬编码映射获取）
- 修复员工头像emoji字段写入openclaw.json报错问题（emoji改存到IDENTITY.md）
- 修复记忆模块只读取main和worker的问题（现在动态读取所有agent的workspace）

### ✨ 功能优化
- **员工模块优化**：
  - 新增员工名称修改功能（同步到openclaw.json的agent.name）
  - 新增员工头像修改功能（保存到IDENTITY.md）
  - 新增编辑名称/头像的弹窗界面
- **技能模块优化**：
  - 搜索安装界面支持选择目标Agent（下拉多选）
  - 新增ClawHub API Token配置功能（解决搜索限流）
  - 配置后右上角显示「已配置」状态
- **记忆模块优化**：
  - 动态读取所有agent工作区的memory目录和MEMORY.md

### 🗑️ 删除功能
- 移除龙虾办公室模块及设置开关
- 删除龙虾办公室文件夹

### 🎨 界面优化
- 技能搜索结果安装按钮改为下拉选择目标Agent
- 版本号更新为v1.0.6

---

## v1.0.5 (2026-04-01)

### 🐛 问题修复
- 修复龙虾办公室无法隐藏的问题（settings API 的 MySQL 语法与 SQLite 不兼容）

### ✨ 功能优化
- **数据库改造**：从 MySQL 迁移到 SQLite（better-sqlite3），零依赖、开源友好
  - 自动初始化数据库和默认管理员账号（admin/admin123）
  - 数据库文件存储在 `data/mission-control.db`，自动创建 `data/` 目录
- **技能模块全面优化**：
  - 新增「搜索安装」功能，对接 ClawHub.ai 技能市场
  - 已安装技能按 Agent 分组展示，清晰显示每个技能属于哪个 Agent
  - 技能名称中文映射（如 `paddleocr-doc-parsing` → `文档图片OCR解析`）
  - 点击技能卡片弹出详情弹窗，显示完整描述
  - 新增「复制技能」功能：可将技能一键复制到其他指定 Agent
  - 新增「删除技能」功能：可从指定 Agent 删除技能

### 🎨 界面优化
- 日志记录按倒序排列，最新记录显示在最前面
- 技能详情弹窗新增目标 Agent 选择器，支持多选复制
- 版本号更新为 v1.0.5

---

## v1.0.4 (2026-03-31)

### 🙏 致谢
本项目内嵌了 [Star-Office-UI](https://github.com/ringhyacinth/Star-Office-UI) 项目，采用像素风格可视化 AI 助手工作状态。
- 项目作者: [Ring Hyacinth](https://x.com/ring_hyacinth) 与 [Simon Lee](https://x.com/simonxxoo)
- 代码许可证: MIT License
- 美术资产: 仅供非商业学习使用

感谢 Star-Office-UI 项目的开源贡献！

### 🐛 问题修复

### 🐛 问题修复
- 修复实时会话项目分类保存问题
- 修复实时会话刷新功能
- 修复全局搜索功能
- 修复新建员工名称显示为ID的问题
- 修复数据库INSERT语句缺少agent_id字段的问题

### ✨ 功能优化
- 优化员工人格编辑功能（AGENTS.md、SOUL.md、USER.md改为结构化表单）
- 添加中文填写示例
- 新增日志模块，对接OpenClaw日志
- 支持按级别、分类、关键词筛选日志
- 员工/渠道变更自动重启OpenClaw Gateway
- 实时会话支持按项目分类筛选和搜索

### 🎨 界面优化
- 登录后页面图标改为小龙虾样式
- 关于页面版本号更新为v1.0.4

---

## v1.0.3 (2026-03-30)

### 初始版本
- 任务看板模块
- 员工管理模块
- 渠道配置模块
- 实时会话模块
- 定时任务模块
- 系统设置模块
