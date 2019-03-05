/**
 * 主程序
 */
import program from 'commander'
import Log from './Log'
const pkg = require('../package.json')

program.option('-v, --verbose')

program.version(pkg.version, '--version')

program.command('init').action(() => {
  // 初始化程序
  setImmediate(() => {
    require('./init').default()
  })
})

program.command('release').action(() => {
  setImmediate(() => {
    require('./release').default()
  })
})

program.command('deploy').action(() => {
  setImmediate(() => {
    require('./deploy').default()
  })
})

program.parse(process.argv)

if (program.verbose) {
  Log.enabled = true
}
