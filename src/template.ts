/**
 * 提交信息模板
 */
export interface TemplateLocal {
  name: string
  version: string
  title?: string
  body?: string
}

export default (local: TemplateLocal) => `${local.name} ${local.version} ${local.title || '标题'}

${local.body || '主要描述'}

# 新增功能
无

# Bug修复
无

# 注意事项
无
`
