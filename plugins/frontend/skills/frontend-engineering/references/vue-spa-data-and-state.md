# Data and state in an SPA

Data from an API goes in a query layer (TanStack Vue Query, or one fetch composable).

## Query keys

Put key construction in one factory rather than writing array literals at call sites.
Hand-written keys drift, and a drifted key is a cache miss that looks like a slow page.

```ts
export const invoiceKeys = {
  all: (tenant: string) => ['tenant', tenant, 'invoices'] as const,
  page: (tenant: string, page: number) => [...invoiceKeys.all(tenant), page] as const,
}
```

## Reactive inputs

A query whose input is a plain value is evaluated once and never refetches. Pass a
getter or a computed so the query re-runs when the input changes:

```ts
const { data } = useQuery(computed(() => invoiceQuery(tenantId.value, page.value)))
```
