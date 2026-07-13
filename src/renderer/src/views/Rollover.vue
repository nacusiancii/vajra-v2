<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Download, RefreshCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
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
import { useInventoryQuery, useBusinessDayQuery, useApproveRollover } from '@/queries/operations'
import { downloadEodReport } from '@/lib/eod-report'
import { formatRupees, formatStockQty } from '@/lib/format'
import { summariseDrawer } from '@domain/transaction'

const router = useRouter()
const { data: day } = useBusinessDayQuery()
const { data: transactions } = useTransactionsQuery()
const { data: inventory } = useInventoryQuery()
const approveRollover = useApproveRollover()

const confirmOpen = ref(false)

const txns = computed(() => transactions.value ?? [])
const inv = computed(() => inventory.value ?? [])
const drawer = computed(() => summariseDrawer(txns.value))

function exportReport(): void {
  if (day.value) downloadEodReport(day.value, txns.value, inv.value)
}

function approve(): void {
  approveRollover.mutate(undefined, {
    onSuccess: () => {
      confirmOpen.value = false
      void router.push('/')
    }
  })
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8" data-testid="rollover-page">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <RefreshCcw class="size-6" />
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Rollover</h1>
          <p class="text-sm text-muted-foreground">
            Business Day {{ day?.startDate }} — review the report, then approve to start the next
            day.
          </p>
        </div>
      </div>
      <Button variant="outline" data-testid="eod-export" @click="exportReport">
        <Download class="mr-2 size-4" /> Export Report
      </Button>
    </div>

    <!-- Drawer summary -->
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

    <!-- Closing stock preview -->
    <div>
      <h2 class="mb-2 font-semibold">Closing stock → next day's Opening Stock</h2>
      <div class="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead class="text-right">Opening</TableHead>
              <TableHead class="text-right">Closing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="inv.length === 0">
              <TableCell :colspan="3" class="py-6 text-center text-muted-foreground">
                No products in the catalog.
              </TableCell>
            </TableRow>
            <TableRow v-for="row in inv" :key="row.productId">
              <TableCell>{{ row.productName }}</TableCell>
              <TableCell class="text-right tabular-nums">{{
                formatStockQty(row.opening, row.defaultBagSizeG)
              }}</TableCell>
              <TableCell class="text-right font-semibold tabular-nums">
                {{ formatStockQty(Math.max(0, row.closing), row.defaultBagSizeG) }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>

    <div class="flex items-center justify-between border-t pt-4">
      <p class="max-w-xl text-sm text-muted-foreground">
        Approving wipes this day's transactions and opens the next Business Day with the closing
        stock above as its Opening Stock. Export the report first if you need it.
      </p>
      <Button size="lg" data-testid="rollover-approve-open" @click="confirmOpen = true">
        Approve Rollover
      </Button>
    </div>

    <Dialog :open="confirmOpen" @update:open="(v) => (confirmOpen = v)">
      <DialogContent data-testid="rollover-confirm">
        <DialogHeader>
          <DialogTitle>Approve Rollover?</DialogTitle>
          <DialogDescription>
            This finalises Business Day {{ day?.startDate }}. All {{ txns.length }} transaction(s)
            will be wiped and a new Business Day will open. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="confirmOpen = false">Cancel</Button>
          <Button data-testid="rollover-approve-confirm" @click="approve">
            Approve &amp; Start Next Day
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
