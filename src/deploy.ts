/**
 * 部署程序
 */
import inquirer from 'inquirer'
import path from 'path'
import url from 'url'
import Log from './Log'
import GitUtils, { createGitUtils } from './GitUtils'
import template from './template'
import { getOrCreateWorkDir, getTempFileSync, clearAndCopy, parseVersion, Version } from './utils'
import getConfig from './config'
import { Configuration } from './constants'

async function generateCommitMessage(repo: GitUtils, conf: Configuration, override: boolean) {
  const lastNCommit = repo.getLastCommitMessageTitles(10)
  if (lastNCommit.length < 2) {
    return template({
      override,
      name: conf.name,
      version: conf.version,
      title: lastNCommit[0],
    })
  } else {
    const ans = await inquirer.prompt<{ commits: string[] }>([
      { type: 'checkbox', name: 'commits', message: '选择需要提交的信息: ', choices: lastNCommit },
    ])
    return template({
      override,
      name: conf.name,
      version: conf.version,
      title: lastNCommit[0],
      body: ans.commits.map(m => `* ${m}`).join('\n'),
    })
  }
}

async function editCommitMessage(defaultMessage: string) {
  const ans = await inquirer.prompt<{ message: string }>([
    {
      type: 'editor',
      name: 'message',
      message: '确认提交信息: ',
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

async function checkVersionConflit(repo: GitUtils, name: string, version: Version) {
  const { major, minor, patch } = version
  const tagName = `${name}/${major}.${minor}.${patch}`
  if (repo.hasTag(tagName)) {
    // 冲突了
    const ans = await inquirer.prompt<{ ok: boolean }>({
      type: 'confirm',
      message: `版本: ${tagName} 已经存在, 是否覆盖? 注意避免覆盖, 尽量和后端应用的大版本保持一致: `,
      name: 'ok',
    })

    if (!ans.ok) {
      process.exit(0)
    }

    return true
  }
  return false
}

async function updateTags(repo: GitUtils, name: string, version: Version, group?: string) {
  const { major, minor, patch } = version
  const tagName = `${name}/${major}.${minor}.${patch}`
  const wideTagName = `${name}/${major}.${minor}.x`
  const latestTagName = `${name}/latest`
  const tags = repo.getTagsAndSortByVersion(name)
  const latestTag = tags[0]

  // 不存在最新tag
  // 或者覆盖模式，最新tag等于当前tag
  // 或者当前tag新于最新tag
  if (
    latestTag == null ||
    latestTag.raw === tagName ||
    repo.isNewerOrEqualThan(repo.getVersionOnTag(tagName)!, latestTag)
  ) {
    // 更新最新标志
    Log.info(`更新${latestTagName}...`)
    repo.addOrReplaceTag(latestTagName)
  }

  repo.addOrReplaceTag(tagName)
  repo.addOrReplaceTag(wideTagName)
}

export default async function deploy() {
  const cwd = process.cwd()
  const conf = getConfig()
  const workdir = getOrCreateWorkDir()
  const pathname = url.parse(conf.remote).pathname || '/repo'
  const basename = path.basename(pathname, '.git')
  const repoDir = path.join(workdir, basename)
  const version = parseVersion(conf.version)

  if (version == null) {
    Log.error('版本号有误, 请遵循`{major}.{minor}.{patch}规范`:', version)
    process.exit(-1)
    return
  }

  const repo = createGitUtils(repoDir, conf.remote, 'origin')
  const localRepo = createGitUtils(cwd)
  Log.info('初始化项目...')
  repo.initial()
  Log.info('初始化并更新分支...')
  repo.initialBranch(conf.name)
  Log.info('检查版本冲突...')
  const override = await checkVersionConflit(repo, conf.name, version)
  Log.info('资源复制...')
  clearAndCopy(conf.dist, repoDir)
  repo.addAll()

  if (repo.shouldCommit()) {
    const defaultMessage = await generateCommitMessage(localRepo, conf, override)
    const message = await editCommitMessage(defaultMessage)
    Log.info('开始提交...')
    getTempFileSync(message, file => {
      repo.commitByFile(file)
    })
    Log.info('更新tags...')
    await updateTags(repo, conf.name, version, conf.group)
    repo.push(true)
    Log.tip('发布完成!')
  } else {
    Log.tip('暂无提交内容，退出')
  }
}
