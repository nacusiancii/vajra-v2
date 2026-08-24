<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BookText } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import NumericField from '@/components/NumericField.vue'
import { useCreateJournal, useEditJournal } from '@/queries/transactions'
import { JournalSchema } from '@domain/transaction-rules'
import type { JournalSide } from '@domain/transaction'

const route = useRoute()
const router = useRouter()
const editId = computed(() => (typeof route.query.edit === 'string' ? route.query.edit : null))

const createJournal = useCreateJournal()
const editJournal = useEditJournal()

const party = ref('')
const side = ref<JournalSide>('debit')
const amount = ref<number | null>(null)
const remarks = ref('')
const error = ref<string | null>(null)

const selectedClass =
  'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground'
const unselectedClass =
  'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground'

function finish(): void {
  error.value = null

  if (!party.value.trim()) {
    error.value = 'Journal needs a Party'
    return
  }
  if (!((amount.value ?? 0) > 0)) {
    error.value = 'Amount must be greater than zero'
    return
  }

  const parsed = JournalSchema.safeParse({
    party: party.value,
    side: side.value,
    amount: amount.value,
    remarks: remarks.value
  })
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Invalid entry'
    return
  }

  const onSuccess = (): void => void router.push('/')
  if (editId.value) {
    editJournal.mutate({ id: editId.value, input: parsed.data }, { onSuccess })
  } else {
    createJournal.mutate(parsed.data, { onSuccess })
  }
}

watch(
  editId,
  async () => {
    if (!editId.value) return
    const txn = await window.api.getTransaction(editId.value)
    if (!txn || txn.type !== 'JN') return
    party.value = txn.label ?? ''
    side.value = txn.journalSide ?? 'debit'
    amount.value = txn.total || null
    remarks.value = txn.remarks ?? ''
  },
  { immediate: true }
)
</script>

<template>
  <div class="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-8" data-testid="journal-page">
    <div class="flex items-center gap-3">
      <BookText class="size-6" />
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ editId ? 'Edit Journal' : 'New Journal' }}
      </h1>
    </div>

    <div class="grid gap-2">
      <Label>Party</Label>
      <Input v-model="party" autofocus data-testid="journal-party" />
    </div>

    <div class="grid gap-2">
      <Label>Debit / Credit</Label>
      <div
        class="inline-flex items-center rounded-lg border bg-background p-1"
        role="group"
        aria-label="Journal Debit or Credit"
        data-testid="journal-side"
      >
        <button
          type="button"
          data-testid="journal-side-debit"
          :class="side === 'debit' ? selectedClass : unselectedClass"
          @click="side = 'debit'"
        >
          Debit
        </button>
        <button
          type="button"
          data-testid="journal-side-credit"
          :class="side === 'credit' ? selectedClass : unselectedClass"
          @click="side = 'credit'"
        >
          Credit
        </button>
      </div>
    </div>

    <div class="grid gap-2">
      <Label>Amount</Label>
      <NumericField
        mode="money"
        :model-value="amount"
        placeholder="0"
        test-id="journal-amount"
        @update:model-value="amount = $event"
      />
    </div>

    <div class="grid gap-2">
      <Label for="journal-remarks">Remarks</Label>
      <Input
        id="journal-remarks"
        v-model="remarks"
        placeholder="Optional"
        data-testid="journal-remarks"
      />
    </div>

    <div class="flex items-center justify-between border-t pt-4">
      <p v-if="error" class="text-sm text-destructive" data-testid="journal-error">{{ error }}</p>
      <span v-else></span>
      <Button size="lg" data-testid="journal-finish" @click="finish">Record Journal</Button>
    </div>
  </div>
</template>
