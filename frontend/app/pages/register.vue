<template>
  <div class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-10 sm:px-6">
    <div class="w-full">
      <div class="flex items-center gap-3">
        <BrandMark :size="40" />
        <div>
          <p class="eyebrow">Обсерватория данных</p>
          <p class="font-display text-h3 font-semibold tracking-tight text-ink dark:text-paper">Y.Map</p>
        </div>
      </div>

      <!-- Sent state. The form is replaced rather than kept below the message: a
           second submit from this screen would only produce a second letter. -->
      <template v-if="sent">
        <h1 class="mt-8 font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">
          Проверьте почту
        </h1>
        <p class="mt-3 text-lead text-ink-muted dark:text-ink-faint">
          Письмо со ссылкой подтверждения отправлено на <span class="font-mono text-ink dark:text-paper">{{ email }}</span>.
          Ссылка действует сутки.
        </p>

        <NoteBlock v-if="!mailDelivered" tone="caution" title="Письмо не ушло">
          Почтовый сервер не принял сообщение. Аккаунт создан, но подтвердить его сейчас нельзя.
          Попробуйте отправить письмо ещё раз или сообщите администратору.
        </NoteBlock>

        <div class="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="rounded-control border border-rule px-4 py-2.5 text-body font-medium text-ink-muted transition-colors hover:bg-paper-sunk disabled:opacity-60 dark:border-night-rule dark:text-ink-faint dark:hover:bg-night-sunk"
            :disabled="resending || cooldown > 0"
            @click="resend"
          >
            <span v-if="cooldown > 0">Отправить заново через {{ cooldown }} с</span>
            <span v-else>{{ resending ? 'Письмо отправляется…' : 'Отправить заново' }}</span>
          </button>
          <NuxtLink to="/login" class="text-body font-semibold text-prussian-600 dark:text-prussian-200">
            Перейти ко входу
          </NuxtLink>
        </div>

        <p v-if="resendNote" class="mt-3 text-note text-ink-muted dark:text-ink-faint">{{ resendNote }}</p>
      </template>

      <template v-else>
        <h1 class="mt-8 font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">
          Регистрация
        </h1>
        <p class="mt-2 text-body text-ink-muted dark:text-ink-faint">
          Карта, модели и отчёты открыты без аккаунта. Регистрация нужна, чтобы уточнять записи
          реестра по объектам, которые вы знаете вживую.
        </p>

        <form class="mt-8 space-y-5" @submit.prevent="handleSubmit">
          <div>
            <label for="reg-email" class="eyebrow block">Адрес почты</label>
            <input
              id="reg-email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="name@example.com"
              required
              class="control mt-2 w-full"
            />
          </div>

          <div>
            <label for="reg-password" class="eyebrow block">Пароль</label>
            <input
              id="reg-password"
              v-model="password"
              type="password"
              autocomplete="new-password"
              placeholder="не короче 6 символов"
              required
              class="control mt-2 w-full"
            />
          </div>

          <div>
            <label for="reg-password2" class="eyebrow block">Пароль ещё раз</label>
            <input
              id="reg-password2"
              v-model="password2"
              type="password"
              autocomplete="new-password"
              required
              class="control mt-2 w-full"
            />
          </div>

          <NoteBlock v-if="error" tone="caution">{{ error }}</NoteBlock>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full rounded-control bg-prussian-600 px-5 py-3 text-body font-semibold text-paper transition-colors hover:bg-prussian-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ isLoading ? 'Аккаунт создаётся…' : 'Создать аккаунт' }}
          </button>
        </form>

        <p class="mt-6 border-t border-rule pt-5 text-body text-ink-muted dark:border-night-rule dark:text-ink-faint">
          Уже есть аккаунт?
          <NuxtLink to="/login" class="font-semibold text-prussian-600 dark:text-prussian-200">Войти</NuxtLink>
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// Email, password, confirmation by letter. No name field on purpose: the account
// cannot do anything until the address is confirmed, and asking for a name before
// that collects a value that is discarded whenever the letter goes unread.
definePageMeta({ layout: 'default' })
useSeoMeta({ title: 'Регистрация - Y.Map' })

const { isAuthenticated } = useAuth()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const password2 = ref('')
const error = ref('')
const isLoading = ref(false)

const sent = ref(false)
const mailDelivered = ref(true)
const resending = ref(false)
const resendNote = ref('')

// Mirrors VERIFY_RESEND_COOLDOWN_MS on the backend. The counter is here so the
// button explains the wait instead of returning a 429 the user cannot read.
const cooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

const startCooldown = (seconds: number) => {
  cooldown.value = seconds
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

onMounted(() => {
  if (isAuthenticated.value) navigateTo('/profile')
})

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})

const handleSubmit = async () => {
  error.value = ''
  if (password.value.length < 6) {
    error.value = 'Пароль должен быть не короче 6 символов'
    return
  }
  if (password.value !== password2.value) {
    error.value = 'Пароли не совпадают'
    return
  }

  isLoading.value = true
  try {
    const res = await auth.register(email.value, password.value)
    mailDelivered.value = res.mailDelivered !== false
    sent.value = true
    startCooldown(60)
  } catch (err: any) {
    error.value = err?.data?.message || 'Не удалось создать аккаунт'
  } finally {
    isLoading.value = false
  }
}

const resend = async () => {
  resending.value = true
  resendNote.value = ''
  try {
    await auth.resendVerification(email.value)
    resendNote.value = 'Письмо отправлено. Если его нет через пару минут, проверьте папку со спамом.'
    startCooldown(60)
  } catch (err: any) {
    if (err?.data?.code === 'RESEND_COOLDOWN') {
      startCooldown(Math.ceil((err.data.retryAfterMs ?? 60000) / 1000))
    } else {
      resendNote.value = err?.data?.message || 'Не удалось отправить письмо'
    }
  } finally {
    resending.value = false
  }
}
</script>
