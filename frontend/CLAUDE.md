# FastPR - Git Diff Review App

## Overview
FastPR aggregates comments from multiple sources (GitHub, Slack, in-app), provides code search and navigation
AI overview and chat with AI agent on the PR

## Key Features (Planned)
- **PR Review:** Review code changes in a visual diff view like Github PR
- **File Tree:** View the file tree of the repository
- **Code search & navigation:** Browse repository content at specific commits
- **AI Overview:** Get a summary of the PR from AI
- **AI Chat:** Chat with AI agent on the PR


## Architecture

### Provide/Inject Pattern
The project heavily uses the provide/inject pattern through @vuseuse createInjectionState
to slice the state into different concerns.

For example: the provide component (usually the App.vue) initialize the state
```
// App.vue
useProvideAccount()

```

later, any component can inject the state to use it
```
// SomeComponent.vue
const { account } = useAccount()
```

The state and action are defined in the composition file e.g. useAccount.ts
```ts
// useCounterStore.ts
import { createInjectionState } from '@vueuse/core'
import { computed, shallowRef } from 'vue'

const [useProvideAccount, useAccount] = createInjectionState(() => {
  const account = shallowRef<Account | null>(null)
  return {
    account
  }
})

export { useProvideAccount, useAccount }
```

### Modules file structure
Each product use case is often wrapped in a modules/usecase folder.
e.g. modules/filetree/

Often, a module will have a single useX.ts and a root component of that module to manage the shared state of that module

## UI components
We use Shadcn-vue for the UI components.
The components are auto installed and placed in the components folder.
To install a new component, first check if it's already installed, then install it via pnpm
```
pnpm dlx shadcn-vue@latest add button
```

For icon, we use lucide-vue-next.

## Aesthetic Guidelines
Font: Inter, base 14px

The application relies on Shadcn-vue for the UI components so it is impacted by the Shadcn-vue aesthetic guidelines which means:
- Clean and modern design: something like Notion app or Linear app

The app also contains a lot of non-UI components like: diff view, code search, canvas flow discussions, etc.
Currently, the aesthetic guidelines for these components are not yet defined. We'll experiment and update the guidelines as we go.
