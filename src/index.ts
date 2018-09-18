/**
 * 主程序
 */
import program from 'commander';
import Log from './Log'
import init from './init'
import deploy from './deploy'
const pkg = require('../package.json');

program.option('-v, --verbose')

program.version(pkg.version, '--version');

program.command('init').action(() => {
  // 初始化程序
  setImmediate(() => {
    init()
  })
});

program.command('deploy').action(() => {
  setImmediate(() => {
    deploy()
  })
});

program.parse(process.argv);

if (program.verbose) {
  Log.enabled = true
}