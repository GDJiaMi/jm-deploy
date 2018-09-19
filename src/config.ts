import fs from 'fs-extra'
import { getConfigFilePath, getPkg } from './utils'
import { Configuration, ConfigurableKeys } from './constants'

export default function getConfig(): Configuration {
  const pkg = getPkg()
  const configPath = getConfigFilePath()
  if (!fs.existsSync(configPath)) {
    console.error('Call `jm-deploy init` at Node project root before deploy.')
    process.exit(-1)
  }
  const conf = require(configPath) as ConfigurableKeys

  if (!fs.existsSync(conf.dist)) {
    console.error(`${conf.dist} is not found.`)
    process.exit(-1)
  }

  return {
    name: pkg.name,
    version: pkg.version,
    remote: conf.remote,
    dist: conf.dist,
  }
}
