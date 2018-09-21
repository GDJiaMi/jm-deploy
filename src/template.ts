/**
 * 提交信息模板
 */
export interface TemplateLocal {
  name: string
  version: string
  override: boolean
  title?: string
  body?: string
}

export default (local: TemplateLocal) => `${local.name} ${local.override ? '覆盖 ' : ''}${
  local.version
} ${local.title || '标题'}

${local.body || '主要描述'}

# 注意事项
无
`
