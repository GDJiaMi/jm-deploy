import fs from 'fs';
import os from 'os';
import path from 'path';
import { CONFIG_FILE, WORK_DIR } from './constants';

// require fields in package.json
export interface Pkg {
  name: string;
  version: string;
}

/**
 * 获取当前项目的package.json 文件
 */
export function getPkg(): Pkg {
  const currentDir = process.cwd();
  const pkgPath = path.join(currentDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error('package.json not found');
    process.exit(-1);
  }
  return require(pkgPath);
}

export function getConfigFilePath() {
  const currentDir = process.cwd();
  const configFilePath = path.join(currentDir, CONFIG_FILE);
  return configFilePath;
}

/**
 * 创建工作目录
 */
export function getOrCreateWorkDir() {
  const homeDir = os.homedir();
  const workdir = path.join(homeDir, WORK_DIR);
  if (!fs.existsSync(workdir)) {
    fs.mkdirSync(workdir);
  }

  return workdir;
}