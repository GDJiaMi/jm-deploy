import fs from 'fs-extra'
import os from 'os'
import glob from 'glob'
import path from 'path'
import { CONFIG_FILE, WORK_DIR } from './constants'

// require fields in package.json
export interface Pkg {
  name: string
  version: string
}

/**
 * 获取当前项目的package.json 文件
 */
export function getPkg(): Pkg {
  const currentDir = process.cwd()
  const pkgPath = path.join(currentDir, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    console.error('package.json not found')
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
    fs.mkdirSync(path.join(workdir, 'tmp'))
  }

  return workdir
}

/**
 * 获取临时文件并自动删除
 */
export function getTemplateFileSync(content: string, wrapper: (filePath: string) => void) {
  const workdir = getOrCreateWorkDir()
  const tmpFile = path.join(workdir, 'tmp/template')
  try {
    fs.outputFileSync(tmpFile, content)
    wrapper(tmpFile)
  } finally {
    fs.removeSync(tmpFile)
  }
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