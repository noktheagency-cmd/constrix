import { useState } from "react"
import type { FormulaLine, Recipe } from "../domain/types"
import { num } from "../format"
import { usePrefs } from "../i18n"
import { useStore } from "../store"
import { Icon } from "../icons"
import { Drawer, Empty, Field, PageHead, RowMenu, Select, useTitle } from "../ui"

export default function Recipes() {
  const { t } = usePrefs()
  useTitle(t("page.recipes.title"))
  const { plants, recipes, materials, addProduct, editProduct, removeProduct } = useStore()
  const sites = plants.filter((item) => item.kind === "zavod" || item.kind === "sex")
  const [plantId, setPlantId] = useState(sites.find((item) => item.kind === "zavod")?.id || sites[0]?.id || "")
  const [product, setProduct] = useState({ name: "", unit: sites.find((item) => item.id === plantId)?.unit || "m³" })
  const [editing, setEditing] = useState("")
  const [error, setError] = useState("")
  const place = sites.find((item) => item.id === plantId) || sites[0]
  const open = recipes.find((item) => item.id === editing)

  return (
    <>
      <PageHead kicker={t("page.recipes.kicker")} title={t("page.recipes.title")} text={t("page.recipes.text")} />
      <form
        className="form-row transfer"
        style={{ marginBottom: 12 }}
        onSubmit={(event) => {
          event.preventDefault()
          if (!place) return
          const message = addProduct({ plantId: place.id, name: product.name, unit: product.unit || place.unit })
          setError(message)
          if (!message) setProduct({ name: "", unit: place.unit })
        }}
      >
        <Field label="Məhsul">
          <input value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} />
        </Field>
        <Field label="Vahid">
          <input value={product.unit} onChange={(event) => setProduct({ ...product, unit: event.target.value })} />
        </Field>
        <Field label="Yer">
          <Select
            value={place?.id || ""}
            onValueChange={(value) => {
              const next = sites.find((item) => item.id === value)
              setPlantId(value)
              if (next) setProduct((current) => ({ ...current, unit: next.unit }))
            }}
            options={sites.map((item) => ({ value: item.id, label: item.name }))}
          />
        </Field>
        <button className="btn" type="submit">Məhsulu yaz</button>
      </form>
      {error && <p className="form-error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Məhsul</th>
              <th>Yer</th>
              <th>Vahid</th>
              <th>Xammal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((item) => {
              const site = sites.find((row) => row.id === item.plantId)
              const summary = item.items
                .map((line) => {
                  const material = materials.find((row) => row.id === line.materialId)
                  return `${material?.name || line.materialId} ${num(line.qty, 2)}`
                })
                .join(" · ")
              return (
                <tr key={item.id}>
                  <td><b>{item.product}</b></td>
                  <td>{site?.name || "—"}</td>
                  <td>1 {item.unit}</td>
                  <td>
                    <button type="button" className="mat-open" onClick={() => { setEditing(item.id); setError("") }}>
                      {item.items.length === 0 ? (
                        <span className="muted">Norma yazılmayıb</span>
                      ) : (
                        <>
                          <b>{item.items.length} xammal</b>
                          <span className="clip">{summary}</span>
                        </>
                      )}
                    </button>
                  </td>
                  <td>
                    <RowMenu
                      items={[
                        { id: "edit", label: "Redaktə", onClick: () => { setEditing(item.id); setError("") } },
                        { id: "delete", label: "Sil", onClick: () => setError(removeProduct(item.id)) },
                      ]}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {recipes.length === 0 && <Empty title="Məhsul yoxdur" text="Cədvəlin üstündən məhsul yazın, normasını redaktədə doldurun." />}
      </div>
      {open && (
        <Drawer title={open.product} onClose={() => setEditing("")}>
          <RecipeEditor
            key={`${open.id}:${open.product}:${open.items.map((row) => row.materialId + row.qty).join()}`}
            recipe={open}
            materials={materials}
            error={error}
            onSave={(form) => {
              const message = editProduct(open.id, form)
              setError(message)
              if (!message) setEditing("")
            }}
            onDelete={() => {
              const message = removeProduct(open.id)
              setError(message)
              if (!message) setEditing("")
            }}
          />
        </Drawer>
      )}
    </>
  )
}

function RecipeEditor({
  recipe, materials, error, onSave, onDelete,
}: {
  recipe: Recipe
  materials: { id: string; name: string; unit: string }[]
  error: string
  onSave: (form: { name: string; unit: string; lines: FormulaLine[] }) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(recipe.product)
  const [unit, setUnit] = useState(recipe.unit)
  const [lines, setLines] = useState(recipe.items.map((item) => ({ materialId: item.materialId, qty: String(item.qty) })))
  const spare = materials.find((item) => !lines.some((line) => line.materialId === item.id))

  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault()
        onSave({ name, unit, lines })
      }}
    >
      <Field label="Məhsul">
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Vahid">
        <input value={unit} onChange={(event) => setUnit(event.target.value)} />
      </Field>
      <p className="muted">1 {unit || recipe.unit} üçün xammal norması.</p>
      {lines.map((line, index) => {
        const material = materials.find((item) => item.id === line.materialId)
        return (
          <div className="recipe-line" key={`${line.materialId}-${index}`}>
            <Select
              ariaLabel="Xammal"
              value={line.materialId}
              onValueChange={(value) => setLines(lines.map((row, rowIndex) => (rowIndex === index ? { ...row, materialId: value } : row)))}
              options={materials.map((item) => ({ value: item.id, label: item.name }))}
            />
            <div className="recipe-line-qty">
              <input
                type="number"
                min="0"
                step="0.01"
                aria-label="Norma"
                value={line.qty}
                onChange={(event) => setLines(lines.map((row, rowIndex) => (rowIndex === index ? { ...row, qty: event.target.value } : row)))}
              />
              <span className="muted">{material ? `${num(Number(line.qty) || 0, 2)} ${material.unit}` : "Norma"}</span>
              <button type="button" className="btn ghost small" onClick={() => setLines(lines.filter((_, rowIndex) => rowIndex !== index))}><Icon name="trash" /> Sil</button>
            </div>
          </div>
        )
      })}
      <div className="form-actions">
        <button type="button" className="btn ghost" disabled={!spare} onClick={() => spare && setLines([...lines, { materialId: spare.id, qty: "" }])}>Xammal əlavə et</button>
        <button type="button" className="btn ghost" onClick={onDelete}>Məhsulu sil</button>
        <button className="btn" type="submit">Yaz</button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  )
}
