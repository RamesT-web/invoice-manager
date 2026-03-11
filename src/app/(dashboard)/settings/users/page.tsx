"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users,
  Shield,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  UserX,
  UserCheck,
  Loader2,
  UserPlus,
  X,
} from "lucide-react";

export default function UsersAdminPage() {
  const { activeCompanyId } = useCompanyStore();
  const utils = trpc.useUtils();

  const { data: users, isLoading } = trpc.user.listByCompany.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );

  const toggleActiveMutation = trpc.user.toggleActive.useMutation({ onSuccess: () => utils.user.listByCompany.invalidate() });
  const changeRoleMutation = trpc.user.changeRole.useMutation({ onSuccess: () => utils.user.listByCompany.invalidate() });
  const resetPasswordMutation = trpc.user.adminResetPassword.useMutation({
    onSuccess: () => { setResetUserId(null); setResetPassword(""); setResetSuccess("Password reset successfully."); setTimeout(() => setResetSuccess(""), 3000); },
  });
  const createUserMutation = trpc.user.adminCreateUser.useMutation({
    onSuccess: (data) => {
      utils.user.listByCompany.invalidate();
      setShowAddForm(false);
      setNewUser({ name: "", email: "", password: "", role: "staff" });
      setResetSuccess(`User "${data.name}" added successfully.`);
      setTimeout(() => setResetSuccess(""), 4000);
    },
  });

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "staff" });

  const anyError = toggleActiveMutation.error ?? changeRoleMutation.error ?? resetPasswordMutation.error ?? createUserMutation.error;

  if (!activeCompanyId) return <div className="flex items-center justify-center h-64"><p className="text-sm text-gray-500">Select a company first.</p></div>;
  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  const roleIcon = (role: string) => {
    switch (role) {
      case "admin": return <ShieldAlert className="h-4 w-4 text-red-500" />;
      case "accounts": return <ShieldCheck className="h-4 w-4 text-blue-500" />;
      default: return <Shield className="h-4 w-4 text-gray-400" />;
    }
  };

  const handleAddUser = () => {
    createUserMutation.mutate({
      companyId: activeCompanyId!,
      name: newUser.name.trim(),
      email: newUser.email.trim(),
      password: newUser.password,
      role: newUser.role as "admin" | "accounts" | "staff",
    });
  };

  const isAddFormValid = newUser.name.trim().length > 0 && newUser.email.includes("@") && newUser.password.length >= 8;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><Users className="h-5 w-5" />User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage users, roles, and access for this company.</p>
        </div>
        {!showAddForm && (
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 gap-1.5" onClick={() => setShowAddForm(true)}>
            <UserPlus className="h-4 w-4" />Add User
          </Button>
        )}
      </div>

      {anyError && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{anyError.message}</div>}
      {resetSuccess && <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">{resetSuccess}</div>}

      {/* Add User Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg border border-blue-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><UserPlus className="h-4 w-4 text-blue-600" />Add New User</h2>
            <button onClick={() => { setShowAddForm(false); setNewUser({ name: "", email: "", password: "", role: "staff" }); createUserMutation.reset(); }} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-700">Full Name <span className="text-red-500">*</span></Label>
              <Input placeholder="e.g. Ramesh Kumar" value={newUser.name} onChange={(e) => setNewUser(u => ({ ...u, name: e.target.value }))} className="h-8 text-sm bg-gray-50 border-gray-200" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-700">Email Address <span className="text-red-500">*</span></Label>
              <Input type="email" placeholder="ramesh@company.com" value={newUser.email} onChange={(e) => setNewUser(u => ({ ...u, email: e.target.value }))} className="h-8 text-sm bg-gray-50 border-gray-200" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-700">Password <span className="text-red-500">*</span></Label>
              <Input type="password" placeholder="Min 8 characters" value={newUser.password} onChange={(e) => setNewUser(u => ({ ...u, password: e.target.value }))} className="h-8 text-sm bg-gray-50 border-gray-200" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-700">Role</Label>
              <select className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 h-8 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" value={newUser.role} onChange={(e) => setNewUser(u => ({ ...u, role: e.target.value }))}>
                <option value="staff">Staff — view only</option>
                <option value="accounts">Accounts — create &amp; edit</option>
                <option value="admin">Admin — full access</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8" disabled={!isAddFormValid || createUserMutation.isPending} onClick={handleAddUser}>
              {createUserMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Creating…</> : "Create User"}
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => { setShowAddForm(false); setNewUser({ name: "", email: "", password: "", role: "staff" }); createUserMutation.reset(); }}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {users?.map((u) => (
          <div key={u.id} className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-gray-600">{u.name.charAt(0).toUpperCase()}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{u.name}</span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">{roleIcon(u.role)} {u.role}</span>
                    {!u.isActive && <span className="text-[11px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">Disabled</span>}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{u.email}</p>
                  <p className="text-xs text-gray-400">Last login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "Never"}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <select className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" value={u.role} onChange={(e) => changeRoleMutation.mutate({ companyId: activeCompanyId!, userId: u.id, role: e.target.value as "admin" | "accounts" | "staff" })} disabled={changeRoleMutation.isPending}>
                  <option value="admin">Admin</option><option value="accounts">Accounts</option><option value="staff">Staff</option>
                </select>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" title={u.isActive ? "Disable user" : "Enable user"} onClick={() => toggleActiveMutation.mutate({ companyId: activeCompanyId!, userId: u.id, isActive: !u.isActive })} disabled={toggleActiveMutation.isPending}>
                  {u.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="Reset password" onClick={() => setResetUserId(resetUserId === u.id ? null : u.id)}>
                  <KeyRound className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {resetUserId === u.id && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-gray-700">New Password for {u.name}</Label>
                  <Input type="password" placeholder="Min 8 characters" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} className="h-8 text-sm bg-gray-50 border-gray-200" />
                </div>
                <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" disabled={resetPassword.length < 8 || resetPasswordMutation.isPending} onClick={() => resetPasswordMutation.mutate({ companyId: activeCompanyId!, userId: u.id, newPassword: resetPassword })}>
                  {resetPasswordMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}Reset
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => { setResetUserId(null); setResetPassword(""); }}>Cancel</Button>
              </div>
            )}
          </div>
        ))}

        {users?.length === 0 && (
          <div className="bg-white rounded-lg border">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mb-4"><Users className="h-8 w-8 text-gray-300" /></div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">No users found</h2>
              <p className="text-sm text-gray-500 mb-4">No users are registered for this company.</p>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 gap-1.5" onClick={() => setShowAddForm(true)}><UserPlus className="h-4 w-4" />Add First User</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
