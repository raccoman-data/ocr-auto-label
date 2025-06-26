# Adding New Sample Code Formats 🧬

This guide explains how to add support for new sample code formats to the OCR Auto-Label system. Follow these steps carefully to ensure your new format works correctly with both the AI and validation systems.

## 📋 Before You Start

### What You'll Need
- **Basic text editing skills** (copy, paste, find & replace)
- **A text editor** (Notepad++, VSCode, or even Notepad)
- **The new code format specification** (e.g., "TZN.0.[1-5].[1-8].[1-15].[1-20].[1-12]")
- **An example code** (e.g., "TZN.0.3.5.12.18.9")

### Understanding Sample Code Patterns
Sample codes follow a specific structure:
```
COUNTRY.TYPE.REGION.AREA.SAMPLE.BATCH.MONTH
   ↓      ↓     ↓     ↓     ↓     ↓     ↓
  TZN  .  0  . [1-5].[1-8].[1-15].[1-20].[1-12]
```

- **COUNTRY**: 3-letter country code (MWI, KEN, TZN, etc.)
- **TYPE**: Study type (0, 1, etc.) 
- **REGION**: Geographic region number
- **AREA**: Area within region
- **SAMPLE**: Sample number (may include letters like A-D)
- **BATCH**: Batch number  
- **MONTH**: Month number (1-12)

---

## 🎯 Step-by-Step Instructions

### Step 1: Update the AI Prompt (Backend) 🤖

**File:** `backend/src/services/gemini.ts`

**What to find:** Look for this section around line 75:
```typescript
SAMPLE CODE PATTERNS (must match exactly):
1. MWI.1.[1-3].[1-24].[1-10][A-D].[1-30].[1-12] 
   Example: MWI.1.2.15.7B.12.8 (exactly 6 periods, 7 segments)

2. MWI.0.[1-3].[1-6].[1-13].[1-27].[1-12]
   Example: MWI.0.1.4.10.15.7 (exactly 5 periods, 6 segments)

3. KEN.0.[1-2].[1-9].[1-8].[1-11].[1-12]
   Example: KEN.0.2.3.5.8.11 (exactly 5 periods, 6 segments)
```

**What to add:** Insert your new pattern as pattern #4:
```typescript
4. TZN.0.[1-5].[1-8].[1-15].[1-20].[1-12]
   Example: TZN.0.3.5.12.18.9 (exactly 5 periods, 6 segments)
```

> **💡 Tip:** Count the periods! Your example should have exactly the number of periods mentioned.

---

### Step 2: Update Backend Validation ⚙️

**Same file:** `backend/src/services/gemini.ts`

**What to find:** Look for the `isValidSampleCode` function around line 44:
```typescript
export function isValidSampleCode(code: string | null): boolean {
  if (!code) return false;
  
  const trimmedCode = code.trim().toUpperCase();
  
  // Pattern 1: MWI.1.[1-3].[1-24].[1-10][A-D].[1-30].[1-12]
  const mwi1Pattern = /^MWI\.1\.([1-3])\.([1-9]|1[0-9]|2[0-4])\.([1-9]|10)[A-D]\.([1-9]|1[0-9]|2[0-9]|30)\.([1-9]|1[0-2])$/;
  
  // Pattern 2: MWI.0.[1-3].[1-6].[1-13].[1-27].[1-12]
  const mwi0Pattern = /^MWI\.0\.([1-3])\.([1-6])\.([1-9]|1[0-3])\.([1-9]|1[0-9]|2[0-7])\.([1-9]|1[0-2])$/;
  
  // Pattern 3: KEN.0.[1-2].[1-9].[1-8].[1-11].[1-12]
  const ken0Pattern = /^KEN\.0\.([1-2])\.([1-9])\.([1-8])\.([1-9]|1[0-1])\.([1-9]|1[0-2])$/;
  
  return mwi1Pattern.test(trimmedCode) || mwi0Pattern.test(trimmedCode) || ken0Pattern.test(trimmedCode);
}
```

**What to add:** Add your new pattern and include it in the return statement:
```typescript
  // Pattern 4: TZN.0.[1-5].[1-8].[1-15].[1-20].[1-12]
  const tznPattern = /^TZN\.0\.([1-5])\.([1-8])\.([1-9]|1[0-5])\.([1-9]|1[0-9]|20)\.([1-9]|1[0-2])$/;
  
  return mwi1Pattern.test(trimmedCode) || mwi0Pattern.test(trimmedCode) || ken0Pattern.test(trimmedCode) || tznPattern.test(trimmedCode);
```

> **⚠️ Important:** Don't forget to add `|| tznPattern.test(trimmedCode)` to the return statement!

---

### Step 3: Update Frontend Validation (3 Files) 🖥️

#### File 1: `frontend/src/lib/validation.ts`

**What to find:** Look for the `SAMPLE_CODE_PATTERNS` object around line 14.

**What to add:** Add your new pattern object after the existing ones:
```typescript
  TZN_TYPE_0: {
    pattern: /^TZN\.0\.[1-5]\.\d+\.\d+\.\d+\.\d+$/,
    description: 'TZN.0.[1-5].[1-8].[1-15].[1-20].[1-12]',
    segments: 6,
    periods: 5,
    validate: (segments: string[]) => {
      const [prefix, type, region, area, sample, batch, month] = segments;
      const errors: string[] = [];
      
      if (prefix !== 'TZN') errors.push('Must start with TZN');
      if (type !== '0') errors.push('Second segment must be 0 for this pattern');
      
      const regionNum = parseInt(region);
      if (regionNum < 1 || regionNum > 5) errors.push('Region must be 1-5');
      
      const areaNum = parseInt(area);
      if (areaNum < 1 || areaNum > 8) errors.push('Area must be 1-8');
      
      const sampleNum = parseInt(sample);
      if (sampleNum < 1 || sampleNum > 15) errors.push('Sample must be 1-15');
      
      const batchNum = parseInt(batch);
      if (batchNum < 1 || batchNum > 20) errors.push('Batch must be 1-20');
      
      const monthNum = parseInt(month);
      if (monthNum < 1 || monthNum > 12) errors.push('Month must be 1-12');
      
      return errors;
    }
  }
```

**Also find and update:** The warnings section around line 135:
```typescript
warnings: [
  'Expected patterns:',
  '• MWI.1.[1-3].[1-24].[1-10][A-D].[1-30].[1-12]',
  '• MWI.0.[1-3].[1-6].[1-13].[1-27].[1-12]',
  '• KEN.0.[1-2].[1-9].[1-8].[1-11].[1-12]',
  '• TZN.0.[1-5].[1-8].[1-15].[1-20].[1-12]'
]
```

#### File 2: `frontend/src/components/GroupEditor.tsx`

**What to find:** The `isValidSampleCode` function around line 8.

**What to add:** Same pattern as Step 2 - add your regex pattern and include it in the return statement.

#### File 3: `frontend/src/components/ImageTable/ImageTable.tsx` 

**What to find:** The `isValidSampleCode` function around line 8.

**What to add:** Same pattern as Step 2 - add your regex pattern and include it in the return statement.

---

### Step 4: Update Documentation 📚

**File:** `README.md`

**What to find:** Look for the Sample Code Patterns section around line 230:
```markdown
### Sample Code Patterns
The app recognizes these specific patterns:
- **MWI codes:** `MWI.1.2.15.7B.12.8` or `MWI.0.1.4.10.15.7`
- **KEN codes:** `KEN.0.2.3.5.8.11`
```

**What to add:**
```markdown
### Sample Code Patterns
The app recognizes these specific patterns:
- **MWI codes:** `MWI.1.2.15.7B.12.8` or `MWI.0.1.4.10.15.7`
- **KEN codes:** `KEN.0.2.3.5.8.11`
- **TZN codes:** `TZN.0.3.5.12.18.9`
```

---

## 🔧 Building Regex Patterns (For Technical Users)

If you need to create the regex pattern yourself, here's the formula:

### Pattern Structure
```
^COUNTRY\.TYPE\.SEGMENT1\.SEGMENT2\.SEGMENT3\.SEGMENT4\.SEGMENT5$
```

### Regex Building Blocks
- `^` = Must start here
- `TZN\.0\.` = Literal "TZN.0." (dots are escaped with `\.`)
- `([1-5])` = Single digit 1-5
- `([1-8])` = Single digit 1-8  
- `([1-9]|1[0-5])` = Numbers 1-9 OR 10-15
- `([1-9]|1[0-9]|20)` = Numbers 1-9 OR 10-19 OR 20
- `([1-9]|1[0-2])` = Numbers 1-9 OR 10-12 (months)
- `$` = Must end here

### Example: TZN.0.[1-5].[1-8].[1-15].[1-20].[1-12]
```regex
^TZN\.0\.([1-5])\.([1-8])\.([1-9]|1[0-5])\.([1-9]|1[0-9]|20)\.([1-9]|1[0-2])$
```

---

## ✅ Testing Your Changes

### Step 1: Restart the App
```bash
npm start
```

### Step 2: Test with Sample Images
1. **Upload a test image** with your new code format written on it
2. **Check the processing results** - it should recognize and validate your code
3. **Verify the validation icons** show green checkmarks for valid codes

### Step 3: Test Edge Cases
- **Invalid codes** (numbers outside the ranges) should show red warning icons
- **Partial codes** should be flagged as invalid
- **Similar but wrong codes** should not validate

---

## 🚨 Common Mistakes & Troubleshooting

### ❌ Forgot to Update All Files
**Problem:** Code recognized in some places but not others
**Solution:** Make sure you updated ALL 5 files mentioned in the steps

### ❌ Wrong Regex Pattern
**Problem:** Valid codes showing as invalid
**Solution:** Double-check your number ranges match the specification exactly

### ❌ Missing Return Statement Update
**Problem:** New pattern never validates
**Solution:** Add `|| yourPattern.test(trimmedCode)` to ALL `isValidSampleCode` functions

### ❌ Period Count Mismatch
**Problem:** AI can't read codes reliably
**Solution:** Verify your example has exactly the right number of periods

---

## 📞 Getting Help

If you run into problems:

1. **Check the browser console** (Press F12 → Console tab) for error messages
2. **Test with a clear, hand-written sample** first
3. **Compare your changes** with the existing MWI/KEN patterns
4. **Ask for help** with specific error messages and what you were trying to do

---

## 🎉 Success!

Once everything is working, your new sample code format will:
- ✅ Be recognized by the AI from photos
- ✅ Show proper validation indicators in the UI  
- ✅ Auto-group related images correctly
- ✅ Export with proper filenames

---

*This guide covers the most common scenario. For complex patterns with letters, special formatting, or multiple subtypes, you may need additional modifications.* 