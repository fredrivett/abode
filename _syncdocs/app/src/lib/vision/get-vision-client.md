---
title: getVisionClient
syncdocsVersion: 0.0.1
generated: 2026-02-15T23:04:33.040Z
dependencies:
  - path: app/src/lib/vision.ts
    symbol: getVisionClient
    hash: b8ec084ed9d7b25165c2ec001ade75277b179cfb553277f83926320cb1bbaebb
---
# getVisionClient

Creates and configures a Google Cloud Vision API client instance. The function supports two authentication methods: credentials loaded from a JSON file path or inline credentials parsed from an environment variable, with inline credentials taking precedence when both are available.

<details>
<summary>Visual Flow</summary>

```mermaid
flowchart TD
    Start([getVisionClient called]) --> A[Read GOOGLE_CLOUD_CREDENTIALS env var]
    A --> B{rawCredentials exists?}
    B -->|Yes| C[Call parseCredentials]
    B -->|No| D[Set credentials to undefined]
    C --> E[Create ImageAnnotatorClient config]
    D --> E
    E --> F[Pass keyFilename from GOOGLE_CLOUD_CREDENTIALS_PATH]
    F --> G[Pass credentials object]
    G --> H[Instantiate vision.ImageAnnotatorClient]
    H --> Return([Return client instance])

    style Start fill:#BBDEFB,stroke:#64B5F6,color:#333
    style A fill:#E8DEEE,stroke:#B39DDB,color:#333
    style B fill:#E8DEEE,stroke:#B39DDB,color:#333
    style C fill:#E8DEEE,stroke:#B39DDB,color:#333
    style D fill:#E8DEEE,stroke:#B39DDB,color:#333
    style E fill:#E8DEEE,stroke:#B39DDB,color:#333
    style F fill:#E8DEEE,stroke:#B39DDB,color:#333
    style G fill:#E8DEEE,stroke:#B39DDB,color:#333
    style H fill:#E8DEEE,stroke:#B39DDB,color:#333
    style Return fill:#C8E6C9,stroke:#81C784,color:#333
```

</details>

<details>
<summary>Return Value</summary>

Returns a `vision.ImageAnnotatorClient` instance configured with Google Cloud credentials. The client is ready to make requests to the Google Cloud Vision API for image analysis operations.

</details>

<details>
<summary>Usage Examples</summary>

```typescript
// Basic usage
const client = getVisionClient();

// Using the client to analyze an image
const client = getVisionClient();
const [result] = await client.labelDetection({
  image: { source: { imageUri: 'gs://bucket/image.jpg' } }
});

// Environment variable setup examples
// Option 1: Using credentials file path
process.env.GOOGLE_CLOUD_CREDENTIALS_PATH = '/path/to/service-account.json';

// Option 2: Using inline credentials (takes precedence)
process.env.GOOGLE_CLOUD_CREDENTIALS = JSON.stringify({
  type: 'service_account',
  project_id: 'my-project',
  private_key_id: 'key-id',
  private_key: '-----BEGIN PRIVATE KEY-----\n...',
  client_email: 'service@my-project.iam.gserviceaccount.com',
  // ... other service account fields
});

const client = getVisionClient();
```

</details>

<details>
<summary>Implementation Details</summary>

The function implements a dual authentication strategy for Google Cloud Vision:

1. **Inline Credentials**: Reads `GOOGLE_CLOUD_CREDENTIALS` environment variable and parses it using the `parseCredentials()` helper function
2. **File-based Credentials**: Uses `GOOGLE_CLOUD_CREDENTIALS_PATH` environment variable pointing to a service account JSON file
3. **Precedence**: The `credentials` object takes precedence over `keyFilename` when both are provided to the `ImageAnnotatorClient` constructor

The function creates a new client instance on each call rather than implementing singleton pattern, allowing for different configurations if environment variables change between calls.

</details>

<details>
<summary>Edge Cases</summary>

- **No Credentials**: If neither `GOOGLE_CLOUD_CREDENTIALS` nor `GOOGLE_CLOUD_CREDENTIALS_PATH` are set, the client will attempt to use Google Cloud Application Default Credentials (ADC)
- **Invalid JSON**: If `GOOGLE_CLOUD_CREDENTIALS` contains malformed JSON, `parseCredentials()` may throw an error
- **File Not Found**: If `GOOGLE_CLOUD_CREDENTIALS_PATH` points to a non-existent file, the client instantiation will fail at runtime when making API calls
- **Precedence Behavior**: When both environment variables are set, `credentials` takes precedence and `keyFilename` is effectively ignored
- **Empty String Values**: Empty string values in environment variables are treated as falsy, falling back to `undefined`

</details>

<details>
<summary>Related</summary>

- `parseCredentials()` - Helper function for parsing credential strings
- `vision.ImageAnnotatorClient` - Google Cloud Vision API client class
- Google Cloud Application Default Credentials (ADC) - Fallback authentication method
- Environment variable configuration for Google Cloud authentication

</details>