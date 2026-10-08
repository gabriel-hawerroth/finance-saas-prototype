/** Category endpoints of the mock backend (§8.3). */
import { ApiError } from "@/domain/errors";
import type { Category, CategoryType, CategoryWithSubs, Id, Subcategory } from "@/domain/types";
import { nextId, nowISO, type Dataset } from "./store";

const bad = (d: string) => new ApiError(400, { errorDescription: d });

export function listCategories(ds: Dataset): Category[] {
  return ds.categories.filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function listCategoriesWithSubs(ds: Dataset): CategoryWithSubs[] {
  return listCategories(ds).map((c) => ({ ...c, subcategories: subcategoriesOf(ds, c.id) }));
}

export function subcategoriesOf(ds: Dataset, categoryId: Id): Subcategory[] {
  return ds.subcategories.filter((s) => s.categoryId === categoryId && s.active).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export interface SaveCategoryDTO {
  name: string;
  color: string;
  icon: string;
  type: CategoryType;
  essential: boolean;
}

function validateName(name: string) {
  if (!name.trim()) throw bad("name required");
  if (name.trim().length > 40) throw bad("name too long");
}

export function createCategory(ds: Dataset, dto: SaveCategoryDTO): Category {
  validateName(dto.name);
  const c = { id: nextId(ds), name: dto.name.trim(), color: dto.color, icon: dto.icon, type: dto.type, essential: dto.type === "E" && dto.essential, active: true, createdAt: nowISO() };
  ds.categories.push(c);
  return c;
}

export function updateCategory(ds: Dataset, id: Id, dto: SaveCategoryDTO): Category {
  validateName(dto.name);
  const c = ds.categories.find((x) => x.id === id);
  if (!c) throw new ApiError(404, { errorDescription: "category not found" });
  Object.assign(c, { name: dto.name.trim(), color: dto.color, icon: dto.icon, essential: c.type === "E" && dto.essential, updatedAt: nowISO() });
  return c;
}

export function deleteCategory(ds: Dataset, id: Id): void {
  const subIds = new Set(ds.subcategories.filter((s) => s.categoryId === id).map((s) => s.id));
  if (ds.releases.some((r) => r.categoryId === id || (r.subcategoryId != null && subIds.has(r.subcategoryId)))) {
    throw new ApiError(400, { code: "LINKED_RELEASES" });
  }
  ds.categories = ds.categories.filter((c) => c.id !== id);
  ds.subcategories = ds.subcategories.filter((s) => s.categoryId !== id);
}

export function inactivateCategory(ds: Dataset, id: Id): void {
  const stamp = nowISO();
  for (const c of ds.categories) if (c.id === id) Object.assign(c, { active: false, updatedAt: stamp });
  for (const s of ds.subcategories) if (s.categoryId === id) Object.assign(s, { active: false, updatedAt: stamp });
}

export function createSubcategory(ds: Dataset, dto: { name: string; essential: boolean; categoryId: Id }): Subcategory {
  validateName(dto.name);
  const cat = ds.categories.find((c) => c.id === dto.categoryId);
  if (!cat) throw bad("category not found");
  const s = { id: nextId(ds), name: dto.name.trim(), essential: cat.type === "E" && dto.essential, active: true, categoryId: cat.id, createdAt: nowISO() };
  ds.subcategories.push(s);
  return s;
}

export function updateSubcategory(ds: Dataset, id: Id, dto: { name: string; essential: boolean }): Subcategory {
  validateName(dto.name);
  const s = ds.subcategories.find((x) => x.id === id);
  if (!s) throw new ApiError(404, { errorDescription: "subcategory not found" });
  const cat = ds.categories.find((c) => c.id === s.categoryId);
  Object.assign(s, { name: dto.name.trim(), essential: cat?.type === "E" && dto.essential, updatedAt: nowISO() });
  return s;
}

export function deleteSubcategory(ds: Dataset, id: Id): void {
  if (ds.releases.some((r) => r.subcategoryId === id)) throw new ApiError(400, { code: "LINKED_RELEASES" });
  ds.subcategories = ds.subcategories.filter((s) => s.id !== id);
}

export function inactivateSubcategory(ds: Dataset, id: Id): void {
  const s = ds.subcategories.find((x) => x.id === id);
  if (s) Object.assign(s, { active: false, updatedAt: nowISO() });
}

export interface MoveReleasesDTO {
  sourceCategoryId: Id;
  sourceSubcategoryId?: Id | null;
  targetCategoryId: Id;
  targetSubcategoryId?: Id | null;
}

/** Moves releases between categories of the same type. Choosing a whole category as source moves all of its releases. */
export function moveReleases(ds: Dataset, dto: MoveReleasesDTO): number {
  const src = ds.categories.find((c) => c.id === dto.sourceCategoryId);
  const dst = ds.categories.find((c) => c.id === dto.targetCategoryId);
  if (!src || !dst) throw bad("categories required");
  if (src.type !== dst.type) throw bad("different types");
  if (src.id === dst.id && (dto.sourceSubcategoryId ?? null) === (dto.targetSubcategoryId ?? null)) throw bad("same source and target");
  let moved = 0;
  for (const r of ds.releases) {
    if (r.categoryId !== src.id) continue;
    if (dto.sourceSubcategoryId != null && r.subcategoryId !== dto.sourceSubcategoryId) continue;
    r.categoryId = dst.id;
    r.subcategoryId = dto.targetSubcategoryId ?? null;
    r.updatedAt = nowISO();
    moved++;
  }
  return moved;
}
