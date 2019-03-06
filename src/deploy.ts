/**
 * 部署程序
 */
import path from 'path'
import url from 'url'
import Log from './Log'
import GitUtils, { createGitUtils } from './GitUtils'
import { getOrCreateWorkDir, clearAndCopy, parseVersion, Version, getTempFileSync } from './utils'
import getConfig from './config'

export const VERSION_TAG_REGEXP = /^v\d+\.\d+\.\d+.*$/
export const FORMAL_RELEASE_TAG_REGEXP = /^v\d+\.\d+\.\d+.*@(.+)$/
export const RELEASE_BRANCH_REGEXP = /^release\/(.*)$/

enum DeployType {
  ByTag,
  ByBranch,
}

async function updateTags(repo: GitUtils, name: string, version: Version) {
  const { major, minor, patch } = version
  const tagName = `${name}/${major}.${minor}.${patch}`
  const tags = repo.getTagsAndSortByVersion(name)
  const latestTag = tags[0]

  repo.addOrReplaceTag(tagName)
}

/**
 * 检测是否需要进行部署
 */
function shouldDeploy(branch: string, tags?: string[]): [boolean, DeployType] {
  if (tags && tags.some(i => !!i.match(VERSION_TAG_REGEXP))) {
    return [true, DeployType.ByTag]
  }

  return [!!branch.match(RELEASE_BRANCH_REGEXP), DeployType.ByBranch]
}

/**
 * 获取推送的目标目录
 */
function getTargetBranch(type: DeployType, branch: string, tags?: string[]): string {
  if (type === DeployType.ByBranch) {
    Log.info(`检测到发布分支: ${branch}`)
    return branch
  }

  for (const tag of tags!) {
    const matched = tag!.match(FORMAL_RELEASE_TAG_REGEXP)

    if (matched) {
      Log.info(`检测到发布tag: ${tag}`)
      return `release/${matched[1]}`
    }
  }

  return 'master'
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
  const currentTag = localRepo.getCurrentTag()
  Log.info('初始化项目...')

  // 判断是否需要部署
  const [shouldContinue, deployType] = shouldDeploy(currentBranchName, currentTag)
  if (!shouldContinue) {
    Log.info(`非发布分支(${currentBranchName})且没有检测到release tag(${currentTag}), 跳过deploy`)
    return
  }

  const targetBranch = getTargetBranch(deployType, currentBranchName, currentTag)

  // 更新分支
  targetRepo.initial()
  Log.info(`初始化并更新分支-${targetBranch}...`)
  targetRepo.initialBranch(targetBranch)
  Log.info(`资源复制(to ${conf.target})...`)
  clearAndCopy(conf.dist, path.join(targetRepoDir, conf.target))
  targetRepo.addAll()

  // 提交代码
  if (targetRepo.shouldCommit()) {
    const lastMessage = localRepo.getLastCommitMessage()
    const message = `${lastMessage.title}${!!lastMessage.body ? '\n' + lastMessage.body : ''}`
    Log.info('开始提交...')
    const tempFile = getTempFileSync(message)
    targetRepo.commitByFile(tempFile)
    Log.info('更新tags...')
    await updateTags(targetRepo, conf.name, version)

    if (!targetRepo.isUserConfigured()) {
      targetRepo.configureUser(
        process.env.USER || 'jm-deploy',
        process.env.EMAIL || process.env.GITLAB_USER_EMAIL || 'jm-deploy@ci.com',
      )
    }

    targetRepo.push(true)
    Log.tip('发布完成!')
  } else {
    Log.tip('暂无提交内容，退出')
  }
}
