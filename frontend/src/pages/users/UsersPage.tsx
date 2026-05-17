import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable } from '../../components/ui/DataTable';
import type { Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { Badge, statusVariant } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { fmtDate } from '../../utils/cn';
import * as usersApi from '../../api/users';
import * as authApi from '../../api/auth';
import type { AppUser, UserRole } from '../../api/types';

const ROLES: UserRole[] = ['admin', 'manager', 'cashier', 'warehouse', 'viewer'];

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin:     'Full access including user management and audit logs.',
  manager:   'Approve POs, set prices, view all reports.',
  cashier:   'Create sales, barcode lookup, manage customers.',
  warehouse: 'Receive stock (GRN), manual stock adjustments.',
  viewer:    'Read-only access to catalog and reports.',
};

const addUserSchema = z.object({
  name:     z.string().min(1, 'Name is required'),
  email:    z.email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role:     z.enum(['admin', 'manager', 'cashier', 'warehouse', 'viewer']),
});

const editUserSchema = z.object({
  role:     z.enum(['admin', 'manager', 'cashier', 'warehouse', 'viewer']),
  isActive: z.boolean(),
});

type AddUserFormData  = z.infer<typeof addUserSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;

const inputCls =
  'w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder-text3 focus:outline-none focus:border-accent transition-colors';

function RolePicker({
  value,
  onChange,
}: {
  value: UserRole;
  onChange: (r: UserRole) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium capitalize border transition-colors ${
              value === r
                ? 'bg-accent text-white border-accent'
                : 'bg-surface2 text-text2 border-border hover:border-accent/50'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      <p className="text-text3 text-[11px]">{ROLE_DESCRIPTIONS[value]}</p>
    </div>
  );
}

export function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser,   setEditingUser]   = useState<AppUser | null>(null);

  const { data: users = [], isLoading, isError } = useQuery<AppUser[]>({
    queryKey: ['users'],
    queryFn:  () => usersApi.getUsers(),
    retry: 1,
  });

  const addMutation = useMutation({
    mutationFn: (data: AddUserFormData) =>
      authApi.register({ name: data.name, email: data.email, password: data.password, role: data.role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast('success', 'User registered successfully');
      setShowAddModal(false);
    },
    onError: (err: unknown) => {
      toast('error', err instanceof Error ? err.message : 'Failed to register user');
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EditUserFormData }) =>
      usersApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast('success', 'User updated');
      setShowEditModal(false);
    },
    onError: (err: unknown) => {
      toast('error', err instanceof Error ? err.message : 'Failed to update user');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersApi.updateUser(id, { isActive }),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast('success', isActive ? 'User reactivated' : 'User deactivated');
    },
    onError: (err: unknown) => {
      toast('error', err instanceof Error ? err.message : 'Failed to update status');
    },
  });

  const addForm = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { role: 'cashier' },
  });
  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: { role: 'cashier', isActive: true },
  });

  const addRole      = useWatch({ control: addForm.control,  name: 'role',     defaultValue: 'cashier' });
  const editRole     = useWatch({ control: editForm.control, name: 'role',     defaultValue: 'cashier' });
  const editIsActive = useWatch({ control: editForm.control, name: 'isActive', defaultValue: true });

  function openAdd() {
    addForm.reset({ role: 'cashier' });
    setShowAddModal(true);
  }

  function openEdit(user: AppUser) {
    setEditingUser(user);
    editForm.reset({ role: user.role, isActive: user.isActive });
    setShowEditModal(true);
  }

  const columns: Column<AppUser>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="text-text font-medium text-[13px]">{row.name}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => <span className="text-text2 text-[13px]">{row.email}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => <Badge label={row.role} variant={statusVariant(row.role)} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge
          label={row.isActive ? 'Active' : 'Inactive'}
          variant={row.isActive ? 'success' : 'danger'}
          dot
        />
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => <span className="text-text3 text-[12px]">{fmtDate(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-36',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openEdit(row)}
            className="px-2 py-1 text-text3 hover:text-accent text-[12px] rounded-lg hover:bg-accent/10 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => toggleMutation.mutate({ id: row.id, isActive: !row.isActive })}
            disabled={toggleMutation.isPending}
            className={`px-2 py-1 text-[12px] rounded-lg transition-colors disabled:opacity-50 ${
              row.isActive
                ? 'text-text3 hover:text-danger hover:bg-danger/10'
                : 'text-text3 hover:text-success hover:bg-success/10'
            }`}
          >
            {row.isActive ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        count={isError ? undefined : users.length}
        actions={
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent/90 transition-colors"
          >
            Add User
          </button>
        }
      />

      {isError ? (
        <EmptyState
          icon={<Users className="w-10 h-10" />}
          title="Failed to load users"
          message="Check that you have admin access."
          action={{ label: 'Register New User', onClick: openAdd }}
        />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <DataTable
            columns={columns}
            data={users}
            loading={isLoading}
            rowKey={(r) => r.id}
            emptyTitle="No users found"
            emptyMessage="Registered users will appear here."
            emptyIcon={<Users className="w-10 h-10" />}
          />
        </div>
      )}

      {/* Add User Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Register New User"
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
              onClick={addForm.handleSubmit((d) => addMutation.mutate(d))}
              disabled={addMutation.isPending}
              className="px-5 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {addMutation.isPending && <Spinner size="sm" />}
              Register
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-text2 text-[12px] font-medium mb-1.5">
              Full Name <span className="text-danger">*</span>
            </label>
            <input {...addForm.register('name')} placeholder="Jane Doe" className={inputCls} />
            <ErrorMessage message={addForm.formState.errors.name?.message} />
          </div>
          <div>
            <label className="block text-text2 text-[12px] font-medium mb-1.5">
              Email <span className="text-danger">*</span>
            </label>
            <input {...addForm.register('email')} type="email" placeholder="jane@example.com" className={inputCls} />
            <ErrorMessage message={addForm.formState.errors.email?.message} />
          </div>
          <div>
            <label className="block text-text2 text-[12px] font-medium mb-1.5">
              Password <span className="text-danger">*</span>
            </label>
            <input {...addForm.register('password')} type="password" placeholder="Minimum 8 characters" className={inputCls} />
            <ErrorMessage message={addForm.formState.errors.password?.message} />
          </div>
          <div>
            <label className="block text-text2 text-[12px] font-medium mb-1.5">Role</label>
            <RolePicker value={addRole} onChange={(r) => addForm.setValue('role', r)} />
            <ErrorMessage message={addForm.formState.errors.role?.message} />
          </div>
        </div>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit User — ${editingUser?.name ?? ''}`}
        size="md"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 bg-surface2 border border-border text-text rounded-lg text-[13px] font-medium hover:bg-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={editForm.handleSubmit((d) => {
                if (editingUser) editMutation.mutate({ id: editingUser.id, data: d });
              })}
              disabled={editMutation.isPending}
              className="px-5 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {editMutation.isPending && <Spinner size="sm" />}
              Save Changes
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <div>
            <label className="block text-text2 text-[12px] font-medium mb-1.5">Role</label>
            <RolePicker value={editRole} onChange={(r) => editForm.setValue('role', r)} />
            <ErrorMessage message={editForm.formState.errors.role?.message} />
          </div>

          <div>
            <label className="block text-text2 text-[12px] font-medium mb-2">Account Status</label>
            <button
              type="button"
              onClick={() => editForm.setValue('isActive', !editIsActive)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border w-full transition-colors ${
                editIsActive
                  ? 'bg-success/10 border-success/30 text-success'
                  : 'bg-danger/10 border-danger/30 text-danger'
              }`}
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${editIsActive ? 'bg-success' : 'bg-danger'}`} />
              <span className="text-[13px] font-medium">{editIsActive ? 'Active' : 'Inactive'}</span>
              <span className="text-[11px] opacity-60 ml-auto">Click to toggle</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
