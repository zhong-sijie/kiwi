import { useState } from 'react';

function App() {
  const [userName] = useState('小明');
  const [count] = useState(3);
  const [isLogin] = useState(true);
  const [isVip] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const date = '2024-06-01';

  return (
    <div>
      {/* 页面与标题 */}
      <h1>欢迎来到 Kiwi 国际化 Demo</h1>
      <h2>你好，世界！</h2>
      <h3>这是一个测试页面</h3>

      {/* 按钮/操作 */}
      <button onClick={() => alert('确定')}>确定</button>
      <button onClick={() => alert('取消')}>取消</button>
      <button onClick={() => alert('提交')}>提交</button>
      <button onClick={() => alert('删除')}>删除</button>
      <button onClick={() => alert('编辑')}>编辑</button>
      <button onClick={() => alert('新增')}>新增</button>
      <button onClick={() => alert('查询')}>查询</button>
      <button onClick={() => alert('重置')}>重置</button>

      {/* 表单与校验 */}
      <form
        onSubmit={e => {
          e.preventDefault();
          alert('登录');
        }}>
        <label>请输入用户名</label>
        <input placeholder="请输入用户名" value={inputValue} onChange={e => setInputValue(e.target.value)} />
        <div>{inputValue === '' ? '用户名不能为空' : ''}</div>
        <label>请输入密码</label>
        <input type="password" placeholder="请输入密码" />
        <div>密码长度不能少于6位</div>
        <button type="submit">登录</button>
        <button type="button">注册</button>
      </form>

      {/* 列表与表格 */}
      <table border={1}>
        <thead>
          <tr>
            <th>序号</th>
            <th>姓名</th>
            <th>年龄</th>
            <th>性别</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>小明</td>
            <td>18</td>
            <td>男</td>
            <td>编辑/删除</td>
          </tr>
          <tr>
            <td>2</td>
            <td>小红</td>
            <td>20</td>
            <td>女</td>
            <td>编辑/删除</td>
          </tr>
        </tbody>
      </table>
      <div>没有数据</div>
      <div>加载中...</div>

      {/* 弹窗与通知 */}
      <button onClick={() => setShowModal(true)}>打开弹窗</button>
      {showModal && (
        <div style={{ border: '1px solid #ccc', padding: 20, background: '#fff' }}>
          <h4>提示</h4>
          <p>你确定要删除这条数据吗？</p>
          <button
            onClick={() => {
              setShowModal(false);
              alert('操作成功');
            }}>
            操作成功
          </button>
          <button
            onClick={() => {
              setShowModal(false);
              alert('操作失败');
            }}>
            操作失败
          </button>
          <button onClick={() => setShowModal(false)}>关闭</button>
        </div>
      )}
      <div>已保存</div>

      {/* 菜单与导航 */}
      <nav>
        <a href="#">首页</a> | <a href="#">关于我们</a> | <a href="#">产品中心</a> | <a href="#">联系我们</a> |{' '}
        <a href="#">退出登录</a>
      </nav>

      {/* 变量插值/模板字符串/拼接/三元表达式/复杂表达式 */}
      <div>欢迎，{userName}！</div>
      <div>{`你好 React，${userName}，今天是${date}，你有${count}条消息。`}</div>
      <div>{'你有' + count + '条未读消息'}</div>
      <div>{isLogin ? '已登录' : '未登录'}</div>
      <div>{count > 0 ? `你有${count}条新消息` : '暂无新消息'}</div>
      <div>{isVip ? `尊贵的${userName}，欢迎回来！` : '欢迎回来！'}</div>

      {/* 组件属性/插槽/HTML 属性 */}
      <button title="点击查看更多">更多</button>
      <img alt="用户头像" src="https://placehold.co/40x40" />
      <input aria-label="搜索内容" placeholder="请输入搜索内容" />
    </div>
  );
}

export default App;
