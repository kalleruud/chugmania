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

Strings are organized by category and feature for maintainability:

```typescript
export const noLocale = {
  common: {
    // Generic buttons and actions used across the app
    loading: 'Laster inn…',
    save: 'Lagre',
  },

  messages: {
    error: {
      // Error messages
    },
    validation: {
      // Validation error messages
    },
    success: {
      // Success messages
    },
    info: {
      // Informational messages
    },
    auth: {
      // Authentication-related messages
    },
    admin: {
      // Admin panel messages
    },
    track: {
      // Track-related messages
    },
    timeEntry: {
      // Time entry messages
    },
    session: {
      // Session messages
    },
  },
}
```

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

## Type Definition Reference

The translation system uses TypeScript's type inference to provide complete autocomplete:

- **Frontend**: `TranslationKey` type ensures only valid keys can be used
- **Backend**: Same `TranslationKey` type for consistency
- Both support parameter validation through `params` object typing
