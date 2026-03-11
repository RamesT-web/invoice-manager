"use client";

import { FileText } from "lucide-react";

export default function QuotesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Quotes</h1>
      <div className="bg-white rounded-lg border">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mb-4"><FileText className="h-8 w-8 text-gray-300" /></div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Coming Soon</h2>
          <p className="text-sm text-gray-500">Quote management will be available in a future update.</p>
        </div>
      </div>
    </div>
  );
}
