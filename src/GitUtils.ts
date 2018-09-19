/**
 * git 相关的帮助方法
 */
import cp from 'child_process'
import url from 'url'
import path from 'path'
import fs from 'fs-extra'
import Log from './Log'

const StatusRegexp = /^([ADM? ])([ADM? ])\s(.+)$/

export interface BranchDesc {
  name: string
  ref: string
  remote: boolean
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
      cp.execSync(cmd, { cwd: this.workDir })
    } else {
      // 更新状态
      this.updateBranch()
    }
  }

  /**
   * 初始化分支
   */
  public initialBranch(branchName: string = 'master') {
    const locals = this.getLocalBranches()
    if (locals.findIndex(i => i.name === branchName) === -1) {
      const remotes = this.getRemoteBranches()
      if (remotes.findIndex(i => i.name === branchName) === -1) {
        // 本地和远程都不存在, 创建分支
        const masterCommit = this.getMasterCommit()
        this.createBranch(branchName, masterCommit)
      }
    }

    // created
    this.checkout(branchName)
    this.focusedBranch = branchName
  }

  /**
   * 更新远程状态
   */
  public updateBranch() {
    const cmd = `git pull -t --ff ${this.remoteName} master`
    this.Logger.log(cmd)
    cp.execSync(cmd, { cwd: this.repoDir })
  }

  public createBranch(name: string, commit: string) {
    const cmd = `git checkout -b ${name} ${commit}`
    this.Logger.log(cmd)
    cp.execSync(cmd, { cwd: this.repoDir })
  }

  public checkout(ref: string) {
    const cmd = `git checkout ${ref}`
    this.Logger.log(cmd)
    cp.execSync(cmd, { cwd: this.repoDir })
  }

  /**
   * 获取master分支的commit sha
   */
  public getMasterCommit() {
    const cmd = `git rev-parse master`
    this.Logger.log(cmd)
    return cp.execSync(cmd, { cwd: this.repoDir }).toString()
  }

  public getBranchCommit(branch: string) {
    const cmd = `git rev-parse ${branch}`
    this.Logger.log(cmd)
    return cp.execSync(cmd, { cwd: this.repoDir }).toString()
  }

  /**
   * 获取所有分支，需要在调用前pull一下
   */
  public getAllBranches() {
    return this.getLocalBranches().concat(this.getRemoteBranches())
  }

  public getLocalBranches() {
    const refDir = path.join(this.repoDir, '.git/refs/heads')
    return this.getFiles(refDir).map(item => ({
      name: item.name,
      ref: item.content,
      remote: false,
    }))
  }

  public getRemoteBranches() {
    const refDir = path.join(this.repoDir, `.git/refs/remotes/${this.remoteName}`)

    return this.getFiles(refDir)
      .filter(item => {
        return ['HEAD'].indexOf(item.name) === -1
      })
      .map(item => ({
        name: item.name,
        ref: item.content,
        remote: true,
      }))
  }

  public commit(message: string) {
    const cmd = `git commit -n -m "${message}"`
    this.Logger.log(cmd)
    cp.execSync(cmd, { cwd: this.repoDir })
  }

  public shouldCommit() {
    return this.status().length !== 0
  }

  public status(): StatusDesc[] {
    const cmd = `git status -s`
    this.Logger.log(cmd)
    const res = cp.execSync(cmd, { cwd: this.repoDir }).toString()
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
    const cmd = `git push --tags ${this.remoteName} ${this.focusedBranch} ${force ? '-f' : ''}`
    this.Logger.log(cmd)
    cp.execSync(cmd, { cwd: this.repoDir })
  }

  public getTags(): string[] {
    const cmd = `git tag --list`
    this.Logger.log(cmd)
    return cp
      .execSync(cmd, { cwd: this.repoDir })
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
    cp.execSync(cmd, { cwd: this.repoDir })
  }

  /**
   * 添加tag
   */
  public addTag(name: string, message?: string) {
    const cmd = message == null ? `git tag ${name}` : `git tag -a ${name} -m "${message}"`
    this.Logger.log(cmd)
    cp.execSync(cmd, { cwd: this.repoDir })
  }

  /**
   * 添加tag，如果已存在则替换它
   */
  public addOrReplaceTag(name: string, message?: string) {
    const cmd = message == null ? `git tag ${name} -f` : `git tag -a ${name} -m "${message}" -f`
    this.Logger.log(cmd)
    cp.execSync(cmd, { cwd: this.repoDir })
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
}
