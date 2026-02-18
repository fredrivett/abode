---
title: deltaE
generated: 2026-02-15T22:23:55.206Z
dependencies:
  - path: app/src/lib/search/color-utils.ts
    symbol: deltaE
    hash: 4bc023c3229ba0709365d8416f8b9edc26afade95e1381f4e563477056d26f2d
---
# deltaE

Calculates the Delta E (ΔE) color difference between two colors using the CIE Lab color space. This function converts hex color values to Lab coordinates and computes the Euclidean distance, providing a perceptually uniform measure of color difference.

<details>
<summary>Visual Flow</summary>

```mermaid
flowchart TD
    Start([deltaE called]) --> A[Convert color1 to RGB]
    A --> B[Convert color2 to RGB]
    B --> C{Both RGB conversions successful?}
    C -->|No| D[Return null]
    C -->|Yes| E[Convert RGB1 to Lab]
    E --> F[Convert RGB2 to Lab]
    F --> G[Calculate dL = lab1.l - lab2.l]
    G --> H[Calculate da = lab1.a - lab2.a]
    H --> I[Calculate db = lab1.b - lab2.b]
    I --> J[Calculate Euclidean distance]
    J --> K[Return Delta E value]
    
    subgraph "External Functions"
        L[hexToRgb]
        M[rgbToLab]
    end
    
    A -.-> L
    B -.-> L
    E -.-> M
    F -.-> M
    
    style Start fill:#BBDEFB,stroke:#64B5F6,color:#333
    style A fill:#E8DEEE,stroke:#B39DDB,color:#333
    style B fill:#E8DEEE,stroke:#B39DDB,color:#333
    style C fill:#E8DEEE,stroke:#B39DDB,color:#333
    style E fill:#E8DEEE,stroke:#B39DDB,color:#333
    style F fill:#E8DEEE,stroke:#B39DDB,color:#333
    style G fill:#E8DEEE,stroke:#B39DDB,color:#333
    style H fill:#E8DEEE,stroke:#B39DDB,color:#333
    style I fill:#E8DEEE,stroke:#B39DDB,color:#333
    style J fill:#E8DEEE,stroke:#B39DDB,color:#333
    style D fill:#FCE4EC,stroke:#E57373,color:#333
    style K fill:#C8E6C9,stroke:#81C784,color:#333
```

</details>

<details>
<summary>Parameters</summary>

- `color1`: `string` - The first color in hexadecimal format (e.g., "#FF0000" or "FF0000")
- `color2`: `string` - The second color in hexadecimal format (e.g., "#00FF00" or "00FF00")

</details>

<details>
<summary>Return Value</summary>

Returns `number | null`:
- `number` - The Delta E value representing the perceptual difference between the two colors. Lower values indicate more similar colors (0 = identical colors)
- `null` - Returned when either color cannot be parsed as a valid hexadecimal color

</details>

<details>
<summary>Usage Examples</summary>

```typescript
// Compare two similar reds
const difference1 = deltaE("#FF0000", "#FF1111");
console.log(difference1); // ~5.89

// Compare red and blue (very different)
const difference2 = deltaE("#FF0000", "#0000FF");
console.log(difference2); // ~113.4

// Compare identical colors
const difference3 = deltaE("#FFFFFF", "#FFFFFF");
console.log(difference3); // 0

// Handle invalid colors
const difference4 = deltaE("#INVALID", "#FF0000");
console.log(difference4); // null

// Colors without # prefix
const difference5 = deltaE("FF0000", "00FF00");
console.log(difference5); // Works if hexToRgb supports this format
```

</details>

<details>
<summary>Implementation Details</summary>

The function implements the CIE76 Delta E formula:

1. **Color Space Conversion**: Converts both hex colors to RGB, then to CIE Lab color space
2. **Lab Difference Calculation**: Computes differences in each Lab dimension:
   - `dL`: Lightness difference (L* axis)
   - `da`: Green-Red difference (a* axis) 
   - `db`: Blue-Yellow difference (b* axis)
3. **Euclidean Distance**: Calculates `√(dL² + da² + db²)` for the final Delta E value

The CIE Lab color space is designed to be perceptually uniform, meaning equal numerical differences correspond to roughly equal perceived color differences.

</details>

<details>
<summary>Edge Cases</summary>

- **Invalid Hex Colors**: Returns `null` if either color cannot be parsed by `hexToRgb()`
- **Identical Colors**: Returns exactly `0` for identical colors
- **Color Format Dependency**: Behavior with different hex formats (with/without #, 3-digit vs 6-digit) depends on the `hexToRgb()` implementation
- **Precision**: Results are floating-point numbers with precision dependent on the Lab conversion accuracy

**Delta E Interpretation Guidelines**:
- `0-1`: Colors are nearly identical
- `1-2`: Very slight difference (expert eye needed)
- `2-5`: Slight difference (trained eye can notice)
- `5-10`: Noticeable difference
- `>10`: Significant difference

</details>

<details>
<summary>Related</summary>

- `hexToRgb()` - Converts hexadecimal colors to RGB values
- `rgbToLab()` - Converts RGB colors to CIE Lab color space
- **CIE Delta E variants**: CIE94, CIE2000 (more complex but potentially more accurate formulas)
- **Color difference standards**: Used in printing, display calibration, and color matching applications

</details>