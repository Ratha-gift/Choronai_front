"use client";
import { NativeSelect } from "@/components/ui/select";
import { useState } from "react";
import { useCollection } from "@/data/collections";
import type { Row } from "@/data/types";
import { useProducts } from "@/features/products/store";
import { resources } from "@/features/resources";
import { ResourcePage } from "@/features/resources/resource-page";
import { DataTable } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { useLanguage, type Label } from "@/i18n";
import { canPerform } from "@/lib/permissions";
import { notify } from "@/lib/toast";
import { redeemReward } from "@/features/pos/loyalty";

export function ProductRewardsPage() {
  const { products } = useProducts();
  const base = resources["inventory/product-rewards"];
  return (
    <ResourcePage
      def={{
        ...base,
        fields: [
          ...(base.fields ?? []),
          {
            key: "productId",
            label: ["Reward product", "ផលិតផលរង្វាន់"],
            required: true,
            type: "select",
            options: products
              .filter((row) => row.type !== "combo")
              .map((row) => [row.id, [row.name, row.name]]),
          },
          {
            key: "quantity",
            label: ["Reward quantity", "បរិមាណរង្វាន់"],
            required: true,
            type: "number",
            default: 1,
          },
        ],
      }}
    />
  );
}

export function MemberCardsPage() {
  const { l } = useLanguage();
  const customers = useCollection("customers").rows;
  const base = resources["sales/member-cards"];
  const customerOf = (row: Row) =>
    customers.find((item) => item.id === row.customerId);
  const rewards = useCollection("productRewards").rows;
  const ledger = useCollection("rewardLedger").rows;
  const warehouses = useCollection("warehouses").rows;
  const [card, setCard] = useState<Row | null>(null);
  const [reward, setReward] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  return (
    <>
      <ResourcePage
        def={{
          ...base,
          // Every card belongs to a customer from People → Customers.
          columns: [
            ...base.columns.slice(0, 1),
            {
              key: "customerName",
              label: ["Customer", "អតិថិជន"],
              value: (row) =>
                customerOf(row)?.name ??
                l(["⚠ Not in Customers", "⚠ មិនមានក្នុងបញ្ជីអតិថិជន"]),
            },
            ...base.columns.slice(1),
          ],
          fields: (base.fields ?? []).map((field) =>
            field.key === "customer"
              ? {
                  key: "customerId",
                  label: ["Customer", "អតិថិជន"],
                  required: true,
                  type: "select" as const,
                  options: customers.map((row): [string, Label] => {
                    const text = [row.name, row.phone]
                      .map((value) => String(value ?? "").trim())
                      .filter((value) => value && value !== "-")
                      .join(" — ");
                    return [String(row.id), [text, text]];
                  }),
                }
              : field,
          ),
          prepare: (values, existing) => {
            const customer = customers.find(
              (row) => row.id === values.customerId,
            );
            if (!customer)
              return {
                error: [
                  "Choose a customer. Add new people in People → Customers first.",
                  "សូមជ្រើសអតិថិជន។ បើមិនទាន់មាន សូមបន្ថែមនៅ មនុស្ស → អតិថិជន ជាមុនសិន។",
                ],
              };
            const result = base.prepare
              ? base.prepare(
                  { ...values, customer: String(customer.phone ?? "") },
                  existing,
                )
              : { values };
            if ("error" in result) return result;
            return {
              values: {
                ...result.values,
                customer: String(customer.phone ?? ""),
                customerId: customer.id,
              },
            };
          },
          rowActions: "menu",
          canDelete: (row) => !ledger.some((entry) => entry.cardId === row.id),
          menuItems: (row) => [
            {
              icon: "card",
              label: l(["Redeem points", "ប្ដូរពិន្ទុ"]),
              onClick: () => {
                setCard(row);
                setReward("");
                setWarehouseId("");
              },
            },
          ],
          details: (row) => (
            <DataTable
              rows={ledger.filter((entry) => entry.cardId === row.id)}
              selectable={false}
              initialSort={{ key: "date", desc: true }}
              columns={[
                {
                  key: "date",
                  label: ["Date", "កាលបរិច្ឆេទ"],
                  type: "datetime",
                },
                {
                  key: "kind",
                  label: ["Activity", "សកម្មភាព"],
                  filter: "chips",
                },
                { key: "reference", label: ["Reference", "លេខយោង"] },
                {
                  key: "points",
                  label: ["Points change", "ការប្រែប្រួលពិន្ទុ"],
                  type: "number",
                },
                { key: "createdBy", label: ["User", "អ្នកប្រើប្រាស់"] },
              ]}
            />
          ),
        }}
      />
      {card && (
        <Modal
          open
          title={l(["Redeem points", "ប្ដូរពិន្ទុ"])}
          onClose={() => setCard(null)}
          onSubmit={() => {
            if (!canPerform("memberCards.redeem")) {
              notify(
                l([
                  "You do not have permission to redeem points.",
                  "អ្នកមិនមានសិទ្ធិប្ដូរពិន្ទុទេ។",
                ]),
              );
              return;
            }
            const location = warehouses.find((row) => row.id === warehouseId);
            if (!location) return;
            try {
              redeemReward(card.id, reward, {
                branch: String(location.branch || "Central"),
                warehouse: String(location.name),
              });
              setCard(null);
              notify(l(["Reward redeemed", "បានប្ដូររង្វាន់"]));
            } catch (error) {
              notify(
                error instanceof Error ? error.message : "Redemption failed",
              );
            }
          }}
          footer={
            <button type="submit" className="btn btn-primary">
              {l(["Redeem", "ប្ដូរ"])}
            </button>
          }
        >
          <label className="field">
            <span>{l(["Reward", "រង្វាន់"])}</span>
            <NativeSelect
              required
              className="form-control"
              value={reward}
              onChange={(event) => setReward(event.target.value)}
            >
              <option value="">{l(["Select", "ជ្រើសរើស"])}</option>
              {rewards.map((row) => (
                <option key={row.id} value={row.id}>
                  {String(row.name)} ({String(row.points)})
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="field">
            <span>{l(["Warehouse", "ឃ្លាំង"])}</span>
            <NativeSelect
              required
              className="form-control"
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
            >
              <option value="">{l(["Select", "ជ្រើសរើស"])}</option>
              {warehouses.map((row) => (
                <option key={row.id} value={row.id}>
                  {String(row.branch || "Central")} / {String(row.name)}
                </option>
              ))}
            </NativeSelect>
          </label>
        </Modal>
      )}
    </>
  );
}
