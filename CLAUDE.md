
Default to using pnpm and Node.js.

- Use `pnpm install` for package management
- Use `pnpm run <script>` to execute scripts defined in package.json
- Use `pnpm <command>` instead of `npm` or `yarn`
- Use standard Node.js with TypeScript for runtime execution

## Testing

Use `vitest` to run tests.

```ts#index.test.ts
import { test, expect } from "vitest";

test("hello world", () => {
  expect(1).toBe(1);
});

```

## Effect libraries

check this out for more info:
`https://effect.website/llms-full.txt`
