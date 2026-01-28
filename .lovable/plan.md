

## Plan: Add CSV Export/Re-upload for Unenriched Contacts on Campaign Review

This plan adds the ability to download candidates who couldn't be automatically enriched as a CSV file, and then re-upload the CSV with manually-sourced contact info (email/phone) to update those candidates.

---

### Overview

On the Campaign Review page's "Step 2: Prepare Candidates" section, we will add:
1. **Download Button** - Export unenriched candidates (those missing contact info) as a CSV template
2. **Upload Button** - Re-import the filled-out CSV to update candidate records with the external contact data

This allows recruiters to use external data sources (LinkedIn, paid services, manual lookup) to find contact info, then easily bring it back into the system.

---

### User Flow

```text
1. User reaches Step 2: Prepare Candidates on Campaign Review
2. User sees "X candidates need enrichment"
3. User clicks "Download for External Enrichment" button
   → CSV downloads with columns: candidate_id, first_name, last_name, specialty, city, state, email (blank), phone (blank)
4. User fills in email/phone columns externally (Excel, Google Sheets, etc.)
5. User clicks "Upload Enriched CSV" button
   → System parses CSV
   → Matches rows by candidate_id
   → Updates candidates with the new email/phone values
   → Shows success summary
6. Updated candidates now appear as "Ready to Contact"
```

---

### Technical Approach

#### 1. Update StepPrepareCandidates.tsx

Add two new buttons in the enrichment panel section:
- **Download Template** - Exports unenriched candidates to CSV
- **Upload CSV** - Opens file picker, parses uploaded CSV, updates records

**CSV Download Format:**
| candidate_id | first_name | last_name | specialty | city | state | personal_email | personal_phone |
|--------------|------------|-----------|-----------|------|-------|----------------|----------------|
| uuid-1       | John       | Smith     | Cardiology| Atlanta | GA | (fill in) | (fill in) |

**CSV Upload Parsing:**
- Read file using FileReader API
- Parse CSV (handle quotes, commas in values)
- Match rows by `candidate_id`
- Validate email format and phone format
- Batch update candidates table via Supabase
- Update local state with new values

#### 2. New Component: CSVUploadDialog.tsx

A dialog component that handles:
- File selection (accepts `.csv` files only)
- CSV parsing with error handling
- Preview of matched records before saving
- Progress indicator during save
- Summary of updated/skipped records

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/campaign-review/CSVUploadDialog.tsx` | Dialog for uploading and processing enriched CSV |

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/campaign-review/StepPrepareCandidates.tsx` | Add download and upload buttons, integrate CSVUploadDialog |

---

### Technical Details

**CSV Download Function:**
```typescript
const handleDownloadForEnrichment = () => {
  // Filter candidates missing both email AND phone
  const needsEnrichment = candidates.filter(c => {
    const hasEmail = c.email || c.personal_email;
    const hasPhone = c.phone || c.personal_mobile;
    return !hasEmail && !hasPhone;
  });

  const headers = ["candidate_id", "first_name", "last_name", "specialty", "city", "state", "personal_email", "personal_phone"];
  const rows = needsEnrichment.map(c => [
    c.id,
    c.first_name,
    c.last_name,
    c.specialty || "",
    c.city || "",
    c.state || "",
    "", // empty for user to fill
    ""  // empty for user to fill
  ]);
  
  // Create CSV blob and download
  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  // ... download logic
};
```

**CSV Upload + Parse Flow:**
1. User selects file via `<input type="file" accept=".csv">`
2. FileReader reads file as text
3. Parse CSV rows, handling:
   - Header row detection
   - Quoted values containing commas
   - Empty values
4. Match each row's `candidate_id` to existing candidates
5. Update via Supabase batch update
6. Refresh local candidate state

**Phone Normalization:**
- Strip non-digits
- Convert 10-digit to +1XXXXXXXXXX format
- Validate length

**Error Handling:**
- File format validation
- Missing required columns
- Invalid candidate IDs
- Malformed email/phone values
- Report skipped rows with reasons

---

### UI Design

The enrichment panel will show (when candidates need enrichment):

```text
┌─────────────────────────────────────────────────────┐
│ 💎 Contact Enrichment                    [Optional] │
├─────────────────────────────────────────────────────┤
│ → 15 candidates need contact info                   │
│   Enrich now or skip and launch with 45 ready       │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ✨ Enrich All 15 Candidates · ~$3.00            │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ✏️ Enter Contact Info Manually                  │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ─────────── OR ENRICH EXTERNALLY ───────────        │
│                                                     │
│ ┌───────────────────┐  ┌───────────────────┐        │
│ │ 📥 Download CSV   │  │ 📤 Upload CSV     │        │
│ └───────────────────┘  └───────────────────┘        │
│                                                     │
│ Download candidates as CSV, add contact info        │
│ externally, then re-upload to continue.             │
└─────────────────────────────────────────────────────┘
```

---

### Implementation Steps

1. **Create CSVUploadDialog component**
   - File input with drag-and-drop support
   - CSV parsing logic with error handling  
   - Preview table showing matched candidates
   - Batch update to Supabase
   - Success/failure summary

2. **Add download function to StepPrepareCandidates**
   - Export unenriched candidates with blank email/phone columns
   - Use proper CSV escaping for names with commas

3. **Add upload button and integrate dialog**
   - Wire up state management
   - Handle successful upload by refreshing candidates
   - Update tier stats after upload

4. **Polish and edge cases**
   - Handle re-upload (update existing values)
   - Skip rows where user didn't fill in any data
   - Show warning if candidate_id doesn't match

