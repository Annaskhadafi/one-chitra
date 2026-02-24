# Mobile Native Design - Dashboard Tables

## Overview
Implementasi desain native mobile yang modern dan touch-friendly untuk semua tabel dashboard. Desain menggunakan card-based layout dengan gradient backgrounds, shadows, dan interactive elements yang memberikan pengalaman seperti aplikasi mobile native.

## Fitur Desain Mobile Native

### Visual Design
- **Gradient Backgrounds**: Setiap card menggunakan gradient yang sesuai dengan konteks (red/amber untuk alerts, emerald/blue/slate untuk ABC class, blue/indigo untuk data, purple/pink untuk sales)
- **Glassmorphism**: Backdrop blur dan transparency untuk efek modern
- **Rounded Corners**: Border radius 2xl (16px) untuk tampilan yang lebih soft
- **Shadows & Borders**: Border 2px dengan shadow untuk depth
- **Active States**: Scale animation saat di-tap untuk feedback visual

### Typography
- **Font Hierarchy**: Jelas dengan size yang berbeda untuk header, body, dan metadata
- **Tabular Numbers**: Menggunakan font-mono untuk angka agar alignment konsisten
- **Font Weights**: Bold/Black untuk emphasis, Medium untuk labels

### Layout
- **Touch-Friendly**: Spacing yang cukup besar (p-4, gap-3/4) untuk easy tapping
- **Grid System**: 2-column grid untuk info yang terstruktur
- **Badges & Pills**: Rounded badges untuk status dan kategori
- **Absolute Positioning**: Status badges di top-right untuk visibility

## Halaman yang Telah Diupdate

### 1. Reorder Point Alert (`/dashboard/stock-alerts`)
**Desain:**
- Gradient red/amber background sesuai urgency level
- Status badge (CRITICAL/WARNING) di top-right dengan icon
- Material number sebagai heading dengan font-mono
- Stock stats dalam card terpisah dengan 3 kolom
- Number badge untuk index

**Warna:**
- Critical: Red gradient (from-red-50 to-red-100/50)
- Warning: Amber gradient (from-amber-50 to-amber-100/50)

### 2. ABC Analysis (`/dashboard/abc-analysis`)
**Desain:**
- Gradient background sesuai ABC class (emerald/blue/slate)
- Large ABC badge (48x48px) di top-right
- Low stock alert badge di top-left jika applicable
- Progress bar dengan warna sesuai class
- Movement stats dalam card dengan backdrop blur

**Warna:**
- Class A: Emerald gradient (from-emerald-50 to-emerald-100/50)
- Class B: Blue gradient (from-blue-50 to-blue-100/50)
- Class C: Slate gradient (from-slate-50 to-slate-100/50)

### 3. Competitor Info (`/dashboard/competitor-info`)
**Desain:**
- Blue/indigo gradient background
- Price badge dengan gradient green di top-right
- Customer name sebagai heading
- Product info dalam 2x2 grid
- Remark section terpisah dengan backdrop blur

**Warna:**
- Background: Blue/indigo gradient
- Price badge: Green to emerald gradient

### 4. Dashboard R49 Tire (`/dashboard/r49-dashboard`)
**Desain:**
- Header dengan gradient purple/indigo background (clickable)
- Expand/collapse icon dalam rounded square
- Year stats dalam individual cards
- Material breakdown dengan numbered badges
- Divider dengan gradient line untuk sections

**Warna:**
- Header: Purple to indigo gradient
- Materials: Indigo gradient cards

### 5. Sales Dashboard (`/dashboard/sales-dashboard`)
**Desain:**
- Header dengan gradient purple/pink background (clickable)
- Year cards dengan highlight untuk sorted year
- Ring effect untuk active sort year
- Revenue groups dengan numbered badges
- 2-column grid untuk year breakdown

**Warna:**
- Header: Purple to pink gradient
- Active year: Purple ring effect
- Groups: Purple/pink gradient cards

## Komponen & Utilities

### ResponsiveTableWrapper
Breakpoint diubah dari `md` (768px) ke `lg` (1024px) untuk memberikan lebih banyak ruang untuk mobile view.

```tsx
// Desktop: >= 1024px (lg)
// Mobile: < 1024px
```

### Utility Classes yang Sering Digunakan
- `rounded-2xl`: Border radius 16px
- `backdrop-blur-sm`: Glassmorphism effect
- `active:scale-[0.98]`: Touch feedback
- `tabular-nums`: Monospace numbers
- `truncate`: Text overflow handling
- `line-clamp-2`: Multi-line text truncation

## Design Patterns

### Card Structure
```tsx
<div className="rounded-2xl border-2 bg-gradient-to-br ...">
  {/* Absolute positioned badges */}
  <div className="absolute top-3 right-3">...</div>
  
  {/* Content */}
  <div className="p-4 space-y-4">
    {/* Header with index badge */}
    {/* Info grid */}
    {/* Stats card with backdrop blur */}
  </div>
</div>
```

### Interactive Header (Expandable)
```tsx
<div className="p-4 bg-gradient-to-r ... cursor-pointer active:scale-[0.99]">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl bg-white/20">
      <Icon />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-bold text-white truncate">...</h3>
    </div>
  </div>
</div>
```

### Stats Display
```tsx
<div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border-2">
  <div className="grid grid-cols-2 gap-4">
    <div>
      <div className="text-xs text-muted-foreground">Label</div>
      <div className="text-2xl font-black tabular-nums">Value</div>
    </div>
  </div>
</div>
```

## Accessibility
- Touch targets minimal 44x44px
- Sufficient color contrast
- Clear visual hierarchy
- Active/focus states untuk interactive elements

## Performance
- Menggunakan CSS transforms untuk animations (GPU accelerated)
- Conditional rendering untuk expanded states
- Optimized re-renders dengan proper key props

## Browser Support
- Modern browsers dengan support untuk:
  - CSS backdrop-filter
  - CSS gradients
  - CSS transforms
  - Flexbox & Grid
