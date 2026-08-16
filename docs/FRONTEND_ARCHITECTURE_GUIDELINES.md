# CanvasFlow Frontend Architecture & Implementation Guidelines

This guide details the architectural patterns, state management strategies, API integration flows, and code conventions across the Next.js frontend (`apps/web`).

---

## 1. Directory & Routing Architecture (`apps/web`)

```
apps/web/
├── app/
│   ├── (auth)/             # Authentication routes (login, register)
│   ├── (menti)/            # Live presentation & audience experience routes
│   ├── dashboard/          # Creator dashboard (form listing, metrics, analytics)
│   ├── forms/              # Form filling respondent pages & builder
│   │   ├── [formId]/       # Form respondent submission view
│   │   └── builder/        # Canvas form builder editor
│   ├── globals.css         # Design tokens, components, utility classes
│   └── layout.tsx          # Root HTML shell & providers wrapper
├── components/
│   ├── ui/                 # Base primitives (button, input, modal, sonner)
│   ├── builder/            # Builder canvas, node inspector, sidebar, dialogs
│   ├── forms/              # Question renderers, thank you screen, file upload
│   └── landing/            # Landing page hero, features, footer
├── hooks/
│   ├── api/                # tRPC query & mutation hook wrappers
│   ├── use-toasts.ts       # Unified notification toasts
│   └── useDebounce.ts      # Debounce primitives
├── lib/
│   ├── auth-client.ts      # Better-Auth client configuration
│   ├── utils.ts            # Class name merger (`cn`)
│   └── upload.ts           # Upload chunking and polling logic
└── trpc/
    └── client.ts           # tRPC React Query client instantiation
```

---

## 2. API Integration with tRPC & React Query

All backend communication flows through the `@repo/trpc` client wrapper.

### Standard Query Pattern
Organized by domain inside `hooks/api/<domain>/`:
```tsx
import { trpc } from "@/trpc/client";

export function useGetForm(id: string) {
  return trpc.form.getForm.useQuery(
    { id },
    {
      enabled: !!id,
      staleTime: 1000 * 30, // 30 seconds
    }
  );
}
```

### Standard Mutation Pattern with Cache Updates
```tsx
import { trpc } from "@/trpc/client";
import { useToasts } from "@/hooks/use-toasts";

export function useCreateFormField() {
  const utils = trpc.useUtils();
  const { showSuccessToast, showErrorToast } = useToasts();

  return trpc.form.createFormField.useMutation({
    onSuccess: (data, variables) => {
      // Invalidate relevant caches
      utils.form.getFormById.invalidate({ id: variables.formId });
      showSuccessToast("Question added");
    },
    onError: (err) => {
      showErrorToast(err.message || "Failed to create field");
    },
  });
}
```

---

## 3. State Management Patterns

### 1. Complex Editors (e.g. Form Builder / Slide Editor)
For complex multi-panel interfaces (canvas, sidebar, settings, inspector):
- Use a dedicated custom hook (`useBuilderState.ts` or `usePresentationState.ts`) containing:
  - Local state for active selection (selected question/slide ID).
  - Draft changes buffer before persisting.
  - Optimistic updates to local arrays during drag-and-drop or reordering.
  - Undo/redo stacks if appropriate.

### 2. Live / Real-Time Data (e.g. Live Polling)
- Maintain reactive state subscribed to live updates (via SSE, WebSocket, or short-interval React Query polling).
- Animate counter changes using [useAnimatedCounter.ts](file:///Users/sakshamsaini/Desktop/kuchbhi/CanvasFlow/apps/web/hooks/useAnimatedCounter.ts).

---

## 4. Forms & Validation

- **Libraries**: `react-hook-form` + `@hookform/resolvers/zod` + `zod`.
- **Validation Rules**: Shared zod schemas imported from `@repo/services/<module>/model` whenever possible.
- **Error Display**:
  - Always render inline error text underneath the field with `text-xs text-red-600 font-medium`.
  - Use `aria-invalid={!!error}` on inputs for accessibility.

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const formSchema = z.object({
  title: z.string().min(1, "Title is required").max(150),
});

export function CreateDialog({ onSubmit }) {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "" },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input {...form.register("title")} className="cf-panel px-3 py-2" />
      {form.formState.errors.title && (
        <span className="text-xs text-red-600">{form.formState.errors.title.message}</span>
      )}
    </form>
  );
}
```

---

## 5. Toast Notifications & Alerts

Use the centralized [`useToasts`](file:///Users/sakshamsaini/Desktop/kuchbhi/CanvasFlow/apps/web/hooks/use-toasts.ts) hook (backed by `sonner`):

```tsx
import { useToasts } from "@/hooks/use-toasts";

const { showSuccessToast, showErrorToast, showInfoToast } = useToasts();

showSuccessToast("Presentation published successfully!");
showErrorToast("Could not connect to live room");
```

---

## 6. Modals & Dialogs

- Implement dialogs using [ModalOverlay.tsx](file:///Users/sakshamsaini/Desktop/kuchbhi/CanvasFlow/apps/web/components/ui/ModalOverlay.tsx).
- Dialogs must include:
  - An explicit close `Esc` key listener.
  - Backdrop click dismissal (unless unsaved changes exist).
  - Consistent header bar (`.cf-pane-bar`) with title and close icon button.
  - Action footer with secondary `Cancel` (`.cf-btn-outline`) and primary `Save`/`Confirm` (`.cf-btn`).
