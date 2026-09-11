<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Pencil, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { useTransactionsQuery } from '@/queries/transactions'
import { useCancelJournal, useDayEntriesQuery } from '@/queries/journals'
import { formatRupees } from '@/lib/format'
import { txnCounterparty, txnEditPath } from '@/lib/txn-edit'
import { userFacingError } from '@/lib/utils'
import { displayTxnSerial, summariseDrawer, TXN_TYPE_LABELS, type Txn } from '@domain/transaction'
import { displayJournalSerial, type DayEntry, type Journal } from '@domain/journal'

const router = useRouter()
const dayEntriesQuery = useDayEntriesQuery()
const transactionsQuery = useTransactionsQuery()
const cancelJournal = useCancelJournal()

const entries = computed(() => dayEntriesQuery.data.value ?? [])
const txns = computed(() => transactionsQuery.data.value ?? [])
const drawer = computed(() => summariseDrawer(txns.value))
const isLoading = computed(
  () => dayEntriesQuery.isLoading.value || transactionsQuery.isLoading.value
)

const pendingDelete = ref<Journal | null>(null)
const deleteError = ref<string | null>(null)

/** Net cash + UPI a transaction moved through the drawer (signed). */
function drawerImpact(t: Txn): number {
  return t.cashIn + t.upiIn - t.cashOut - t.upiOut
}

function entryVoided(row: DayEntry): boolean {
  return row.kind === 'txn' ? row.txn.voided : row.journal.voided
}

function journalParties(j: Journal): string {
  if (j.debit && j.credit) return `${j.debit.name} · ${j.credit.name}`
  return j.debit?.name ?? j.credit?.name ?? '—'
}

function editTxn(t: Txn): void {
  void router.push(txnEditPath(t))
}

function editJournal(j: Journal): void {
  void router.push({ path: '/journal', query: { edit: String(j.id) } })
}

function requestDelete(j: Journal): void {
  deleteError.value = null
  pendingDelete.value = j
}

function closeDelete(): void {
  pendingDelete.value = null
  deleteError.value = null
}

function confirmDelete(): void {
  const j = pendingDelete.value
  if (!j) return
  cancelJournal.mutate(j.id, {
    onSuccess: () => closeDelete(),
    onError: (err) => {
      deleteError.value = userFacingError(err, 'Could not delete Journal')
    }
  })
}
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8"
    data-testid="transactions-page"
  >
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Transactions &amp; Records</h1>
      <p class="text-sm text-muted-foreground">Current Business Day transactions and records</p>
    </div>

    <!-- Drawer summary -->
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="drawer-summary">
      <div class="rounded-md border p-3">
        <p class="text-xs uppercase text-muted-foreground">Cash net</p>
        <p class="text-xl font-semibold tabular-nums">{{ formatRupees(drawer.cashNet) }}</p>
      </div>
      <div class="rounded-md border p-3">
        <p class="text-xs uppercase text-muted-foreground">UPI net</p>
        <p class="text-xl font-semibold tabular-nums">{{ formatRupees(drawer.upiNet) }}</p>
      </div>
      <div class="rounded-md border p-3">
        <p class="text-xs uppercase text-muted-foreground">Credit Sales</p>
        <p class="text-xl font-semibold tabular-nums">{{ formatRupees(drawer.creditSales) }}</p>
      </div>
      <div class="rounded-md border p-3">
        <p class="text-xs uppercase text-muted-foreground">Credit Purchases</p>
        <p class="text-xl font-semibold tabular-nums">{{ formatRupees(drawer.creditPurchases) }}</p>
      </div>
    </div>

    <!-- Day list -->
    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[60px]">No.</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Counterparty</TableHead>
            <TableHead class="text-right">Amount</TableHead>
            <TableHead class="text-right">Drawer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead class="w-[96px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="isLoading">
            <TableCell :colspan="7" class="py-8 text-center text-muted-foreground"
              >Loading...</TableCell
            >
          </TableRow>
          <TableRow v-else-if="entries.length === 0">
            <TableCell :colspan="7" class="py-8 text-center text-muted-foreground">
              No entries yet today.
            </TableCell>
          </TableRow>
          <template v-else>
            <TableRow
              v-for="row in entries"
              :key="row.id"
              :data-testid="row.kind === 'txn' ? 'txn-row' : 'journal-row'"
              :class="entryVoided(row) ? 'text-muted-foreground line-through' : ''"
            >
              <template v-if="row.kind === 'txn'">
                <TableCell class="tabular-nums" data-testid="txn-serial">{{
                  displayTxnSerial(row.txn)
                }}</TableCell>
                <TableCell>
                  {{ TXN_TYPE_LABELS[row.txn.type] }}
                  <Badge v-if="row.txn.saleMode === 'credit'" variant="outline" class="ml-1 text-xs"
                    >credit</Badge
                  >
                </TableCell>
                <TableCell>{{ txnCounterparty(row.txn) }}</TableCell>
                <TableCell class="text-right tabular-nums">{{
                  formatRupees(row.txn.total)
                }}</TableCell>
                <TableCell class="text-right tabular-nums">{{
                  formatRupees(drawerImpact(row.txn))
                }}</TableCell>
                <TableCell>
                  <Badge v-if="row.txn.voided" variant="secondary"
                    >voided → {{ row.txn.successorId }}</Badge
                  >
                  <Badge v-else variant="outline" class="text-green-600">live</Badge>
                </TableCell>
                <TableCell class="text-right">
                  <Button
                    v-if="!row.txn.voided"
                    variant="ghost"
                    size="icon"
                    data-testid="txn-edit"
                    @click="editTxn(row.txn)"
                  >
                    <Pencil class="size-4" />
                  </Button>
                </TableCell>
              </template>
              <template v-else>
                <TableCell class="tabular-nums">{{ displayJournalSerial(row.journal) }}</TableCell>
                <TableCell>
                  <Badge variant="outline">Journal</Badge>
                </TableCell>
                <TableCell>{{ journalParties(row.journal) }}</TableCell>
                <TableCell class="text-right tabular-nums">
                  <div class="flex flex-col items-end">
                    <span v-if="row.journal.debit"
                      >Dr {{ formatRupees(row.journal.debit.amount) }}</span
                    >
                    <span v-if="row.journal.credit"
                      >Cr {{ formatRupees(row.journal.credit.amount) }}</span
                    >
                  </div>
                </TableCell>
                <TableCell class="text-right tabular-nums">—</TableCell>
                <TableCell>
                  <Badge
                    v-if="row.journal.voided && row.journal.successorSerial"
                    variant="secondary"
                  >
                    voided → {{ row.journal.successorSerial }}
                  </Badge>
                  <Badge v-else-if="row.journal.voided" variant="secondary">voided</Badge>
                  <Badge v-else variant="outline" class="text-green-600">live</Badge>
                </TableCell>
                <TableCell class="text-right">
                  <span v-if="!row.journal.voided" class="inline-flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid="journal-edit"
                      @click="editJournal(row.journal)"
                    >
                      <Pencil class="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid="journal-delete"
                      @click="requestDelete(row.journal)"
                    >
                      <Trash2 class="size-4" />
                    </Button>
                  </span>
                </TableCell>
              </template>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <Dialog
      :open="pendingDelete != null"
      @update:open="
        (v) => {
          if (!v) closeDelete()
        }
      "
    >
      <DialogContent data-testid="journal-delete-dialog">
        <DialogHeader>
          <DialogTitle>Delete Journal?</DialogTitle>
          <DialogDescription>
            This voids the Journal without a replacement. It stays on today's list until Rollover.
          </DialogDescription>
        </DialogHeader>
        <p v-if="deleteError" class="text-sm text-destructive">{{ deleteError }}</p>
        <DialogFooter>
          <Button variant="outline" @click="closeDelete">Cancel</Button>
          <Button
            data-testid="journal-delete-confirm"
            :disabled="cancelJournal.isPending.value"
            @click="confirmDelete"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
