# One Chitra Development Guidelines

## 📁 File Upload Rule (Standardized)

To ensure uploaded files are persistent across deployments on Dokploy, all file uploads MUST follow this unified rule:

### 1. Storage Location
Files are stored in the `public/uploads` directory. On production (Dokploy), this folder is mapped to a **Persistent Bind Mount** at `/mnt/data/one-chitra/uploads`.

### 2. Upload Action
Always use the centralized `uploadFile` action. Do NOT use `fs` directly in your components or other actions.

**Usage:**
```typescript
import { uploadFile } from "@/app/actions/upload"

const formData = new FormData()
formData.append("file", fileInstance)

const result = await uploadFile(formData)
if (result.success) {
  const fileUrl = result.url // Returns something like "/api/uploads/uuid.png"
}
```

### 3. File Serving
Files are served via a custom API route to bypass Next.js static asset limitations in standalone mode:
`GET /api/uploads/[filename]`

### 4. Supported Types
The system automatically detects and sets the correct headers for:
- Images (JPG, PNG, WebP, GIF)
- Documents (PDF)
- Others (Octet-stream)

---

## 🛠️ Infrastructure Reminder
If you add a new service or redeploy, ensure the following command has been run on the VPS host:
```bash
sudo chown -R 1001:1001 /mnt/data/one-chitra/uploads
sudo chmod -R 775 /mnt/data/one-chitra/uploads
```
