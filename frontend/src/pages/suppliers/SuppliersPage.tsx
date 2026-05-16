import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Phone, Mail, Pencil, Trash2, Plus, Package } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Badge';
import { fmt } from '../../utils/cn';
import { useToast } from '../../contexts/ToastContext';
import * as suppliersApi from '../../api/suppliers';
import type { Supplier } from '../../api/types';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
const supplierSchema = z.object({
  name: z.string().min(1, { error: 'Name is required' }),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  creditLimit: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

// ---------------------------------------------------------------------------
// SupplierCard
// ---------------------------------------------------------------------------
interface SupplierCardProps {
  supplier: Supplier;
  onEdit: (s: Supplier) => void;
  onDelete: (s: Supplier) => void;
}

function SupplierCard({ supplier, onEdit, onDelete }: SupplierCardProps) {
  const productCount = supplier._count?.products ?? 0;

  return (
    <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-3 hover:border-accent/40 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-text truncate">{supplier.name}</p>
            {supplier.contactPerson && (
              <p className="text-[12px] text-text2 truncate">{supplier.contactPerson}</p>
            )}
          </div>
        </div>
        <Badge
          label={`${productCount} ${productCount === 1 ? 'product' : 'products'}`}
          variant={productCount > 0 ? 'accent' : 'muted'}
        />
      </div>

      {/* Contact details */}
      <div className="flex flex-col gap-1.5">
        {supplier.phone && (
          <div className="flex items-center gap-2 text-[13px] text-text2">
            <Phone className="w-3.5 h-3.5 text-text3 shrink-0" />
            <span className="truncate">{supplier.phone}</span>
          </div>
        )}
        {supplier.email && (
          <div className="flex items-center gap-2 text-[13px] text-text2">
            <Mail className="w-3.5 h-3.5 text-text3 shrink-0" />
            <span className="truncate">{supplier.email}</span>
          </div>
        )}
        {!supplier.phone && !supplier.email && (
          <p className="text-[13px] text-text3 italic">No contact info</p>
        )}
      </div>

      {/* Credit limit */}
      <div className="flex items-center justify-between py-2 border-t border-border/60">
        <span className="text-[11px] text-text3 uppercase tracking-wide font-medium">Credit Limit</span>
        <span className="text-[13px] font-semibold text-text">
          {supplier.creditLimit ? `KSh ${fmt(supplier.creditLimit)}` : '—'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onEdit(supplier)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-surface2 border border-border text-text2 text-[12px] font-medium hover:text-accent hover:border-accent/40 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={() => onDelete(supplier)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-surface2 border border-border text-text2 text-[12px] font-medium hover:text-danger hover:border-danger/40 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SupplierForm (used inside modal)
// ---------------------------------------------------------------------------
interface SupplierFormProps {
  defaultValues?: Partial<SupplierFormValues>;
  onSubmit: (values: SupplierFormValues) => void;
  loading: boolean;
  submitLabel: string;
  onCancel: () => void;
}

function SupplierForm({ defaultValues, onSubmit, loading, submitLabel, onCancel }: SupplierFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues,
  });

  const fieldClass =
    'w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder:text-text3 focus:outline-none focus:border-accent transition-colors';
  const labelClass = 'block text-[12px] font-medium text-text2 mb-1';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Name */}
      <div>
        <label className={labelClass}>Company Name <span className="text-danger">*</span></label>
        <input {...register('name')} placeholder="e.g. Nairobi Kitchen Supplies" className={fieldClass} />
        <ErrorMessage message={errors.name?.message} />
      </div>

      {/* Contact person */}
      <div>
        <label className={labelClass}>Contact Person</label>
        <input {...register('contactPerson')} placeholder="Full name" className={fieldClass} />
        <ErrorMessage message={errors.contactPerson?.message} />
      </div>

      {/* Phone + Email */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Phone</label>
          <input {...register('phone')} placeholder="+254 700 000000" className={fieldClass} />
          <ErrorMessage message={errors.phone?.message} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input {...register('email')} type="email" placeholder="contact@example.com" className={fieldClass} />
          <ErrorMessage message={errors.email?.message} />
        </div>
      </div>

      {/* Address */}
      <div>
        <label className={labelClass}>Address</label>
        <textarea
          {...register('address')}
          placeholder="Street, City"
          rows={2}
          className={`${fieldClass} resize-none`}
        />
        <ErrorMessage message={errors.address?.message} />
      </div>

      {/* Credit limit */}
      <div>
        <label className={labelClass}>Credit Limit (KSh)</label>
        <input
          {...register('creditLimit')}
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          className={fieldClass}
        />
        <ErrorMessage message={errors.creditLimit?.message} />
      </div>

      {/* Footer buttons */}
      <div className="flex gap-3 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 bg-surface2 border border-border text-text rounded-lg text-[13px] font-medium hover:bg-border transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-[13px] font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          {loading && <Spinner size="sm" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// SuppliersPage
// ---------------------------------------------------------------------------
export function SuppliersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);

  // Queries
  const { data: suppliers = [], isLoading, isError } = useQuery({
    queryKey: ['suppliers'],
    queryFn: suppliersApi.getSuppliers,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (values: SupplierFormValues) =>
      suppliersApi.createSupplier({
        name: values.name,
        contactPerson: values.contactPerson || undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
        address: values.address || undefined,
        creditLimit: values.creditLimit || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast('success', 'Supplier created successfully');
      setShowCreateModal(false);
    },
    onError: () => toast('error', 'Failed to create supplier'),
  });

  const updateMutation = useMutation({
    mutationFn: (values: SupplierFormValues) =>
      suppliersApi.updateSupplier(editingSupplier!.id, {
        name: values.name,
        contactPerson: values.contactPerson || undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
        address: values.address || undefined,
        creditLimit: values.creditLimit || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast('success', 'Supplier updated successfully');
      setEditingSupplier(null);
    },
    onError: () => toast('error', 'Failed to update supplier'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => suppliersApi.deleteSupplier(deletingSupplier!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast('success', 'Supplier deleted');
      setDeletingSupplier(null);
    },
    onError: () => toast('error', 'Failed to delete supplier'),
  });

  // Derived
  const deletingHasProducts = (deletingSupplier?._count?.products ?? 0) > 0;

  const deleteMessage = deletingHasProducts
    ? `"${deletingSupplier?.name}" has ${deletingSupplier!._count!.products} linked product(s). Deleting it may affect those products. Are you sure?`
    : `Are you sure you want to delete "${deletingSupplier?.name}"? This action cannot be undone.`;

  // Loading / error states
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 text-danger text-[13px]">Failed to load suppliers. Please try again.</div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Suppliers"
        count={suppliers.length}
        actions={
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-[13px] font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>
        }
      />

      {suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Package className="w-12 h-12 text-text3 mb-4 opacity-40" />
          <p className="text-text text-[15px] font-semibold mb-1">No suppliers yet</p>
          <p className="text-text2 text-[13px] mb-5">Add your first supplier to get started.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent/90 transition-colors"
          >
            Add Supplier
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map((supplier) => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              onEdit={setEditingSupplier}
              onDelete={setDeletingSupplier}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Supplier"
        size="md"
      >
        <SupplierForm
          onSubmit={(v) => createMutation.mutate(v)}
          loading={createMutation.isPending}
          submitLabel="Create Supplier"
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={editingSupplier !== null}
        onClose={() => setEditingSupplier(null)}
        title="Edit Supplier"
        size="md"
      >
        {editingSupplier && (
          <SupplierForm
            defaultValues={{
              name: editingSupplier.name,
              contactPerson: editingSupplier.contactPerson ?? '',
              phone: editingSupplier.phone ?? '',
              email: editingSupplier.email ?? '',
              address: editingSupplier.address ?? '',
              creditLimit: editingSupplier.creditLimit ?? '',
            }}
            onSubmit={(v) => updateMutation.mutate(v)}
            loading={updateMutation.isPending}
            submitLabel="Save Changes"
            onCancel={() => setEditingSupplier(null)}
          />
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={deletingSupplier !== null}
        onClose={() => setDeletingSupplier(null)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Supplier"
        message={deleteMessage}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        danger
      />
    </div>
  );
}
