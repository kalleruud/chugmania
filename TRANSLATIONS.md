# Translation System Documentation

## Overview

Chugmania uses a centralized translation system for all user-facing strings. All text is organized in a single Norwegian locale file (`common/locales/no.ts`) with corresponding utility functions for both frontend and backend.

## File Structure

```
common/locales/
├── no.ts                    # Norwegian (Norsk) translation strings
├── translateServer.ts       # Backend translation utility function
└── index.ts                # Exports for frontend (if needed)

frontend/locales/
├── no.ts                    # Frontend re-export of strings with frontend-specific grouping
├── useTranslation.ts        # Frontend translation React hook
└── index.ts                # Frontend exports
```

## Adding New Strings

### 1. Add String to Translation File

First, add your new string to the appropriate group in `common/locales/no.ts`:

```typescript
export const noLocale = {
  messages: {
    error: {
      // Add new error here
      myNewError: 'Min nye feil',
    },
  },
}
```

### 2. Using in Frontend Components

Import and use the `useTranslation` hook:

```typescript
import { useTranslation } from '../../locales/useTranslation'

export default function MyComponent() {
  const { t } = useTranslation()

  return <div>{t('messages.error.myNewError')}</div>
}
```

**With parameters:**

```typescript
const message = t('messages.error.myNewError', { userId: 123 })
```

### 3. Using in Backend Managers

Import and use the `t` function directly:

```typescript
import { t } from '../../../common/locales/translateServer'

export function myManager() {
  const errorMessage = t('messages.error.myNewError')
  const userMessage = t('messages.error.myNewError', { userId: 123 })
}
```

## String Organization

Strings are organized by category and feature for maintainability. The system uses template parameters to reduce duplication:

```typescript
export const noLocale = {
  common: {
    // Generic buttons and actions used across the app
    loading: 'Laster inn…',
    save: 'Lagre',
  },

  messages: {
    error: {
      // Generic error messages
    },
    validation: {
      // Validation messages with template support for fields
      required: '{{field}} er påkrevd',
      invalid: '{{field}} er ugyldig',
      tooShort: '{{field}} må være minst {{min}} tegn',
      notSelected: '{{item}} ikke valgt',
      alreadyHappened: '{{action}} etter at sesjonen har funnet sted',
    },
    success: {
      // Success messages - uses generic template where possible
      generic: '{{action}} fullført',
      imported: 'Importerte {{imported}}/{{total}} {{table}} med suksess',
    },
    info: {
      // Informational messages
    },
    auth: {
      // Authentication-related messages
      roleNotAllowed: 'Rollen din {{role}} tillater ikke denne handlingen',
    },
    admin: {
      // Admin panel messages
    },
    track: {
      // Track-related messages
    },
    timeEntry: {
      // Time entry messages
      roleNotAllowed:
        'Rollen din {{role}} tillater ikke å poste rundetider for andre',
    },
    session: {
      // Session messages
      failedToProcess: 'Klarte ikke å {{action}} sesjon.',
    },
  },
}
```

## Template Parameters

The system uses template parameters to reduce string duplication:

- **{{field}}** - Used in validation messages (e.g., "E-post", "Passord")
- **{{item}}** - Used for items not selected (e.g., "Sjåfør", "Bane")
- **{{action}}** - Used for operations (e.g., "Opprett", "Oppdater", "Slett")
- **{{role}}** - Used for permission-related messages
- **{{min}}** - Used for length constraints
- **{{imported}}, {{total}}, {{table}}** - Used for import statistics

## Translation Function Reference

### Frontend: `useTranslation()`

```typescript
import { useTranslation } from '../../locales/useTranslation'

const { t } = useTranslation()

// Simple translation
t('messages.error.notFound')

// With parameters
t('messages.success.importedSuccessfully', {
  imported: 100,
  total: 150,
  table: 'users',
})
```

Parameters are replaced using the `{{paramName}}` syntax in strings:

```typescript
// In translation file:
importedSuccessfully: 'Importerte {{imported}}/{{total}} {{table}} med suksess'

// In component:
t('messages.admin.importedSuccessfully', {
  imported: data.imported,
  total: data.total,
  table: request.table,
})
```

### Backend: `t()`

```typescript
import { t } from '../../../common/locales/translateServer'

// Simple translation
const message = t('messages.error.notFound')

// With parameters
const message = t('messages.session.invalidTable', {
  table: 'invalid_table_name',
})
```

## Type Safety

Both the frontend hook and backend function provide **full type safety**:

- IDE autocomplete will suggest all available translation keys
- TypeScript will error if you use a non-existent key
- Type errors will be caught at compile time, not runtime

## Guidelines

1. **Use consistent keys**: Follow the existing naming convention (e.g., `messages.error.notFound`)
2. **Keep strings short**: Aim for concise, clear messages
3. **Use Norwegian**: All strings should be in Norwegian (Norsk)
4. **Group logically**: Place related strings together
5. **Avoid abbreviations**: Spell out words fully for clarity
6. **Use lowercase**: Start with lowercase unless it's a proper noun
7. **Include context**: Make sure the string is clear in context
8. **Use templates for similar messages**: Before adding a new string, check if an existing template with parameters can be used (e.g., use `validation.required` with `{{field}}` parameter instead of creating new keys like `emailRequired`, `nameRequired`, etc.)
9. **Consolidate where possible**: Use generic templates like `success.generic` with `{{action}}` parameter instead of specific keys like `created`, `updated`, `deleted`

## Common Patterns

### Error Messages

```typescript
messages: {
  error: {
    generic: 'En feil oppstod',
    notFound: 'Ikke funnet',
  },
}
```

### Validation Messages

```typescript
messages: {
  validation: {
    emailRequired: 'E-post er påkrevd',
    passwordTooShort: 'Passord må være minst 6 tegn',
  },
}
```

### Dynamic Messages

```typescript
messages: {
  error: {
    userNotFound: 'Bruker {{userId}} ble ikke funnet',
  },
}

// Usage:
t('messages.error.userNotFound', { userId: 42 })
// Result: "Bruker 42 ble ikke funnet"
```

## Future Enhancements

This system is designed to be extendable:

- **Multiple languages**: Add `es.ts`, `en.ts`, etc. for additional languages
- **Dynamic locale switching**: Implement locale context provider
- **Lazy loading**: Load locales on demand for performance
- **Backend translations**: Backend errors are now centralized and can be serialized to frontend

## Consolidation Strategy

The translation system uses template parameters to minimize redundancy:

### Before (Unconsolidated)

```typescript
messages: {
  validation: {
    emailRequired: 'E-post er påkrevd',
    passwordRequired: 'Passord er påkrevd',
    firstNameRequired: 'Fornavn er påkrevd',
    sessionNameRequired: 'Sesjonsnavn er påkrevd',
    // ... 8 similar keys for different fields
  },
  success: {
    created: 'Opprettet',
    updated: 'Oppdatert',
    deleted: 'Slettet',
    sessionCreated: 'Sesjon opprettet',
    sessionUpdated: 'Sesjon oppdatert',
    // ... 9 similar keys for different actions
  },
}
```

### After (Consolidated)

```typescript
messages: {
  validation: {
    required: '{{field}} er påkrevd', // Reusable template
    notSelected: '{{item}} ikke valgt', // Reusable template
  },
  success: {
    generic: '{{action}} fullført', // Reusable template
    sessionJoined: 'Du har påmeldt deg sesjonen', // Specific when needed
  },
}
```

**Result**: ~36% reduction in message keys while maintaining clarity and specificity where needed.

## Type Definition Reference

The translation system uses TypeScript's type inference to provide complete autocomplete:

- **Frontend**: `TranslationKey` type ensures only valid keys can be used
- **Backend**: Same `TranslationKey` type for consistency
- Both support parameter validation through `params` object typing
