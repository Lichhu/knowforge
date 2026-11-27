<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-vue-next'

const props = defineProps<{ serviceUnavailable: boolean; message?: string; busy?: boolean }>()
const emit = defineEmits<{
  login: [credentials: { email: string; password: string }]
}>()

const email = ref('')
const password = ref('')
const localError = ref('')

function submit() {
  if (props.busy) return
  localError.value = ''
  emit('login', { email: email.value.trim(), password: password.value })
}

</script>

<template>
  <main class="login-screen">
    <div class="login-grid"></div>
    <section class="login-panel">
      <div class="login-brand">
        <div class="brand-mark"><span></span><span></span><span></span></div>
        <div class="brand-copy">
          <strong>测试知识工作台</strong>
          <span>AI TEST DESIGN</span>
        </div>
      </div>
      <div class="login-rule"></div>
      <div class="login-kicker">SECURE WORKSPACE <span>·</span> PILOT 01</div>
      <h1>让每个测试判断，<br />都有依据。</h1>
      <p class="login-intro">登录工作台，继续测试管理平台试点中的需求澄清与测试设计。</p>

      <form class="login-form" @submit.prevent="submit">
        <label for="login-email">工作邮箱</label>
        <input
          id="login-email"
          v-model="email"
          type="email"
          autocomplete="username"
          placeholder="name@organization.com"
          required
        />
        <label for="login-password">密码</label>
        <input
          id="login-password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          placeholder="输入账户密码"
          required
        />
        <p v-if="props.message || localError" class="login-error">{{ localError || props.message }}</p>
        <p v-if="props.serviceUnavailable" class="login-service-note">
          <span></span>暂时无法连接平台服务，请确认 API 与数据库已启动。
        </p>
        <button class="login-submit" type="submit" :disabled="props.busy || props.serviceUnavailable">
          {{ props.busy ? '正在验证…' : '安全登录' }}
          <ArrowRight :size="16" />
        </button>
      </form>
      <div class="login-security">
        <span><ShieldCheck :size="15" />系统级权限隔离</span>
        <span><LockKeyhole :size="14" />操作全程留痕</span>
      </div>
      <div class="login-footer">未配置默认账户。请联系平台管理员开通访问权限。</div>
    </section>
    <aside class="login-aside">
      <div class="aside-index">KNOWLEDGE BEFORE TEST</div>
      <div class="aside-quote">
        <span class="quote-mark">“</span>
        <p>AI 可以提出问题，<br />但不能替业务确认答案。</p>
        <span class="quote-rule"></span>
        <small>可信知识 · 人工确认 · 可追溯测试</small>
      </div>
      <div class="aside-bottom"><span>测试管理平台</span><span>WEB / SIT PILOT</span></div>
    </aside>
  </main>
</template>
