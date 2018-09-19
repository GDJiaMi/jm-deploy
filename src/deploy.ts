/**
 * 部署程序
 */
import fs from 'fs-extra'
import inquirer from 'inquirer'
import path from 'path'
import url from 'url'
import Log from './Log'
import GitUtils from './GitUtils'
import template from './template'
import { getOrCreateWorkDir, getTemplateFileSync, clearAndCopy } from './utils'
import getConfig from './config'

async function getCommitMessage(defaultMessage: string) {
  const ans = await inquirer.prompt<{ message: string }>([
    {
      type: 'editor',
      name: 'message',
      message: '输入提交信息: ',
      default: defaultMessage,
      validate: (v: string) => {
        if (v == null || v.trim() === '') {
          return '不能为空'
        }
        return true
      },
    },
  ])
  return ans.message
}

async function updateTags(repo: GitUtils, name: string, version: string) {
  const macthed = version.match(/(\d+)\.(\d+)\.(\d+).*/)
  if (macthed == null) {
    Log.error('版本号有误:', version)
    process.exit(-1)
    return
  }

  const [major, minor, fixed] = macthed.slice(1)
  const tags = repo.getTags()
  const tag = `${name}/${major}.${minor}.${fixed}`
  const wideTag = `${name}/${major}.${minor}.x`

  if (tags.indexOf(tag) !== -1) {
    // 冲突了
    const ans = await inquirer.prompt<{ ok: boolean }>({
      type: 'confirm',
      message: `版本: ${version} 已经存在, 是否覆盖?: `,
      name: 'ok',
    })

    if (!ans.ok) {
      process.exit(0)
    }
  }

  repo.addOrReplaceTag(tag)
  repo.addOrReplaceTag(wideTag)
}

export default async function deploy() {
  const cwd = process.cwd()
  const conf = getConfig()
  const workdir = getOrCreateWorkDir()
  const pathname = url.parse(conf.remote).pathname || '/repo'
  const basename = path.basename(pathname, '.git')
  const repoDir = path.join(workdir, basename)

  const repo = new GitUtils(workdir, repoDir, conf.remote, 'origin')
  Log.info("初始化项目...")
  repo.initial()
  Log.info("初始化并更新分支...")
  repo.initialBranch(conf.name)
  Log.info("资源复制...")
  clearAndCopy(conf.dist, repoDir)
  repo.addAll()

  if (repo.shouldCommit()) {
    const lastCommit = GitUtils.getLastCommitMessage(cwd)
    const message = await getCommitMessage(
      template({
        name: conf.name,
        version: conf.version,
        title: lastCommit.title,
        body: lastCommit.body,
      }),
    )

    Log.info("开始提交...")
    getTemplateFileSync(message, file => {
      repo.commitByFile(file)
    })
    Log.info("更新tags...")
    await updateTags(repo, conf.name, conf.version)
    repo.push(true)
    Log.tip('发布完成!')
  } else {
    Log.tip('暂无提交内容，退出')
  }
}
