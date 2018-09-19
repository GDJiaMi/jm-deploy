/**
 * git 相关的帮助方法
 */
import cp from 'child_process'
import url from 'url'
import path from 'path'
import fs from 'fs-extra'
import Log from './Log'

const StatusRegexp = /^([ADM? ])([ADM? ])\s(.+)$/
const LocalBranchRegexp = /^(\*?)\s+(\S*)$/

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

export default class GitUtils {
  public workDir: string
  public repoDir: string
  public remote: string
  public remoteName: string
  public basename: string
  public verbose: boolean = false
  public focusedBranch: string = 'master'
  public Logger = Log

  public static getLastCommitMessage(repoDir: string) {
    try {
      const title = cp.execSync(`git log -1 --pretty=format:"%s"`, { cwd: repoDir }).toString()
      const body = cp.execSync(`git log -1 --pretty=format:"%b"`, { cwd: repoDir }).toString()
      return {
        title,
        body,
      }
    } catch {
      return { title: '', body: '' }
    }
  }

  public constructor(workDir: string, repoDir: string, remote: string, remoteName: string = 'origin') {
    this.workDir = workDir
    this.repoDir = repoDir
    this.remote = remote
    this.remoteName = remoteName
    const pathname = url.parse(remote).pathname || '/repo'
    this.basename = path.basename(pathname, '.git')
  }

  /**
   * 初始化版本库
   */
  public initial() {
    if (!fs.existsSync(this.repoDir)) {
      // 仓库不存在
      const cmd = `git clone ${this.remote} ${this.basename}`
      this.Logger.log(cmd)
      cp.execSync(cmd, this.getExecOptions(true, this.workDir))
    } else {
      // 更新状态
      this.switchBranch('master')
      this.updateBranches()
    }
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

  public checkout(ref: string) {
    const cmd = `git checkout ${ref}`
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

  public push(force?: boolean) {
    const cmd = `git push -u --tags ${this.remoteName} ${this.focusedBranch} ${force ? '-f' : ''}`
    this.Logger.log(cmd)
    cp.execSync(cmd, this.getExecOptions(true))
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
    return {
      cwd,
      stdio: (quietable && !this.Logger.enabled && 'ignore') || undefined,
    }
  }
}
