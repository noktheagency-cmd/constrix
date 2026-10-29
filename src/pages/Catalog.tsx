import { Button, Input, TableContainer, Toolbar } from "../components/primitives"
import { useRef, useState, type ReactNode } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { hit } from "../format"
import { Icon } from "../icons"
import { blankState, kindLabel, seesCost, showPath, type PriceBreak, type Product } from "../procure/engine"
import { patchProcure, procureNow, stamp, useProcure } from "../procure/store"
import { useOrgs } from "../orgs"
import { useStore } from "../store"
import { Confirm, Empty, Modal, PageHead, RowMenu, Select, Tabs, useTitle } from "../ui"

const emptyProduct = { name: "", code: "", category: "Alüminium profil", params: "", colors: "", sizes: "", unit: "m", price: "", cost: "", validUntil: "", minQty: "", leadDays: "", deliveryPrice: "", installPrice: "" }
const freshChoice = "__yeni__"
const seedCategories = new Set(blankState().categories.map((item) => item.toLocaleLowerCase("az")))

function remember(list: string[], name: string) {
  const trimmed = name.trim()
  if (!trimmed) return { list, name: "" }
  const key = trimmed.toLocaleLowerCase("az")
  const found = list.find((item) => item.trim().toLocaleLowerCase("az") === key)
  if (found) return { list, name: found }
  return { list: [...list, trimmed], name: trimmed }
}

function keepName(kind: "categories" | "units", name: string) {
  const next = remember(procureNow()[kind], name)
  if (next.list !== procureNow()[kind]) patchProcure((current) => ({ ...current, [kind]: remember(current[kind], name).list }))
  return next.name
}

type Draft = typeof emptyProduct

function draftFrom(product: Product): Draft {
  return {
    name: product.name,
    code: product.code,
    category: product.category,
    params: product.params,
    colors: product.colors,
    sizes: product.sizes,
    unit: product.unit,
    price: product.price,
    cost: product.cost,
    validUntil: product.validUntil,
    minQty: product.minQty,
    leadDays: product.leadDays,
    deliveryPrice: product.deliveryPrice,
    installPrice: product.installPrice,
  }
}

function freshId() {
  return crypto.randomUUID()
}

function text(value: string) {
  const trimmed = value.trim()
  return trimmed || "—"
}

function day(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return text(value)
  return `${match[3]}.${match[2]}.${match[1]}`
}

function when(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return text(value)
  return date.toLocaleDateString("az-AZ", { day: "2-digit", month: "short", year: "numeric" })
}

function ChoiceField({
  label,
  value,
  choices,
  placeholder,
  onValue,
  onCreate,
}: {
  label: string
  value: string
  choices: string[]
  placeholder: string
  onValue: (value: string) => void
  onCreate: (value: string) => void
}) {
  const prior = useRef(value)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState("")
  const known = [...new Set(choices.map((item) => item.trim()).filter(Boolean))]
  const options = [
    { value: freshChoice, label: "Yeni" },
    ...known.map((item) => ({ value: item, label: item })),
  ]
  if (value.trim() && !known.some((item) => item.toLocaleLowerCase("az") === value.trim().toLocaleLowerCase("az"))) {
    options.push({ value, label: value })
  }

  function begin() {
    prior.current = value
    setDraft("")
    setAdding(true)
  }

  function finish() {
    const name = draft.trim()
    if (!name) {
      setAdding(false)
      onValue(prior.current)
      return
    }
    onCreate(name)
    setAdding(false)
  }

  return (
    <label>
      {label}
      <Select
        value={adding ? freshChoice : value}
        onValueChange={(next) => {
          if (next === freshChoice) begin()
          else {
            setAdding(false)
            onValue(next)
          }
        }}
        options={options}
      />
      {adding && (
        <Input
          className="catalog-fresh"
          value={draft}
          autoFocus
          placeholder={placeholder}
          onChange={(event) => {
            setDraft(event.target.value)
            onValue(event.target.value)
          }}
          onBlur={finish}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            event.preventDefault()
            finish()
          }}
        />
      )}
    </label>
  )
}

function ProductForm({
  form,
  setForm,
  categories,
  units,
  saveLabel,
  showCost = true,
  onSave,
  onCancel,
}: {
  form: Draft
  setForm: (next: Draft) => void
  categories: string[]
  units: string[]
  saveLabel: string
  showCost?: boolean
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="form-row wide catalog-fields">
        <label>Ad<Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>Kod<Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
        <ChoiceField
          label="Kateqoriya"
          value={form.category}
          choices={categories}
          placeholder="Yeni kateqoriya"
          onValue={(category) => setForm({ ...form, category })}
          onCreate={(category) => setForm({ ...form, category: keepName("categories", category) })}
        />
        <label>Parametr<Input value={form.params} onChange={(event) => setForm({ ...form, params: event.target.value })} /></label>
        <label>Rəng<Input value={form.colors} onChange={(event) => setForm({ ...form, colors: event.target.value })} /></label>
        <label>Ölçü<Input value={form.sizes} onChange={(event) => setForm({ ...form, sizes: event.target.value })} /></label>
        <ChoiceField
          label="Vahid"
          value={form.unit}
          choices={units}
          placeholder="Yeni vahid"
          onValue={(unit) => setForm({ ...form, unit })}
          onCreate={(unit) => setForm({ ...form, unit: keepName("units", unit) })}
        />
        <label>Satış qiyməti<Input value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label>
        {showCost && <label>Maya<Input value={form.cost} onChange={(event) => setForm({ ...form, cost: event.target.value })} /></label>}
        <label>Qüvvədədir<Input value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} placeholder="2026-12-31" /></label>
        <label>Minimum<Input value={form.minQty} onChange={(event) => setForm({ ...form, minQty: event.target.value })} /></label>
        <label>İstehsal, gün<Input value={form.leadDays} onChange={(event) => setForm({ ...form, leadDays: event.target.value })} /></label>
        <label>Çatdırılma<Input value={form.deliveryPrice} onChange={(event) => setForm({ ...form, deliveryPrice: event.target.value })} /></label>
        <label>Montaj<Input value={form.installPrice} onChange={(event) => setForm({ ...form, installPrice: event.target.value })} /></label>
        <div className="pricebook-actions">
          <Button type="button" onClick={onSave} disabled={!form.name.trim()}>{saveLabel}</Button>
          <Button type="button" className="ghost" onClick={onCancel}>Ləğv et</Button>
        </div>
    </div>
  )
}

function Guard({ children }: { children: ReactNode }) {
  const state = useProcure()
  const kind = state.companies.find((item) => item.id === state.activeId)?.kind
  if (showPath("/kataloq", kind ?? "")) return children
  return <PageHead kicker="Kabinet" title="Bu bölmə bağlıdır" text={`${kind ? kindLabel(kind) : "Şirkət seçilməyib"}. Bu növün kabinetində həmin iş yoxdur.`} />
}

function useCatalog() {
  const state = useProcure()
  const orgs = useOrgs()
  const activeId = orgs.activeId || state.activeId
  const active = state.companies.find((item) => item.id === activeId) ?? state.companies.find((item) => item.id === state.activeId)
  const visible = state.products.filter((item) => active?.kind === "admin" || item.companyId === activeId || !seesCost(active?.kind ?? "", item.companyId, activeId))
  return { state, active, activeId, visible }
}

export function CatalogPage() {
  useTitle("Kataloq")
  const { query } = useStore()
  const { state, active, activeId, visible } = useCatalog()
  const go = useNavigate()
  const [form, setForm] = useState(emptyProduct)
  const [find, setFind] = useState("")
  const [category, setCategory] = useState("hamisi")
  const [compose, setCompose] = useState(false)
  const [editingId, setEditingId] = useState("")
  const [drop, setDrop] = useState<Product | null>(null)
  const categories = [...new Set([
    ...visible.map((item) => item.category.trim()).filter(Boolean),
    ...state.categories.filter((item) => item.trim() && !seedCategories.has(item.trim().toLocaleLowerCase("az"))),
  ])].sort((a, b) => a.localeCompare(b, "az"))
  const current = category === "hamisi" || categories.includes(category) ? category : "hamisi"
  const shown = visible
    .filter((item) => {
      const owner = state.companies.find((company) => company.id === item.companyId)
      const categoryOk = current === "hamisi" || item.category === current
      const parts = [item.name, item.code, item.category, item.params, item.colors, item.sizes, item.unit, owner?.name]
      return categoryOk && hit(query, ...parts) && hit(find, ...parts)
    })
    .sort((a, b) => a.category.localeCompare(b.category, "az") || a.name.localeCompare(b.name, "az"))

  function closeForm() {
    setCompose(false)
    setEditingId("")
    setForm({ ...emptyProduct, category: state.categories[0] || "Alüminium profil" })
  }

  function openNew() {
    setEditingId("")
    setForm({ ...emptyProduct, category: state.categories[0] || "Alüminium profil" })
    setCompose(true)
  }

  function startEdit(product: Product) {
    setForm(draftFrom(product))
    setEditingId(product.id)
    setCompose(true)
  }

  function saveProduct() {
    if (!active || !form.name.trim()) return
    const name = form.name.trim()
    const category = remember(state.categories, form.category)
    const unit = remember(state.units, form.unit)
    if (editingId) {
      const previous = state.products.find((item) => item.id === editingId)
      if (!previous || !writable()) return
      const priceChanged = previous.price !== form.price
      patchProcure((currentState) => ({
        ...currentState,
        categories: remember(currentState.categories, form.category).list,
        units: remember(currentState.units, form.unit).list,
        products: currentState.products.map((item) => item.id === previous.id ? { ...item, ...form, name, category: category.name, unit: unit.name, cost: seesCost(active.kind, previous.companyId, activeId) ? form.cost : item.cost, breaks: item.breaks } : item),
        prices: priceChanged ? [...currentState.prices, { id: freshId(), productId: previous.id, at: new Date().toISOString(), from: previous.price, to: form.price, by: currentState.actor }] : currentState.prices,
        audit: [...currentState.audit, stamp(currentState, "Məhsul düzəldi", name)],
      }))
      closeForm()
      return
    }
    const product: Product = { ...form, name, category: category.name, unit: unit.name, id: freshId(), companyId: active.id, breaks: [] }
    patchProcure((currentState) => ({
      ...currentState,
      categories: remember(currentState.categories, form.category).list,
      units: remember(currentState.units, form.unit).list,
      products: [...currentState.products, product],
      prices: [...currentState.prices, { id: freshId(), productId: product.id, at: new Date().toISOString(), from: "", to: product.price, by: currentState.actor }],
      audit: [...currentState.audit, stamp(currentState, "Məhsul açıldı", product.name)],
    }))
    closeForm()
    go(`/kataloq/${product.id}`)
  }

  function removeProduct(product: Product) {
    if (!writable()) return
    patchProcure((currentState) => ({
      ...currentState,
      products: currentState.products.filter((item) => item.id !== product.id),
      prices: currentState.prices.filter((item) => item.productId !== product.id),
      jobs: currentState.jobs.map((job) => ({ ...job, productIds: job.productIds.filter((item) => item !== product.id) })),
      audit: [...currentState.audit, stamp(currentState, "Məhsul silindi", product.name)],
    }))
    if (editingId === product.id) closeForm()
    setDrop(null)
  }

  function writable() {
    return Boolean(active)
  }

  return (
    <Guard>
      <PageHead kicker="Təchizat" title="Kataloq" text="Məhsullar, satış şərtləri və texniki göstəricilər.">
        {active && (
          <Button type="button" onClick={openNew}>
            <Icon name="plus" /> Məhsul
          </Button>
        )}
      </PageHead>
      {!active && <p className="lede">Əvvəl şirkət seçilməlidir.</p>}
      {compose && active && (
        <Modal wide className="catalog-modal" title={editingId ? "Məhsulu düzəlt" : "Yeni məhsul"} onClose={closeForm}>
          <ProductForm
            form={form}
            setForm={setForm}
            categories={state.categories}
            units={state.units}
            saveLabel={editingId ? "Yadda saxla" : "Məhsulu yaz"}
            showCost={!editingId || seesCost(active?.kind ?? "", state.products.find((item) => item.id === editingId)?.companyId || "", activeId)}
            onSave={saveProduct}
            onCancel={closeForm}
          />
        </Modal>
      )}
      <Toolbar>
        <form className="search" role="search" onSubmit={(event) => event.preventDefault()}>
          <Icon name="search" />
          <Input value={find} onChange={(event) => setFind(event.target.value)} placeholder="Ad, kod, parametr" aria-label="Kataloqda axtar" />
        </form>
        <Tabs
          value={current}
          onChange={setCategory}
          options={[{ id: "hamisi", label: "Hamısı" }, ...categories.map((item) => ({ id: item, label: item }))]}
        />
      </Toolbar>
      {visible.length === 0 && <Empty title="Kataloq boşdur" text="İstehsalçı məhsul yazanda o, bu siyahıda görünəcək." />}
      {visible.length > 0 && shown.length === 0 && <Empty title="Uyğun məhsul yoxdur" text="Axtarışı və ya kateqoriyanı dəyişin." />}
      {shown.length > 0 && (
        <TableContainer className="pricebook">
          <table>
            <thead>
              <tr>
                <th>Məhsul</th>
                <th>Parametr</th>
                <th>Rəng</th>
                <th>Ölçü</th>
                <th>Şərt</th>
                <th className="num">Qiymət</th>
                <th className="acts"><span className="sr">Əməliyyat</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((product) => {
                const owner = state.companies.find((item) => item.id === product.companyId)
                const volume = product.breaks[0]
                return (
                  <tr
                    key={product.id}
                    className="click"
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                      if ((event.target as HTMLElement).closest("a, button, .row-menu")) return
                      go(`/kataloq/${product.id}`)
                    }}
                  >
                    <td>
                      <Link to={`/kataloq/${product.id}`} className="pricebook-link">
                        <span className="name-cell">
                          <b>{product.name}</b>
                          <span className="muted">{[product.code, product.category, owner?.name].filter(Boolean).join(" · ")}</span>
                        </span>
                      </Link>
                    </td>
                    <td>{text(product.params)}</td>
                    <td>{text(product.colors)}</td>
                    <td>{text(product.sizes)}</td>
                    <td>
                      <span className="name-cell">
                        <b>min {text(product.minQty)} {product.unit}</b>
                        <span className="muted">{text(product.leadDays)} gün{volume ? ` · ${volume.minQty || "0"}+ ${volume.price} AZN` : ""}</span>
                      </span>
                    </td>
                    <td className="num ask">{product.price.trim() ? product.price : "—"} <span className="muted">/ {product.unit}</span></td>
                    <td className="acts">
                      <RowMenu
                        items={[
                          { id: "edit", label: "Redaktə", onClick: () => startEdit(product) },
                          { id: "delete", label: "Sil", onClick: () => setDrop(product) },
                        ]}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableContainer>
      )}
      {drop && <Confirm title="Məhsulu sil" text={`${drop.name} kataloqdan silinəcək. Qiymət tarixçəsi də silinir.`} onClose={() => setDrop(null)} onYes={() => removeProduct(drop)} />}
    </Guard>
  )
}

export function CatalogDetail() {
  const { id = "" } = useParams()
  const go = useNavigate()
  const { state, active, activeId, visible } = useCatalog()
  const product = visible.find((item) => item.id === id)
  useTitle(product?.name || "Məhsul")
  const [breakForm, setBreakForm] = useState({ minQty: "", size: "", spec: "", delivery: "", price: "" })
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(emptyProduct)
  const [drop, setDrop] = useState(false)
  const owner = state.companies.find((item) => item.id === product?.companyId)
  const secret = Boolean(product && seesCost(active?.kind ?? "", product.companyId, activeId))
  const managed = Boolean(product)
  const history = state.prices.filter((item) => item.productId === id).sort((a, b) => b.at.localeCompare(a.at))

  function setPrice(row: Product, price: string) {
    if (!seesCost(active?.kind ?? "", row.companyId, state.activeId)) return
    patchProcure((current) => ({
      ...current,
      products: current.products.map((item) => item.id === row.id ? { ...item, price } : item),
      prices: [...current.prices, { id: freshId(), productId: row.id, at: new Date().toISOString(), from: row.price, to: price, by: current.actor }],
      audit: [...current.audit, stamp(current, "Qiymət dəyişdi", `${row.name}: ${row.price || "boş"} → ${price || "boş"}`)],
    }))
  }

  function addBreak() {
    if (!product || !breakForm.price.trim()) return
    const row: PriceBreak = { ...breakForm, id: freshId() }
    patchProcure((current) => ({
      ...current,
      products: current.products.map((item) => item.id === product.id && seesCost(active?.kind ?? "", item.companyId, state.activeId) ? { ...item, breaks: [...item.breaks, row] } : item),
    }))
    setBreakForm({ minQty: "", size: "", spec: "", delivery: "", price: "" })
  }

  function removeBreak(breakId: string) {
    if (!product || !secret) return
    patchProcure((current) => ({
      ...current,
      products: current.products.map((item) => item.id === product.id ? { ...item, breaks: item.breaks.filter((row) => row.id !== breakId) } : item),
      audit: [...current.audit, stamp(current, "Qiymət şərti silindi", product.name)],
    }))
  }

  function saveEdit() {
    if (!product || !active || !form.name.trim() || !managed) return
    const name = form.name.trim()
    const category = remember(state.categories, form.category)
    const unit = remember(state.units, form.unit)
    const priceChanged = product.price !== form.price
    patchProcure((current) => ({
      ...current,
      categories: remember(current.categories, form.category).list,
      units: remember(current.units, form.unit).list,
      products: current.products.map((item) => item.id === product.id ? { ...item, ...form, name, category: category.name, unit: unit.name, cost: secret ? form.cost : item.cost, breaks: item.breaks } : item),
      prices: priceChanged ? [...current.prices, { id: freshId(), productId: product.id, at: new Date().toISOString(), from: product.price, to: form.price, by: current.actor }] : current.prices,
      audit: [...current.audit, stamp(current, "Məhsul düzəldi", name)],
    }))
    setEditing(false)
  }

  function removeProduct() {
    if (!product || !active || !managed) return
    patchProcure((current) => ({
      ...current,
      products: current.products.filter((item) => item.id !== product.id),
      prices: current.prices.filter((item) => item.productId !== product.id),
      jobs: current.jobs.map((job) => ({ ...job, productIds: job.productIds.filter((item) => item !== product.id) })),
      audit: [...current.audit, stamp(current, "Məhsul silindi", product.name)],
    }))
    go("/kataloq")
  }

  if (!product) {
    return (
      <Guard>
        <PageHead kicker="Kataloq" title="Məhsul tapılmadı" text="Bu qeyd kataloqda yoxdur." />
        <Link to="/kataloq" className="btn ghost">Kataloqa qayıt</Link>
      </Guard>
    )
  }

  const facts = [
    ["İstehsalçı", owner?.name || "—"],
    ["Kod", text(product.code)],
    ["Kateqoriya", text(product.category)],
    ["Parametr", text(product.params)],
    ["Rəng", text(product.colors)],
    ["Ölçü", text(product.sizes)],
    ["Vahid", text(product.unit)],
    ["Minimum sifariş", product.minQty.trim() ? `${product.minQty.trim()} ${product.unit}` : "—"],
    ["İstehsal", product.leadDays.trim() ? `${product.leadDays.trim()} gün` : "—"],
    ["Çatdırılma", product.deliveryPrice.trim() ? `${product.deliveryPrice.trim()} AZN` : "—"],
    ["Montaj", product.installPrice.trim() ? `${product.installPrice.trim()} AZN` : "—"],
    ["Qüvvədədir", day(product.validUntil)],
  ]

  return (
    <Guard>
      <article className="pricebook doc">
        <header className="doc-head">
          <div>
            <Link to="/kataloq">Kataloq</Link>
            <p>{product.category}</p>
            <h1>{product.name}</h1>
            <span>{[owner?.name, product.code].filter(Boolean).join(" · ")}</span>
          </div>
          <div className="doc-price">
            <strong>{product.price.trim() || "—"}</strong>
            <span>AZN / {product.unit || "vahid"}</span>
            {managed && (
              <div className="doc-tools">
                <RowMenu
                  items={[
                    { id: "edit", label: "Redaktə", onClick: () => { setForm(draftFrom(product)); setEditing(true) } },
                    { id: "delete", label: "Sil", onClick: () => setDrop(true) },
                  ]}
                />
              </div>
            )}
          </div>
        </header>
        <h2>Spesifikasiya</h2>
        <dl className="doc-spec">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <h2>Qiymət şərtləri</h2>
        {product.breaks.length === 0 && <p className="doc-note">Əlavə şərt yoxdur. Əsas satış qiyməti tətbiq olunur.</p>}
        {product.breaks.length > 0 && (
          <table className="breaks">
            <thead>
              <tr>
                <th>Minimum</th>
                <th>Ölçü</th>
                <th>Texniki şərt</th>
                <th>Çatdırılma</th>
                <th className="num">Qiymət</th>
                {secret && <th className="acts"></th>}
              </tr>
            </thead>
            <tbody>
              {product.breaks.map((row) => (
                <tr key={row.id}>
                  <td>{text(row.minQty)}</td>
                  <td>{text(row.size)}</td>
                  <td>{text(row.spec)}</td>
                  <td>{text(row.delivery)}</td>
                  <td className="num ask">{row.price} AZN</td>
                  {secret && <td className="acts"><Button type="button" className="ghost small" onClick={() => removeBreak(row.id)}>Sil</Button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {secret && (
          <div className="form-row wide doc-form">
            <label>Minimum həcm<Input value={breakForm.minQty} onChange={(event) => setBreakForm({ ...breakForm, minQty: event.target.value })} /></label>
            <label>Ölçü<Input value={breakForm.size} onChange={(event) => setBreakForm({ ...breakForm, size: event.target.value })} /></label>
            <label>Texniki şərt<Input value={breakForm.spec} onChange={(event) => setBreakForm({ ...breakForm, spec: event.target.value })} /></label>
            <label>Çatdırılma<Input value={breakForm.delivery} onChange={(event) => setBreakForm({ ...breakForm, delivery: event.target.value })} /></label>
            <label>Qiymət<Input value={breakForm.price} onChange={(event) => setBreakForm({ ...breakForm, price: event.target.value })} /></label>
            <Button type="button" onClick={addBreak} disabled={!breakForm.price.trim()}>Şərti yaz</Button>
          </div>
        )}
        {secret && (
          <>
            <h2>Maya və tarixçə</h2>
            <p className="doc-note">Maya {text(product.cost)} AZN. Bu bölmə yalnız bu məhsulun sahibinə və administratora açılır.</p>
            <label className="doc-edit">
              Satış qiyməti
              <Input key={product.price} defaultValue={product.price} onBlur={(event) => { if (event.target.value !== product.price) setPrice(product, event.target.value) }} />
            </label>
            {history.length === 0 && <p className="doc-note">Qiymət tarixçəsi yoxdur.</p>}
            {history.length > 0 && (
              <table className="breaks">
                <thead>
                  <tr>
                    <th>Tarix</th>
                    <th>Əvvəl</th>
                    <th>Sonra</th>
                    <th>Kim</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td>{when(item.at)}</td>
                      <td>{item.from.trim() || "əvvəl"}</td>
                      <td>{item.to.trim() || "—"}</td>
                      <td>{text(item.by)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </article>
      {editing && managed && (
        <Modal wide className="catalog-modal" title="Məhsulu düzəlt" onClose={() => setEditing(false)}>
          <ProductForm
            form={form}
            setForm={setForm}
            categories={state.categories}
            units={state.units}
            saveLabel="Yadda saxla"
            showCost={secret}
            onSave={saveEdit}
            onCancel={() => setEditing(false)}
          />
        </Modal>
      )}
      {drop && <Confirm title="Məhsulu sil" text={`${product.name} kataloqdan silinəcək. Qiymət tarixçəsi də silinir.`} onClose={() => setDrop(false)} onYes={removeProduct} />}
    </Guard>
  )
}
