import React, { useState } from "react";
import { VTTApp } from "./VTTApp";

export const VTTDemo: React.FC = () => {
  const [user, setUser] = useState<{ id: string; campaignId: string } | null>(null);
  const [loginForm, setLoginForm] = useState({ userId: "", campaignId: "" });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginForm.userId && loginForm.campaignId) {
      setUser({
        id: loginForm.userId,
        campaignId: loginForm.campaignId,
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-gray-800 rounded-lg shadow-xl p-8">
            <h1 className="text-3xl font-bold text-center mb-8">Virtual Tabletop Demo</h1>
            <form onSubmit={handleLogin} className="space-y-6" role="form">
              <div>
                <label htmlFor="userId" className="block text-sm font-medium mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  id="userId"
                  value={loginForm.userId}
                  onChange={(e) => setLoginForm((prev) => ({ ...prev, userId: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your user ID"
                  required
                />
              </div>
              <div>
                <label htmlFor="campaignId" className="block text-sm font-medium mb-2">
                  Campaign ID
                </label>
                <input
                  type="text"
                  id="campaignId"
                  value={loginForm.campaignId}
                  onChange={(e) =>
                    setLoginForm((prev) => ({ ...prev, campaignId: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter campaign ID"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                aria-label="Join campaign"
              >
                Join Campaign
              </button>
            </form>
            <div className="mt-6 text-center text-sm text-gray-400">
              <p>For testing, try:</p>
              <p>User ID: test-user-1</p>
              <p>Campaign ID: test-campaign-1</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <VTTApp userId={user.id} campaignId={user.campaignId} />;
};
