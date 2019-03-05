import fs from 'fs-extra'
import os from 'os'
import glob from 'glob'
import tempfile from 'tempfile'
import Log from './Log'
import path from 'path'
import { CONFIG_FILE, WORK_DIR } from './constants'

// require fields in package.json
export interface Pkg {
  name: string
  version: string
}

export interface Version {
  major: string
  minor: string
  patch: string
}

/**
 * 获取当前项目的package.json 文件
 */
export function getPkg(): Pkg {
  const currentDir = process.cwd()
  const pkgPath = path.join(currentDir, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    Log.error('package.json not found')
    process.exit(-1)
  }
  return require(pkgPath)
}

export function getConfigFilePath() {
  const currentDir = process.cwd()
  const configFilePath = path.join(currentDir, CONFIG_FILE)
  return configFilePath
}

/**
 * 创建工作目录
 */
export function getOrCreateWorkDir() {
  const homeDir = os.homedir()
  const workdir = path.join(homeDir, WORK_DIR)
  if (!fs.existsSync(workdir)) {
    fs.mkdirSync(workdir)
  }

  return workdir
}

/**
 * 获取临时文件并自动删除
 */
export function getTempFileSync(content: string) {
  const tmpFile = tempfile()
  fs.outputFileSync(tmpFile, content)
  return tmpFile
}

export function clearDir(path: string) {
  const items = glob.sync('*', {
    cwd: path,
    dot: false,
    absolute: true,
  })
  items.forEach(item => fs.removeSync(item))
}

export function copyFiles(src: string, dest: string) {
  fs.copySync(src, dest)
}

/**
 * 清除并复制目录
 */
export function clearAndCopy(src: string, dest: string) {
  clearDir(dest)
  copyFiles(src, dest)
}

/**
 * 解析版本号
 */
export function parseVersion(version: string): Version | null {
  const macthed = version.match(/(\d+)\.(\d+)\.(\d+).*/)
  if (macthed == null) {
    return null
  }
  const [major, minor, patch] = macthed.slice(1)
  return { major, minor, patch }
}

/**
 * interpolate ${variable} in string
 */
export function interpolate(str: string, local: { [key: string]: string | undefined }) {
  if (str == null) {
    return ''
  }

  const matches = str.match(/\$([a-zA-Z0-9_]+)|\${([a-zA-Z0-9_]+)}/g) || []

  matches.forEach(function(match) {
    const key = match.replace(/\$|{|}/g, '')
    let variable = local[key] || ''
    // Resolve recursive interpolations
    variable = interpolate(variable, local)

    str = str.replace(match, variable)
  })

  return str
}
