import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Edit2, Trash2, Tag, FolderOpen, Folder } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../contexts/ToastContext';
import * as categoriesApi from '../../api/categories';
import type { Category } from '../../api/types';

// ─── Schema ──────────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  description: z.string().optional(),
  parentId: z.string().optional().nullable(),
});

type CategoryForm = z.infer<typeof categorySchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface CategoryNode extends Category {
  children: CategoryNode[];
}

function buildTree(flat: Category[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  for (const c of flat) {
    map.set(c.id, { ...c, children: [] });
  }

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface CategoryRowProps {
  node: CategoryNode;
  depth: number;
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
}

function CategoryRow({ node, depth, onEdit, onDelete }: CategoryRowProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const count = node._count?.products ?? 0;

  return (
    <div>
      <div
        className="group flex items-center gap-2 px-4 py-2.5 hover:bg-surface2 rounded-lg transition-colors cursor-pointer"
        style={{ paddingLeft: `${16 + depth * 24}px` }}
      >
        {/* Expand toggle or indent spacer */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}
            className="text-text3 hover:text-text transition-colors shrink-0"
          >
            {expanded
              ? <FolderOpen className="w-4 h-4" />
              : <Folder className="w-4 h-4" />}
          </button>
        ) : (
          <Tag className="w-4 h-4 text-text3 shrink-0" />
        )}

        <span className={`flex-1 text-[13px] leading-snug ${depth === 0 ? 'font-semibold text-text' : 'font-normal text-text2'}`}>
          {node.name}
        </span>

        {node.description && (
          <span className="hidden sm:inline text-[11px] text-text3 max-w-[160px] truncate">
            {node.description}
          </span>
        )}

        {/* Product count */}
        <span className={`text-[11px] font-medium tabular-nums ${count > 0 ? 'text-accent' : 'text-text3'}`}>
          {count} {count === 1 ? 'product' : 'products'}
        </span>

        {/* Action icons - visible on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(node); }}
            className="p-1.5 text-text3 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node); }}
            className="p-1.5 text-text3 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Left border line for children */}
      {hasChildren && expanded && (
        <div className="relative" style={{ marginLeft: `${24 + depth * 24}px` }}>
          <div className="absolute left-4 top-0 bottom-2 w-px bg-border" />
          {node.children.map((child) => (
            <CategoryRow
              key={child.id}
              node={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CategoriesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.getCategories,
  });

  const tree = useMemo(() => buildTree(categories), [categories]);

  // Root categories only (for parent select — prevents circular)
  const rootCategories = useMemo(
    () => categories.filter((c: Category) => !c.parentId),
    [categories]
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ['categories'] });

  const createMut = useMutation({
    mutationFn: (payload: Parameters<typeof categoriesApi.createCategory>[0]) =>
      categoriesApi.createCategory(payload),
    onSuccess: () => { toast('success', 'Category created'); invalidate(); },
    onError: () => toast('error', 'Failed to create category'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof categoriesApi.updateCategory>[1] }) =>
      categoriesApi.updateCategory(id, payload),
    onSuccess: () => { toast('success', 'Category updated'); setEditingCategory(null); invalidate(); },
    onError: () => toast('error', 'Failed to update category'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => categoriesApi.deleteCategory(id),
    onSuccess: () => { toast('success', 'Category deleted'); setDeleteTarget(null); invalidate(); },
    onError: () => toast('error', 'Failed to delete category'),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryForm>({ resolver: zodResolver(categorySchema) });

  // When editing category changes, populate the form
  useEffect(() => {
    if (editingCategory) {
      reset({
        name: editingCategory.name,
        description: editingCategory.description ?? '',
        parentId: editingCategory.parentId ?? '',
      });
    } else {
      reset({ name: '', description: '', parentId: '' });
    }
  }, [editingCategory, reset]);

  function onSubmit(data: CategoryForm) {
    const parentId = data.parentId && data.parentId !== '' ? data.parentId : null;
    if (editingCategory) {
      updateMut.mutate({
        id: editingCategory.id,
        payload: {
          name: data.name,
          description: data.description || undefined,
          parentId,
        },
      });
    } else {
      createMut.mutate({
        name: data.name,
        description: data.description || undefined,
        parentId: parentId ?? undefined,
      });
      reset({ name: '', description: '', parentId: '' });
    }
  }

  function handleCancel() {
    setEditingCategory(null);
    reset({ name: '', description: '', parentId: '' });
  }

  const deleteCount = deleteTarget?._count?.products ?? 0;
  const isBusy = createMut.isPending || updateMut.isPending;

  const inputCls =
    'bg-bg border border-border text-text rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-accent transition-colors placeholder-text3 w-full';

  return (
    <div className="p-6 min-h-screen bg-bg">
      <PageHeader
        title="Categories"
        subtitle="Organize your products into a hierarchy"
        count={categories.length}
      />

      <div className="flex gap-6 items-start">
        {/* Left: Tree */}
        <div className="flex-1 bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-text">Category Tree</h3>
            {!isLoading && (
              <Badge
                label={`${categories.length} total`}
                variant="muted"
              />
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-text3">
              <FolderOpen className="w-10 h-10" />
              <p className="text-[13px]">No categories yet. Create the first one.</p>
            </div>
          ) : (
            <div className="p-3 space-y-0.5">
              {tree.map((node) => (
                <CategoryRow
                  key={node.id}
                  node={node}
                  depth={0}
                  onEdit={(c) => setEditingCategory(c)}
                  onDelete={(c) => setDeleteTarget(c)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Form panel */}
        <div className="w-[380px] bg-surface border border-border rounded-xl overflow-hidden shrink-0">
          <div className="px-5 py-4 border-b border-border">
            {editingCategory ? (
              <div>
                <p className="text-[10px] text-text3 uppercase tracking-wider mb-0.5">Editing</p>
                <h3 className="text-[14px] font-semibold text-text truncate">{editingCategory.name}</h3>
              </div>
            ) : (
              <h3 className="text-[14px] font-semibold text-text">New Category</h3>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-5 space-y-4">
            {/* Name */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-text2">
                Name <span className="text-danger">*</span>
              </label>
              <input
                {...register('name')}
                className={inputCls}
                placeholder="e.g. Cutting Tools"
              />
              {errors.name && (
                <p className="text-[11px] text-danger">{errors.name.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-text2">Description</label>
              <textarea
                {...register('description')}
                className={`${inputCls} resize-none`}
                rows={3}
                placeholder="Optional description"
              />
            </div>

            {/* Parent Category */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-text2">Parent Category</label>
              <select
                {...register('parentId')}
                className={inputCls}
                disabled={editingCategory !== null && rootCategories.length === 0}
              >
                <option value="">None (root category)</option>
                {rootCategories
                  .filter((c: Category) => c.id !== editingCategory?.id)
                  .map((c: Category) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
              <p className="text-[11px] text-text3">Only root categories can be parents.</p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={isBusy}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
              >
                {isBusy && <Spinner size="sm" />}
                {editingCategory ? 'Save Changes' : 'Create Category'}
              </button>

              {editingCategory && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2.5 bg-surface2 border border-border text-text rounded-lg text-[13px] font-medium hover:bg-border transition-colors"
                >
                  Cancel
                </button>
              )}

              {!editingCategory && (
                <button
                  type="button"
                  onClick={() => reset({ name: '', description: '', parentId: '' })}
                  className="px-4 py-2.5 bg-surface2 border border-border text-text2 rounded-lg text-[13px] font-medium hover:bg-border transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </form>

          {/* Quick stats */}
          {!isLoading && categories.length > 0 && (
            <div className="px-5 pb-5">
              <div className="bg-surface2 rounded-lg p-4 grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-[20px] font-semibold text-text">
                    {tree.length}
                  </p>
                  <p className="text-[11px] text-text3">Root categories</p>
                </div>
                <div>
                  <p className="text-[20px] font-semibold text-text">
                    {categories.filter((c: Category) => c.parentId !== null).length}
                  </p>
                  <p className="text-[11px] text-text3">Sub-categories</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMut.mutate(deleteTarget.id); }}
        title={`Delete "${deleteTarget?.name ?? ''}"`}
        message={
          deleteCount > 0
            ? `This category has ${deleteCount} product${deleteCount !== 1 ? 's' : ''} assigned to it. Reassign or delete those products before deleting this category.`
            : `Are you sure you want to delete "${deleteTarget?.name ?? ''}"? This action cannot be undone.`
        }
        confirmLabel={deleteCount > 0 ? 'Cannot Delete' : 'Delete Category'}
        loading={deleteMut.isPending}
        danger
      />
    </div>
  );
}
