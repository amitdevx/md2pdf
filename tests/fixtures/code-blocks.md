# Code Blocks

This file tests the Shiki syntax highlighting.

## TypeScript
```typescript
interface User {
  id: number;
  name: string;
}

const getUser = (id: number): User => {
  return { id, name: 'Alice' };
};
```

## Python
```python
def fibonacci(n):
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    return fibonacci(n-1) + fibonacci(n-2)
```

## CSS
```css
.markdown-body {
  padding: 2em;
  background: var(--md2pdf-color-bg);
}
```

## Unknown Language (Should fallback to txt)
```unknownlang
this is a custom unsupported language that should not crash the compiler.
```

## Long Line (Should Wrap in PDF)
```bash
echo "This is an extremely long command that will definitely exceed the standard page width of an A4 paper in portrait mode. It should be wrapped cleanly by the pre-wrap CSS rule in the print stylesheet."
```
