<template>
  <div style="border:1px dashed #4caf50; margin:16px 0; padding:12px;">
    <h2>组合式 API 组件</h2>
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

<script setup lang="ts">
import { ref, computed } from 'vue';
const userName = ref('小明');
const count = ref(3);
const isLogin = ref(true);
const isVip = ref(false);
const inputValue = ref('');
const date = ref('2024-06-01');

const statusText = computed(() => (isLogin.value ? '已登录' : '未登录'));
const messageText = computed(() => '你有' + count.value + '条未读消息');
const complexText = computed(() => (isVip.value ? `尊贵的${userName.value}，欢迎回来！` : '欢迎回来！'));

function sayHello() {
  alert('你好，' + userName.value);
}
</script>
