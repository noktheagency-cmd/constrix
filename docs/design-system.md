# Constrix UI

Interplasterp-in yığcam iş ekranlarından ilhamlanan dizayn sistemi. Əsas rəng `#0e2a43` olaraq qalır. Ağ iş sahəsi, açıq boz menyu, incə çərçivələr və az dekorasiya istifadə olunur.

## Ortaq mənbələr

- `src/styles/system.css`: rənglər, ölçülər, ortaq komponent üslubları, mobil ölçülər və tünd rejim.
- `src/components/primitives.tsx`: `Button`, `Input`, `Textarea`, `SearchInput`, `Panel`, `SectionHeader`, `Toolbar`, `TableContainer`, `StatGrid`, `Metric`, `Disclosure`.
- `src/ui.tsx`: `PageHead`, `Tabs`, `Select`, `Badge`, `Modal`, `Drawer`, `Empty` və digər mövcud ortaq idarələr.
- `src/index.css`: işə aid xüsusi düzülüşlər və çap formatları. Yeni ortaq rəng və komponent qaydalarını burada təkrarlamayın.

## Səhifə quruluşu

1. `PageHead` ilə başlıq, qısa izah və əsas əməliyyat.
2. Lazımdırsa `StatGrid` daxilində əsas göstəricilər.
3. `Toolbar` daxilində tablar, axtarış və filtrlər.
4. Əsas iş siyahısı üçün `TableContainer`; xüsusi iş bölmələri üçün `Panel`.
5. İkinci dərəcəli qrafik və təhlillər üçün `Disclosure`.

Eyni məlumatı həm kartlarda, həm də cədvəldə yanaşı təkrarlamayın. Alternativ görünüş lazımdırsa tabdan istifadə edin. Dekorativ bölmə adlarını səhifə başlığının üzərində təkrarlamayın.

## İstifadə

```tsx
<PageHead title="Məhsullar" text="Məhsul və satış şərtləri.">
  <Button onClick={openForm}>Yeni məhsul</Button>
</PageHead>
<Toolbar>
  <SearchInput value={query} onChange={(event) => setQuery(event.target.value)} />
</Toolbar>
<TableContainer>
  <table>{/* başlıq və sətirlər */}</table>
</TableContainer>
```

`Button` ilkin olaraq `type="button"` istifadə edir. Formanı göndərən düymədə `type="submit"` mütləq yazılmalıdır. İkinci dərəcəli əməliyyat üçün mövcud `ghost`, yığcam əməliyyat üçün `small` sinifləri istifadə olunur.

`Input` və `Textarea` bütün native atributları və ref-i ötürür. Checkbox, radio və fayl seçiciləri öz semantikasını saxlayır. `Panel` üçün `as="div"` və `as="article"` də mümkündür.

Mobil görünüşdə geniş cədvəl `TableContainer` daxilində sürüşməlidir; bütün səhifə üfüqi daşmamalıdır. Formanın və ya cədvəlin domen məntiqini üslub komponentinin daxilinə köçürməyin. Rəsmi sənədlərin çap düzülüşlərini ayrıca saxlayın.

## Klaviatura

- Tablar: ox düymələri, Home və End.
- Modal və drawer: fokus pəncərə daxilində qalır, bağlananda əvvəlki elementə qayıdır.
- Başlanğıcdakı “Məzmuna keç” keçidi menyunu ötürməyə imkan verir.
- Görünən fokus işarələrini və reduced-motion qaydalarını qoruyun.
