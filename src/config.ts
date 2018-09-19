import fs from 'fs-extra'
import Log from './Log'
import { getConfigFilePath, getPkg } from './utils'
import { Configuration, ConfigurableKeys } from './constants'

export default function getConfig(): Configuration {
  const pkg = getPkg()
  const configPath = getConfigFilePath()
  if (!fs.existsSync(configPath)) {
    Log.error('Call `jm-deploy init` at Node project root before deploy.')
    process.exit(-1)
  }
  const conf = require(configPath) as ConfigurableKeys

  if (!fs.existsSync(conf.dist)) {
    Log.error(`${conf.dist} is not found.`)
    process.exit(-1)
  }

  return {
    name: pkg.name,
    version: pkg.version,
    remote: conf.remote,
    dist: conf.dist,
  }
}
