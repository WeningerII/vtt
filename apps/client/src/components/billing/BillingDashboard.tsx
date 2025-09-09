/**
 * Billing Dashboard - Overview of subscription, usage, and billing information
 */
import React, { useState, useEffect } from "react";
import { logger } from "@vtt/logging";
import { toErrorObject } from "../../utils/error-utils";
import {
  CreditCard,
  Download,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Users,
  HardDrive,
  Clock,
  Zap,
  ArrowUpRight,
  Settings
} from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { formatCurrency, formatDate, formatFileSize } from "../../lib/format";

// Mock data - in real app this would come from API
const mockBillingData = {
  subscription: {
    plan: "Pro",
    status: "active",
    currentPeriodStart: new Date("2024-01-01"),
    currentPeriodEnd: new Date("2024-02-01"),
    cancelAtPeriodEnd: false,
    amount: 1999, // in cents
    currency: "USD",
  },
  usage: {
    players: { current: 12, limit: 25 },
    storage: { current: 2.1 * 1024 * 1024 * 1024, limit: 10 * 1024 * 1024 * 1024 }, // bytes
    bandwidth: { current: 45.2 * 1024 * 1024 * 1024, limit: 100 * 1024 * 1024 * 1024 }, // bytes
    campaigns: { current: 3, limit: 10 },
  },
  paymentMethod: {
    type: "card",
    brand: "visa",
    last4: "4242",
    expiryMonth: 12,
    expiryYear: 2025,
  },
  recentInvoices: [
    {
      id: "inv_1",
      amount: 1999,
      currency: "USD",
      status: "paid",
      created: new Date("2024-01-01"),
      pdfUrl: "/invoices/inv_1.pdf",
    },
    {
      id: "inv_2",
      amount: 1999,
      currency: "USD",
      status: "paid",
      created: new Date("2023-12-01"),
      pdfUrl: "/invoices/inv_2.pdf",
    },
    {
      id: "inv_3",
      amount: 1999,
      currency: "USD",
      status: "paid",
      created: new Date("2023-11-01"),
      pdfUrl: "/invoices/inv_3.pdf",
    },
  ],
};

export function BillingDashboard() {
  const [loading, setLoading] = useState(false);
  const { subscription, usage, paymentMethod, recentInvoices } = mockBillingData;

  const getUsagePercentage = (current: number, limit: number) => {
    if (!limit) {return 0;}
    return Math.min((current / limit) * 100, 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success-100 text-success-800";
      case "canceled":
        return "bg-error-100 text-error-800";
      case "past_due":
        return "bg-warning-100 text-warning-800";
      default:
        return "bg-neutral-100 text-neutral-800";
    }
  };

  const handleDownloadInvoice = async (invoiceId: string) => {
    setLoading(true);
    try {
      // Simulate download
      const invoice = recentInvoices.find((i) => i.id === invoiceId);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      // In real app: if (invoice?.pdfUrl) window.open(invoice.pdfUrl, '_blank');
    } catch (error) {
      logger.error("Failed to fetch billing info:", toErrorObject(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subscription Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Current Subscription</CardTitle>
                <p className="text-sm text-neutral-600 mt-1">{subscription.plan} Plan</p>
              </div>
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(subscription.status)}`}
              >
                {subscription.status}
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-neutral-900">
                    {formatCurrency(subscription.amount / 100)}
                  </p>
                  <p className="text-sm text-neutral-600">per month</p>
                </div>
                <Button>
                  Manage Plan
                </Button>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Current period</span>
                  <span className="text-neutral-900">
                    {formatDate(subscription.currentPeriodStart, "MMM d")} -{" "}
                    {formatDate(subscription.currentPeriodEnd, "MMM d")}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Next billing date</span>
                  <span className="text-neutral-900">
                    {formatDate(subscription.currentPeriodEnd)}
                  </span>
                </div>
                {subscription.cancelAtPeriodEnd && (
                  <div className="flex items-center gap-2 p-3 bg-warning-50 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-warning-600" />
                    <span className="text-sm text-warning-800">
                      Your subscription will cancel on {formatDate(subscription.currentPeriodEnd)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Method */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Payment Method</CardTitle>
            <Button>
              <Settings className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 bg-neutral-100 rounded-lg flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-neutral-600" />
              </div>
              <div>
                <p className="font-medium text-neutral-900">•••• •••• •••• {paymentMethod.last4}</p>
                <p className="text-sm text-neutral-600">
                  {paymentMethod.brand.toUpperCase()} • Expires {paymentMethod.expiryMonth}/
                  {paymentMethod.expiryYear}
                </p>
              </div>
            </div>
            <Button>
              Update Payment Method
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Usage Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Usage This Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Players */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-neutral-600" />
                  <span className="text-sm font-medium text-neutral-700">Active Players</span>
                </div>
                <span className="text-sm text-neutral-600">
                  {usage.players.current}/{usage.players.limit}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    getUsagePercentage(usage.players.current, usage.players.limit) >= 90
                      ? "bg-error-500"
                      : getUsagePercentage(usage.players.current, usage.players.limit) >= 75
                        ? "bg-warning-500"
                        : "bg-success-500"
                  }`}
                  style={{
                    width: `${getUsagePercentage(usage.players.current, usage.players.limit)}%`,
                  }}
                />
              </div>
            </div>

            {/* Storage */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-neutral-600" />
                  <span className="text-sm font-medium text-neutral-700">Storage</span>
                </div>
                <span className="text-sm text-neutral-600">
                  {formatFileSize(usage.storage.current)}/{formatFileSize(usage.storage.limit)}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    getUsagePercentage(usage.storage.current, usage.storage.limit) >= 90
                      ? "bg-error-500"
                      : getUsagePercentage(usage.storage.current, usage.storage.limit) >= 75
                        ? "bg-warning-500"
                        : "bg-success-500"
                  }`}
                  style={{
                    width: `${getUsagePercentage(usage.storage.current, usage.storage.limit)}%`,
                  }}
                />
              </div>
            </div>

            {/* Bandwidth */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-neutral-600" />
                  <span className="text-sm font-medium text-neutral-700">Bandwidth</span>
                </div>
                <span className="text-sm text-neutral-600">
                  {formatFileSize(usage.bandwidth.current)}/{formatFileSize(usage.bandwidth.limit)}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    getUsagePercentage(usage.bandwidth.current, usage.bandwidth.limit) >= 90
                      ? "bg-error-500"
                      : getUsagePercentage(usage.bandwidth.current, usage.bandwidth.limit) >= 75
                        ? "bg-warning-500"
                        : "bg-success-500"
                  }`}
                  style={{
                    width: `${getUsagePercentage(usage.bandwidth.current, usage.bandwidth.limit)}%`,
                  }}
                />
              </div>
            </div>

            {/* Campaigns */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-neutral-600" />
                  <span className="text-sm font-medium text-neutral-700">Campaigns</span>
                </div>
                <span className="text-sm text-neutral-600">
                  {usage.campaigns.current}/{usage.campaigns.limit}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    getUsagePercentage(usage.campaigns.current, usage.campaigns.limit) >= 90
                      ? "bg-error-500"
                      : getUsagePercentage(usage.campaigns.current, usage.campaigns.limit) >= 75
                        ? "bg-warning-500"
                        : "bg-success-500"
                  }`}
                  style={{
                    width: `${getUsagePercentage(usage.campaigns.current, usage.campaigns.limit)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Invoices</CardTitle>
          <Button>
            View all
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-3 border border-neutral-200 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-neutral-100 rounded-lg flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-neutral-600" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">
                      {formatCurrency(invoice.amount / 100)}
                    </p>
                    <p className="text-sm text-neutral-600">{formatDate(invoice.created)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      invoice.status === "paid"
                        ? "bg-success-100 text-success-800"
                        : "bg-warning-100 text-warning-800"
                    }`}
                  >
                    <CheckCircle className="h-3 w-3 inline mr-1" />
                    {invoice.status}
                  </span>
                  <Button
                    onClick={() => handleDownloadInvoice(invoice.id)}
                    disabled={loading}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card interactive>
          <CardContent className="p-6 text-center">
            <TrendingUp className="h-8 w-8 text-primary-600 mx-auto mb-3" />
            <h3 className="font-medium text-neutral-900 mb-2">Upgrade Plan</h3>
            <p className="text-sm text-neutral-600 mb-4">Get more features and higher limits</p>
            <Button>
              View Plans
            </Button>
          </CardContent>
        </Card>

        <Card interactive>
          <CardContent className="p-6 text-center">
            <Calendar className="h-8 w-8 text-success-600 mx-auto mb-3" />
            <h3 className="font-medium text-neutral-900 mb-2">Billing History</h3>
            <p className="text-sm text-neutral-600 mb-4">View all invoices and payments</p>
            <Button>
              View History
            </Button>
          </CardContent>
        </Card>

        <Card interactive>
          <CardContent className="p-6 text-center">
            <Settings className="h-8 w-8 text-neutral-600 mx-auto mb-3" />
            <h3 className="font-medium text-neutral-900 mb-2">Billing Settings</h3>
            <p className="text-sm text-neutral-600 mb-4">Manage payment methods and preferences</p>
            <Button>
              Open Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default BillingDashboard;
