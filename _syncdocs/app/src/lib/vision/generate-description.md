---
title: generateDescription
syncdocsVersion: 0.0.1
generated: 2026-02-15T23:06:52.957Z
dependencies:
  - path: app/src/lib/vision.ts
    symbol: generateDescription
    hash: 2acb4e56b2b39ff56fb37f71c7c22cb34540c8d2d13dead5c5b61fd076fc41f8
---
# generateDescription

Generates a human-readable description string from image analysis data by combining detected objects, thematic labels, and extracted text. The function intelligently formats and truncates the input data to create concise, informative descriptions suitable for alt text or content summaries.

<details>
<summary>Visual Flow</summary>

```mermaid
flowchart TD
    Start([generateDescription called]) --> InitParts[Initialize empty parts array]
    InitParts --> CheckObjects{objects.length > 0?}
    
    CheckObjects -->|Yes| SliceObjects[Take first 3 objects]
    CheckObjects -->|No| CheckLabels{labels.length > 0?}
    
    SliceObjects --> AddObjects[Add 'Image contains: ...' to parts]
    AddObjects --> CheckLabels
    
    CheckLabels -->|Yes| SliceLabels[Take first 5 labels]
    CheckLabels -->|No| CheckOCR{ocrText exists and not empty?}
    
    SliceLabels --> AddLabels[Add 'Themes: ...' to parts]
    AddLabels --> CheckOCR
    
    CheckOCR -->|Yes| TruncateText[Slice ocrText to 100 chars]
    CheckOCR -->|No| JoinParts[Join parts with '. ']
    
    TruncateText --> CheckTruncation{ocrText.length > 100?}
    CheckTruncation -->|Yes| AddEllipsis[Add '...' to preview]
    CheckTruncation -->|No| AddTextPart[Add 'Text: "preview"' to parts]
    
    AddEllipsis --> AddTextPart
    AddTextPart --> JoinParts
    JoinParts --> Return([Return description string])

    style Start fill:#BBDEFB,stroke:#64B5F6,color:#333
    style InitParts fill:#E8DEEE,stroke:#B39DDB,color:#333
    style CheckObjects fill:#E8DEEE,stroke:#B39DDB,color:#333
    style SliceObjects fill:#E8DEEE,stroke:#B39DDB,color:#333
    style AddObjects fill:#E8DEEE,stroke:#B39DDB,color:#333
    style CheckLabels fill:#E8DEEE,stroke:#B39DDB,color:#333
    style SliceLabels fill:#E8DEEE,stroke:#B39DDB,color:#333
    style AddLabels fill:#E8DEEE,stroke:#B39DDB,color:#333
    style CheckOCR fill:#E8DEEE,stroke:#B39DDB,color:#333
    style TruncateText fill:#E8DEEE,stroke:#B39DDB,color:#333
    style CheckTruncation fill:#E8DEEE,stroke:#B39DDB,color:#333
    style AddEllipsis fill:#E8DEEE,stroke:#B39DDB,color:#333
    style AddTextPart fill:#E8DEEE,stroke:#B39DDB,color:#333
    style JoinParts fill:#E8DEEE,stroke:#B39DDB,color:#333
    style Return fill:#C8E6C9,stroke:#81C784,color:#333
```

</details>

<details>
<summary>Parameters</summary>

- `labels`: `string[]` - Array of thematic labels or tags describing the image content. Up to 5 labels will be included in the output.
- `objects`: `string[]` - Array of detected objects in the image. Up to 3 objects will be included in the output.
- `ocrText`: `string | null` - Extracted text content from the image via OCR. Can be `null` if no text was detected. Text longer than 100 characters will be truncated with ellipsis.

</details>

<details>
<summary>Return Value</summary>

Returns a `string` containing the formatted description. The string is composed of up to three parts separated by `. `:

1. Object description: `"Image contains: object1, object2, object3"`
2. Theme labels: `"Themes: label1, label2, label3, label4, label5"`
3. Text preview: `"Text: \"extracted text preview...\""`

If any input array is empty or `ocrText` is `null`/empty, that section is omitted from the result.

</details>

<details>
<summary>Usage Examples</summary>

```typescript
// Full description with all components
const description = generateDescription(
  ['nature', 'outdoor', 'scenic', 'mountain', 'landscape'],
  ['tree', 'mountain', 'sky', 'lake'],
  'Welcome to Mountain View Park. Open daily 9am-5pm.'
);
// Returns: "Image contains: tree, mountain, sky. Themes: nature, outdoor, scenic, mountain, landscape. Text: \"Welcome to Mountain View Park. Open daily 9am-5pm.\""

// Only objects and labels
const description2 = generateDescription(
  ['food', 'restaurant'],
  ['pizza', 'table'],
  null
);
// Returns: "Image contains: pizza, table. Themes: food, restaurant"

// Long text truncation
const description3 = generateDescription(
  ['document'],
  ['paper'],
  'This is a very long document with lots of text that exceeds the 100 character limit and will be truncated with ellipsis'
);
// Returns: "Image contains: paper. Themes: document. Text: \"This is a very long document with lots of text that exceeds the 100 character limit and will be tr...\""

// Empty inputs
const description4 = generateDescription([], [], '');
// Returns: ""

// Only OCR text
const description5 = generateDescription([], [], 'Short text');
// Returns: "Text: \"Short text\""
```

</details>

<details>
<summary>Implementation Details</summary>

The function uses a three-phase approach to build the description:

1. **Object Processing**: Takes the first 3 items from the `objects` array and formats them as `"Image contains: ..."`. This limitation prevents overly verbose object lists.

2. **Label Processing**: Takes the first 5 items from the `labels` array and formats them as `"Themes: ..."`. Labels typically represent higher-level concepts or categories.

3. **OCR Text Processing**: 
   - Checks for both existence and non-empty content
   - Truncates to exactly 100 characters using `slice(0, 100)`
   - Appends `"..."` if the original text was longer than 100 characters
   - Wraps the preview in quotes for clear text boundaries

The final description is assembled by joining non-empty parts with `". "` (period and space), creating natural sentence flow.

</details>

<details>
<summary>Edge Cases</summary>

- **Empty arrays**: If `objects` or `labels` arrays are empty, those sections are completely omitted from the output
- **Null OCR text**: `null` values for `ocrText` are handled gracefully and omitted
- **Empty string OCR**: Empty strings (`""`) for `ocrText` are also omitted
- **All empty inputs**: Returns an empty string `""` when all inputs are empty/null
- **Whitespace-only text**: OCR text containing only whitespace will still be included (not trimmed)
- **Exactly 100 character text**: Text of exactly 100 characters will not have ellipsis appended
- **Unicode characters**: Text truncation uses character count, not byte length, so Unicode text is handled correctly
- **Array order**: The function preserves the original order of items in both `objects` and `labels` arrays

</details>

<details>
<summary>Related</summary>

This function is typically used in image processing pipelines alongside:
- Image analysis services (object detection, label recognition)
- OCR text extraction functions
- Alt text generation systems
- Content management and accessibility tools
- Search indexing systems that need textual representations of images

</details>