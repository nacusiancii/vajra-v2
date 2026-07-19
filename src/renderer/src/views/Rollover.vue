<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { Download, RefreshCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useDraftsQuery, useTransactionsQuery } from '@/queries/transactions'
import {
  useInventoryQuery,
  useBusinessDayQuery,
  useApproveRollover,
  useUpdateOpenBusinessDayStartDate
} from '@/queries/operations'
import { exportEodReport } from '@/lib/eod-report'
import { showToast } from '@/lib/toast'
import { formatRupees, formatStockQty } from '@/lib/format'
import { userFacingError } from '@/lib/utils'
import { canApproveRollover, summariseDrawer } from '@domain/transaction'
import {
  localToday,
  minNextBusinessDayStartDate,
  preselectNextBusinessDayStartDate,
  validateNextBusinessDayStartDate
} from '@domain/business-day'

const router = useRouter()
const queryClient = useQueryClient()
const { data: day } = useBusinessDayQuery()
const { data: transactions } = useTransactionsQuery()
const { data: inventory } = useInventoryQuery()
const { data: drafts } = useDraftsQuery()
const approveRollover = useApproveRollover()
const updateOpenStartDate = useUpdateOpenBusinessDayStartDate()

const confirmOpen = ref(false)
const exporting = ref(false)
const nextStartDate = ref('')
const editStartDate = ref('')
const editDateError = ref<string | null>(null)
const editDateSaved = ref(false)

const today = localToday()

const txns = computed(() => transactions.value ?? [])
const inv = computed(() => inventory.value ?? [])
const draftList = computed(() => drafts.value ?? [])
const drawer = computed(() => summariseDrawer(txns.value))

const exportFresh = computed(() => (day.value ? canApproveRollover(day.value) : false))

const dateMin = computed(() =>
  day.value ? minNextBusinessDayStartDate(day.value.startDate, today) : today
)

const dateValidation = computed(() => {
  if (!day.value || !nextStartDate.value) {
    return { ok: false as const, reason: 'Choose the next Business Day date.' }
  }
  return validateNextBusinessDayStartDate(nextStartDate.value, day.value.startDate, today)
})

const canApprove = computed(
  () => exportFresh.value && dateValidation.value.ok && !approveRollover.isPending.value
)

/** Edit startDate only when the open day has no finished transactions. */
const canEditStartDate = computed(() => txns.value.length === 0)
const hasDraftsBlockingDate = computed(() => draftList.value.length > 0)

// Preselect when the open Business Day loads (or changes after a prior rollover).
watch(
  () => day.value?.startDate,
  (startDate) => {
    if (!startDate) return
    nextStartDate.value = preselectNextBusinessDayStartDate(startDate, today)
    editStartDate.value = startDate
  },
  { immediate: true }
)

async function exportReport(): Promise<void> {
  if (!day.value || exporting.value) return
  exporting.value = true
  try {
    const result = await exportEodReport(day.value, txns.value, inv.value)
    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: ['businessDay'] })
      const parts = result.path.split(/[/\\]/).filter(Boolean)
      const label =
        parts.length >= 2 ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}` : result.path
      showToast(`Exported to ${label}`, 'success')
    } else {
      showToast(result.error || 'Export failed', 'error')
    }
  } finally {
    exporting.value = false
  }
}

function saveStartDate(): void {
  editDateError.value = null
  editDateSaved.value = false
  if (hasDraftsBlockingDate.value) {
    editDateError.value = 'Clear Drafts before changing the Business Day date'
    return
  }
  updateOpenStartDate.mutate(editStartDate.value, {
    onSuccess: () => {
      editDateSaved.value = true
    },
    onError: (err) => {
      editDateError.value = userFacingError(err, 'Could not update Business Day date')
    }
  })
}

function approve(): void {
  if (!canApprove.value) return
  approveRollover.mutate(nextStartDate.value, {
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
      <Button
        variant="outline"
        data-testid="eod-export"
        :disabled="exporting"
        @click="exportReport"
      >
        <Download class="mr-2 size-4" /> Export Report (Excel)
      </Button>
    </div>

    <!-- Export-gate notice when Approve is blocked -->
    <div
      v-if="!exportFresh"
      class="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
      data-testid="rollover-export-gate-info"
      role="status"
    >
      <p class="font-medium">Export Report before approving</p>
      <p class="mt-1 text-amber-900/90 dark:text-amber-100/90">
        Approve Rollover is available only after a successful Export Report that includes the latest
        finished transactions. If you record more sales or other ledger work, export again — you may
        repeat Export Report as often as needed until you are satisfied.
      </p>
    </div>

    <!-- Empty-day startDate edit: only when no finished transactions -->
    <div
      v-if="canEditStartDate"
      class="flex flex-col gap-2 rounded-md border p-4"
      data-testid="edit-bizday-date-section"
    >
      <Label for="edit-bizday-date" class="text-sm font-medium">Business Day date</Label>
      <p class="text-xs text-muted-foreground">
        No finished transactions yet — you can correct this Business Day's start date. Must be today
        or later, and after the previous closed day when one exists.
      </p>
      <p
        v-if="hasDraftsBlockingDate"
        class="text-sm text-amber-700"
        data-testid="edit-bizday-drafts-hint"
      >
        Clear Drafts first before changing the date.
      </p>
      <div class="flex flex-wrap items-end gap-2">
        <Input
          id="edit-bizday-date"
          v-model="editStartDate"
          type="date"
          class="w-44"
          data-testid="edit-bizday-date-input"
          :disabled="hasDraftsBlockingDate || updateOpenStartDate.isPending.value"
        />
        <Button
          type="button"
          data-testid="edit-bizday-date-save"
          :disabled="
            hasDraftsBlockingDate ||
            updateOpenStartDate.isPending.value ||
            !editStartDate ||
            editStartDate === day?.startDate
          "
          @click="saveStartDate"
        >
          Save date
        </Button>
        <span
          v-if="editDateSaved"
          class="text-sm text-green-600"
          data-testid="edit-bizday-date-saved"
        >
          Saved
        </span>
      </div>
      <p v-if="editDateError" class="text-sm text-destructive" data-testid="edit-bizday-date-error">
        {{ editDateError }}
      </p>
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

    <div class="flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="flex flex-col gap-3">
        <p class="max-w-xl text-sm text-muted-foreground">
          Approving wipes this day's transactions and opens the next Business Day with the closing
          stock above as its Opening Stock. A fresh Export Report is required first (including empty
          days) so the day book file always exists.
        </p>
        <div class="flex max-w-xs flex-col gap-1.5">
          <Label for="next-business-day">Next Business Day</Label>
          <Input
            id="next-business-day"
            v-model="nextStartDate"
            type="date"
            :min="dateMin"
            data-testid="rollover-next-start-date"
            class="w-full"
          />
          <p
            v-if="nextStartDate && !dateValidation.ok"
            class="text-sm text-destructive"
            data-testid="rollover-next-date-error"
          >
            {{ dateValidation.reason }}
          </p>
        </div>
      </div>
      <Button
        size="lg"
        data-testid="rollover-approve-open"
        :disabled="!canApprove"
        @click="confirmOpen = true"
      >
        Approve Rollover
      </Button>
    </div>

    <Dialog :open="confirmOpen" @update:open="(v) => (confirmOpen = v)">
      <DialogContent data-testid="rollover-confirm">
        <DialogHeader>
          <DialogTitle>Approve Rollover?</DialogTitle>
          <DialogDescription>
            This finalises Business Day {{ day?.startDate }}. All {{ txns.length }} transaction(s)
            will be wiped and a new Business Day will open on
            <span class="font-medium tabular-nums" data-testid="rollover-confirm-next-date">{{
              nextStartDate
            }}</span
            >. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="confirmOpen = false">Cancel</Button>
          <Button data-testid="rollover-approve-confirm" :disabled="!canApprove" @click="approve">
            Approve &amp; Start Next Day
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
