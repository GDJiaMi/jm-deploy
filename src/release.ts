import cp from 'child_process'
import path from 'path'
import conventionalChangelog from 'conventional-changelog'
import inquirer, { ChoiceType } from 'inquirer'
import GitUtils, { createGitUtils, VersionDesc } from './GitUtils'
import { getPkg, getTempFileSync } from './utils'
import Log from './Log'
import { Readable } from 'stream'
import fs from 'fs'

const VERSION_REGEXP = /^\d+\.\d+\.\d+.*$/
const RELEASE_VERSION_REGEXP = /^\d+\.\d+(\.\d+)?.*$/
const RELEASE_BRANCH_REGEXP = /^release\/.+$/
const RELEASE_BRANCH_DETAIL_REGEXP = /^release\/(\d+)\.(\d+)(?:\.(\d))?.*$/
const CHANGELOG_FILE = 'CHANGELOG.md'

/**
 * 读取未提交的changelog
 */
async function getUnreleaseChangelog(newVersion: string) {
  const options = {
    preset: 'gzb',
    outputUnreleased: true,
  }

  const changelog = await new Promise<string>((res, rej) => {
    const changelogStream = conventionalChangelog(options, undefined, {}, undefined, undefined) as Readable
    const chunks: Buffer[] = []
    changelogStream
      .on('error', err => {
        rej(err)
      })
      .on('data', chunk => {
        chunks.push(chunk)
      })
      .on('end', () => {
        res(Buffer.concat(chunks).toString())
      })
  })

  return changelog.replace('Unreleased', newVersion)
}

/**
 * 提升npm版本
 */
function bumpNpmVersion(version: string) {
  const cmd = `npm version ${version} --git-tag-version=false --allow-same-version`
  Log.log(cmd)
  cp.execSync(cmd, { stdio: ['ignore', 'ignore', 'pipe'] })
}

/**
 * 更新changeLog
 */
function updateChangeLog(message: string) {
  const filePath = path.join(process.cwd(), CHANGELOG_FILE)
  return new Promise((res, rej) => {
    if (fs.existsSync(filePath)) {
      const tempFile = getTempFileSync(message)
      const tempFileStream = fs.createWriteStream(tempFile, {
        flags: 'a',
      })

      fs.createReadStream(filePath)
        .on('error', err => {
          rej(err)
        })
        .pipe(tempFileStream)
        .on('finish', () => {
          fs.createReadStream(tempFile)
            .pipe(fs.createWriteStream(filePath))
            .on('finish', res)
        })
    } else {
      try {
        fs.writeFileSync(filePath, message)
        res()
      } catch (err) {
        rej(err)
      }
    }
  })
}

function getReleaseBranches(repo: GitUtils) {
  const all = repo.getAllBranches()
  const release: Array<{
    name: string
    version: VersionDesc
  }> = []

  for (const branch of all) {
    const matched = branch.name.match(RELEASE_BRANCH_DETAIL_REGEXP)
    if (matched) {
      release.push({
        name: branch.name,
        version: {
          major: parseInt(matched[1], 10),
          minor: parseInt(matched[2], 10),
          patch: parseInt(matched[3] || '0', 10),
        },
      })
    }
  }

  return release.sort((a, b) => {
    return GitUtils.versionComparator(b.version, a.version)
  })
}

/**
 * 代码发布
 */

export default async function release() {
  const cwd = process.cwd()
  const localRepo = createGitUtils(cwd)
  const pkg = getPkg()
  let version = pkg.version

  // 需要指定新版本
  const needSpecifyVersion = localRepo.hasTag(`v${version}`)
  const currentBranch = localRepo.getCurrentBranch()
  localRepo.focusedBranch = currentBranch

  if (currentBranch.match(RELEASE_BRANCH_REGEXP)) {
    Log.error('请在非release分支执行该命令, 再合并到对应的release分支. 详见发布规范')
    process.exit(1)
  }

  // 获取新版本号
  if (needSpecifyVersion) {
    const ans = await inquirer.prompt<{ version: string }>([
      {
        type: 'input',
        name: 'version',
        message: '请指定版本号: ',
        validate: (input: string) => {
          if (input.match(VERSION_REGEXP) == null) {
            return '请输入规范版本号'
          }
          return true
        },
      },
    ])
    version = ans.version
  }

  // 获取未发布的特性
  const unreleaseMessage = await getUnreleaseChangelog(version)
  // 编辑提交信息
  const { message } = await inquirer.prompt<{ message: string }>([
    {
      type: 'editor',
      name: 'message',
      message: '编辑CHANGELOG: ',
      default: unreleaseMessage,
    },
  ])

  // 更新版本号
  Log.info(`更新package.json版本到 ${version}`)
  bumpNpmVersion(version)

  Log.info(`更新CHANGELOG.md`)
  await updateChangeLog(message)

  localRepo.addAll()

  const tempFile = getTempFileSync(`🎉 release: ${version}\n\n${message}`)
  localRepo.commitByFile(tempFile)

  // 提交后添加tag
  localRepo.addOrReplaceTag(`v${version}`)

  // 合并到发布分支
  const releaseBranches = getReleaseBranches(localRepo)
  let createReleaseBranch = false
  let selectedReleaseBranch: string

  if (releaseBranches.length) {
    const { release } = await inquirer.prompt<{ release: number }>([
      {
        type: 'list',
        name: 'release',
        message: '选择要合并到的发布分支: ',
        choices: releaseBranches
          .map<ChoiceType>((i, idx) => ({ name: i.name, value: idx }))
          .concat([{ name: '创建新发布分支', value: -1 }]),
        default: releaseBranches[0].name,
      },
    ])
    if (release !== -1) {
      selectedReleaseBranch = releaseBranches[release].name
    } else {
      createReleaseBranch = true
    }
  } else {
    createReleaseBranch = true
  }

  // 输入发布分支
  if (createReleaseBranch) {
    const { version } = await inquirer.prompt<{ version: string }>([
      {
        type: 'input',
        name: 'version',
        message: '输入发布分支版本号: ',
        validate: (input: string) => {
          if (input.match(RELEASE_VERSION_REGEXP) == null) {
            return '请输入规范版本号'
          } else if (releaseBranches.some(i => i.name === `release/${input}`)) {
            return '该分支已存在'
          }
          return true
        },
      },
    ])
    selectedReleaseBranch = `release/${version}`
  }

  // 创建发布分支并进行分支合并
  if (createReleaseBranch) {
    localRepo.createBranch(selectedReleaseBranch!, '', false)
  } else {
    localRepo.switchBranch(selectedReleaseBranch!, false)
    localRepo.merge(currentBranch)
  }

  // 确定是否提交
  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: 'confirm',
      name: 'confirm',
      default: 'true',
      message: '现在就提交?',
    },
  ])

  if (confirm) {
    localRepo.switchBranch(selectedReleaseBranch!, false)
    localRepo.push(false, selectedReleaseBranch!)

    localRepo.switchBranch(currentBranch, false)
    localRepo.push(false, currentBranch)
  }
  Log.log('发布成功')
}
