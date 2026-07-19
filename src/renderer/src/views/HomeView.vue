<script setup lang="ts">
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { RouterLink, useRouter } from 'vue-router'
import {
  Banknote,
  Boxes,
  CircleDollarSign,
  ClipboardSignature,
  Download,
  FileSignature,
  HandCoins,
  type LucideIcon,
  Package,
  Pencil,
  ReceiptText,
  RefreshCcw,
  Settings,
  ShoppingCart,
  Trash2,
  Truck,
  Users,
  Wallet
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useClearDraft, useDraftsQuery, useTransactionsQuery } from '@/queries/transactions'
import { useBusinessDayQuery, useInventoryQuery } from '@/queries/operations'
import { exportEodReport } from '@/lib/eod-report'
import { formatRupees } from '@/lib/format'
import { showToast } from '@/lib/toast'
import { txnCounterparty, txnEditPath } from '@/lib/txn-edit'
import { displayTxnSerial, TXN_TYPE_LABELS, type Txn } from '@domain/transaction'
import type { Draft } from '@domain/draft'

const router = useRouter()
const queryClient = useQueryClient()
const { data: transactions } = useTransactionsQuery()
const { data: day } = useBusinessDayQuery()
const { data: inventory } = useInventoryQuery()
/** Sale + Purchase Drafts share one pool; list both on Home (ADR-0010). */
const { data: allDrafts } = useDraftsQuery()
const clearDraft = useClearDraft()
/** Live tips only — voided predecessors stay on the full ledger, not Recent. */
const recent = computed(() => (transactions.value ?? []).filter((t) => !t.voided).slice(0, 5))
const drafts = computed(() => allDrafts.value ?? [])

const exporting = ref(false)

/** Same path as Rollover Export Report — silent folder + toast (ADR-0006). */
async function exportDayReport(): Promise<void> {
  if (!day.value || exporting.value) return
  exporting.value = true
  try {
    const result = await exportEodReport(day.value, transactions.value ?? [], inventory.value ?? [])
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

function draftTypeLabel(d: Draft): string {
  return d.type === 'PU' ? 'Purchase' : 'Sale'
}

function draftModeLabel(d: Draft): string {
  return d.payload.mode === 'credit' ? 'Credit' : 'Cash'
}

function resumeDraft(d: Draft): void {
  // Resume replaces any open cart — no auto-save, no conflict dialog (ADR-0010).
  const path = d.type === 'PU' ? '/purchase' : '/sale'
  void router.push({ path, query: { draft: String(d.id) } })
}

function clearHomeDraft(d: Draft): void {
  clearDraft.mutate(d.id)
}

function editTransaction(t: Txn): void {
  // Recent only lists live tips; Edit is always available on those rows.
  void router.push(txnEditPath(t))
}

interface HomeLink {
  label: string
  route: string
  icon: LucideIcon
  description?: string
}

/** First-screen entry points — mode is pre-chosen; cart toggle remains available. */
const primaryEntryPoints: (HomeLink & {
  testId: string
  variant: 'default' | 'secondary' | 'outline'
})[] = [
  {
    label: 'Cash Sale',
    route: '/sale?mode=cash',
    icon: ShoppingCart,
    testId: 'open-cash-sale',
    variant: 'default'
  },
  {
    label: 'Credit Sale',
    route: '/sale?mode=credit',
    icon: FileSignature,
    testId: 'open-credit-sale',
    variant: 'secondary'
  },
  {
    label: 'Cash Purchase',
    route: '/purchase?mode=cash',
    icon: Truck,
    testId: 'open-cash-purchase',
    variant: 'outline'
  },
  {
    label: 'Credit Purchase',
    route: '/purchase?mode=credit',
    icon: ClipboardSignature,
    testId: 'open-credit-purchase',
    variant: 'outline'
  }
]

const secondaryTransactionLinks: HomeLink[] = [
  {
    label: 'Receipt',
    route: '/receipt',
    icon: HandCoins
  },
  {
    label: 'Payment',
    route: '/payment',
    icon: Wallet
  },
  {
    label: 'Expense',
    route: '/expense',
    icon: CircleDollarSign
  },
  {
    label: 'Income',
    route: '/income',
    icon: Banknote
  },
  {
    label: 'Stock Transfer',
    route: '/stock-transfer',
    icon: RefreshCcw
  }
]

const managementLinks: HomeLink[] = [
  {
    label: 'Product Master',
    route: '/product-master',
    icon: Package,
    description: 'Products, groups, bag types, and rates.'
  },
  {
    label: 'Customer Master',
    route: '/customer-master',
    icon: Users,
    description: 'Customer names, places, and Telugu translations.'
  },
  {
    label: 'Transactions',
    route: '/transactions',
    icon: ReceiptText,
    description: 'Current Business Day transaction ledger.'
  },
  {
    label: 'Inventory',
    route: '/inventory',
    icon: Boxes,
    description: 'Live stock position computed from transactions.'
  },
  {
    label: 'Settings',
    route: '/settings',
    icon: Settings,
    description: 'Loading charges, bag types, and app config.'
  },
  {
    label: 'Rollover',
    route: '/rollover',
    icon: RefreshCcw,
    description: 'Close the Business Day, export End of Day Report.'
  }
]
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8" data-testid="home-page">
    <!-- Hero: primary counter actions -->
    <section
      class="flex flex-col gap-4 rounded-3xl border bg-card p-8 shadow-sm md:flex-row md:items-center md:justify-between"
      data-testid="home-hero"
    >
      <div class="max-w-2xl space-y-3">
        <p class="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Project Vajra
        </p>
        <h1 class="text-4xl font-semibold tracking-tight md:text-5xl">
          Daily shop operations, starting with sales.
        </h1>
        <p class="text-lg text-muted-foreground">
          Pick Cash or Credit for a Sale or Purchase — the cart opens with that mode already set.
        </p>
      </div>

      <div class="grid w-full max-w-md grid-cols-2 gap-3" data-testid="primary-actions">
        <Button
          v-for="entry in primaryEntryPoints"
          :key="entry.testId"
          as-child
          size="lg"
          :variant="entry.variant"
          class="justify-start"
        >
          <RouterLink :to="entry.route" :data-testid="entry.testId">
            <component :is="entry.icon" class="size-4" />
            {{ entry.label }}
          </RouterLink>
        </Button>
      </div>
    </section>

    <!-- Secondary money/stock actions -->
    <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="secondary-actions">
      <Button
        v-for="link in secondaryTransactionLinks"
        :key="link.route"
        as-child
        variant="outline"
        class="justify-start gap-2"
      >
        <RouterLink :to="link.route">
          <component :is="link.icon" class="size-4" />
          {{ link.label }}
        </RouterLink>
      </Button>
    </section>

    <!-- Drafts (parked Sale + Purchase carts — outside the ledger) -->
    <Card v-if="drafts.length > 0" data-testid="home-drafts">
      <CardHeader>
        <CardTitle>Drafts</CardTitle>
      </CardHeader>
      <CardContent>
        <ul class="space-y-2">
          <li
            v-for="d in drafts"
            :key="d.id"
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3"
            :data-testid="d.type === 'PU' ? `purchase-draft-row-${d.id}` : `sale-draft-row-${d.id}`"
          >
            <div class="min-w-0 flex-1 space-y-0.5">
              <p class="truncate font-semibold" data-testid="draft-counterparty">
                {{ d.counterpartyLabel }}
              </p>
              <p
                v-if="d.counterpartyLabelTe"
                class="truncate text-sm text-muted-foreground"
                lang="te"
                data-testid="draft-counterparty-te"
              >
                {{ d.counterpartyLabelTe }}
              </p>
              <p class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span data-testid="draft-type">{{ draftTypeLabel(d) }}</span>
                <Badge variant="outline" class="text-xs font-normal">
                  {{ draftModeLabel(d) }}
                </Badge>
                <span>
                  {{ d.payload.lines.filter((l) => l.productId != null).length }} line(s)
                </span>
              </p>
            </div>
            <span class="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                type="button"
                :data-testid="`draft-resume-${d.id}`"
                @click="resumeDraft(d)"
              >
                Resume
              </Button>
              <Button
                size="sm"
                variant="outline"
                type="button"
                :data-testid="`draft-clear-${d.id}`"
                :disabled="clearDraft.isPending.value"
                @click="clearHomeDraft(d)"
              >
                <Trash2 class="size-4" />
                Clear
              </Button>
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>

    <!-- Recent Transactions -->
    <Card data-testid="recent-transactions">
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>
          The latest non-voided entries in the current Business Day.
          <RouterLink to="/transactions" class="underline hover:text-foreground">
            See all →
          </RouterLink>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          v-if="recent.length === 0"
          class="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground"
        >
          No transactions yet today.
        </div>
        <ul v-else class="divide-y">
          <li
            v-for="t in recent"
            :key="t.id"
            class="flex items-center justify-between gap-3 py-2 text-sm"
            data-testid="home-txn-row"
          >
            <span class="flex min-w-0 flex-1 items-center gap-2">
              <span class="tabular-nums text-muted-foreground">#{{ displayTxnSerial(t) }}</span>
              <span class="font-medium">{{ TXN_TYPE_LABELS[t.type] }}</span>
              <Badge v-if="t.saleMode === 'credit'" variant="outline" class="text-xs">credit</Badge>
              <span class="truncate text-muted-foreground">{{ txnCounterparty(t) }}</span>
            </span>
            <span class="flex shrink-0 items-center gap-2">
              <span class="tabular-nums">{{ formatRupees(t.total) }}</span>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                data-testid="txn-edit"
                :aria-label="`Edit ${TXN_TYPE_LABELS[t.type]} #${displayTxnSerial(t)}`"
                @click="editTransaction(t)"
              >
                <Pencil class="size-4" />
              </Button>
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>

    <!-- Shopkeeper / management section -->
    <section data-testid="management-links">
      <div class="mb-4 space-y-1">
        <h2 class="text-xl font-semibold">Masters &amp; Records</h2>
        <p class="text-sm text-muted-foreground">
          Product catalog, customer data, inventory, settings, and end-of-day rollover.
        </p>
      </div>

      <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <RouterLink
          v-for="link in managementLinks"
          :key="link.route"
          :to="link.route"
          class="group flex items-start gap-4 rounded-xl border bg-card p-4 transition hover:border-foreground/20 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground transition group-hover:text-foreground"
          >
            <component :is="link.icon" class="size-5" />
          </span>
          <div class="min-w-0 flex-1">
            <h3 class="font-semibold">{{ link.label }}</h3>
            <p class="mt-0.5 text-sm text-muted-foreground">{{ link.description }}</p>
          </div>
        </RouterLink>

        <!-- Export only — Approve Rollover stays on the Rollover screen. -->
        <button
          type="button"
          data-testid="home-eod-export"
          class="group flex items-start gap-4 rounded-xl border bg-card p-4 text-left transition hover:border-foreground/20 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          :disabled="exporting"
          @click="exportDayReport"
        >
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground transition group-hover:text-foreground"
          >
            <Download class="size-5" />
          </span>
          <div class="min-w-0 flex-1">
            <h3 class="font-semibold">Export Day Report</h3>
            <p class="mt-0.5 text-sm text-muted-foreground">
              Export the End of Day Report for the current Business Day.
            </p>
          </div>
        </button>
      </div>
    </section>
  </div>
</template>
