<template>
  <div style="border:1px dashed #aaa; margin:16px 0; padding:12px;">
    <h2>{{ title }}</h2>
    <div>欢迎，{{ userName }}！</div>
    <div>{{ `你好，${userName}，今天是${date}，你有${count}条消息。` }}</div>
    <div>{{ '你有' + count + '条未读消息' }}</div>
    <div>{{ statusText }}</div>
    <div>{{ messageText }}</div>
    <div>{{ complexText }}</div>
    <button @click="sayHello">点击问好</button>
    <input v-model="inputValue" placeholder="请输入内容" />
    <div v-if="inputValue === ''">内容不能为空</div>
  </div>
</template>

<script>
export default {
  name: 'OptionsDemo',
  data() {
    return {
      title: '选项式 API 组件',
      userName: '小刚',
      count: 7,
      isLogin: false,
      isVip: true,
      inputValue: '',
      date: '2024-06-02'
    };
  },
  computed: {
    welcomeMsg() {
      return `欢迎，${this.userName}！`;
    },
    statusText() {
      return this.isLogin ? '已登录' : '未登录';
    },
    messageText() {
      return '你有' + this.count + '条未读消息';
    },
    complexText() {
      return this.isVip ? `尊贵的${this.userName}，欢迎回来！` : '欢迎回来！';
    }
  },
  methods: {
    sayHello() {
      alert('你好，' + this.userName);
    }
  }
};
</script>
