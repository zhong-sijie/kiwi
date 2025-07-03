/**
 * @author doubledream
 * @desc 利用 Ast 查找对应文件中的中文文案
 */
import * as ts from 'typescript';
import * as compiler from '@angular/compiler';
import * as compilerVue from 'vue-template-compiler';
import * as compilerVue3 from '@vue/compiler-sfc';
import * as babel from '@babel/core';
import * as babelParser from '@babel/parser';
import * as babelTraverse from '@babel/traverse';
import * as babelTypes from '@babel/types';
/** unicode cjk 中日韩文 范围 */
const DOUBLE_BYTE_REGEX = /[\u4E00-\u9FFF]/g;

/**
 * 根据语言类型分发到 TS/JS 的中文提取
 * @param code 代码内容
 * @param filename 文件名
 * @param lang 语言类型
 */
function transerI18n(code, filename, lang) {
  return lang === 'ts' ? typescriptI18n(code) : javascriptI18n(code, filename);
}

/**
 * 提取 JS 文件中的中文字符串
 * @param code 代码内容
 * @param filename 文件名
 */
function javascriptI18n(code, filename) {
  let arr = [];
  let visitor = {
    StringLiteral(path) {
      if (path.node.value.match(DOUBLE_BYTE_REGEX)) {
        arr.push(path.node.value);
      }
    }
  };
  let arrayPlugin = { visitor };
  babel.transformSync(code.toString(), {
    filename,
    plugins: [arrayPlugin]
  });
  return arr;
}

/**
 * 提取 TS 文件中的中文字符串
 * @param code 代码内容
 * @param fileName 文件名
 */
function typescriptI18n(code) {
  let arr = [];
  const ast = ts.createSourceFile('', code, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS);
  function visit(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.StringLiteral: {
        /** 判断 Ts 中的字符串含有中文 */
        const { text } = node as ts.StringLiteral;
        if (text.match(DOUBLE_BYTE_REGEX)) {
          arr.push(text);
        }
        break;
      }
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(ast, visit);
  return arr;
}

/**
 * 去掉文件中的注释
 * @param code 代码内容
 * @param fileName 文件名
 */
function removeFileComment(code, fileName) {
  const printer = ts.createPrinter({ removeComments: true });
  const sourceFile = ts.createSourceFile(
    '',
    code,
    ts.ScriptTarget.ES2015,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  return printer.printFile(sourceFile);
}

/**
 * 辅助：判断字符串是否包含中文
 */
function hasChinese(str: string): boolean {
  return !!str && !!str.match(DOUBLE_BYTE_REGEX);
}

/**
 * 辅助：生成字符串区间对象
 */
function makeRange(start: number, end: number) {
  return { start, end };
}

/**
 * 优化后的 TS/TSX 文件中文查找
 */
function findTextInTs(code: string, fileName: string) {
  const matches = [];
  const ast = ts.createSourceFile('', code, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TSX);

  function handleStringLiteral(node: ts.StringLiteral) {
    if (hasChinese(node.text)) {
      matches.push({
        range: makeRange(node.getStart(), node.getEnd()),
        text: node.text,
        isString: true
      });
    }
  }

  function handleJsxElement(node: ts.JsxElement) {
    node.children.forEach(child => {
      if (child.kind === ts.SyntaxKind.JsxText) {
        const text = child.getText();
        const noCommentText = removeFileComment(text, fileName);
        if (hasChinese(noCommentText)) {
          matches.push({
            range: makeRange(child.getStart(), child.getEnd()),
            text: text.trim(),
            isString: false
          });
        }
      }
    });
  }

  function handleTemplateExpression(node: ts.TemplateExpression) {
    const { pos, end } = node;
    const templateContent = code.slice(pos, end);
    if (hasChinese(templateContent)) {
      matches.push({
        range: makeRange(node.getStart(), node.getEnd()),
        text: code.slice(node.getStart() + 1, node.getEnd() - 1),
        isString: true
      });
    }
  }

  function handleNoSubstitutionTemplateLiteral(node: ts.NoSubstitutionTemplateLiteral) {
    const { pos, end } = node;
    const templateContent = code.slice(pos, end);
    if (hasChinese(templateContent)) {
      matches.push({
        range: makeRange(node.getStart(), node.getEnd()),
        text: code.slice(node.getStart() + 1, node.getEnd() - 1),
        isString: true
      });
    }
  }

  function visit(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.StringLiteral:
        handleStringLiteral(node as ts.StringLiteral);
        break;
      case ts.SyntaxKind.JsxElement:
        handleJsxElement(node as ts.JsxElement);
        break;
      case ts.SyntaxKind.TemplateExpression:
        handleTemplateExpression(node as ts.TemplateExpression);
        break;
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
        handleNoSubstitutionTemplateLiteral(node as ts.NoSubstitutionTemplateLiteral);
        break;
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(ast, visit);
  return matches;
}

/**
 * 优化后的 JS/JSX 文件中文查找
 */
function findTextInJs(code: string) {
  const matches = [];
  const ast = babelParser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'decorators-legacy']
  });

  function handleStringLiteral(node: babelTypes.StringLiteral) {
    if (hasChinese(node.value)) {
      matches.push({
        range: makeRange(node.start, node.end),
        text: node.value,
        isString: true
      });
    }
  }

  function handleTemplateLiteral(node: babelTypes.TemplateLiteral) {
    const templateContent = code.slice(node.start, node.end);
    if (hasChinese(templateContent)) {
      matches.push({
        range: makeRange(node.start, node.end),
        text: code.slice(node.start + 1, node.end - 1),
        isString: true
      });
    }
  }

  function handleJSXElement(node: babelTypes.JSXElement) {
    node.children.forEach(child => {
      if (babelTypes.isJSXText(child) && hasChinese(child.value)) {
        matches.push({
          range: makeRange(child.start, child.end),
          text: child.value.trim(),
          isString: false
        });
      }
    });
  }

  babelTraverse.default(ast, {
    StringLiteral({ node }) {
      handleStringLiteral(node);
    },
    TemplateLiteral({ node }) {
      handleTemplateLiteral(node);
    },
    JSXElement({ node }) {
      handleJSXElement(node);
    }
  });
  return matches;
}

/**
 * 优化后的 HTML 文件中文查找
 */
function findTextInHtml(code) {
  const matches = [];
  const ast = compiler.parseTemplate(code, 'ast.html', {
    preserveWhitespaces: false
  });

  function handleStringValue(node, value, startOffset, endOffset) {
    let isString = false;
    const nodeValue = code.slice(startOffset, endOffset);
    if (nodeValue.charAt(0) === '"' || nodeValue.charAt(0) === "'") {
      isString = true;
    }
    matches.push({
      range: makeRange(startOffset, endOffset),
      text: value,
      isString
    });
  }

  function handleObjectValue(node, match, startOffset, endOffset) {
    const nodeValue = code.slice(startOffset, endOffset);
    const start = nodeValue.indexOf(match);
    const end = start + match.length;
    matches.push({
      range: makeRange(start, end),
      text: match[0],
      isString: false
    });
  }

  function visit(node) {
    const value = node.value;
    if (value && typeof value === 'string' && hasChinese(value)) {
      const valueSpan = node.valueSpan || node.sourceSpan;
      let {
        start: { offset: startOffset },
        end: { offset: endOffset }
      } = valueSpan;
      handleStringValue(node, value, startOffset, endOffset);
    } else if (value && typeof value === 'object' && value.source && hasChinese(value.source)) {
      const chineseMatches = value.source.match(DOUBLE_BYTE_REGEX);
      chineseMatches.map(match => {
        const valueSpan = node.valueSpan || node.sourceSpan;
        let {
          start: { offset: startOffset },
          end: { offset: endOffset }
        } = valueSpan;
        handleObjectValue(node, match, startOffset, endOffset);
      });
    }
    if (node.children && node.children.length) {
      node.children.forEach(visit);
    }
    if (node.attributes && node.attributes.length) {
      node.attributes.forEach(visit);
    }
  }
  if (ast.nodes && ast.nodes.length) {
    ast.nodes.forEach(visit);
  }
  return matches;
}

/**
 * 辅助：替换常见 HTML 空格实体为占位符，避免干扰正则
 */
function replaceHtmlSpaces(code: string): string {
  return code
    .replace(/&ensp;/g, 'ccsp&;')
    .replace(/&emsp;/g, 'ecsp&;')
    .replace(/&nbsp;/g, 'ncsp&;');
}

/**
 * 辅助：还原 HTML 空格实体
 */
function recoverHtmlSpaces(str: string): string {
  return str
    .replace(/ccsp&;/g, '&ensp;')
    .replace(/ecsp&;/g, '&emsp;')
    .replace(/ncsp&;/g, '&nbsp;');
}

/**
 * 辅助：判断字符串是否被引号包裹
 */
function isQuoted(str: string, code: string, start: number, end: number): boolean {
  return (
    (code.substr(start - 1, 1) === '"' && code.substr(end, 1) === '"') ||
    (code.substr(start - 1, 1) === "'" && code.substr(end, 1) === "'")
  );
}

/**
 * 辅助：过滤被包含的区间，避免重复
 */
function filterNestedRanges(matches: any[]): any[] {
  return matches.filter(item => {
    let canBe = true;
    matches.forEach(items => {
      if (
        (item.arrf[0] > items.arrf[0] && item.arrf[1] <= items.arrf[1]) ||
        (item.arrf[0] >= items.arrf[0] && item.arrf[1] < items.arrf[1]) ||
        (item.arrf[0] > items.arrf[0] && item.arrf[1] < items.arrf[1])
      ) {
        canBe = false;
      }
    });
    return canBe;
  });
}

/**
 * 辅助：生成正则安全字符串
 */
function escapeRegExp(str: string): string {
  return str
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\$/g, '\\$')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\+/g, '\\+')
    .replace(/\*/g, '\\*')
    .replace(/\^/g, '\\^');
}

/**
 * 辅助：读取 kiwi 配置文件获取 vue 版本
 */
function getVueVersionFromConfig(): 'vue2' | 'vue3' {
  try {
    const fs = require('fs');
    const path = require('path');
    const configPath = path.resolve(process.cwd(), './kiwi.config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.vueVersion || 'vue3';
    }
  } catch (e) {
    // ignore
  }
  return 'vue3';
}

/**
 * 递归匹配 vue 文件中的中文（主入口）
 */
function findTextInVue(code: string) {
  const vueVersion = getVueVersionFromConfig();
  if (vueVersion === 'vue2') {
    return findTextInVue2(code);
  }
  return findTextInVue3(code);
}

/**
 * Vue2 文件中文查找处理
 */
function findTextInVue2(code: string) {
  // 1. 预处理：替换常见 HTML 空格实体，避免干扰后续正则
  code = replaceHtmlSpaces(code);
  let matches = [];
  let result;

  // 2. 解析 vue 文件，获取 AST
  const vueObejct = compilerVue.compile(code.toString(), { outputSourceRange: true });
  let vueAst = vueObejct.ast;

  // 3. 提取模板中的中文（递归遍历 AST）
  let expressTemp = findVueText(vueAst);
  expressTemp.forEach(item => {
    item.arrf = [item.start, item.end];
  });
  matches = expressTemp;

  // 4. 解析 render 函数，提取中文（包括静态渲染函数）
  let vueTemp = extractRenderChinese(vueObejct, code);

  // 5. 在模板代码中查找 render 函数中提取到的中文
  let codeTemplate = code.substring((vueObejct.ast as any).start, (vueObejct.ast as any).end);
  vueTemp.forEach(item => {
    let items = escapeRegExp(item);
    let rex = new RegExp(items, 'g');
    while ((result = rex.exec(codeTemplate))) {
      let res = result;
      let last = rex.lastIndex;
      last = last - (res[0].length - res[0].trimRight().length);
      const range = { start: res.index, end: last };
      matches.push({
        arrf: [res.index, last],
        range,
        text: recoverHtmlSpaces(res[0].trimRight()),
        isString: isQuoted(res[0], codeTemplate, res.index, last)
      });
    }
  });

  // 6. 过滤掉被包含的区间，避免重复
  let matchesTempResult = filterNestedRanges(matches);

  // 7. 解析 <script> 部分，查找 TS 代码中的中文
  const sfc = compilerVue.parseComponent(code.toString());
  return matchesTempResult.concat(findTextInVueTs(sfc.script.content, 'AS', sfc.script.start));
}

/**
 * Vue3 文件中文查找处理
 */
function findTextInVue3(code: string) {
  const matches = [];

  try {
    // 使用 Vue3 的 SFC 编译器解析
    const { descriptor } = compilerVue3.parse(code);

    // 1. 处理 template 部分
    if (descriptor.template) {
      const templateMatches = findTextInVue3Template(descriptor.template, code);
      matches.push(...templateMatches);
    }

    // 2. 处理 script 部分
    if (descriptor.script) {
      const scriptMatches = findTextInVue3Script(descriptor.script, code);
      matches.push(...scriptMatches);
    }

    // 3. 处理 script setup 部分
    if (descriptor.scriptSetup) {
      const scriptSetupMatches = findTextInVue3Script(descriptor.scriptSetup, code);
      matches.push(...scriptSetupMatches);
    }
  } catch (error) {
    console.error('Vue3 解析错误:', error);
    // 解析失败时回退到 Vue2 逻辑
    return findTextInVue2(code);
  }

  return matches;
}

/**
 * 处理 Vue3 template 部分的中文
 */
function findTextInVue3Template(template: any, code: string) {
  const matches = [];

  if (!template.ast) return matches;

  function visitNode(node: any) {
    // 处理文本节点
    if (node.type === 2 && node.content && hasChinese(node.content)) {
      // 2 = NodeTypes.TEXT
      const range = { start: node.loc.start.offset, end: node.loc.end.offset };
      matches.push({
        range,
        text: node.content.trim(),
        isString: false,
        arrf: [node.loc.start.offset, node.loc.end.offset]
      });
    }

    // 处理插值表达式 ({{ }})
    if (node.type === 5 && node.content) {
      // 5 = NodeTypes.INTERPOLATION
      const content = node.content;
      // 内容区间
      const contentStart = content.loc.start.offset;
      const contentEnd = content.loc.end.offset;

      // 处理模板字符串
      if (content.type === 16) {
        // 16 = NodeTypes.TEMPLATE_LITERAL
        const templateContent = content.content;
        if (hasChinese(templateContent)) {
          const range = { start: contentStart, end: contentEnd };
          matches.push({
            range,
            text: `\`${templateContent}\``,
            isString: true,
            arrf: [contentStart, contentEnd]
          });
        }
      }

      // 处理字符串字面量
      if (content.type === 4) {
        // 4 = NodeTypes.SIMPLE_EXPRESSION
        const expressionContent = content.content;
        if (hasChinese(expressionContent)) {
          const range = { start: contentStart, end: contentEnd };
          matches.push({
            range,
            text: expressionContent,
            isString: true,
            arrf: [contentStart, contentEnd]
          });
        }
      }

      // 处理复合表达式 (如字符串拼接)
      if (content.type === 8) {
        // 8 = NodeTypes.COMPOUND_EXPRESSION
        const compoundContent = content.children;
        let fullExpression = '';
        let hasChineseInCompound = false;

        compoundContent.forEach((child: any) => {
          if (child.type === 4) {
            // 4 = NodeTypes.SIMPLE_EXPRESSION
            if (hasChinese(child.content)) {
              hasChineseInCompound = true;
            }
            fullExpression += child.content;
          } else if (child.type === 17) {
            // 17 = NodeTypes.TEXT_CALL
            fullExpression += child.content;
          }
        });

        if (hasChineseInCompound) {
          const range = { start: contentStart, end: contentEnd };
          matches.push({
            range,
            text: fullExpression,
            isString: true,
            arrf: [contentStart, contentEnd]
          });
        }
      }
    }

    // 处理属性中的中文
    if (node.props) {
      node.props.forEach((prop: any) => {
        if (prop.type === 6 && prop.value && hasChinese(prop.value.content)) {
          // 6 = NodeTypes.ATTRIBUTE
          const range = { start: prop.loc.start.offset, end: prop.loc.end.offset };
          matches.push({
            range,
            text: prop.value.content,
            isString: true,
            arrf: [prop.loc.start.offset, prop.loc.end.offset]
          });
        }
      });
    }

    // 递归处理子节点
    if (node.children) {
      node.children.forEach(visitNode);
    }
  }

  visitNode(template.ast);
  return matches;
}

/**
 * 处理 Vue3 script 部分的中文
 */
function findTextInVue3Script(script: any, code: string) {
  const matches = [];

  if (!script.content) return matches;

  // 计算 script 在原始代码中的偏移量
  const scriptStartOffset = script.loc.start.offset;

  // 使用 TypeScript 解析 script 内容
  const scriptContent = script.content;
  const ast = ts.createSourceFile('', scriptContent, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS);

  /**
   * 递归遍历 TypeScript AST 节点，查找包含中文的字符串
   * @param node TypeScript AST 节点
   */
  function visit(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.StringLiteral: {
        // 处理字符串字面量，如: "你好世界"
        const { text } = node as ts.StringLiteral;
        if (hasChinese(text)) {
          // 计算在原始代码中的位置（需要加上 script 部分的偏移量）
          const start = node.getStart() + scriptStartOffset;
          const end = node.getEnd() + scriptStartOffset;
          matches.push({
            range: { start, end },
            text,
            isString: true,
            arrf: [start, end] // 兼容旧版本的数组格式
          });
        }
        break;
      }
      case ts.SyntaxKind.TemplateExpression: {
        // 处理模板表达式，如: `你好${name}世界`
        const { pos, end } = node;
        // 提取模板内容并移除插值表达式，只保留静态文本部分
        let templateContent = scriptContent
          .slice(pos, end)
          .toString()
          .replace(/\$\{[^\}]+\}/, '');
        if (hasChinese(templateContent)) {
          const start = node.getStart() + scriptStartOffset;
          const end = node.getEnd() + scriptStartOffset;
          matches.push({
            range: { start, end },
            // 提取完整的模板字符串内容（包含反引号）
            text: scriptContent.slice(node.getStart() + 1, node.getEnd() - 1),
            isString: true,
            arrf: [start, end]
          });
        }
        break;
      }
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral: {
        // 处理无插值的模板字符串，如: `你好世界`
        const { pos, end } = node;
        const templateContent = scriptContent.slice(pos, end);
        if (hasChinese(templateContent)) {
          const start = node.getStart() + scriptStartOffset;
          const end = node.getEnd() + scriptStartOffset;
          matches.push({
            range: { start, end },
            // 提取模板字符串内容（不包含反引号）
            text: scriptContent.slice(node.getStart() + 1, node.getEnd() - 1),
            isString: true,
            arrf: [start, end]
          });
        }
        break;
      }
    }
    // 递归遍历所有子节点
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(ast, visit);
  return matches;
}

/**
 * 辅助：提取 render 函数和静态渲染函数中的中文
 */
function extractRenderChinese(vueObejct: any, code: string): string[] {
  // 解析 render 函数
  let outcode = vueObejct.render.toString().replace('with(this)', 'function a()');
  let vueTemp = transerI18n(outcode, 'as.vue', null).map(item => item.trim());
  vueTemp = Array.from(new Set(vueTemp));
  // 解析静态渲染函数
  let codeStaticArr: string[] = [];
  vueObejct.staticRenderFns.forEach((item: any) => {
    let childcode = item.toString().replace('with(this)', 'function a()');
    let vueTempChild = transerI18n(childcode, 'as.vue', null);
    codeStaticArr = codeStaticArr.concat(Array.from(new Set(vueTempChild)));
  });
  // 合并 render 和静态渲染函数的中文
  return Array.from(new Set(codeStaticArr.concat(vueTemp)));
}

/**
 * 优化后的查找 vue 文件 <script> 部分的中文（TS）
 */
function findTextInVueTs(code: string, fileName: string, startNum: number) {
  const matches = [];
  const ast = ts.createSourceFile('', code, ts.ScriptTarget.ES2015, true, ts.ScriptKind.TS);

  function handleStringLiteral(node: ts.StringLiteral) {
    if (hasChinese(node.text)) {
      matches.push({
        range: makeRange(node.getStart() + startNum, node.getEnd() + startNum),
        text: node.text,
        isString: true
      });
    }
  }

  function handleTemplateExpression(node: ts.TemplateExpression) {
    const { pos, end } = node;
    let templateContent = code
      .slice(pos, end)
      .toString()
      .replace(/\$\{[^\}]+\}/, '');
    if (hasChinese(templateContent)) {
      matches.push({
        range: makeRange(node.getStart() + startNum, node.getEnd() + startNum),
        text: code.slice(node.getStart() + 1, node.getEnd() - 1),
        isString: true
      });
    }
  }

  function visit(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.StringLiteral:
        handleStringLiteral(node as ts.StringLiteral);
        break;
      case ts.SyntaxKind.TemplateExpression:
        handleTemplateExpression(node as ts.TemplateExpression);
        break;
    }
    ts.forEachChild(node, visit);
  }
  ts.forEachChild(ast, visit);
  return matches;
}

/**
 * 优化后的递归遍历 vue ast，查找模板中的中文
 */
function findVueText(ast) {
  let arr = [];
  const regex1 = /\`(.+?)\`/g;
  function handleExpression(ast) {
    let text = ast.expression.match(regex1);
    if (text && hasChinese(text[0])) {
      text.forEach(itemText => {
        const varInStr = itemText.match(/(\$\{[^\}]+?\})/g);
        if (varInStr)
          hasChinese(itemText) &&
            arr.push({ text: ' ' + itemText, range: { start: ast.start + 2, end: ast.end - 2 }, isString: true });
        else
          hasChinese(itemText) &&
            arr.push({ text: itemText, range: { start: ast.start, end: ast.end }, isString: false });
      });
    } else {
      ast.tokens &&
        ast.tokens.forEach(element => {
          if (typeof element === 'string' && hasChinese(element)) {
            arr.push({
              text: element,
              range: {
                start: ast.start + ast.text.indexOf(element),
                end: ast.start + ast.text.indexOf(element) + element.length
              },
              isString: false
            });
          }
        });
    }
  }
  function emun(ast) {
    if (ast.expression) {
      handleExpression(ast);
    } else if (!ast.expression && ast.text) {
      hasChinese(ast.text) && arr.push({ text: ast.text, range: { start: ast.start, end: ast.end }, isString: false });
    } else {
      ast.children &&
        ast.children.forEach(item => {
          emun(item);
        });
    }
  }
  emun(ast);
  return arr;
}

/**
 * 递归匹配代码的中文（入口）
 * @param code 代码内容
 * @param fileName 文件名
 */
function findChineseText(code: string, fileName: string) {
  if (fileName.endsWith('.html')) {
    return findTextInHtml(code);
  }

  if (fileName.endsWith('.vue')) {
    return findTextInVue(code);
  }

  if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) {
    return findTextInJs(code);
  }

  return findTextInTs(code, fileName);
}

export { findChineseText };
