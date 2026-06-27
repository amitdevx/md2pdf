# Comprehensive Test Document

This document tests the core rendering features of `md2pdf` v0.1.0.

## 1. Typography & Inline Elements

This paragraph contains **bold text**, *italic text*, and ***bold italic text***. It also has ~~strikethrough~~ and inline `code`.

Here is a blockquote:
> Software is a great combination between artistry and engineering.
> -- Bill Gates

## 2. Code Blocks with Syntax Highlighting

```javascript
// A simple JavaScript function
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10));
```

```python
# A simple Python script
import os

def list_files(dir_path):
    for root, dirs, files in os.walk(dir_path):
        for name in files:
            print(os.path.join(root, name))
```

## 3. Lists and Tasks

### Unordered List
* Apples
  * Granny Smith
  * Fuji
* Oranges
* Bananas

### Ordered List
1. First step
2. Second step
   1. Sub-step A
   2. Sub-step B
3. Third step

### Task List
- [x] Complete core rendering
- [x] Implement Shiki highlighting
- [ ] Implement KaTeX math
- [ ] Implement Mermaid

## 4. Tables

| Feature | Status | Notes |
|---------|--------|-------|
| Typography | Done | Inter font included |
| Code Blocks | Done | Shiki integrated |
| Tables | Done | GFM supported |
| Math | Pending | Planned for v0.3.0 |

## 5. Horizontal Rule

---

End of test document.
