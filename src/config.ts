import fs from 'fs-extra'
import Log from './Log'
import { getConfigFilePath, getPkg, interpolate } from './utils'
import { Configuration, ConfigurableKeys, defaultConf } from './constants'

function preprocessRemoteUrl(url: string) {
  return interpolate(url, process.env)
}

/**
 * 获取配置文件
 */
export default function getConfig(): Configuration {
  const pkg = getPkg()
  const configPath = getConfigFilePath()
  if (!fs.existsSync(configPath)) {
    Log.error('Call `jm-deploy init` at Node project root before deploy.')
    process.exit(-1)
  }

  let conf = require(configPath) as ConfigurableKeys
  conf = {
    ...defaultConf,
    ...conf,
  }

  if (!fs.existsSync(conf.dist)) {
    Log.error(`目录 ${conf.dist} 不存在`)
    process.exit(-1)
  }

  return {
    name: pkg.name,
    version: pkg.version,
    remote: preprocessRemoteUrl(conf.remote),
    dist: conf.dist,
    target: conf.target,
  }
}
