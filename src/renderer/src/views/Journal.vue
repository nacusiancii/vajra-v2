<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NotebookPen } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import NumericField from '@/components/NumericField.vue'
import JournalNameField, { type JournalNameValue } from '@/components/journal/JournalNameField.vue'
import { useCreateJournal, useEditJournal } from '@/queries/journals'
import { userFacingError } from '@/lib/utils'
import { CreateJournalSchema } from '@domain/journal'

const route = useRoute()
const router = useRouter()

const editId = computed(() => {
  const raw = route.query.edit
  if (typeof raw !== 'string') return null
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
})

const createJournal = useCreateJournal()
const editJournal = useEditJournal()

const emptyParty = (): JournalNameValue => ({ name: '', customerId: null })

const debitParty = ref<JournalNameValue>(emptyParty())
const debitAmount = ref<number | null>(null)
const creditParty = ref<JournalNameValue>(emptyParty())
const creditAmount = ref<number | null>(null)
const remarks = ref('')
const error = ref<string | null>(null)
const refused = ref(false)

const pending = computed(
  () => createJournal.isPending.value || editJournal.isPending.value || refused.value
)

function finish(): void {
  if (refused.value) return
  error.value = null

  const parsed = CreateJournalSchema.safeParse({
    debit: {
      name: debitParty.value.name,
      amount: debitAmount.value,
      customerId: debitParty.value.customerId
    },
    credit: {
      name: creditParty.value.name,
      amount: creditAmount.value,
      customerId: creditParty.value.customerId
    },
    remarks: remarks.value
  })
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Invalid entry'
    return
  }

  const input = parsed.data
  const onSuccess = (): void => void router.push('/')
  const onError = (err: Error): void => {
    error.value = userFacingError(err, 'Could not record Journal')
  }
  if (editId.value != null) {
    editJournal.mutate({ id: editId.value, input }, { onSuccess, onError })
  } else {
    createJournal.mutate(input, { onSuccess, onError })
  }
}

watch(
  editId,
  async (id) => {
    if (id == null) return
    refused.value = false
    error.value = null
    const journal = await window.api.getJournal(id)
    if (!journal || journal.voided) {
      refused.value = true
      error.value = 'This Journal cannot be edited.'
      return
    }
    debitParty.value = {
      name: journal.debit?.name ?? '',
      customerId: journal.debit?.customerId ?? null
    }
    debitAmount.value = journal.debit?.amount ?? null
    creditParty.value = {
      name: journal.credit?.name ?? '',
      customerId: journal.credit?.customerId ?? null
    }
    creditAmount.value = journal.credit?.amount ?? null
    remarks.value = journal.remarks ?? ''
  },
  { immediate: true }
)
</script>

<template>
  <div class="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-8" data-testid="journal-page">
    <div class="flex items-center gap-3">
      <NotebookPen class="size-6" />
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ editId != null ? 'Edit Journal' : 'New Journal' }}
      </h1>
    </div>

    <p class="text-sm text-muted-foreground">
      Journals are notes for today. They do not change cash or credit totals, are not on this End of
      Day Report, and are wiped at Rollover.
    </p>

    <div class="grid gap-2">
      <p class="text-sm font-medium">Debit</p>
      <div class="grid grid-cols-2 gap-4">
        <div class="grid gap-2">
          <Label for="journal-debit-name">Party</Label>
          <JournalNameField
            id="journal-debit-name"
            v-model="debitParty"
            placeholder="Party"
            test-id="journal-debit-name"
            autofocus
          />
        </div>
        <div class="grid gap-2">
          <Label>Amount</Label>
          <NumericField
            mode="money"
            :model-value="debitAmount"
            placeholder="0"
            test-id="journal-debit-amount"
            @update:model-value="debitAmount = $event"
          />
        </div>
      </div>
    </div>

    <div class="grid gap-2">
      <p class="text-sm font-medium">Credit</p>
      <div class="grid grid-cols-2 gap-4">
        <div class="grid gap-2">
          <Label for="journal-credit-name">Party</Label>
          <JournalNameField
            id="journal-credit-name"
            v-model="creditParty"
            placeholder="Party"
            test-id="journal-credit-name"
          />
        </div>
        <div class="grid gap-2">
          <Label>Amount</Label>
          <NumericField
            mode="money"
            :model-value="creditAmount"
            placeholder="0"
            test-id="journal-credit-amount"
            @update:model-value="creditAmount = $event"
          />
        </div>
      </div>
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
      <Button size="lg" data-testid="journal-finish" :disabled="pending" @click="finish">
        Record Journal
      </Button>
    </div>
  </div>
</template>
