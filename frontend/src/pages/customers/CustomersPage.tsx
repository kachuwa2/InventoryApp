import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Pencil, Trash2, Users, ExternalLink } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FilterBar } from '../../components/ui/FilterBar';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { fmt, fmtDate, fmtDateTime } from '../../utils/cn';
import * as customersApi from '../../api/customers';
import type { Customer, CustomerType } from '../../api/types';

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  type: z.enum(['retail', 'wholesale']),
  creditLimit: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

export function CustomersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', { type: typeFilter, search }],
    queryFn: () =>
      customersApi.getCustomers({
        type: (typeFilter as CustomerType) || undefined,
        search: search || undefined,
      }),
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['customers', selectedCustomer?.id],
    queryFn: () => customersApi.getCustomer(selectedCustomer!.id),
    enabled: selectedCustomer !== null,
  });

  const createMutation = useMutation({
    mutationFn: customersApi.createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast('success', 'Customer created');
      setShowAddModal(false);
    },
    onError: () => toast('error', 'Failed to create customer'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CustomerFormData }) =>
      customersApi.updateCustomer(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast('success', 'Customer updated');
      setEditingCustomer(null);
    },
    onError: () => toast('error', 'Failed to update customer'),
  });

  const deleteMutation = useMutation({
    mutationFn: customersApi.deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast('success', 'Customer deleted');
      setDeleteTarget(null);
      if (selectedCustomer?.id === deleteTarget?.id) setSelectedCustomer(null);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : 'Cannot delete customer with existing orders';
      toast('error', msg);
      setDeleteTarget(null);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: { type: 'retail', creditLimit: '0' },
  });

  const formType = watch('type');

  function openAddModal() {
    reset({ type: 'retail', creditLimit: '0' });
    setShowAddModal(true);
  }

  function openEditModal(c: Customer) {
    reset({
      name: c.name,
      phone: c.phone ?? '',
      email: c.email ?? '',
      address: c.address ?? '',
      type: c.type,
      creditLimit: c.creditLimit,
    });
    setEditingCustomer(c);
  }

  function onSubmitAdd(data: CustomerFormData) {
    createMutation.mutate({
      name: data.name,
      phone: data.phone || undefined,
      email: data.email || undefined,
      address: data.address || undefined,
      type: data.type,
      creditLimit: data.creditLimit || undefined,
    });
  }

  function onSubmitEdit(data: CustomerFormData) {
    if (!editingCustomer) return;
    updateMutation.mutate({ id: editingCustomer.id, payload: data });
  }

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="text-text font-medium text-[13px]">{row.name}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => (
        <span className="font-mono text-text2 text-[12px]">{row.phone ?? '—'}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => <span className="text-text2 text-[13px]">{row.email ?? '—'}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <Badge label={row.type} variant={row.type === 'wholesale' ? 'info' : 'success'} />
      ),
    },
    {
      key: 'orders',
      header: 'Orders',
      render: (row) => (
        <span className="text-text2 text-[13px]">{row._count?.sales ?? 0}</span>
      ),
    },
    {
      key: 'creditLimit',
      header: 'Credit Limit (KSh)',
      render: (row) => <span className="text-text2 text-[13px]">{fmt(row.creditLimit)}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 text-text3 hover:text-accent rounded-lg hover:bg-accent/10 transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="p-1.5 text-text3 hover:text-danger rounded-lg hover:bg-danger/10 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full relative">
      <PageHeader
        title="Customers"
        count={customers.length}
        actions={
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent/90 transition-colors"
          >
            Add Customer
          </button>
        }
      />

      <FilterBar
        search={{ value: search, onChange: setSearch, placeholder: 'Search name, phone, email…' }}
        filters={[
          {
            label: 'Type',
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: 'retail', label: 'Retail' },
              { value: 'wholesale', label: 'Wholesale' },
            ],
          },
        ]}
      />

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <DataTable
          columns={columns}
          data={customers}
          loading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelectedCustomer(r)}
          emptyTitle="No customers found"
          emptyMessage="Add your first customer to get started."
          emptyIcon={<Users className="w-10 h-10" />}
        />
      </div>

      {/* Right panel */}
      {selectedCustomer !== null && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40"
            onClick={() => setSelectedCustomer(null)}
          />
          <div className="fixed top-0 right-0 h-full w-80 bg-surface border-l border-border z-40 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <span className="text-text font-semibold text-[15px]">Customer Profile</span>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-text3 hover:text-text transition-colors p-1 rounded-lg hover:bg-surface2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Spinner />
              </div>
            ) : detail ? (
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                {/* Profile */}
                <div className="flex flex-col gap-2 text-[13px]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center">
                      <span className="text-accent font-bold text-[16px]">
                        {detail.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-text font-semibold">{detail.name}</p>
                      <Badge label={detail.type} variant={detail.type === 'wholesale' ? 'info' : 'success'} />
                    </div>
                  </div>
                  {detail.phone && (
                    <div className="flex justify-between">
                      <span className="text-text3">Phone</span>
                      <span className="font-mono text-text2">{detail.phone}</span>
                    </div>
                  )}
                  {detail.email && (
                    <div className="flex justify-between">
                      <span className="text-text3">Email</span>
                      <span className="text-text2">{detail.email}</span>
                    </div>
                  )}
                  {detail.address && (
                    <div className="flex justify-between">
                      <span className="text-text3">Address</span>
                      <span className="text-text2 text-right max-w-[60%]">{detail.address}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-text3">Credit Limit</span>
                    <span className="text-text">KSh {fmt(detail.creditLimit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text3">Member Since</span>
                    <span className="text-text2">{fmtDate(detail.createdAt)}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="bg-surface2 rounded-xl p-4">
                  <p className="text-text3 text-[11px] uppercase tracking-wider mb-2">Stats</p>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-text2">Total Orders</span>
                    <span className="text-text font-semibold">{detail._count?.sales ?? 0}</span>
                  </div>
                </div>

                {/* Recent orders */}
                {detail.sales && detail.sales.length > 0 && (
                  <div>
                    <p className="text-text3 text-[11px] uppercase tracking-wider mb-3">
                      Recent Orders
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {detail.sales.slice(0, 10).map((sale) => (
                        <div
                          key={sale.id}
                          className="flex items-center gap-2 bg-surface2 rounded-lg px-3 py-2.5"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-accent text-[11px]">
                                {sale.invoiceNumber}
                              </span>
                              <Badge
                                label={sale.type}
                                variant={sale.type === 'retail' ? 'success' : 'info'}
                              />
                            </div>
                            <p className="text-text3 text-[11px] mt-0.5">
                              {fmtDateTime(sale.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-success text-[12px] font-semibold">
                              KSh {fmt(sale.totalAmount)}
                            </span>
                            <ExternalLink className="w-3 h-3 text-text3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="px-5 py-4 border-t border-border shrink-0">
              <button
                onClick={() => { openEditModal(selectedCustomer); setSelectedCustomer(null); }}
                className="w-full py-2.5 bg-accent text-white rounded-xl text-[13px] font-medium hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Customer
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Customer"
        size="md"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 bg-surface2 border border-border text-text rounded-lg text-[13px] font-medium hover:bg-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit(onSubmitAdd)}
              disabled={createMutation.isPending}
              className="px-5 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {createMutation.isPending && <Spinner size="sm" />}
              Create
            </button>
          </div>
        }
      >
        <CustomerForm
          register={register}
          errors={errors}
          formType={formType}
          setValue={setValue}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={editingCustomer !== null}
        onClose={() => setEditingCustomer(null)}
        title="Edit Customer"
        size="md"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setEditingCustomer(null)}
              className="px-4 py-2 bg-surface2 border border-border text-text rounded-lg text-[13px] font-medium hover:bg-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit(onSubmitEdit)}
              disabled={updateMutation.isPending}
              className="px-5 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {updateMutation.isPending && <Spinner size="sm" />}
              Save Changes
            </button>
          </div>
        }
      >
        <CustomerForm
          register={register}
          errors={errors}
          formType={formType}
          setValue={setValue}
        />
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Customer"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone. Customers with existing orders cannot be deleted.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        danger
      />
    </div>
  );
}

interface CustomerFormProps {
  register: ReturnType<typeof useForm<CustomerFormData>>['register'];
  errors: ReturnType<typeof useForm<CustomerFormData>>['formState']['errors'];
  formType: CustomerType;
  setValue: ReturnType<typeof useForm<CustomerFormData>>['setValue'];
}

function CustomerForm({ register, errors, formType, setValue }: CustomerFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-text2 text-[12px] font-medium mb-1.5">
          Name <span className="text-danger">*</span>
        </label>
        <input
          {...register('name')}
          placeholder="Customer name"
          className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder-text3 focus:outline-none focus:border-accent transition-colors"
        />
        <ErrorMessage message={errors.name?.message} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-text2 text-[12px] font-medium mb-1.5">Phone</label>
          <input
            {...register('phone')}
            placeholder="+254…"
            className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder-text3 focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div>
          <label className="block text-text2 text-[12px] font-medium mb-1.5">Email</label>
          <input
            {...register('email')}
            type="email"
            placeholder="email@example.com"
            className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder-text3 focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>
      <div>
        <label className="block text-text2 text-[12px] font-medium mb-1.5">Address</label>
        <input
          {...register('address')}
          placeholder="Street, city…"
          className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder-text3 focus:outline-none focus:border-accent transition-colors"
        />
      </div>
      <div>
        <label className="block text-text2 text-[12px] font-medium mb-1.5">Customer Type</label>
        <div className="flex gap-2">
          {(['retail', 'wholesale'] as CustomerType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setValue('type', t)}
              className={`flex-1 py-2 rounded-lg text-[13px] font-medium capitalize border transition-colors ${
                formType === t
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface2 text-text2 border-border hover:border-accent/50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-text2 text-[12px] font-medium mb-1.5">
          Credit Limit (KSh)
        </label>
        <input
          {...register('creditLimit')}
          type="number"
          min="0"
          placeholder="0"
          className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder-text3 focus:outline-none focus:border-accent transition-colors"
        />
      </div>
    </div>
  );
}
