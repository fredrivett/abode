---
title: hexToRgb
generated: 2026-02-15T22:24:16.475Z
dependencies:
  - path: app/src/lib/search/color-utils.ts
    symbol: hexToRgb
    hash: 6e37373c0d56833d7048bf3683cc45c98c1f0b17f9a2eefe75b8d4536cf4a8dd
---
# hexToRgb

Converts a hexadecimal color string to an RGB object representation. This function parses standard hex color formats and returns the individual red, green, and blue channel values as integers from 0-255.

<details>
<summary>Visual Flow</summary>

```mermaid
flowchart TD
    Start([hexToRgb called]) --> A[Call normalizeColor]
    A --> B{normalized color valid?}
    B -->|No| C[Return null]
    B -->|Yes| D[Execute regex pattern match]
    D --> E{regex result found?}
    E -->|No| F[Return null]
    E -->|Yes| G[Parse red component]
    G --> H[Parse green component]
    H --> I[Parse blue component]
    I --> J[Return RGB object]

    subgraph "External Dependencies"
        K[normalizeColor function]
    end
    
    A -.-> K

    style Start fill:#BBDEFB,stroke:#64B5F6,color:#333
    style A fill:#E8DEEE,stroke:#B39DDB,color:#333
    style B fill:#E8DEEE,stroke:#B39DDB,color:#333
    style D fill:#E8DEEE,stroke:#B39DDB,color:#333
    style E fill:#E8DEEE,stroke:#B39DDB,color:#333
    style G fill:#E8DEEE,stroke:#B39DDB,color:#333
    style H fill:#E8DEEE,stroke:#B39DDB,color:#333
    style I fill:#E8DEEE,stroke:#B39DDB,color:#333
    style C fill:#FCE4EC,stroke:#E57373,color:#333
    style F fill:#FCE4EC,stroke:#E57373,color:#333
    style J fill:#C8E6C9,stroke:#81C784,color:#333
    style K fill:#FFF3E0,stroke:#FFB74D,color:#333
```

</details>

<details>
<summary>Parameters</summary>

- `hex` (`string`) - The hexadecimal color string to convert. Can be in various formats that will be normalized by the `normalizeColor` function.

</details>

<details>
<summary>Return Value</summary>

Returns `{ r: number; g: number; b: number } | null`:
- **Success**: An object containing RGB values where each component (`r`, `g`, `b`) is an integer between 0-255
- **Failure**: `null` if the input cannot be normalized or doesn't match the expected hex color format

</details>

<details>
<summary>Usage Examples</summary>

```typescript
// Standard 6-digit hex color
const rgb1 = hexToRgb('#FF5733');
// Returns: { r: 255, g: 87, b: 51 }

// Lowercase hex color
const rgb2 = hexToRgb('#a0b2c3');
// Returns: { r: 160, g: 178, b: 195 }

// Invalid hex color
const rgb3 = hexToRgb('#invalid');
// Returns: null

// Color that fails normalization
const rgb4 = hexToRgb('not-a-color');
// Returns: null

// Using the result
const color = hexToRgb('#FF0000');
if (color) {
  console.log(`Red: ${color.r}, Green: ${color.g}, Blue: ${color.b}`);
  // Output: Red: 255, Green: 0, Blue: 0
}
```

</details>

<details>
<summary>Implementation Details</summary>

The function follows a two-stage validation process:

1. **Color Normalization**: Delegates to `normalizeColor()` to handle various input formats and convert them to a standard hex format
2. **Regex Parsing**: Uses the pattern `/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i` to extract exactly three 2-character hex segments
3. **Value Conversion**: Each hex segment is parsed using `Number.parseInt(segment, 16)` with base 16 to convert to decimal

The regex pattern specifically matches:
- `^#` - Must start with hash symbol
- `([a-f\d]{2})` - Exactly 2 hex characters for red channel
- `([a-f\d]{2})` - Exactly 2 hex characters for green channel  
- `([a-f\d]{2})$` - Exactly 2 hex characters for blue channel
- `i` flag makes matching case-insensitive

</details>

<details>
<summary>Edge Cases</summary>

- **Invalid input formats**: Returns `null` for any input that `normalizeColor` cannot process
- **Short hex codes**: 3-digit hex codes (e.g., `#RGB`) must be handled by `normalizeColor` before reaching this function
- **Case insensitive**: Accepts both uppercase and lowercase hex digits due to regex `i` flag
- **Malformed hex**: Returns `null` for strings that look like hex colors but don't match the exact 6-character format after normalization
- **Empty/null input**: Behavior depends on `normalizeColor` implementation - likely returns `null`

</details>

<details>
<summary>Related</summary>

- `normalizeColor` - Dependency function that standardizes color input formats
- RGB to hex conversion functions (inverse operation)
- Color utility functions for HSL, HSV conversions
- Color validation and parsing utilities

</details>