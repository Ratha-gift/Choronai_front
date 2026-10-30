"use client";
import { Fragment, type ReactNode } from "react";
import { useHydrated } from "@/lib/store";
import { PlannedModule } from "@/components/layout/planned-module";
import { resolvePath } from "@/config/modules";
import { DashboardView } from "./dashboard/components/dashboard-view";
import { ProductFormPage } from "./products/components/product-form-page";
import { ProductsView } from "./products/components/products-view";
import {
  BestSellers,
  CategoryChart,
  OverviewChart,
  WarehouseStockChart,
} from "./reports/chart-reports";
import {
  AdjustmentDetails,
  AdjustmentReport,
  BrandReport,
  CategoriesReport,
  ExpiryAlerts,
  InventoryInOut,
  InventoryInOutExpiry,
  ProductSalesReport,
  ProductsReport,
  QuantityAlerts,
} from "./reports/table-reports";
import { resources } from "./resources";
import { ResourcePage } from "./resources/resource-page";
import { ChangeLogo } from "./settings/change-logo";
import { POS_SECTIONS, SYSTEM_SECTIONS } from "./settings/definitions";
import { EmailTemplates } from "./settings/email-templates";
import { GroupPermissions } from "./settings/group-permissions";
import { SettingsPage } from "./settings/settings-page";
import { TransactionForm } from "./transactions/transaction-form";

// Pages with their own component. Everything listed in `resources` renders
// through ResourcePage; anything else shows the "planned" placeholder.
const PAGES: Record<string, (params: string[]) => ReactNode> = {
  "": () => <DashboardView />,
  "inventory/products": () => <ProductsView />,
  "inventory/products/add": () => <ProductFormPage />,
  "inventory/products/edit": ([id]) => (
    <ProductFormPage key={id} productId={id} />
  ),
  "inventory/stock-receive/add": () => <TransactionForm kind="stock-receive" />,
  "inventory/stock-issue/add": () => <TransactionForm kind="stock-issue" />,
  "inventory/stock-adjustment/add": () => <TransactionForm kind="adjustment" />,
  "sales/returns/add": () => <TransactionForm kind="sale-return" />,
  "purchases/requests/add": () => <TransactionForm kind="purchase-request" />,
  "purchases/orders/add": () => <TransactionForm kind="purchase-order" />,
  "purchases/list/add": () => <TransactionForm kind="purchase" />,
  "purchases/returns/add": () => <TransactionForm kind="purchase-return" />,
  "settings/system": () => (
    <SettingsPage
      name="system"
      sections={SYSTEM_SECTIONS}
      title={["System Settings", "ការកំណត់ប្រព័ន្ធ"]}
      icon="cog"
    />
  ),
  "settings/pos": () => (
    <SettingsPage
      name="pos"
      sections={POS_SECTIONS}
      title={["POS Settings", "ការកំណត់ POS"]}
      icon="grid"
    />
  ),
  "settings/logo": () => <ChangeLogo />,
  "settings/email-templates": () => <EmailTemplates />,
  "settings/group-permissions/edit": ([id]) => (
    <GroupPermissions key={id} groupId={id} />
  ),
  "reports/overview": () => <OverviewChart />,
  "reports/warehouse-stock": () => <WarehouseStockChart />,
  "reports/category-chart": () => <CategoryChart />,
  "reports/best-sellers": () => <BestSellers />,
  "reports/quantity-alerts": () => <QuantityAlerts />,
  "reports/expiry-alerts": () => <ExpiryAlerts />,
  "reports/brands": () => <BrandReport />,
  "reports/categories": () => <CategoriesReport />,
  "reports/products": () => <ProductsReport />,
  "reports/inventory-in-out": () => <InventoryInOut />,
  "reports/inventory-in-out-expiry": () => <InventoryInOutExpiry />,
  "reports/adjustments": () => <AdjustmentReport />,
  "reports/adjustment-details": () => <AdjustmentDetails />,
  "reports/product-sales": () => <ProductSalesReport />,
};

export function ModuleView({ segments }: { segments: string[] }) {
  // Remount once stored data is available, so forms that copy saved values
  // into local state (settings, POS defaults ...) start from the real data.
  const hydrated = useHydrated();
  return (
    <Fragment key={hydrated ? "stored" : "seed"}>
      <ModuleContent segments={segments} />
    </Fragment>
  );
}

function ModuleContent({ segments }: { segments: string[] }) {
  const resolved = resolvePath(segments);
  if (!resolved) return null;
  const { module, params } = resolved;
  const page = PAGES[module.id];
  if (page) return <>{page(params)}</>;
  const def = resources[module.id];
  if (def) return <ResourcePage key={def.id} def={def} />;
  return <PlannedModule moduleId={module.id} />;
}
