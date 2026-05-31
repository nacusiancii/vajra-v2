<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import {
  Banknote,
  Boxes,
  CircleDollarSign,
  HandCoins,
  Package,
  ReceiptText,
  RefreshCcw,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTransactionsQuery } from '@/queries/transactions'
import { formatRupees } from '@/lib/format'
import { TXN_TYPE_LABELS, type Txn } from '@domain/transaction'

const { data: transactions } = useTransactionsQuery()
const recent = computed(() => (transactions.value ?? []).slice(0, 5))

function counterparty(t: Txn): string {
  return t.customerName ?? t.walkinName ?? t.label ?? '—'
}

interface ManagementLink {
  label: string
  route: string
  icon: typeof Users
  description: string
}

const managementLinks: ManagementLink[] = [
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
          Quick access to counter flows. Pick an action to begin a new transaction.
        </p>
      </div>

      <div class="flex flex-wrap gap-3" data-testid="primary-actions">
        <Button as-child size="lg">
          <RouterLink to="/sale">
            <ShoppingCart class="size-4" />
            New Sale
          </RouterLink>
        </Button>
        <Button as-child variant="secondary" size="lg">
          <RouterLink to="/purchase">
            <Truck class="size-4" />
            New Purchase
          </RouterLink>
        </Button>
      </div>
    </section>

    <!-- Secondary money/stock actions -->
    <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid="secondary-actions">
      <Button as-child variant="outline" class="justify-start gap-2">
        <RouterLink to="/receipt">
          <HandCoins class="size-4" />
          Receipt
        </RouterLink>
      </Button>
      <Button as-child variant="outline" class="justify-start gap-2">
        <RouterLink to="/payment">
          <Wallet class="size-4" />
          Payment
        </RouterLink>
      </Button>
      <Button as-child variant="outline" class="justify-start gap-2">
        <RouterLink to="/expense">
          <CircleDollarSign class="size-4" />
          Expense
        </RouterLink>
      </Button>
      <Button as-child variant="outline" class="justify-start gap-2">
        <RouterLink to="/income">
          <Banknote class="size-4" />
          Income
        </RouterLink>
      </Button>
      <Button as-child variant="outline" class="justify-start gap-2">
        <RouterLink to="/stock-transfer">
          <RefreshCcw class="size-4" />
          Stock Transfer
        </RouterLink>
      </Button>
    </section>

    <!-- Recent Transactions -->
    <Card data-testid="recent-transactions">
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>
          The latest entries in the current Business Day.
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
            class="flex items-center justify-between py-2 text-sm"
            :class="t.voided ? 'text-muted-foreground line-through' : ''"
          >
            <span class="flex items-center gap-2">
              <span class="tabular-nums text-muted-foreground">#{{ t.seq }}</span>
              <span class="font-medium">{{ TXN_TYPE_LABELS[t.type] }}</span>
              <Badge v-if="t.saleMode === 'credit'" variant="outline" class="text-xs">credit</Badge>
              <span class="text-muted-foreground">{{ counterparty(t) }}</span>
            </span>
            <span class="tabular-nums">{{ formatRupees(t.total) }}</span>
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
      </div>
    </section>
  </div>
</template>
