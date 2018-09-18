/**
 * 部署程序
 */
import fs from 'fs-extra';
import glob from 'glob';
import inquirer from 'inquirer';
import childProcess from 'child_process';
import path from 'path';
import url from 'url';
import GitUtils from './GitUtils'
import { getConfigFilePath, getPkg, getOrCreateWorkDir } from './utils';
import { Configuration, ConfigurableKeys } from './constants';

function getConfig(): Configuration {
  const pkg = getPkg();
  const configPath = getConfigFilePath();
  if (!fs.existsSync(configPath)) {
    console.error('Call `jm-deploy init` at Node project root before deploy.');
    process.exit(-1);
  }
  const conf = require(configPath) as ConfigurableKeys;

  if (!fs.existsSync(conf.dist)) {
    console.error(`${conf.dist} is not found.`);
    process.exit(-1);
  }

  return {
    name: pkg.name,
    version: pkg.version,
    remote: conf.remote,
    dist: conf.dist,
  };
}

function clearDir(path: string) {
  const items = glob.sync('*', {
    cwd: path,
    dot: false,
    absolute: true,
  });
  items.forEach(item => fs.removeSync(item));
}

function copyFiles(src: string, dest: string) {
  fs.copySync(src, dest);
}

function updateContent(
  repoDir: string,
  contentDir: string
) {
  clearDir(repoDir);
  copyFiles(contentDir, repoDir);
  childProcess.execSync('git add .', { cwd: repoDir });
}

async function commit(repoDir: string) {
  const ans = await inquirer.prompt<{ message: string }>([
    {
      type: 'editor',
      name: 'message',
      validate: (v: string) => {
        if (v == null || v.trim() === '') {
          return '不能为空';
        }
        return true;
      },
    },
  ]);
  childProcess.execSync(`git commit -a -n -m '${ans.message}'`, { cwd: repoDir });
}

async function updateTags(
  repoDir: string,
  name: string,
  version: string
) {
  const macthed = version.match(/(\d+)\.(\d+)\.(\d+).*/);
  if (macthed == null) {
    console.error('版本号有误:', version);
    process.exit(-1);
    return;
  }

  const [major, minor, fixed] = macthed.slice(1);
  const tags = childProcess
    .execSync(`git tag -l`, { cwd: repoDir })
    .toString()
    .split('\n')
    .filter(i => i != '');
  const tag = `${name}/${major}.${minor}.${fixed}`;
  const wideTag = `${name}/${major}.${minor}.x`;

  console.log('更新tags');

  if (tags.indexOf(tag) !== -1) {
    // 冲突了
    const ans = await inquirer.prompt<{ ok: boolean }>({
      type: 'confirm',
      message: `版本: ${version} 已经存在, 是否覆盖?`,
      name: 'ok',
    });

    if (ans.ok) {
      childProcess.execSync(`git tag -d ${tag}`, { cwd: repoDir });
      childProcess.execSync(`git tag -a ${tag} -m ${tag}`, { cwd: repoDir });
      childProcess.execSync(`git push origin --delete tag ${tag}`, {
        cwd: repoDir,
      });
    } else {
      process.exit(0);
    }
  } else {
    childProcess.execSync(`git tag -a ${tag} -m ${tag}`, { cwd: repoDir });
  }

  // 添加通用tags
  if (tags.indexOf(wideTag) !== -1) {
    childProcess.execSync(`git tag -d ${wideTag}`, { cwd: repoDir });
    childProcess.execSync(`git tag -a ${wideTag} -m ${wideTag}`, {
      cwd: repoDir,
    });
    childProcess.execSync(`git push origin --delete tag ${wideTag}`, {
      cwd: repoDir,
    });
  } else {
    childProcess.execSync(`git tag -a ${wideTag} -m ${wideTag}`, {
      cwd: repoDir,
    });
  }
}

export default async function deploy() {
  // TODO: validate config
  // TODO: 检查是否有内容变动
  // TODO: 提供commit模板
  const conf = getConfig();
  const workdir = getOrCreateWorkDir();
  const pathname = url.parse(conf.remote).pathname || '/repo';
  const basename = path.basename(pathname, '.git');
  const repoDir = path.join(workdir, basename);

  const repo = new GitUtils(workdir, repoDir, conf.remote, 'origin')
  repo.initial()
  repo.initialBranch(conf.name)
  updateContent(repoDir, conf.dist);
  await commit(repoDir);
  await updateTags(repoDir, conf.name, conf.version);
  repo.push()
  console.log('发布完成!')
}
