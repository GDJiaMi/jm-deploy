export interface ConfigurableKeys {
  // 远程库
  remote: string
  dist: string
  target: string
}

export interface Configuration extends ConfigurableKeys {
  name: string
  version: string
}

export const CONFIG_FILE = 'jm-deploy.json'
export const WORK_DIR = '.jm-deploy'
export const IS_CI = process.env.CI === 'true'

export const defaultConf: Partial<ConfigurableKeys> = {
  dist: 'dist',
  target: '/',
}
