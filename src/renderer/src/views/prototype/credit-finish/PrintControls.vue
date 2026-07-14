<script setup lang="ts">
/**
 * PROTOTYPE ONLY — #78 print affordances for Credit Sale finish.
 * Business copy always on; customer copy deselectable (default on);
 * Credit Voucher locked will-print (not a free toggle-off).
 */
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Lock, Printer } from '@lucide/vue'

const printCustomerCopy = defineModel<boolean>('printCustomerCopy', { default: true })
</script>

<template>
  <div
    class="space-y-2 rounded-md border bg-muted/40 p-3 text-sm"
    data-testid="prototype-print-controls"
  >
    <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Print queue</p>

    <div class="flex items-start gap-2">
      <Checkbox
        id="proto-business-copy"
        :model-value="true"
        disabled
        data-testid="prototype-business-copy"
      />
      <div class="grid gap-0.5">
        <Label for="proto-business-copy" class="text-muted-foreground">
          Sale Invoice — business copy
          <Lock class="ml-1 inline size-3 opacity-70" />
        </Label>
        <p class="text-xs text-muted-foreground">Always prints (not deselectable)</p>
      </div>
    </div>

    <div class="flex items-start gap-2">
      <Checkbox
        id="proto-customer-copy"
        :model-value="printCustomerCopy"
        data-testid="prototype-customer-copy"
        @update:model-value="(v) => (printCustomerCopy = v === true)"
      />
      <div class="grid gap-0.5">
        <Label for="proto-customer-copy">Sale Invoice — customer copy</Label>
        <p class="text-xs text-muted-foreground">Default on — cashier may uncheck</p>
      </div>
    </div>

    <div
      class="flex items-center justify-between gap-2 rounded-md border border-amber-300/70 bg-amber-50/80 px-2.5 py-2 dark:bg-amber-950/50"
      data-testid="prototype-voucher-will-print"
    >
      <div class="flex items-center gap-2">
        <Printer class="size-4 text-amber-700 dark:text-amber-300" />
        <div>
          <p class="font-medium">Credit Voucher</p>
          <p class="text-xs text-muted-foreground">Will print — not deselectable</p>
        </div>
      </div>
      <Badge variant="secondary" class="gap-1">
        <Lock class="size-3" />
        locked
      </Badge>
    </div>
  </div>
</template>
