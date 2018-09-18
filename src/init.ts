import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { getConfigFilePath } from './utils';
import { ConfigurableKeys } from './constants';

export default function init() {
  const configFilePath = getConfigFilePath();
  const conf: ConfigurableKeys = {
    remote: '',
    dist: 'dist',
  };

  if (fs.existsSync(configFilePath)) {
    const content = require(configFilePath);
    conf.remote = content.remote || '';
    conf.dist = content.dist || 'dist';
  }

  inquirer
    .prompt<ConfigurableKeys>([
      {
        type: 'input',
        name: 'remote',
        message: 'Remote git repo url',
        default: conf.remote || '',
        validate: (input: string) => {
          // check validate url
          if (input.trim() === '') {
            return 'require';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'dist',
        message: 'Dist to deploy',
        default: conf.dist,
      },
    ])
    .then(ans => {
      conf.remote = ans.remote;
      conf.dist = ans.dist;

      // save
      fs.writeFileSync(configFilePath, JSON.stringify(conf, undefined, '  '));
    });
}
