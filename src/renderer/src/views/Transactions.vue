<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Pencil } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { useTransactionsQuery } from '@/queries/transactions'
import { formatRupees } from '@/lib/format'
import { txnCounterparty, txnEditPath } from '@/lib/txn-edit'
import { displayTxnSerial, summariseDrawer, TXN_TYPE_LABELS, type Txn } from '@domain/transaction'

const router = useRouter()
const { data: transactions, isLoading } = useTransactionsQuery()

const txns = computed(() => transactions.value ?? [])
const drawer = computed(() => summariseDrawer(txns.value))

/** Net cash + UPI a transaction moved through the drawer (signed). */
function drawerImpact(t: Txn): number {
  return t.cashIn + t.upiIn - t.cashOut - t.upiOut
}

function edit(t: Txn): void {
  void router.push(txnEditPath(t))
}
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8"
    data-testid="transactions-page"
  >
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Transactions</h1>
      <p class="text-sm text-muted-foreground">Current Business Day ledger</p>
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

    <!-- Ledger -->
    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[60px]">No.</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Counterparty</TableHead>
            <TableHead class="text-right">Total</TableHead>
            <TableHead class="text-right">Drawer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead class="w-[80px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="isLoading">
            <TableCell :colspan="7" class="py-8 text-center text-muted-foreground"
              >Loading...</TableCell
            >
          </TableRow>
          <TableRow v-else-if="txns.length === 0">
            <TableCell :colspan="7" class="py-8 text-center text-muted-foreground">
              No transactions yet today.
            </TableCell>
          </TableRow>
          <TableRow
            v-for="t in txns"
            :key="t.id"
            data-testid="txn-row"
            :class="t.voided ? 'text-muted-foreground line-through' : ''"
          >
            <TableCell class="tabular-nums" data-testid="txn-serial">{{
              displayTxnSerial(t)
            }}</TableCell>
            <TableCell>
              {{ TXN_TYPE_LABELS[t.type] }}
              <Badge v-if="t.saleMode === 'credit'" variant="outline" class="ml-1 text-xs"
                >credit</Badge
              >
            </TableCell>
            <TableCell>{{ txnCounterparty(t) }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ formatRupees(t.total) }}</TableCell>
            <TableCell class="text-right tabular-nums">{{
              formatRupees(drawerImpact(t))
            }}</TableCell>
            <TableCell>
              <Badge v-if="t.voided" variant="secondary">voided → {{ t.successorId }}</Badge>
              <Badge v-else variant="outline" class="text-green-600">live</Badge>
            </TableCell>
            <TableCell class="text-right">
              <Button
                v-if="!t.voided"
                variant="ghost"
                size="icon"
                data-testid="txn-edit"
                @click="edit(t)"
              >
                <Pencil class="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
