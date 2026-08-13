# Contract: Upload File

**Endpoint**: `POST /api/AIWebAPI/uploadFile`
**Auth**: Required (JWT via existing interceptor)
**Content-Type**: `multipart/form-data` (browser-generated boundary)

## Request

| Part | Type | Required | Notes |
|---|---|---|---|
| `agentId` | number (form field) | Yes | Numeric agent ID; resolved at attach time |
| `file` | binary (file part) | Yes | The file itself; `filename` in the part header carries the original name |

**Not sent**: MIME type (server determines from filename + content), separate filename field.

## Response

Standard `ApiResponse<T>` envelope:

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "mimeType": "image/png",
    "thumbnailUrl": ""
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `data.id` | `string` | GUID; the reference to include in `files[]` when sending the message |
| `data.mimeType` | `string` | Server-determined MIME type; authoritative, may differ from browser's guess |
| `data.thumbnailUrl` | `string` | Currently always `""`; will become thumbnail URL when serving endpoint exists |

## Error Responses

Standard `ApiResponse<T>` error shape. Known failure modes:

| Scenario | Expected behavior |
|---|---|
| File too large (server-side limit) | 4xx with error message |
| Unsupported file type (server-side) | 4xx with error message |
| Authentication expired | 401 → handled by existing auth interceptor |

## FormData Construction

```
const formData = new FormData()
formData.append('agentId', String(agentId))
formData.append('file', file)
```

The existing `transformRequestInterceptor` in `lib/api/interceptors/request.ts` detects `FormData`
and removes the `Content-Type: application/json` header, letting the browser set the correct
multipart boundary. No per-call header override needed.

## Zod Schema

```
UploadFileResponseDTOSchema = z.object({
  id: z.string().uuid(),
  mimeType: z.string(),
  thumbnailUrl: z.string(),
})
```
