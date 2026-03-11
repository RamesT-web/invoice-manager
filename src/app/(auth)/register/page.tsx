"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const registerMutation = trpc.user.register.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await registerMutation.mutateAsync({ name, email, password });
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) { setError("Account created but login failed. Try signing in."); }
      else { router.push("/settings"); router.refresh(); }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
    } finally { setLoading(false); }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-xl shadow-sm border p-8">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center">
              <FileText className="h-7 w-7 text-white" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Create Account</h1>
          <p className="text-sm text-gray-500 mt-1">Set up your Invoice Manager</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium text-gray-700">Full Name</Label>
            <Input id="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus className="h-9 bg-gray-50 border-gray-200" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-9 bg-gray-50 border-gray-200" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
            <Input id="password" type="password" placeholder="Min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="h-9 bg-gray-50 border-gray-200" />
          </div>

          <Button type="submit" className="w-full h-9 bg-blue-600 hover:bg-blue-700" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </Button>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
