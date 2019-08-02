import inquirer from 'inquirer'
import fs from 'fs-extra'
import { getConfigFilePath } from './utils'
import { ConfigurableKeys, defaultConf } from './constants'

export default function init() {
  const configFilePath = getConfigFilePath()
  const conf: Partial<ConfigurableKeys> = {
    ...defaultConf,
  }

  if (fs.existsSync(configFilePath)) {
    const content = require(configFilePath)
    conf.remote = content.remote || conf.remote
    conf.dist = content.dist || conf.dist
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
        name: 'target',
        message: '放置前端资源的目录',
        default: conf.target,
      },
    ])
    .then(ans => {
      conf.remote = ans.remote
      conf.dist = ans.dist
      conf.target = ans.target

      // save
      fs.writeFile(configFilePath, JSON.stringify(filterDefault(conf, defaultConf), undefined, '  '), err => {
        if (err != null) {
          console.error(err)
        }
      })
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
