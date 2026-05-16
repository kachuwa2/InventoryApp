import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
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

const addUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'manager', 'cashier', 'warehouse', 'viewer']),
});

type AddUserFormData = z.infer<typeof addUserSchema>;

export function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: users = [], isLoading, isError } = useQuery<AppUser[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.getUsers(),
    retry: 1,
  });

  const addUserMutation = useMutation({
    mutationFn: (data: AddUserFormData) =>
      authApi.register({ name: data.name, email: data.email, password: data.password, role: data.role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast('success', 'User registered successfully');
      setShowAddModal(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to register user';
      toast('error', msg);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { role: 'cashier' },
  });

  const selectedRole = watch('role');

  function openAddModal() {
    reset({ role: 'cashier' });
    setShowAddModal(true);
  }

  function onSubmit(data: AddUserFormData) {
    addUserMutation.mutate(data);
  }

  const columns: Column<AppUser>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <span className="text-text font-medium text-[13px]">{row.name}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => (
        <span className="text-text2 text-[13px]">{row.email}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <Badge label={row.role} variant={statusVariant(row.role)} />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge
          label={row.deletedAt ? 'Inactive' : 'Active'}
          variant={row.deletedAt ? 'danger' : 'success'}
          dot
        />
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (row) => (
        <span className="text-text3 text-[12px]">{fmtDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-16',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            reset({ role: row.role as UserRole });
            // Open in edit mode — for now just show add modal pre-filled with role
            // A full edit endpoint is not available; role context shown via toast
            toast('info', `Role: ${row.role} — use registration to change roles`);
          }}
          className="px-2 py-1 text-text3 hover:text-accent text-[12px] rounded-lg hover:bg-accent/10 transition-colors"
        >
          Edit Role
        </button>
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
            onClick={openAddModal}
            className="px-4 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent/90 transition-colors"
          >
            Add User
          </button>
        }
      />

      {isError ? (
        <EmptyState
          icon={<Users className="w-10 h-10" />}
          title="User list endpoint not available"
          message="Register users via /register."
          action={{ label: 'Register New User', onClick: openAddModal }}
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
              onClick={handleSubmit(onSubmit)}
              disabled={addUserMutation.isPending}
              className="px-5 py-2 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {addUserMutation.isPending && <Spinner size="sm" />}
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
            <input
              {...register('name')}
              placeholder="Jane Doe"
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder-text3 focus:outline-none focus:border-accent transition-colors"
            />
            <ErrorMessage message={errors.name?.message} />
          </div>

          <div>
            <label className="block text-text2 text-[12px] font-medium mb-1.5">
              Email <span className="text-danger">*</span>
            </label>
            <input
              {...register('email')}
              type="email"
              placeholder="jane@example.com"
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder-text3 focus:outline-none focus:border-accent transition-colors"
            />
            <ErrorMessage message={errors.email?.message} />
          </div>

          <div>
            <label className="block text-text2 text-[12px] font-medium mb-1.5">
              Password <span className="text-danger">*</span>
            </label>
            <input
              {...register('password')}
              type="password"
              placeholder="Minimum 8 characters"
              className="w-full bg-surface2 border border-border rounded-lg px-3 py-2 text-[13px] text-text placeholder-text3 focus:outline-none focus:border-accent transition-colors"
            />
            <ErrorMessage message={errors.password?.message} />
          </div>

          <div>
            <label className="block text-text2 text-[12px] font-medium mb-1.5">Role</label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setValue('role', r)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium capitalize border transition-colors ${
                    selectedRole === r
                      ? 'bg-accent text-white border-accent'
                      : 'bg-surface2 text-text2 border-border hover:border-accent/50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <ErrorMessage message={errors.role?.message} />
            <p className="text-text3 text-[11px] mt-2">
              {selectedRole === 'admin' && 'Full access including user management and audit logs.'}
              {selectedRole === 'manager' && 'Approve POs, set prices, view all reports.'}
              {selectedRole === 'cashier' && 'Create sales, barcode lookup, manage customers.'}
              {selectedRole === 'warehouse' && 'Receive stock (GRN), manual stock adjustments.'}
              {selectedRole === 'viewer' && 'Read-only access to catalog and reports.'}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
