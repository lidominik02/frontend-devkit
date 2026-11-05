# Forms

## Contents
- A form is a request the server can refuse
- One submit at a time, and the status always comes back
- Touched, per field
- Server errors belong to their field
- A message clears when the value it judged changes
- Verify the refusal paths

## A form is a request the server can refuse

A form is not a set of inputs with a button under it. It is a request in flight with a
status, and the server is allowed to say no — to the whole request, or to one field.
Model that state explicitly, and most form bugs have nowhere to live.

| State | Holds |
| --- | --- |
| `values` | what the user typed, one `ref` for the form |
| `status` | `'idle' \| 'submitting' \| 'succeeded' \| 'failed'` |
| `touched` | per field, whether the user has left it at least once |
| `fieldErrors` | per field, the message to show next to that field |
| `formError` | the one message that belongs to no field |

If the repo already uses a form library, these live in it under its own names; read how
the neighbouring forms use it before adding a parallel set of refs. Validate `values`
with the schema library the repo already uses, as with any input from outside.

## One submit at a time, and the status always comes back

Disabling the button is not a lock. Enter in a text field submits the form, and a
double-click lands before the re-render that disables anything. The lock is the status,
checked in the handler:

```ts
async function submit() {
  for (const key in values.value) touched.value[key as keyof Values] = true
  if (status.value === 'submitting') return
  status.value = 'submitting'
  formError.value = null
  fieldErrors.value = {}
  try {
    await save(values.value)          // must throw on a non-2xx response
    status.value = 'succeeded'
  } catch (e) {
    if (isValidationError(e)) applyServerErrors(e.fieldErrors)
    else formError.value = messageFor(e)
    status.value = 'failed'
  }
}
```

Every way out of the request leaves `submitting`: success, a validation rejection
(usually 422), any other error status, and a network failure that never got a response.
A branch that forgets to set the status leaves the form locked on "Saving…" with no way
out but a reload. `fetch` resolves on a 4xx or 5xx, so a client that does not check
`response.ok` turns a rejection into the success branch; make the call throw, or branch
on the status, before trusting `then`.

Bind the button's disabled state and its label to `status`, never to a second
`isLoading` flag that can disagree with it.

## Touched, per field

Showing "required" on every field the moment the form opens tells the user they have
already done something wrong. Mark a field touched on its first `blur`, and show its
client-side message only once it is touched. A submit attempt marks every field
touched, so a user who skips straight to the button still sees what is missing.

Keep touched per field. One form-wide flag either shows every message after the first
blur or none until submit.

## Server errors belong to their field

A validation rejection names fields; put each message next to the field it names. A
banner reading "Validation failed" makes the user hunt for the problem the server
already located. Map the response's field keys to the form's field names in one place;
a message for a field the form does not render goes to `formError`, never dropped:

```ts
function applyServerErrors(errors: Record<string, string>) {
  for (const [key, message] of Object.entries(errors)) {
    if (key in values.value) fieldErrors.value[key as keyof Values] = message
    else formError.value = [formError.value, message].filter(Boolean).join(' ')
  }
}
```

Link the message to its input with `aria-describedby` and set `aria-invalid` on the
input, so a screen reader announces both. After a failed submit, move focus to the
first field with an error.

## A message clears when the value it judged changes

A field's message is a verdict on one value. Once the user edits that value, the
verdict is about something no longer in the field. Leaving it in place tells the user
the field is still wrong after they fixed it, and they keep editing a correct value or
give up.

- **A server message** clears on the first edit of its field. The server cannot
  re-check without a submit, so the form must not keep claiming it did.
- **A client message** re-runs on blur, and on each edit once it is showing, so it
  disappears the moment the value becomes valid.

Clear only the edited field's server message. The others still describe values the
user has not touched, and are still true.

```ts
function onInput(field: keyof Values) {   // bound to each field's @input
  if (fieldErrors.value[field]) delete fieldErrors.value[field]
}
```

## Verify the refusal paths

The success path is the one everybody clicks. Force each other branch at least once —
a validation rejection, a 500, the network offline — and confirm the form unlocks, the
message lands on the right field, and editing that field clears it.
