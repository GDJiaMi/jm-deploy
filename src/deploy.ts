/**
 * 部署程序
 */
import fs from 'fs-extra';
import glob from 'glob';
import inquirer from 'inquirer';
import nodegit, { Branch } from 'nodegit';
import childProcess from 'child_process';
import path from 'path';
import url from 'url';
import { getConfigFilePath, getPkg, getOrCreateWorkDir } from './utils';
import { Configuration, ConfigurableKeys } from './constants';
import { match } from '../node_modules/@types/minimatch';

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

/**
 * 获取git仓库描述符, 如果仓库不存在则clone下来
 */
function initialRepo(workdir: string, remote: string, basename: string) {
  const repoDir = path.join(workdir, basename);

  if (!fs.existsSync(repoDir)) {
    console.log('正在克隆仓库: ', remote);
    childProcess.execSync(`git clone ${remote} ${basename}`, { cwd: workdir });
  }

  return nodegit.Repository.open(repoDir);
}

/**
 * 更新分支
 */
async function getOrCreateBranch(git: nodegit.Repository, branch: string) {
  try {
    const ref = await nodegit.Branch.lookup(
      git,
      branch,
      nodegit.Branch.BRANCH.ALL
    );
    return ref;
  } catch (err) {
    // 没有找到
    const commit = await git.getMasterCommit();
    return await git.createBranch(branch, commit, false);
  }
}

async function updateBranch(
  git: nodegit.Repository,
  branch: string,
  repoDir: string
) {
  const ref = await getOrCreateBranch(git, branch);
  // checkout and update
  await git.checkoutBranch(ref);
  console.log('更新git版本库');
  try {
    childProcess.execSync(`git pull origin ${branch} -t --ff`, {
      cwd: repoDir,
    });
  } catch {
    // ignore
    // TODO: 不存在
  }
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

async function updateContent(
  git: nodegit.Repository,
  repoDir: string,
  contentDir: string
) {
  clearDir(repoDir);
  copyFiles(contentDir, repoDir);
  childProcess.execSync('git add .', { cwd: repoDir });
}

async function commit(git: nodegit.Repository, repoDir: string) {
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
  childProcess.execSync(`git commit -a -n -m ${ans.message}`, { cwd: repoDir });
}

async function updateTags(
  git: nodegit.Repository,
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

async function upload(
  repo: nodegit.Repository,
  repoDir: string,
  branch: string
) {
  console.log('正在上传...');
  childProcess.execSync(`git push -u origin ${branch}`, {
    cwd: repoDir,
  });
  childProcess.execSync(`git push --tags`, { cwd: repoDir });
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
  const repo = await initialRepo(workdir, conf.remote, basename);
  await updateBranch(repo, conf.name, repoDir);
  await updateContent(repo, repoDir, conf.dist);
  await commit(repo, repoDir);
  await updateTags(repo, repoDir, conf.name, conf.version);
  await upload(repo, repoDir, conf.name);
  console.log('发布完成!')
}
