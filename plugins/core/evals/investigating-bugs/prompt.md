Users of our warehouse dashboard report that the "items awaiting pickup" count on the
home screen shows 0, even though the pickup list right below it has rows in it. It
affects a minority of accounts, it is consistent for those accounts — reloading does not
fix it — and it never happens on my own account.

This is the tile that renders the count:

```vue
<script setup lang="ts">
const { data: summary } = await useApi<Summary>('/dashboard/summary')
</script>

<template>
  <StatTile label="Awaiting pickup" :value="summary?.pickupCount ?? 0" />
</template>
```

Fix it.
