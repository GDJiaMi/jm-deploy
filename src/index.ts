/**
 * 主程序
 */
import program from 'commander';
import init from './init'
import deploy from './deploy'
const pkg = require('../package.json');

program.version(pkg.version, '-v --version');

program.command('init').action(() => {
  // 初始化程序
  init()
});

program.command('deploy').action(() => {
  deploy()
});

program.parse(process.argv);
