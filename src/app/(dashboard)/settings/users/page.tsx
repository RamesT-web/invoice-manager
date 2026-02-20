"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Users,
  Shield,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  UserX,
  UserCheck,
  Loader2,
} from "lucide-react";

export default function UsersAdminPage() {
  const { activeCompanyId } = useCompanyStore();
  const utils = trpc.useUtils();

  const { data: users, isLoading } = trpc.user.listByCompany.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );

  const toggleActiveMutation = trpc.user.toggleActive.useMutation({
    onSuccess: () => utils.user.listByCompany.invalidate(),
  });

  const changeRoleMutation = trpc.user.changeRole.useMutation({
    onSuccess: () => utils.user.listByCompany.invalidate(),
  });

  const resetPasswordMutation = trpc.user.adminResetPassword.useMutation({
    onSuccess: () => {
      setResetUserId(null);
      setResetPassword("");
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    },
  });

  // Reset password dialog state
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  // Error display
  const anyError =
    toggleActiveMutation.error ??
    changeRoleMutation.error ??
    resetPasswordMutation.error;

  if (!activeCompanyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Select a company first.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const roleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <ShieldAlert className="h-4 w-4 text-red-500" />;
      case "accounts":
        return <ShieldCheck className="h-4 w-4 text-blue-500" />;
      default:
        return <Shield className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          User Management
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage users, roles, and access for this company.
        </p>
      </div>

      {anyError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {anyError.message}
        </div>
      )}

      {resetSuccess && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          Password reset successfully.
        </div>
      )}

      <div className="space-y-3">
        {users?.map((u) => (
          <Card key={u.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between gap-4">
                {/* User info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{u.name}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {roleIcon(u.role)} {u.role}
                      </span>
                      {!u.isActive && (
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {u.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last login:{" "}
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "Never"}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Role selector */}
                  <select
                    className="text-xs border rounded px-2 py-1 bg-background"
                    value={u.role}
                    onChange={(e) => {
                      changeRoleMutation.mutate({
                        companyId: activeCompanyId!,
                        userId: u.id,
                        role: e.target.value as "admin" | "accounts" | "staff",
                      });
                    }}
                    disabled={changeRoleMutation.isPending}
                  >
                    <option value="admin">Admin</option>
                    <option value="accounts">Accounts</option>
                    <option value="staff">Staff</option>
                  </select>

                  {/* Toggle active */}
                  <Button
                    variant="outline"
                    size="sm"
                    title={u.isActive ? "Disable user" : "Enable user"}
                    onClick={() => {
                      toggleActiveMutation.mutate({
                        companyId: activeCompanyId!,
                        userId: u.id,
                        isActive: !u.isActive,
                      });
                    }}
                    disabled={toggleActiveMutation.isPending}
                  >
                    {u.isActive ? (
                      <UserX className="h-4 w-4" />
                    ) : (
                      <UserCheck className="h-4 w-4" />
                    )}
                  </Button>

                  {/* Reset password */}
                  <Button
                    variant="outline"
                    size="sm"
                    title="Reset password"
                    onClick={() =>
                      setResetUserId(resetUserId === u.id ? null : u.id)
                    }
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Password reset form (inline expand) */}
              {resetUserId === u.id && (
                <div className="mt-3 pt-3 border-t flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">New Password for {u.name}</Label>
                    <Input
                      type="password"
                      placeholder="Min 8 characters"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={
                      resetPassword.length < 8 ||
                      resetPasswordMutation.isPending
                    }
                    onClick={() => {
                      resetPasswordMutation.mutate({
                        companyId: activeCompanyId!,
                        userId: u.id,
                        newPassword: resetPassword,
                      });
                    }}
                  >
                    {resetPasswordMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : null}
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setResetUserId(null);
                      setResetPassword("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {users?.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No users found in this company.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
