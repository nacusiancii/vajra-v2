<script setup lang="ts">
import { computed } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  open: boolean
  kind: 'product' | 'customer'
  name: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

const title = computed(() => (props.kind === 'product' ? 'Delete Product?' : 'Delete Customer?'))

const description = computed(() => {
  const master = props.kind === 'product' ? 'Product Master' : 'Customer Master'
  return `Delete “${props.name}” from the ${master}?`
})

function close(): void {
  emit('update:open', false)
}

function confirm(): void {
  emit('confirm')
  close()
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent data-testid="master-delete-dialog">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button type="button" variant="outline" @click="close">Cancel</Button>
        <Button
          type="button"
          variant="destructive"
          data-testid="master-delete-confirm"
          @click="confirm"
        >
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
