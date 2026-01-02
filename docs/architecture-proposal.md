# Unified Local-First Storage + Replication (Design Spec)

## 0) Summary
This document specifies a clean-slate rewrite of storage and sync. Local IndexedDB is always the single source of truth. Cloud mode simply replicates on sign-in and on save. The UI/UX must remain unchanged.

Key changes:
- One local dataset for all modes (no local vs synced cache split).
- One DEK for all data; cloud stores a wrapped copy on sign-in.
- Notes and images are always encrypted locally; images are encrypted before cloud upload.
- Sync is cursor-based replication with explicit deletes (no missing-index deletion inference).

## 1) Goals
- Single local dataset for all modes (local-first, always).
- Cloud replication triggered on sign-in and on save.
- Same UI/UX behavior, modals, flows, and visual presentation.
- Encrypted images in cloud for privacy and consistency.
- Lower operational complexity and fewer sync edge cases.
- Keep Supabase free-tier costs modest.

## 2) Non-goals
- No UI changes or UX flow changes.
- No incremental refactor; storage/sync logic is replaced with clean-slate modules.
- No new features (sharing, multi-note-per-day, etc.).

## 3) Invariants (Must Not Change)
- App looks and feels identical: same modals, prompts, and navigation.
- Mode choice still exists in UI, but it only toggles replication behavior.
- Note content remains sanitized using existing rules.
- Existing Supabase auth flow stays the same (sign-in/up/out flows unchanged).
- Existing local vault prompt behavior remains unchanged.

## 4) Unified Data Model (Local IDB)
A single IDB schema is used regardless of auth state.

### 4.1 Object Store: notes
- key: `date` (DD-MM-YYYY)
- fields:
  - `key_id`: string
  - `ciphertext`: string (base64 AES-GCM ciphertext)
  - `nonce`: string (base64 AES-GCM nonce)
  - `updated_at`: string (ISO timestamp, client-generated)
  - `deleted`: boolean

### 4.2 Object Store: note_meta
- key: `date`
- fields:
  - `revision`: number (increment on local save)
  - `remote_id`: string | null (Supabase notes.id)
  - `server_updated_at`: string | null (Supabase server timestamp)
  - `last_synced_at`: string | null (local time last synced)
  - `pending_op`: 'upsert' | 'delete' | null

### 4.3 Object Store: sync_state
- key: singleton (e.g., "state")
- fields:
  - `cursor`: string | null (latest server_updated_at pulled)

### 4.4 Object Store: images
- key: `image_id` (UUID)
- fields:
  - `key_id`: string
  - `ciphertext`: string (base64 AES-GCM ciphertext)
  - `nonce`: string (base64 AES-GCM nonce)
  - `sha256`: string (hex)
  - `size`: number
  - `mime_type`: string
  - `width`: number
  - `height`: number
  - `created_at`: string

### 4.5 Object Store: image_meta
- key: `image_id`
- fields:
  - `key_id`: string
  - `remote_path`: string | null
  - `server_updated_at`: string | null
  - `pending_op`: 'upload' | 'delete' | null

## 5) Key Handling
### 5.1 Multi-Key DEK Registry
- The app can hold multiple DEKs; each has a `key_id`.
- Local-only: DEKs are device-wrapped and stored locally.
- On sign-in: all locally known DEKs are wrapped with the password KEK and stored in Supabase.
- Notes/images reference `key_id` so data never needs re-encryption.

### 5.2 Image Encryption
- Images are encrypted client-side (AES-GCM via WebCrypto).
- Key strategy:
  - Preferred: derive an image key via HKDF from the DEK (key_id/version stored in metadata).
- Encryption operates on the final compressed bytes (not the original file).

## 6) Sync Protocol (Notes)
### 6.1 Push (on save)
- Save note locally (encrypted) and update note_meta:
  - `revision += 1`
  - `pending_op = 'upsert'`
- If online and signed in, push immediately.
- On successful push, update:
  - `remote_id`, `server_updated_at`, `last_synced_at`, `pending_op = null`

### 6.2 Delete
- Mark local note as deleted and set `pending_op = 'delete'`.
- Sync deletes explicitly; do not infer deletions from missing remote index.

### 6.3 Pull (on sign-in + periodic)
- Use `sync_state.cursor` to fetch only remote notes updated since last pull.
- Apply remote notes if:
  - No local note exists, or
  - `server_updated_at` is newer than local meta, or
  - local has no `server_updated_at` and remote does.
- Update cursor after successful batch.

### 6.4 Conflict Resolution
- Primary: `server_updated_at` (server wins if newer).
- Secondary: `revision` (higher revision wins when timestamps tie).
- If local wins during conflict, push local state and update `server_updated_at`.

### 6.5 Failure Handling
- If sync fails, leave pending ops intact.
- Sync status mirrors existing UI states (Idle/Syncing/Synced/Offline/Error).

## 7) Sync Protocol (Images)
### 7.1 Save (local)
- Resize + compress client-side before encryption (max long edge 1600–2048px).
- Encrypt compressed bytes; compute sha256 and store metadata.
- Set `pending_op = 'upload'`.

### 7.2 Upload
- On sign-in or when online, upload ciphertext to Supabase Storage.
- Store `remote_path` and `server_updated_at` on success.
- Skip upload if `sha256` matches existing remote metadata.
- Store files at `notes/<user>/<noteId>/<imageId>.enc` (or similar).

### 7.3 Delete
- Set `pending_op = 'delete'` and remove from remote storage on sync.

### 7.4 Rendering
- Prefer local decrypted blob URLs for inline rendering.
- Use remote signed URLs as fallback (same UX as current).

## 8) Supabase Schema (Notes)
- `notes` table fields:
  - id, user_id, date, ciphertext, nonce, key_id, revision, updated_at, server_updated_at, deleted
- `server_updated_at` should be set by the DB (trigger or default). Must be monotonically increasing for cursor use.

## 8.1) Supabase Schema (Keyrings)
- `user_keyrings` table fields:
  - user_id, key_id, wrapped_dek, dek_iv, kdf_salt, kdf_iterations, version, is_primary, created_at, updated_at
- Stores all locally known DEKs wrapped with the password-derived KEK.

## 9) Supabase Schema (Images)
- `note_images` table fields:
  - id, user_id, note_date, ciphertext_path, thumb_path, sha256, size, mime_type,
    width, height, created_at, server_updated_at, deleted, key_id, nonce, thumb_nonce
- Storage bucket stores ciphertext blobs (full + thumbnail).
- RLS policies enforced by user_id.

## 10) Cost Controls
- Enforce strict max dimensions + compression before encryption (target 200–600KB).
- Generate encrypted thumbnails (~320px long edge) for fast list/calendar views.
- Deduplicate uploads via sha256.
- Avoid per-note read for calendar by relying on local cache after sync.

## 11) Migration
### 11.1 Legacy Stores
- `dailynotes-notes`, `dailynotes-synced`, legacy image stores.

### 11.2 One-time Import
- Detect and import legacy data into the new schema.
- If both local and synced versions exist:
  - Prefer the one with the newer `updatedAt`, else higher revision.
- Preserve timestamps and revision where possible.
- Set a migration-complete flag to ensure idempotency.

## 12) Validation
- Unit tests for encryption/decryption (notes + images).
- Integration tests for sync push/pull, conflict resolution, and deletes.
- Migration tests to confirm legacy data is preserved.
- UX regression checks (manual) to ensure identical behavior.

## 13) Implementation Outline
1) Build new storage modules (notes + images) with unified schema.
2) Build new sync engine using cursor-based replication.
3) Implement encrypted image replication pipeline.
4) Update Supabase schema and RLS policies.
5) Implement migration from legacy stores.
6) Wire into app without UI changes.
7) Validate with tests and updated docs.

## 14) Open Decisions
- Cursor semantics: use `server_updated_at` vs dedicated `updated_seq`.
