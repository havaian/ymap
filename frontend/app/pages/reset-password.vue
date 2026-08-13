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

      <template v-if="done">
        <h1 class="mt-8 font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">
          Пароль изменён
        </h1>
        <p class="mt-3 text-lead text-ink-muted dark:text-ink-faint">Вход выполнен.</p>
        <div class="mt-6 flex flex-wrap gap-3">
          <NuxtLink
            to="/profile"
            class="rounded-control bg-prussian-600 px-5 py-3 text-body font-semibold text-paper transition-colors hover:bg-prussian-700"
          >
            Профиль
          </NuxtLink>
          <NuxtLink
            to="/analytics/verification"
            class="rounded-control border border-rule px-5 py-3 text-body font-medium text-ink-muted transition-colors hover:bg-paper-sunk dark:border-night-rule dark:text-ink-faint dark:hover:bg-night-sunk"
          >
            Очередь верификации
          </NuxtLink>
        </div>
      </template>

      <template v-else-if="!token">
        <h1 class="mt-8 font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">
          Ссылка не сработала
        </h1>
        <NoteBlock class="mt-4" tone="caution">В ссылке нет токена смены пароля.</NoteBlock>
        <p class="mt-6 border-t border-rule pt-5 text-body dark:border-night-rule">
          <NuxtLink to="/forgot-password" class="font-semibold text-prussian-600 dark:text-prussian-200">
            Запросить новую ссылку
          </NuxtLink>
        </p>
      </template>

      <template v-else>
        <h1 class="mt-8 font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">
          Новый пароль
        </h1>
        <p class="mt-2 text-body text-ink-muted dark:text-ink-faint">
          Ссылка сработает один раз. После смены вход выполнится сразу.
        </p>

        <form class="mt-8 space-y-5" @submit.prevent="handleSubmit">
          <div>
            <label for="reset-password" class="eyebrow block">Пароль</label>
            <input
              id="reset-password"
              v-model="password"
              type="password"
              autocomplete="new-password"
              placeholder="не короче 6 символов"
              required
              class="control mt-2 w-full"
            />
          </div>

          <div>
            <label for="reset-password2" class="eyebrow block">Пароль ещё раз</label>
            <input
              id="reset-password2"
              v-model="password2"
              type="password"
              autocomplete="new-password"
              required
              class="control mt-2 w-full"
            />
          </div>

          <NoteBlock v-if="error" tone="caution">
            {{ error }}
            <NuxtLink
              v-if="expired"
              to="/forgot-password"
              class="mt-2 block font-semibold text-prussian-600 dark:text-prussian-200"
            >
              Запросить новую ссылку
            </NuxtLink>
          </NoteBlock>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full rounded-control bg-prussian-600 px-5 py-3 text-body font-semibold text-paper transition-colors hover:bg-prussian-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ isLoading ? 'Пароль сохраняется…' : 'Задать пароль' }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// Target of the link in the reset letter. Client-only (routeRules): the token is a
// live credential and has no business in an SSR request log.
definePageMeta({ layout: 'default' })
useSeoMeta({ title: 'Новый пароль - Y.Map' })

const route = useRoute()
const auth = useAuthStore()

const token = computed(() => String(route.query.token ?? ''))
const password = ref('')
const password2 = ref('')
const error = ref('')
const expired = ref(false)
const isLoading = ref(false)
const done = ref(false)

const handleSubmit = async () => {
  error.value = ''
  expired.value = false
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
    await auth.resetPassword(token.value, password.value)
    done.value = true
  } catch (err: any) {
    expired.value = err?.data?.code === 'TOKEN_EXPIRED' || err?.data?.code === 'INVALID_TOKEN'
    error.value = err?.data?.message || 'Не удалось сменить пароль'
  } finally {
    isLoading.value = false
  }
}
</script>
