const { execSync } = require('child_process');
const path = require('path');

const projects = [
  'kiwi-react-demo',
  'kiwi-vue2-demo',
  'kiwi-vue3-demo',
];

projects.forEach((project) => {
  const cwd = path.resolve(__dirname, '..', project);
  console.log(`\n==== 执行 ${project} 的 kiwi 命令 ====`);
  try {
    execSync('pnpm run kiwi', { stdio: 'inherit', cwd });
  } catch (e) {
    console.error(`❌ ${project} 执行 kiwi 命令失败`);
  }
}); 