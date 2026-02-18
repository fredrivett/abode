---
title: analyzeImageTask
syncdocsVersion: 0.0.1
generated: 2026-02-15T23:10:21.978Z
dependencies:
  - path: app/trigger/analyze-image.ts
    symbol: analyzeImageTask
    hash: 32ea850adf4d1d022cc2703ba495a8a49c561491c92d3746134f22878d40824d
---
# analyzeImageTask

A Trigger.dev task that performs comprehensive image analysis including vision AI processing, EXIF data extraction, embedding generation, and database updates. The task downloads images from Supabase storage, analyzes them with Google Cloud Vision API, generates AI-powered titles, creates vector embeddings, and triggers smart room synchronization.

<details>
<summary>Visual Flow</summary>

```mermaid
flowchart TD
    Start([analyzeImageTask invoked]) --> Setup[Create Supabase client]
    Setup --> Download[Download image from storage]
    Download --> DownloadErr{Download success?}
    DownloadErr -->|No| Error1[Throw download error]
    DownloadErr -->|Yes| Buffer[Convert to buffer]
    
    Buffer --> EXIF[Extract EXIF data]
    EXIF --> GPS{GPS data found?}
    GPS -->|Yes| Geocode[Reverse geocode GPS]
    GPS -->|No| Vision[Analyze with Vision API]
    Geocode --> LocationDB[Upsert location to DB]
    LocationDB --> Vision
    
    Vision --> VisionErr{Vision success?}
    VisionErr -->|No| ErrorCatch[Catch and handle error]
    VisionErr -->|Yes| Metadata[Fetch item metadata]
    
    Metadata --> AITitle{Generate AI title?}
    AITitle -->|Yes| GenTitle[Generate AI title]
    AITitle -->|No| UseVision[Use Vision title]
    GenTitle --> UpdateDB[Update item in transaction]
    UseVision --> UpdateDB
    
    UpdateDB --> SignedURL[Create signed URL]
    SignedURL --> VisualEmbed[Generate visual embedding]
    VisualEmbed --> StoreVisual[Store visual vector]
    
    StoreVisual --> TextCheck{Has text content?}
    TextCheck -->|Yes| TextEmbed[Generate text embedding]
    TextCheck -->|No| Sync[Trigger smart room sync]
    TextEmbed --> StoreText[Store text vector]
    StoreText --> Sync
    
    Sync --> Return[Return success result]
    
    ErrorCatch -.-> MarkFailed[Mark item as failed]
    Error1 -.-> MarkFailed
    MarkFailed -.-> Rethrow[Re-throw for retry]

    style Start fill:#BBDEFB,stroke:#64B5F6,color:#333
    style Setup fill:#E8DEEE,stroke:#B39DDB,color:#333
    style Download fill:#E8DEEE,stroke:#B39DDB,color:#333
    style Buffer fill:#E8DEEE,stroke:#B39DDB,color:#333
    style EXIF fill:#E8DEEE,stroke:#B39DDB,color:#333
    style Geocode fill:#E8DEEE,stroke:#B39DDB,color:#333
    style LocationDB fill:#E8DEEE,stroke:#B39DDB,color:#333
    style Vision fill:#E8DEEE,stroke:#B39DDB,color:#333
    style Metadata fill:#E8DEEE,stroke:#B39DDB,color:#333
    style GenTitle fill:#E8DEEE,stroke:#B39DDB,color:#333
    style UseVision fill:#E8DEEE,stroke:#B39DDB,color:#333
    style UpdateDB fill:#E8DEEE,stroke:#B39DDB,color:#333
    style SignedURL fill:#E8DEEE,stroke:#B39DDB,color:#333
    style VisualEmbed fill:#E8DEEE,stroke:#B39DDB,color:#333
    style StoreVisual fill:#E8DEEE,stroke:#B39DDB,color:#333
    style TextEmbed fill:#E8DEEE,stroke:#B39DDB,color:#333
    style StoreText fill:#E8DEEE,stroke:#B39DDB,color:#333
    style Sync fill:#E8DEEE,stroke:#B39DDB,color:#333
    style Return fill:#C8E6C9,stroke:#81C784,color:#333
    style Error1 fill:#FCE4EC,stroke:#E57373,color:#333
    style ErrorCatch fill:#FCE4EC,stroke:#E57373,color:#333
    style MarkFailed fill:#FCE4EC,stroke:#E57373,color:#333
    style Rethrow fill:#FCE4EC,stroke:#E57373,color:#333
```

</details>

<details>
<summary>Parameters</summary>

The task accepts an `AnalyzeImagePayload` object with the following properties:

- `itemId`: `string` - Unique identifier for the item being analyzed
- `userId`: `string` - User ID for multi-tenant isolation and ownership
- `fileKey`: `string` - Storage key/path for the image file in Supabase storage

</details>

<details>
<summary>Return Value</summary>

Returns a Promise that resolves to an object containing:

```typescript
{
  success: true,
  itemId: string,
  analysis: {
    title: string,           // Final title (AI-generated or Vision-derived)
    description: string,     // Image description from Vision API
    tagCount: number,        // Number of tags identified
    objectCount: number,     // Number of objects detected
    hasOcr: boolean,         // Whether OCR text was found
    colorCount: number       // Number of dominant colors identified
  },
  embeddings: {
    visualVectorId: string | null,  // ID of stored visual embedding
    textVectorId: string | null     // ID of stored text embedding (if applicable)
  }
}
```

On error, the task throws an exception after marking the item as failed in the database.

</details>

<details>
<summary>Usage Examples</summary>

```typescript
// Trigger the task for image analysis
await tasks.trigger<typeof analyzeImageTask>("analyze-image", {
  itemId: "item_123",
  userId: "user_456", 
  fileKey: "uploads/2024/image.jpg"
});

// The task can also be triggered from other tasks
await analyzeImageTask.trigger({
  itemId: item.id,
  userId: session.user.id,
  fileKey: uploadResult.path
});

// Access task configuration
console.log(analyzeImageTask.id); // "analyze-image"
console.log(analyzeImageTask.maxDuration); // 600 seconds
```

</details>

<details>
<summary>Implementation Details</summary>

The task executes the following processing pipeline:

**1. Image Download**
- Creates Supabase client with service role permissions
- Downloads image from the `items` storage bucket
- Converts blob response to Buffer for processing

**2. EXIF Data Extraction**
- Extracts GPS coordinates and capture date from image metadata
- Performs reverse geocoding if GPS data is present
- Stores location information in `itemLocation` table with `exif` source

**3. Vision API Analysis**
- Processes image with Google Cloud Vision API via `analyzeImage()` function
- Extracts objects, labels, OCR text, colors, and generates initial description
- Combines Vision analysis with original filename for AI title generation

**4. AI Title Enhancement**
- Uses `generateAITitle()` to create contextual titles based on:
  - Original filename
  - Detected labels and objects
  - OCR text content
- Falls back to Vision-derived title if AI generation fails

**5. Database Updates**
- Updates `Item` table with title, description, tags, and processing status
- Creates/updates `ItemImageDetails` with objects, OCR text, colors, and Vision data
- Uses database transactions to ensure consistency

**6. Embedding Generation**
- Creates signed URL for image access (1 hour validity)
- Generates visual embedding using CLIP model via Replicate
- Creates text embedding from combined tags, objects, and OCR text
- Stores embeddings in vector tables for similarity search

**7. Smart Room Sync**
- Triggers `syncItemToRoomsTask` to update smart room classifications
- Enables automatic categorization based on analysis results

</details>

<details>
<summary>Edge Cases</summary>

**Missing or Corrupted Images**
- Throws descriptive error if image download fails
- Handles blob conversion errors gracefully

**EXIF Data Variations**
- Safely processes images without GPS or date information
- Deletes existing EXIF location records if no GPS data found
- Handles reverse geocoding API failures without stopping analysis

**Vision API Limitations** 
- Continues processing even if some Vision features fail
- Handles empty or minimal analysis results
- Provides fallback titles when AI generation returns null

**Large Images**
- 10-minute timeout accommodates processing of high-resolution images
- Buffer size is logged for monitoring storage efficiency

**Text Content Edge Cases**
- Skips text embedding generation if no text content is extracted
- Handles OCR text with special characters or formatting
- Combines multiple text sources (tags, objects, OCR) intelligently

**Multi-tenant Isolation**
- All database operations include `userId` constraints
- Prevents cross-tenant data access in shared database

**Retry Behavior**
- Marks items as `failed` status before re-throwing errors
- Enables Trigger.dev automatic retry mechanisms
- Captures server exceptions for debugging

</details>

<details>
<summary>Related</summary>

**Core Dependencies**
- `analyzeImage()` - Google Cloud Vision API integration
- `generateAITitle()` - AI-powered title generation
- `generateImageEmbedding()` - Visual embedding via CLIP model
- `generateTextEmbedding()` - Text embedding via OpenAI
- `extractExifData()` - EXIF metadata extraction
- `reverseGeocode()` - GPS coordinate to location conversion

**Database Models**
- `Item` - Core item metadata and processing status
- `ItemImageDetails` - Image-specific analysis results
- `ItemLocation` - Location data from various sources
- Vector storage tables for embeddings

**Related Tasks**
- `syncItemToRoomsTask` - Smart room classification
- Upload tasks that trigger image analysis
- Search tasks that use generated embeddings

**Configuration**
- `getSupabaseConfig()` - Storage and database credentials
- Trigger.dev task configuration for timeouts and retries
- Vision API and embedding model settings

</details>