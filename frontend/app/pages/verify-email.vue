<template>
  <div class="mx-auto flex min-h-[calc(100vh-4rem)] min-h-[calc(100dvh-4rem)] max-w-md items-center px-4 py-10 sm:px-6">
    <div class="w-full">
      <div class="flex items-center gap-3">
        <BrandMark :size="40" />
        <div>
          <p class="eyebrow">Обсерватория данных</p>
          <p class="font-display text-h3 font-semibold tracking-tight text-ink dark:text-paper">Y.Map</p>
        </div>
      </div>

      <template v-if="state === 'pending'">
        <h1 class="mt-8 font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">
          Адрес подтверждается
        </h1>
        <p class="mt-2 text-body text-ink-muted dark:text-ink-faint">Ссылка проверяется, это занимает пару секунд.</p>
      </template>

      <template v-else-if="state === 'done'">
        <h1 class="mt-8 font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">
          Адрес подтверждён
        </h1>
        <p class="mt-3 text-lead text-ink-muted dark:text-ink-faint">
          Аккаунт активен, вход выполнен.
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          <NuxtLink
            to="/analytics/verification"
            class="rounded-control bg-prussian-600 px-5 py-3 text-body font-semibold text-paper transition-colors hover:bg-prussian-700"
          >
            Открыть очередь верификации
          </NuxtLink>
          <NuxtLink
            to="/profile"
            class="rounded-control border border-rule px-5 py-3 text-body font-medium text-ink-muted transition-colors hover:bg-paper-sunk dark:border-night-rule dark:text-ink-faint dark:hover:bg-night-sunk"
          >
            Профиль
          </NuxtLink>
        </div>
      </template>

      <template v-else>
        <h1 class="mt-8 font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">
          Ссылка не сработала
        </h1>
        <NoteBlock class="mt-4" tone="caution">{{ message }}</NoteBlock>

        <!-- Expired is recoverable and invalid is not, so only the expired case
             gets a form. Offering a resend for a token that never existed would
             turn this page into an address checker. -->
        <div v-if="code === 'TOKEN_EXPIRED'" class="mt-6">
          <label for="verify-email-input" class="eyebrow block">Адрес почты</label>
          <input
            id="verify-email-input"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="name@example.com"
            class="control mt-2 w-full"
          />
          <button
            type="button"
            class="mt-3 rounded-control bg-prussian-600 px-5 py-3 text-body font-semibold text-paper transition-colors hover:bg-prussian-700 disabled:opacity-60"
            :disabled="resending"
            @click="resend"
          >
            {{ resending ? 'Письмо отправляется…' : 'Прислать новую ссылку' }}
          </button>
          <p v-if="resendNote" class="mt-3 text-note text-ink-muted dark:text-ink-faint">{{ resendNote }}</p>
        </div>

        <p class="mt-6 border-t border-rule pt-5 text-body text-ink-muted dark:border-night-rule dark:text-ink-faint">
          <NuxtLink to="/register" class="font-semibold text-prussian-600 dark:text-prussian-200">
            Зарегистрироваться заново
          </NuxtLink>
          <span class="mx-2">·</span>
          <NuxtLink to="/login" class="font-semibold text-prussian-600 dark:text-prussian-200">Войти</NuxtLink>
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// Target of the link in the confirmation letter. Client-only (routeRules), so the
// token never travels through an SSR request log.
definePageMeta({ layout: 'default' })
useSeoMeta({ title: 'Подтверждение почты - Y.Map' })

const route = useRoute()
const auth = useAuthStore()

const state = ref<'pending' | 'done' | 'failed'>('pending')
const code = ref('')
const message = ref('')
const email = ref('')
const resending = ref(false)
const resendNote = ref('')

onMounted(async () => {
  const token = String(route.query.token ?? '')
  if (!token) {
    state.value = 'failed'
    code.value = 'INVALID_TOKEN'
    message.value = 'В ссылке нет токена подтверждения.'
    return
  }
  try {
    await auth.verifyEmail(token)
    state.value = 'done'
  } catch (err: any) {
    state.value = 'failed'
    code.value = err?.data?.code || 'INVALID_TOKEN'
    message.value = err?.data?.message || 'Ссылка недействительна или уже использована.'
  }
})

const resend = async () => {
  resending.value = true
  resendNote.value = ''
  try {
    await auth.resendVerification(email.value)
    resendNote.value = 'Если аккаунт с таким адресом ждёт подтверждения, письмо отправлено.'
  } catch (err: any) {
    resendNote.value = err?.data?.message || 'Не удалось отправить письмо'
  } finally {
    resending.value = false
  }
}
</script>
