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

      <!-- The sent state is unconditional. The endpoint answers the same way for a
           registered address and an unknown one, so showing anything conditional
           here would leak exactly what the endpoint refuses to. -->
      <template v-if="sent">
        <h1 class="mt-8 font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">
          Письмо отправлено
        </h1>
        <p class="mt-3 text-lead text-ink-muted dark:text-ink-faint">
          Если аккаунт с адресом <span class="font-mono text-ink dark:text-paper">{{ email }}</span>
          существует, ссылка на смену пароля уже в пути. Она действует час и сработает один раз.
        </p>
        <p class="mt-6 border-t border-rule pt-5 text-body text-ink-muted dark:border-night-rule dark:text-ink-faint">
          <NuxtLink to="/login" class="font-semibold text-prussian-600 dark:text-prussian-200">
            Вернуться ко входу
          </NuxtLink>
        </p>
      </template>

      <template v-else>
        <h1 class="mt-8 font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">
          Смена пароля
        </h1>
        <p class="mt-2 text-body text-ink-muted dark:text-ink-faint">
          Укажите адрес, на который зарегистрирован аккаунт. Пришлём ссылку.
        </p>

        <form class="mt-8 space-y-5" @submit.prevent="handleSubmit">
          <div>
            <label for="forgot-email" class="eyebrow block">Адрес почты</label>
            <input
              id="forgot-email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="name@example.com"
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
            {{ isLoading ? 'Письмо отправляется…' : 'Прислать ссылку' }}
          </button>
        </form>

        <p class="mt-6 border-t border-rule pt-5 text-body text-ink-muted dark:border-night-rule dark:text-ink-faint">
          Вспомнили пароль?
          <NuxtLink to="/login" class="font-semibold text-prussian-600 dark:text-prussian-200">Войти</NuxtLink>
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
useSeoMeta({ title: 'Смена пароля - Y.Map' })

const auth = useAuthStore()

const email = ref('')
const error = ref('')
const isLoading = ref(false)
const sent = ref(false)

const handleSubmit = async () => {
  error.value = ''
  isLoading.value = true
  try {
    await auth.forgotPassword(email.value)
    sent.value = true
  } catch (err: any) {
    error.value = err?.data?.message || 'Не удалось отправить письмо'
  } finally {
    isLoading.value = false
  }
}
</script>
