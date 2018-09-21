import inquirer from 'inquirer'
import fs from 'fs-extra'
import { getConfigFilePath } from './utils'
import { ConfigurableKeys } from './constants'

const defaultConf: Partial<ConfigurableKeys> = {
  dist: 'dist',
}

export default function init() {
  const configFilePath = getConfigFilePath()
  const conf: Partial<ConfigurableKeys> = {
    ...defaultConf,
  }

  if (fs.existsSync(configFilePath)) {
    const content = require(configFilePath)
    conf.remote = content.remote || conf.remote
    conf.dist = content.dist || conf.dist
    conf.group = content.group || conf.group
  }

  inquirer
    .prompt<ConfigurableKeys>([
      {
        type: 'input',
        name: 'remote',
        message: '远程Git仓库地址:',
        default: conf.remote || '',
        validate: (input: string) => {
          // check validate url
          if (input.trim() === '') {
            return 'require'
          }
          return true
        },
      },
      {
        type: 'input',
        name: 'dist',
        message: '部署的前端资源目录:',
        default: conf.dist,
      },
      {
        type: 'input',
        name: 'group',
        message: '应用分组(相同分组的应用，最新大版本会保持一致):',
        default: conf.group,
      },
    ])
    .then(ans => {
      conf.remote = ans.remote
      conf.dist = ans.dist
      conf.group = ans.group || undefined

      // save
      fs.writeFileSync(configFilePath, JSON.stringify(filterDefault(conf, defaultConf), undefined, '  '))
    })
}

function filterDefault(conf: { [key: string]: any }, defaultConf: { [key: string]: any }) {
  const res: typeof conf = {}
  for (const key in conf) {
    if (conf[key] == defaultConf[key]) {
      continue
    }

    res[key] = conf[key]
  }

  return res
}
