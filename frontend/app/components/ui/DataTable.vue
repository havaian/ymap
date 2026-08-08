<template>
  <div>
    <!-- Wide: a hairline table. Rules instead of zebra striping, because striping
         implies grouping that is not there. -->
    <div class="hidden md:block">
      <table class="w-full text-body">
        <thead>
          <tr>
            <th
              v-for="c in columns"
              :key="c.key"
              class="pb-2 pr-4 text-left align-bottom text-eyebrow uppercase text-ink-faint"
              :class="c.align === 'right' ? 'text-right pr-0 pl-4' : ''"
              :style="c.width ? { width: c.width } : undefined"
            >
              {{ c.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="String(row[rowKey])" class="rule-row">
            <td
              v-for="c in columns"
              :key="c.key"
              class="py-2 pr-4 tabular"
              :class="[
                c.align === 'right' ? 'text-right pr-0 pl-4' : '',
                c.emphasis ? 'font-semibold text-ink dark:text-paper' : 'text-ink-muted dark:text-ink-faint',
              ]"
            >
              <slot :name="`cell-${c.key}`" :row="row" :value="row[c.key]">{{ row[c.key] ?? '-' }}</slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Narrow: the same rows as blocks. A six-column table on a phone is a
         horizontal scrollbar pretending to be a table, and nobody reads the
         columns that fall off the edge. The first column becomes the heading and
         the rest become labelled pairs, so nothing is dropped. -->
    <div class="md:hidden">
      <div v-for="row in rows" :key="String(row[rowKey])" class="rule-row py-3">
        <p class="font-medium text-ink dark:text-paper">
          <slot :name="`cell-${columns[0].key}`" :row="row" :value="row[columns[0].key]">
            {{ row[columns[0].key] ?? '-' }}
          </slot>
        </p>
        <dl class="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
          <div v-for="c in columns.slice(1)" :key="c.key" class="flex items-baseline justify-between gap-2">
            <dt class="text-label text-ink-faint">{{ c.label }}</dt>
            <dd class="tabular text-body text-ink-muted dark:text-ink-faint">
              <slot :name="`cell-${c.key}`" :row="row" :value="row[c.key]">{{ row[c.key] ?? '-' }}</slot>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <p v-if="!rows.length" class="py-6 text-center text-body text-ink-faint">{{ empty }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * One table for the whole observatory. Columns are declared, cells are overridable
 * through named slots, and the narrow layout is part of the component rather than
 * a media query bolted onto each page.
 */
export interface Column {
  key: string
  label: string
  align?: 'left' | 'right'
  /** Renders bolder: use for the one column a reader scans down. */
  emphasis?: boolean
  width?: string
}

withDefaults(
  defineProps<{
    columns: Column[]
    rows: Record<string, any>[]
    rowKey?: string
    empty?: string
  }>(),
  { rowKey: 'id', empty: 'Нет строк' },
)
</script>
