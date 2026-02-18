---
title: parseCredentials
generated: 2026-02-15T22:22:00.378Z
dependencies:
  - path: app/src/lib/vision.ts
    symbol: parseCredentials
    hash: 576e3add1e5a17b2cd9ecd6b96f9450cda5f7a28cce7608235fbc7e67d7bcb81
---
# parseCredentials

Parses a raw JSON string containing Google Cloud credentials and returns the parsed object. The function includes security-conscious error handling that prevents credential leakage by only including a preview of the input in error messages.

<details>
<summary>Visual Flow</summary>

```mermaid
flowchart TD
    Start([parseCredentials called]) --> TryParse[Try JSON.parse on raw string]
    TryParse --> Success{Parse successful?}
    Success -->|Yes| Return([Return parsed object])
    Success -->|No| CatchError[Catch parse error]
    CatchError --> CreatePreview[Create preview: first 200 chars of raw]
    CreatePreview --> ExtractReason[Extract error message or use default]
    ExtractReason --> ThrowError[Throw detailed error with preview]
    ThrowError -.-> ErrorEnd([Function throws])
    
    style Start fill:#BBDEFB,stroke:#64B5F6,color:#333
    style TryParse fill:#E8DEEE,stroke:#B39DDB,color:#333
    style Success fill:#E8DEEE,stroke:#B39DDB,color:#333
    style CatchError fill:#FCE4EC,stroke:#E57373,color:#333
    style CreatePreview fill:#FCE4EC,stroke:#E57373,color:#333
    style ExtractReason fill:#FCE4EC,stroke:#E57373,color:#333
    style ThrowError fill:#FCE4EC,stroke:#E57373,color:#333
    style Return fill:#C8E6C9,stroke:#81C784,color:#333
    style ErrorEnd fill:#FCE4EC,stroke:#E57373,color:#333
```

</details>

<details>
<summary>Parameters</summary>

- `raw` (`string`): The raw JSON string containing Google Cloud credentials to be parsed. Expected to be valid JSON format.

</details>

<details>
<summary>Return Value</summary>

Returns the parsed JavaScript object from the JSON string. The exact structure depends on the input JSON, but for Google Cloud credentials it typically contains properties like `type`, `project_id`, `private_key_id`, `private_key`, `client_email`, etc.

**Throws**: `Error` if the input string is not valid JSON. The error message includes the original parse error reason and a 200-character preview of the input for debugging purposes.

</details>

<details>
<summary>Usage Examples</summary>

```typescript
// Valid credentials JSON
const credentialsJson = JSON.stringify({
  type: "service_account",
  project_id: "my-project",
  private_key_id: "key123",
  private_key: "-----BEGIN PRIVATE KEY-----\n...",
  client_email: "service@my-project.iam.gserviceaccount.com"
});

const credentials = parseCredentials(credentialsJson);
console.log(credentials.project_id); // "my-project"
```

```typescript
// Invalid JSON - will throw error
try {
  const invalidJson = '{ "type": "service_account", "project_id": ';
  parseCredentials(invalidJson);
} catch (error) {
  console.log(error.message);
  // "Invalid GOOGLE_CLOUD_CREDENTIALS JSON: Unexpected end of JSON input. Preview: { "type": "service_account", "project_id": "
}
```

```typescript
// Using with environment variable
const credentials = parseCredentials(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}');
```

</details>

<details>
<summary>Implementation Details</summary>

The function uses a simple try-catch wrapper around `JSON.parse()` with enhanced error reporting:

1. **JSON Parsing**: Uses the native `JSON.parse()` method to convert the string to an object
2. **Error Handling**: Catches any parsing errors and enhances them with additional context
3. **Security Preview**: Limits the raw input preview to 200 characters to prevent full credential exposure in logs
4. **Error Message Extraction**: Safely extracts the original error message, falling back to a default message if unavailable

The security-conscious approach ensures that if credentials are malformed, the full credential string won't be logged, while still providing enough information for debugging.

</details>

<details>
<summary>Edge Cases</summary>

- **Empty String**: Throws error with message about unexpected end of JSON input
- **Non-JSON String**: Throws error with syntax error details and string preview
- **Very Long Input**: Only first 200 characters included in error preview to prevent log pollution
- **Non-Error Exceptions**: Handles cases where the caught exception is not an `Error` instance
- **Missing Error Message**: Falls back to "Unknown JSON parse error" if the error object lacks a message

</details>

<details>
<summary>Related</summary>

- `JSON.parse()` - The underlying parsing method used
- Google Cloud Authentication - The typical use case for this function
- Environment variable parsing - Common pattern for loading credentials from `GOOGLE_CLOUD_CREDENTIALS`

</details>