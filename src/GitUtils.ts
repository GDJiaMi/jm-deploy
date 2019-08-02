/**
 * git 相关的帮助方法
 */
import cp from 'child_process'
import url from 'url'
import path from 'path'
import fs from 'fs-extra'
import Log from './Log'
import { IS_CI } from './constants'

const StatusRegexp = /^([ADM? ])([ADM? ])\s(.+)$/
const LocalBranchRegexp = /^(\*?)\s+(\S*)$/
const BranchRegexp = /^\s+remotes\/\S+\/(\S+)$|^\*?\s+(\S*)$/
const VersionTagRegexp = /^(.*)\/(\d+)\.(\d+)\.(\d+.*)$/

export interface BranchDesc {
  name: string
  remote: boolean
  current?: boolean
}

export interface StatusDesc {
  file: string
  stagedStatus: FileStatus
  unstagedStatus: FileStatus
}

export interface VersionDesc {
  major: number
  minor: number
  patch: number
}

export interface VersionTagDesc extends VersionDesc {
  raw: string
  name: string
}

export enum FileStatus {
  DELETED,
  MODIFIED,
  UNTRACKED,
  ADDED,
  NONE,
}

export const FileStatusMap: { [key: string]: FileStatus } = {
  D: FileStatus.DELETED,
  M: FileStatus.MODIFIED,
  '?': FileStatus.UNTRACKED,
  ' ': FileStatus.NONE,
  A: FileStatus.ADDED,
}

export function createGitUtils(repoDir: string, remote?: string, remoteName: string = 'origin'): GitUtils {
  if (remote) {
    const workDir = path.dirname(repoDir)
    const pathname = url.parse(remote).pathname || '/repo'
    const basename = path.basename(pathname, '.git')

    if (!fs.existsSync(repoDir)) {
      // 仓库不存在
      const cmd = `git clone ${remote} ${basename}`
      Log.log(IS_CI ? `git clone xxx ${basename}` : cmd)
      cp.execSync(cmd, {
        cwd: workDir,
        stdio: (!Log.enabled && 'ignore') || undefined,
      })
    } else {
      const repoDir = path.join(workDir, basename)
      // 仓库存在，需要重置remote
      try {
        let cmd = `git remote remove ${remoteName}`
        Log.log(cmd)
        cp.execSync(cmd, {
          cwd: repoDir,
          stdio: (!Log.enabled && 'ignore') || undefined,
        })

        cmd = `git remote add ${remoteName} ${remote} && git fetch`
        Log.log(IS_CI ? `git remote add ${remoteName} xxx` : cmd)
        cp.execSync(cmd, {
          cwd: repoDir,
          stdio: (!Log.enabled && 'ignore') || undefined,
        })
      } catch (err) {
        Log.log(`重置remote失败:`, err)
        process.exit(1)
      }
    }
  }

  return new GitUtils(repoDir, remoteName)
}

export default class GitUtils {
  public repoDir: string
  public remoteName: string
  public verbose: boolean = false
  public focusedBranch: string = 'master'
  public Logger = Log

  public static versionComparator(a: VersionDesc, b: VersionDesc) {
    if (a.major > b.major) {
      return 1
    } else if (a.major < b.major) {
      return -1
    } else {
      if (a.minor > b.minor) {
        return 1
      } else if (a.minor < b.minor) {
        return -1
      } else {
        return a.patch - b.patch
      }
    }
  }

  /**
   * tag 版本号比较
   */
  public static isNewerThan(a: VersionDesc, b: VersionDesc) {
    return this.versionComparator(a, b) === 1
  }

  public static isNewerOrEqualThan(a: VersionDesc, b: VersionDesc) {
    const res = this.versionComparator(a, b)
    return res === 1 || res === 0
  }

  public constructor(repoDir: string, remoteName: string = 'origin') {
    this.repoDir = repoDir
    this.remoteName = remoteName
  }

  /**
   * 初始化版本库
   */
  public initial() {
    this.resetStage()
    // 更新状态
    this.switchBranch('master')
    this.updateBranches()
  }

  /**
   * 初始化分支
   */
  public initialBranch(branchName: string = 'master') {
    if (!this.hasLocalBranch(branchName)) {
      if (!this.hasRemoteBranch(branchName)) {
        this.Logger.info('分支不存在，正在创建...')
        // 本地和远程都不存在, 创建分支
        const masterCommit = this.getMasterCommit()
        this.createBranch(branchName, masterCommit)
      }
    }

    // created
    this.switchBranch(branchName)
    this.focusedBranch = branchName
    this.updateBranch(branchName)
  }

  public updateBranches() {
    const cmd = `git pull --tags --ff -f --all`
    this.Logger.log(cmd)
    cp.execSync(cmd, this.getExecOptions(true))
  }

  /**
   * 更新远程状态
   */
  public updateBranch(branch: string = 'master') {
    const cmd = `git pull -t --ff ${this.remoteName} ${branch}`
    this.Logger.log(cmd)
    cp.execSync(cmd, this.getExecOptions(true))
  }

  public createBranch(name: string, commit: string, setUpStream: boolean = true) {
    const cmd = `git checkout -b ${name} ${commit}`
    this.Logger.log(cmd)
    cp.execSync(cmd, this.getExecOptions(true))

    if (setUpStream) {
      const cmd = `git push -u ${this.remoteName} ${name}`
      this.Logger.log(cmd)
      cp.execSync(cmd, this.getExecOptions(true))
    }
  }

  public switchBranch(name: string, setUpStream: boolean = true) {
    this.checkout(name)
    if (setUpStream) {
      const cmd = `git branch --set-upstream-to=${this.remoteName}/${name} ${name}`
      this.Logger.log(cmd)
      cp.execSync(cmd, this.getExecOptions(true))
    }
  }

  /**
   * 还原工作区
   */
  public resetStage() {
    let cmd = `git clean -f`
    this.Logger.log('清空untracked文件', cmd)
    cp.execSync(cmd, this.getExecOptions(true))

    cmd = `git reset --hard`
    this.Logger.log('清空staged文件', cmd)
    cp.execSync(cmd, this.getExecOptions(true))
  }

  public checkout(ref: string) {
    const cmd = `git checkout ${ref}`
    this.Logger.log(cmd)
    cp.execSync(cmd, this.getExecOptions(true))
  }

  /**
   * 分支合并
   * @param ref 分支或提交
   */
  public merge(ref: string) {
    const cmd = `git merge ${ref}`
    this.Logger.log(cmd)
    cp.execSync(cmd, this.getExecOptions(true))
  }

  public mergeNoFF(ref: string, messageFile?: string) {
    const cmd = `git merge --no-ff --file ${messageFile} ${ref}`
    this.Logger.log(cmd)
    cp.execSync(cmd, this.getExecOptions(true))
  }

  public addAll() {
    const cmd = `git add .`
    this.Logger.log(cmd)
    cp.execSync(cmd, this.getExecOptions(true))
  }

  /**
   * 获取master分支的commit sha
   */
  public getMasterCommit() {
    const cmd = `git rev-parse master`
    this.Logger.log(cmd)
    return cp.execSync(cmd, this.getExecOptions()).toString()
  }

  public getBranchCommit(branch: string) {
    const cmd = `git rev-parse ${branch}`
    this.Logger.log(cmd)
    return cp.execSync(cmd, this.getExecOptions()).toString()
  }

  public getLastCommitMessage() {
    try {
      const title = cp.execSync(`git log -1 --pretty=format:"%s"`, this.getExecOptions()).toString()
      const body = cp.execSync(`git log -1 --pretty=format:"%b"`, this.getExecOptions()).toString()
      return {
        title,
        body,
      }
    } catch {
      return { title: '', body: '' }
    }
  }

  public getLastCommitMessageTitles(n: number) {
    const title = cp.execSync(`git log -n ${n} --pretty=format:"%s"`, this.getExecOptions()).toString() || ''
    return title.split('\n').filter(i => !!i)
  }

  public hasRemoteBranch(branch: string) {
    const branches = this.getRemoteBranches()
    return branches.findIndex(i => i.name === branch) !== -1
  }

  public hasLocalBranch(branch: string) {
    const branches = this.getLocalBranches()
    return branches.findIndex(i => i.name === branch) !== -1
  }

  /**
   * 获取所有分支，需要在调用前pull一下
   */
  public getAllBranches() {
    return this.getLocalBranches().concat(this.getRemoteBranches())
  }

  /**
   * 获取当前分支名称
   */
  public getCurrentBranch() {
    const branch = this.getLocalBranches().find(i => !!i.current)!

    if (branch == null) {
      // 当前可能处理checkout在某个提交
      const branches = this.getBranchMatchCommit('HEAD')
      return branches[0]
    }

    return branch.name
  }

  /**
   * 获取最新提交的tag
   */
  public getCurrentTag(): string[] | undefined {
    return this.getTagMatchCommit('HEAD')
  }

  public getLocalBranches() {
    const cmd = `git branch`
    this.Logger.log(cmd)
    const res = cp.execSync(cmd, this.getExecOptions()).toString()
    return res
      .split('\n')
      .map(i => {
        if (i === '') {
          return null
        }
        const matched = i.match(LocalBranchRegexp)
        if (matched == null) {
          return matched
        }

        const [current, name] = matched.slice(1)
        return {
          name: name,
          remote: false,
          current: current === '*',
        }
      })
      .filter(i => !!i) as BranchDesc[]
  }

  /**
   * 获取匹配指定提交的分支
   */
  public getBranchMatchCommit(commit: string) {
    const cmd = `git branch -a --contains ${commit}`
    this.Logger.log(cmd)
    const res = cp.execSync(cmd, this.getExecOptions(true)).toString()
    const branches: { [branch: string]: boolean } = {}
    res.split('\n').forEach(i => {
      if (i === '') {
        return null
      }
      const matched = i.match(BranchRegexp)
      if (matched == null) {
        return matched
      }
      const [remoteName, localName] = matched.slice(1)
      branches[(remoteName || localName) as string] = true
    })

    return Object.keys(branches)
  }

  /**
   * 获取匹配指定提交的tag
   */
  public getTagMatchCommit(commit: string) {
    try {
      const cmd = `git tag --points-at ${commit}`
      this.Logger.log(cmd)
      const res = cp
        .execSync(cmd, this.getExecOptions(true))
        .toString()
        .trim()

      // 可能存在多个tag
      return res === '' ? undefined : res.split('\n')
    } catch {
      return undefined
    }
  }

  public getRemoteBranches() {
    const cmd = `git branch -r`
    this.Logger.log(cmd)
    const res = cp.execSync(cmd, this.getExecOptions()).toString()

    const matchRegexp = new RegExp(`^\\s+${this.remoteName}/(\\S*)$`)

    return res
      .split('\n')
      .map(i => {
        if (i === '') {
          return null
        }

        const matched = i.match(matchRegexp)
        if (matched == null) {
          return matched
        }

        const [name] = matched.slice(1)
        return {
          name: name,
          remote: true,
          current: false,
        }
      })
      .filter(i => !!i) as BranchDesc[]
  }

  public commit(message: string) {
    const cmd = `git commit -n -m "${message}"`
    this.Logger.log(cmd)
    cp.execSync(cmd, this.getExecOptions(true))
  }

  public commitByFile(file?: string) {
    const cmd = `git commit -n ${file ? `-F ${file}` : ''}`
    this.Logger.log(cmd)
    cp.execSync(cmd, this.getExecOptions(true))
  }

  public shouldCommit() {
    return this.status().length !== 0
  }

  public status(): StatusDesc[] {
    const cmd = `git status -s`
    this.Logger.log(cmd)
    const res = cp.execSync(cmd, this.getExecOptions()).toString()
    return res
      .split('\n')
      .filter(i => !!i)
      .map(str => {
        const matched = str.match(StatusRegexp)
        if (!matched) {
          return null
        }
        const [stagedStatus, unstagedStatus, file] = matched.slice(1)
        return {
          file,
          stagedStatus: this.mapStatusDesc(stagedStatus),
          unstagedStatus: this.mapStatusDesc(unstagedStatus),
        } as StatusDesc
      })
      .filter(i => !!i) as StatusDesc[]
  }

  public push(force: boolean = false, branch: string = this.focusedBranch) {
    const cmd = `git push -u --tags ${this.remoteName} ${branch} ${force ? '-f' : ''}`
    this.Logger.log(cmd)
    cp.execSync(cmd, this.getExecOptions(true))
  }

  /**
   * 配置用户信息
   */
  public configureUser(name: string, email: string) {
    const cmd = `git config --local user.name "${name}" && git config --local user.email ${email}`
    this.Logger.log(cmd)
    cp.execSync(cmd, this.getExecOptions(true))
  }

  /**
   * 判断用户是否已经配置
   */
  public isUserConfigured() {
    const cmd = `git config --local --get user.name`
    this.Logger.log(cmd)
    try {
      const res = cp.execSync(cmd, this.getExecOptions(true)).toString()
      return res.trim() !== ''
    } catch (err) {
      return false
    }
  }

  public getTags(): string[] {
    const cmd = `git tag --list`
    this.Logger.log(cmd)
    return cp
      .execSync(cmd, this.getExecOptions())
      .toString()
      .split('\n')
      .filter(i => !!i)
  }

  public hasTag(tag: string): boolean {
    const tags = this.getTags()
    return tags.indexOf(tag) !== -1
  }

  public getTagsStartWith(path: string) {
    return this.getTags().filter(t => t.startsWith(path))
  }

  public getTagsAndSortByVersion(path: string): VersionTagDesc[] {
    return (this.getTagsStartWith(path)
      .map(tag => this.getVersionOnTag(tag))
      .filter(v => !!v) as VersionTagDesc[]).sort((a, b) => GitUtils.versionComparator(b, a))
  }

  public getVersionOnTag(tag: string) {
    const matched = tag.match(VersionTagRegexp)
    if (matched) {
      const [name, major, minor, patch] = matched.slice(1)
      return {
        raw: tag,
        name,
        major: parseInt(major, 10),
        minor: parseInt(minor, 10),
        patch: parseInt(patch, 10),
      }
    }
    return null
  }

  /**
   * 删除tag
   */
  public removeTag(name: string, remote: boolean = false) {
    const cmd = !remote ? `git tag --delete ${name}` : `git push ${this.remoteName} --delete tag ${name}`
    this.Logger.log(cmd)
    cp.execSync(cmd, this.getExecOptions(true))
  }

  /**
   * 添加tag
   */
  public addTag(name: string, message?: string) {
    const cmd = message == null ? `git tag ${name}` : `git tag -a ${name} -m "${message}"`
    this.Logger.log(cmd)
    cp.execSync(cmd, this.getExecOptions(true))
  }

  /**
   * 添加tag，如果已存在则替换它
   */
  public addOrReplaceTag(name: string, message?: string) {
    const cmd = message == null ? `git tag ${name} -f` : `git tag -a ${name} -m "${message}" -f`
    this.Logger.log(cmd)
    cp.execSync(cmd, this.getExecOptions(true))
  }

  private mapStatusDesc(desc: string): FileStatus {
    return FileStatusMap[desc]
  }

  private getFiles(src: string) {
    const files = fs.readdirSync(src)
    return files.map(name => {
      const absolutePath = path.join(src, name)
      const content = fs.readFileSync(absolutePath).toString()
      return {
        absolutePath,
        content,
        name,
      }
    })
  }

  private getExecOptions(quietable: boolean = false, cwd: string = this.repoDir): cp.ExecSyncOptions {
    const stdout = (quietable && !this.Logger.enabled && 'ignore') || undefined
    return {
      cwd,
      stdio: ['pipe', stdout, 'pipe'],
    }
  }
}
