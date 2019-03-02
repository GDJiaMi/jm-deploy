/**
 * 部署程序
 * TODO: config
 */
import inquirer from 'inquirer'
import path from 'path'
import url from 'url'
import Log from './Log'
import GitUtils, { createGitUtils } from './GitUtils'
import { getOrCreateWorkDir, getTempFileSync, clearAndCopy, parseVersion, Version } from './utils'
import getConfig from './config'

async function updateTags(repo: GitUtils, name: string, version: Version) {
  const { major, minor, patch } = version
  const tagName = `${name}/${major}.${minor}.${patch}`
  const tags = repo.getTagsAndSortByVersion(name)
  const latestTag = tags[0]

  repo.addOrReplaceTag(tagName)
}

export default async function deploy() {
  const cwd = process.cwd()
  const conf = getConfig()
  const workdir = getOrCreateWorkDir()
  const pathname = url.parse(conf.remote).pathname || '/repo'
  const basename = path.basename(pathname, '.git')
  const targetRepoDir = path.join(workdir, basename)
  const version = parseVersion(conf.version)

  if (version == null) {
    Log.error('版本号有误, 请遵循`{major}.{minor}.{patch}规范`:', version)
    process.exit(-1)
    return
  }

  // 克隆远程版本库
  const targetRepo = createGitUtils(targetRepoDir, conf.remote, 'origin')
  const localRepo = createGitUtils(cwd)
  const currentBranchName = localRepo.getCurrentBranch()
  Log.info('初始化项目...')
  // 更新分支
  targetRepo.initial()
  Log.info('初始化并更新分支...')
  targetRepo.initialBranch(currentBranchName)
  Log.info('资源复制...')
  clearAndCopy(conf.dist, path.join(targetRepoDir, conf.target))
  targetRepo.addAll()

  // 提交代码
  if (targetRepo.shouldCommit()) {
    const lastMessage = localRepo.getLastCommitMessage()
    const message = `${lastMessage.title}${!!lastMessage.body ? '\n' + lastMessage.body : ''}`
    Log.info('开始提交...')
    getTempFileSync(message, file => {
      targetRepo.commitByFile(file)
    })
    Log.info('更新tags...')
    await updateTags(targetRepo, conf.name, version)
    targetRepo.push(true)
    Log.tip('发布完成!')
  } else {
    Log.tip('暂无提交内容，退出')
  }
}
