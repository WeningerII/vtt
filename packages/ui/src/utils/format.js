import { format as dateFnsFormat, formatDistance, formatRelative } from "date-fns";
export const formatDate = (date, formatStr = "PPP") => {
    const d = typeof date === "string" ? new Date(date) : date;
    return dateFnsFormat(d, formatStr);
};
export const formatTimeAgo = (date) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return formatDistance(d, new Date(), { addSuffix: true });
};
export const formatRelativeTime = (date) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return formatRelative(d, new Date());
};
export const formatNumber = (num) => {
    return new Intl.NumberFormat("en-US").format(num);
};
export const formatCurrency = (amount, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
    }).format(amount);
};
export const formatPercent = (value) => {
    return new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(value);
};
//# sourceMappingURL=format.js.map