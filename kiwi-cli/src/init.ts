/**
 * @author linhuiw
 * @desc 初始化 kiwi 项目的文件以及配置
 */

import * as _ from 'lodash';
import * as path from 'path';
import * as fs from 'fs';
import { PROJECT_CONFIG, KIWI_CONFIG_FILE } from './const';

/**
 * 辅助：获取 package.json 中 vue 依赖的主版本号
 * @returns 'vue2' | 'vue3'
 */
function getVueMajorVersion(): 'vue2' | 'vue3' {
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const vueVersion = pkg.dependencies?.vue || pkg.devDependencies?.vue;
      if (vueVersion) {
        const match = vueVersion.match(/\d+/);
        if (match && match[0] === '2') return 'vue2';
        if (match && match[0] === '3') return 'vue3';
      }
    }
  } catch (e) {
    // ignore
  }
}

function creteConfigFile(existDir?: string, type?: string) {
  const configDir = path.resolve(process.cwd(), `./${KIWI_CONFIG_FILE}`);
  const vueVersion = getVueMajorVersion();
  const configObj: any = {
    ...PROJECT_CONFIG.defaultConfig,
    kiwiDir: existDir,
    fileType: type
  };
  if (vueVersion) {
    configObj.vueVersion = vueVersion;
  }
  const config = JSON.stringify(configObj, null, 2);
  if (existDir && fs.existsSync(existDir) && !fs.existsSync(configDir)) {
    fs.writeFile(configDir, config, err => {
      if (err) {
        console.log(err);
      }
    });
  } else if (!fs.existsSync(configDir)) {
    fs.writeFile(configDir, config, err => {
      if (err) {
        console.log(err);
      }
    });
  }
}

function createCnFile(type?: string) {
  const cnDir = `${PROJECT_CONFIG.dir}/zh-CN`;
  if (!fs.existsSync(cnDir)) {
    fs.mkdirSync(cnDir);
    fs.writeFile(`${cnDir}/index.${type}`, PROJECT_CONFIG.zhIndexFile, err => {
      if (err) {
        console.log(err);
      }
    });
    fs.writeFile(`${cnDir}/common.${type}`, PROJECT_CONFIG.zhTestFile, err => {
      if (err) {
        console.log(err);
      }
    });
  }
}

function initProject(existDir?: string, type?: string) {
  /** 初始化配置文件夹 */
  if (existDir) {
    if (!fs.existsSync(existDir)) {
      console.log('输入的目录不存在，已为你生成默认文件夹');
      fs.mkdirSync(PROJECT_CONFIG.dir);
    }
  } else if (!fs.existsSync(PROJECT_CONFIG.dir)) {
    fs.mkdirSync(PROJECT_CONFIG.dir);
  }
  const defaultFileType = type || PROJECT_CONFIG.defaultConfig.fileType;
  creteConfigFile(existDir, defaultFileType);
  if (!(existDir && fs.existsSync(existDir))) {
    createCnFile(defaultFileType);
  }
}

export { initProject };
