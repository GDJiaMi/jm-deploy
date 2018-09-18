/**
 * 部署程序
 */
import fs from 'fs';
import nodegit from 'nodegit';
import path from 'path';
import url from 'url';
import {
  getConfigFilePath,
  getPkg,
  getOrCreateWorkDir,
} from './utils';
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

/**
 * 获取git仓库描述符, 如果仓库不存在则clone下来
 */
function initialRepo(workdir: string, remote: string, basename: string) {
  const repoDir = path.join(workdir, basename);

  if (!fs.existsSync(repoDir)) {
    console.log('正在克隆仓库: ', remote);
    return nodegit.Clone.clone(remote, repoDir, {
      fetchOpts: {
        callbacks: {
          credentials: (url: string, username: string) => {
            return nodegit.Cred.sshKeyFromAgent(username);
          },
        },
      },
    });
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

async function updateBranch(git: nodegit.Repository, branch: string) {
  const ref = await getOrCreateBranch(git, branch);
  // checkout and update
  await git.checkoutBranch(ref);
  console.log('更新git版本库');
  await git.fetch('origin', {
    downloadTags: 1,
    callbacks: {
      credentials: (url: string, username: string) => {
        return nodegit.Cred.sshKeyFromAgent(username);
      },
    },
  });
}

async function updateContent(
  git: nodegit.Repository,
  repoDir: string,
  contentDir: string
) {}

export default async function deploy() {
  // TODO: validate config
  const conf = getConfig();
  const workdir = getOrCreateWorkDir();
  const pathname = url.parse(conf.remote).pathname || '/repo';
  const basename = path.basename(pathname, '.git');
  const repoDir = path.join(workdir, basename);
  const repo = await initialRepo(workdir, conf.remote, basename);
  await updateBranch(repo, conf.name);
}
