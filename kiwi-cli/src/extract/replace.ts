/**
 * @author doubledream
 * @desc 更新文件 - 负责替换代码中的中文文本为国际化变量，并更新语言文件
 */

import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as prettier from 'prettier';
import * as ts from 'typescript';
import { readFile, writeFile } from './file';
import { getLangData } from './getLangData';
import { getProjectConfig, getLangDir, successInfo, failInfo, highlightText } from '../utils';

const CONFIG = getProjectConfig();
const srcLangDir = getLangDir(CONFIG.srcLang);

// ==================== 工具函数 ====================

/**
 * 使用 Prettier 格式化文件内容
 * @param fileContent 文件内容
 * @returns 格式化后的内容
 */
function prettierFile(fileContent: string): string {
  try {
    // 使用 Prettier 格式化代码
    return prettier.format(fileContent, {
      parser: 'typescript',
      trailingComma: 'all',
      singleQuote: true
    });
  } catch (e) {
    // 格式化失败时输出错误信息
    failInfo(`代码格式化报错！${e.toString()}\n代码为：${fileContent}`);
    return fileContent;
  }
}

/**
 * 生成新的语言文件内容
 * @param key 键值
 * @param value 中文文本
 * @returns 格式化的文件内容
 */
function generateNewLangFile(key: string, value: string): string {
  // 以 key 作为路径生成对象
  const obj = _.set({}, key, value);
  // 返回格式化后的导出内容
  return prettierFile(`export default ${JSON.stringify(obj, null, 2)}`);
}

/**
 * 创建新的主语言文件内容
 * @param filename 文件名
 * @returns 文件内容
 */
function createNewMainLangFile(filename: string): string {
  // 创建主语言文件的内容，包含 import 和 export default
  return `import ${filename} from './${filename}';\n\nexport default Object.assign({}, {\n  ${filename},\n});`;
}

/**
 * 添加导入语句到主语言文件
 * @param content 文件内容
 * @param filename 要导入的文件名
 * @returns 更新后的内容
 */
function addImportStatement(content: string, filename: string): string {
  // 在第一个 import 后插入新的 import 语句
  return content.replace(/^(\s*import.*?;)$/m, `$1\nimport ${filename} from './${filename}';`);
}

/**
 * 添加导出语句到主语言文件
 * @param content 文件内容
 * @param filename 要导出的文件名
 * @returns 更新后的内容
 */
function addExportStatement(content: string, filename: string): string {
  // 处理 export default { ... }; 格式
  if (/(}\);)/.test(content)) {
    if (/\,\n(}\);)/.test(content)) {
      // 最后一行包含,号
      content = content.replace(/(}\);)/, `  ${filename},\n$1`);
    } else {
      // 最后一行不包含,号
      content = content.replace(/\n(}\);)/, `,\n  ${filename},\n$1`);
    }
  }

  // 兼容 export default { common }; 的写法
  if (/(};)/.test(content)) {
    if (/\,\n(};)/.test(content)) {
      // 最后一行包含,号
      content = content.replace(/(};)/, `  ${filename},\n$1`);
    } else {
      // 最后一行不包含,号
      content = content.replace(/\n(};)/, `,\n  ${filename},\n$1`);
    }
  }

  return content;
}

/**
 * 检查导入子句是否包含 I18N
 * @param importClause 导入子句
 * @returns 是否包含 I18N
 */
function checkImportClause(importClause: ts.ImportClause): boolean {
  // import I18N from 'src/utils/I18N';
  if (_.get(importClause, 'kind') === ts.SyntaxKind.ImportClause) {
    // 直接 import I18N from ...
    if (importClause.name) {
      return importClause.name.escapedText === 'I18N';
    } else {
      // import { I18N } 或 import * as I18N
      const namedBindings = importClause.namedBindings;
      return checkNamedBindings(namedBindings);
    }
  }
  return false;
}

/**
 * 检查命名绑定是否包含 I18N
 * @param namedBindings 命名绑定
 * @returns 是否包含 I18N
 */
function checkNamedBindings(namedBindings: ts.NamedImportBindings): boolean {
  // import { I18N } from 'src/utils/I18N';
  if (namedBindings.kind === ts.SyntaxKind.NamedImports) {
    // 遍历所有导入的元素，判断是否有 I18N
    return namedBindings.elements.some(
      element => element.kind === ts.SyntaxKind.ImportSpecifier && _.get(element, 'name.escapedText') === 'I18N'
    );
  }

  // import * as I18N from 'src/utils/I18N';
  if (namedBindings.kind === ts.SyntaxKind.NamespaceImport) {
    return _.get(namedBindings, 'name.escapedText') === 'I18N';
  }

  return false;
}

/**
 * 判断是否为脚本文件
 * @param filePath 文件路径
 * @returns 是否为脚本文件
 */
function isScriptFile(filePath: string): boolean {
  // 判断文件扩展名是否为脚本类型
  return (
    _.endsWith(filePath, '.ts') ||
    _.endsWith(filePath, '.tsx') ||
    _.endsWith(filePath, '.js') ||
    _.endsWith(filePath, '.jsx')
  );
}

/**
 * 判断是否为 Vue 文件
 * @param filePath 文件路径
 * @returns 是否为 Vue 文件
 */
function isVueFile(filePath: string): boolean {
  // 判断文件扩展名是否为 .vue
  return _.endsWith(filePath, '.vue');
}

/**
 * 检测是否在 Vue 插值表达式中
 * @param code 文件内容
 * @param start 开始位置
 * @returns 是否在插值表达式中
 */
function isInVueInterpolation(code: string, start: number): boolean {
  // 向前查找最近的 {{ 和 }}
  let pos = start - 1;
  let foundOpen = false;
  let foundClose = false;
  let openPos = -1;
  let closePos = -1;

  // 向前查找 {{ 和 }}
  while (pos >= 0) {
    if (pos > 0 && code[pos - 1] === '{' && code[pos] === '{') {
      foundOpen = true;
      openPos = pos - 1;
      break;
    }
    if (pos > 0 && code[pos - 1] === '}' && code[pos] === '}') {
      foundClose = true;
      closePos = pos - 1;
    }
    pos--;
  }

  // 如果找到了 {{，检查是否在插值表达式中
  if (foundOpen) {
    // 如果找到了 }}，检查 }} 是否在 {{ 之后
    if (foundClose && closePos > openPos) {
      // 当前位置应该在 {{ 和 }} 之间
      return start > openPos && start < closePos + 2;
    } else {
      // 只找到了 {{，没有找到对应的 }}，认为在插值表达式中
      return true;
    }
  }

  return false;
}

/**
 * 检测是否为模板字符串
 * @param code 文件内容
 * @param start 开始位置
 * @returns 是否为模板字符串
 */
function isTemplateString(code: string, start: number): boolean {
  // 检查当前位置前一个字符是否为反引号
  const last1Char = code.slice(start - 1, start);
  return last1Char === '`';
}

/**
 * 检测是否为属性赋值
 * @param code 文件内容
 * @param start 开始位置
 * @returns 是否为属性赋值
 */
function isPropertyAssignment(code: string, start: number): boolean {
  // 检查当前位置前一个字符是否为等号，判断是否为属性赋值
  const last2Char = code.slice(start - 1, start + 1).split('')[0];
  return last2Char === '=';
}

// ==================== 语言文件管理函数 ====================

/**
 * 更新现有的语言文件
 * @param targetFilename 目标文件路径
 * @param fullKey 完整的键值路径
 * @param text 中文文本
 * @param validateDuplicate 是否验证重复
 */
function updateExistingLangFile(
  targetFilename: string,
  fullKey: string,
  text: string,
  validateDuplicate: boolean
): void {
  // 清除 require 缓存，解决手动更新语言文件后再自动抽取，导致之前更新失效的问题
  const mainContent = getLangData(targetFilename);
  const obj = mainContent;

  // 检查文件内容是否为空
  if (Object.keys(obj).length === 0) {
    failInfo(`${targetFilename} 解析失败，该文件包含的文案无法自动补全`);
  }

  // 验证重复键值
  if (validateDuplicate && _.get(obj, fullKey) !== undefined) {
    failInfo(`${targetFilename} 中已存在 key 为 \`${fullKey}\` 的翻译，请重新命名变量`);
    throw new Error('duplicate');
  }

  // \n 会被自动转义成 \\n，这里转回来
  text = text.replace(/\\n/gm, '\n');
  // 设置新值并写回文件
  _.set(obj, fullKey, text);
  fs.writeFileSync(targetFilename, prettierFile(`export default ${JSON.stringify(obj, null, 2)}`));
}

/**
 * 将新创建的语言文件添加到主语言文件的导入中
 * @param newFilename 新文件名（不含扩展名）
 */
function addImportToMainLangFile(newFilename: string): void {
  const mainLangFilePath = `${srcLangDir}/index.${CONFIG.fileType}`;
  let mainContent = '';

  // 判断主语言文件是否存在，存在则更新，不存在则新建
  if (fs.existsSync(mainLangFilePath)) {
    // 更新现有的主语言文件
    mainContent = fs.readFileSync(mainLangFilePath, 'utf8');
    mainContent = addImportStatement(mainContent, newFilename);
    mainContent = addExportStatement(mainContent, newFilename);
  } else {
    // 创建新的主语言文件
    mainContent = createNewMainLangFile(newFilename);
  }
  fs.writeFileSync(mainLangFilePath, mainContent);
}

/**
 * 更新语言文件，将提取的中文文本写入对应的语言文件中
 * @param keyValue 国际化键值，格式如 'I18N.components.App.welcome'
 * @param text 中文文本内容
 * @param validateDuplicate 是否验证重复键值
 */
function updateLangFiles(keyValue: string, text: string, validateDuplicate: boolean): void {
  // 只处理以 I18N. 开头的键值
  if (!_.startsWith(keyValue, 'I18N.')) {
    return;
  }

  // 解析键值结构：I18N.filename.path.to.key
  const [, filename, ...restPath] = keyValue.split('.');
  const fullKey = restPath.join('.');
  const targetFilename = `${srcLangDir}/${filename}.${CONFIG.fileType}`;

  if (!fs.existsSync(targetFilename)) {
    // 文件不存在，创建新的语言文件
    fs.writeFileSync(targetFilename, generateNewLangFile(fullKey, text));
    addImportToMainLangFile(filename);
    successInfo(`成功新建语言文件 ${targetFilename}`);
  } else {
    // 文件存在，更新现有内容
    updateExistingLangFile(targetFilename, fullKey, text, validateDuplicate);
  }
}

// ==================== 导入检查函数 ====================

/**
 * 检查文件中是否已经导入了 I18N
 * @param filePath 文件路径
 * @returns 是否已导入 I18N
 */
function hasImportI18N(filePath: string): boolean {
  // 解析 AST，遍历 import 语句，判断是否已导入 I18N
  const code = readFile(filePath);
  const ast = ts.createSourceFile('', code, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TSX);
  let hasImportI18N = false;

  function visit(node: ts.Node) {
    // 遍历 AST 节点，查找 ImportDeclaration
    if (node.kind === ts.SyntaxKind.ImportDeclaration) {
      const importDeclaration = node as ts.ImportDeclaration;
      const importClause = importDeclaration.importClause;
      // 检查 importClause 是否包含 I18N
      hasImportI18N = checkImportClause(importClause) || hasImportI18N;
    }
  }

  ts.forEachChild(ast, visit);
  return hasImportI18N;
}

/**
 * 向脚本文件添加导入语句
 * @param code 文件内容
 * @param importStatement 导入语句
 * @returns 更新后的内容
 */
function addImportToScriptFile(code: string, importStatement: string): string {
  // 在脚本文件头部插入 import 语句
  const ast = ts.createSourceFile('', code, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TSX);
  const pos = ast.getStart(ast, false);
  return code.slice(0, pos) + importStatement + code.slice(pos);
}

/**
 * 向 Vue 文件添加导入语句
 * @param code 文件内容
 * @param importStatement 导入语句
 * @returns 更新后的内容
 */
function addImportToVueFile(code: string, importStatement: string): string {
  // 在 <script> 标签后插入 import 语句
  return code.replace(/<script>/g, `<script>\n${importStatement}`);
}

/**
 * 在合适的位置添加 import I18N 语句
 * @param filePath 文件路径
 * @returns 更新后的文件内容
 */
function createImportI18N(filePath: string): string {
  // 根据文件类型插入 import I18N 语句
  const code = readFile(filePath);
  const importStatement = `${CONFIG.importI18N}\n`;

  if (isScriptFile(filePath)) {
    return addImportToScriptFile(code, importStatement);
  } else if (isVueFile(filePath)) {
    return addImportToVueFile(code, importStatement);
  }

  return code;
}

// ==================== 替换逻辑函数 ====================

/**
 * 处理模板字符串中的变量插值
 * @param text 原始文本
 * @param val 键值
 * @returns 处理后的替换值和文本
 */
function handleTemplateString(text: string, val: string): { replaceVal: string; replaceText: string } {
  // 匹配模板字符串中的变量
  const varInStr = text.match(/(\$\{[^\}]+?\})/g);
  if (!varInStr) {
    // 没有变量，直接返回原始文本和 key
    return { replaceVal: val, replaceText: text };
  }
  // 生成变量映射，如 val1: count
  const kvPair = varInStr.map((str, index) => {
    return `val${index + 1}: ${str.replace(/^\${([^\}]+)\}$/, '$1')}`;
  });
  // 构造 I18N.template 调用
  const replaceVal = `I18N.template(${val}, { ${kvPair.join(',\n')} })`;
  let replaceText = text;
  // 替换模板字符串中的变量为 {valN}
  varInStr.forEach((str, index) => {
    replaceText = replaceText.replace(str, `{val${index + 1}}`);
  });
  return { replaceVal, replaceText };
}

/**
 * 生成最终的替换值
 * @param val 键值
 * @param isHtmlFile 是否为 HTML 文件
 * @param isVueFile 是否为 Vue 文件
 * @param isPropertyAssignment 是否为属性赋值
 * @param isTemplateString 是否为模板字符串
 * @param isInVueInterpolation 是否在 Vue 插值表达式中
 * @returns 替换值
 */
function generateReplaceValue(
  val: string,
  isHtmlFile: boolean,
  isVueFile: boolean,
  isPropertyAssignment: boolean,
  isTemplateString: boolean,
  isInVueInterpolation: boolean
): string {
  // 属性赋值场景，区分 html/vue/其他
  if (isPropertyAssignment) {
    if (isHtmlFile || isVueFile) {
      return `{{${val}}}`;
    } else {
      return `{${val}}`;
    }
  }
  // 模板字符串场景，直接返回 val，实际替换在 handleTemplateString 中完成
  if (isTemplateString) {
    return val; // 模板字符串的处理在 handleTemplateString 中完成
  }
  // Vue 插值表达式场景，保持原有结构
  if (isInVueInterpolation && isVueFile) {
    return val; // 在 Vue 插值表达式中，保持原有结构
  }
  // 其他场景，直接返回 key
  return val;
}

/**
 * 生成非字符串类型的替换内容
 * @param code 原始代码
 * @param start 开始位置
 * @param end 结束位置
 * @param val 键值
 * @param isHtmlFile 是否为 HTML 文件
 * @param isVueFile 是否为 Vue 文件
 * @returns 替换后的代码
 */
function generateNonStringReplacement(
  code: string,
  start: number,
  end: number,
  val: string,
  isHtmlFile: boolean,
  isVueFile: boolean
): string {
  // 非字符串类型，直接用 {{val}} 或 {val} 包裹
  if (isHtmlFile || isVueFile) {
    return `${code.slice(0, start)}{{${val}}}${code.slice(end)}`;
  } else {
    return `${code.slice(0, start)}{${val}}${code.slice(end)}`;
  }
}

/**
 * 写入更新后的文件
 * @param filePath 文件路径
 * @param newCode 新代码内容
 * @param val 键值
 * @param finalReplaceText 最终替换文本
 * @param validateDuplicate 是否验证重复
 * @param needWrite 是否需要写入语言文件
 * @returns Promise<void>
 */
async function writeUpdatedFile(
  filePath: string,
  newCode: string,
  val: string,
  finalReplaceText: string,
  validateDuplicate: boolean,
  needWrite: boolean
): Promise<void> {
  try {
    // 先更新语言文件
    if (needWrite) {
      // 更新语言文件
      updateLangFiles(val, finalReplaceText, validateDuplicate);
    }
    // 再写入代码文件
    writeFile(filePath, newCode);
    return Promise.resolve();
  } catch (e) {
    return Promise.reject(e.message);
  }
}

// ==================== 主入口函数 ====================

/**
 * 更新文件 - 替换代码中的中文文本为国际化变量，并更新语言文件
 * @param filePath 当前文件路径
 * @param arg 目标字符串对象，包含位置和内容信息
 * @param val 目标键值
 * @param validateDuplicate 是否校验文件中已经存在要写入的键值
 * @param needWrite 是否只需要替换不需要更新语言文件
 * @returns Promise<void>
 */
function replaceAndUpdate(
  filePath: string,
  arg: { text: string; range: { start: number; end: number }; isString: boolean },
  val: string,
  validateDuplicate: boolean,
  needWrite: boolean = true
): Promise<void> {
  // 读取原始代码内容
  const code = readFile(filePath);
  // 判断文件类型
  const isHtmlFile = _.endsWith(filePath, '.html');
  const isVueFile = _.endsWith(filePath, '.vue');
  // 最终要替换的文本，初始为原始中文
  let finalReplaceText = arg.text;
  // 获取替换区间
  const { start, end } = arg.range;

  // 处理字符串类型的替换（如 '中文'、`模板${变量}`、'你有' + count + '条'）
  if (arg.isString) {
    // 判断是否为属性赋值（=）、模板字符串（`）或 Vue 插值（{{}}）
    const isPropertyAssignmentFlag = isPropertyAssignment(code, start); // 属性赋值场景
    const isTemplateStringFlag = isTemplateString(code, start); // 模板字符串场景
    const isInVueInterpolationFlag = isInVueInterpolation(code, start); // Vue 插值场景

    // 生成最终的替换值（如 {{val}}、I18N.template(...)、{val}）
    let finalReplaceVal = generateReplaceValue(
      val,
      isHtmlFile,
      isVueFile,
      isPropertyAssignmentFlag,
      isTemplateStringFlag,
      isInVueInterpolationFlag
    );

    // 如果是模板字符串，需进一步处理变量映射和替换文本
    if (isTemplateStringFlag) {
      // 解析模板字符串中的变量，生成 I18N.template 调用和替换后的文本
      const templateResult = handleTemplateString(arg.text, val);
      finalReplaceVal = templateResult.replaceVal;
      finalReplaceText = templateResult.replaceText;
    }

    // --- 新增逻辑：在 Vue 文件的 {{ ... }} 插值表达式内，只替换内容 ---
    if (isVueFile && isInVueInterpolationFlag) {
      // 向前查找最近的 {{
      let openPos = code.lastIndexOf('{{', start);
      // 向后查找最近的 }}
      let closePos = code.indexOf('}}', end);
      if (openPos !== -1 && closePos !== -1 && start >= openPos && end <= closePos + 2) {
        // 只替换 {{ 和 }} 之间的内容
        const newCode = code.slice(0, openPos + 2) + finalReplaceVal + code.slice(closePos);
        return writeUpdatedFile(filePath, newCode, val, finalReplaceText, validateDuplicate, needWrite);
      }
      // 如果没找到，兜底用原逻辑
    }
    // --- 新增逻辑结束 ---

    // 拼接新代码（用国际化变量替换原始中文）
    const newCode = `${code.slice(0, start)}${finalReplaceVal}${code.slice(end)}`;
    // 写入新代码并更新语言文件
    return writeUpdatedFile(filePath, newCode, val, finalReplaceText, validateDuplicate, needWrite);
  } else {
    // 处理非字符串类型的替换（如纯文本、标签内容等）
    // 直接用 {{val}} 或 {val} 包裹
    const newCode = generateNonStringReplacement(code, start, end, val, isHtmlFile, isVueFile);
    // 写入新代码并更新语言文件
    return writeUpdatedFile(filePath, newCode, val, finalReplaceText, validateDuplicate, needWrite);
  }
}

export { replaceAndUpdate, hasImportI18N, createImportI18N };
