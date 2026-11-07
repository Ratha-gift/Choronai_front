"use client";
import { useEffect, useRef, useState } from "react";
import { Box } from "@/components/ui/box";
import { useCollection } from "@/data/collections";
import { useLanguage, type Label } from "@/i18n";
import { useStored } from "@/lib/store";
import { notify } from "@/lib/toast";
import {
  DEFAULT_PERMISSIONS,
  PERMISSIONS_KEY,
  useMayManageGroup,
  usePermissions,
} from "./permissions";

const CRUD: [string, Label][] = [
  ["view", ["View", "មើល"]],
  ["add", ["Add", "បន្ថែម"]],
  ["edit", ["Edit", "កែ"]],
  ["delete", ["Delete", "លុប"]],
];

const MODULES: {
  id: string;
  label: Label;
  misc: [string, Label][];
  /** false: no View/Add/Edit/Delete boxes, only the miscellaneous ones. */
  crud?: false;
}[] = [
  {
    id: "products",
    label: ["Products", "មុខទំនិញ"],
    misc: [
      ["cost", ["Product Cost", "ថ្លៃដើម"]],
      ["price", ["Product Price", "តម្លៃ"]],
    ],
  },
  {
    id: "stock",
    label: ["Stock Management", "គ្រប់គ្រងស្តុក"],
    misc: [
      ["receive", ["Stock Receive", "ទទួលស្តុក"]],
      ["issue", ["Stock Issue", "បញ្ចេញស្តុក"]],
      ["approve", ["Approve Adjustment", "អនុម័ត"]],
    ],
  },
  {
    id: "sales",
    label: ["Sales", "ការលក់"],
    misc: [
      ["pos", ["POS", "POS"]],
      ["payments", ["Payments", "ការទូទាត់"]],
      ["returns", ["Return Sales", "លក់ត្រឡប់"]],
      ["cancel", ["Cancel Sales", "បោះបង់"]],
      ["registers", ["Open / Close Register", "បើក / បិទបញ្ជរ"]],
    ],
  },
  {
    id: "memberCards",
    label: ["Member Cards", "កាតសមាជិក"],
    misc: [["redeem", ["Redeem Points", "ប្ដូរពិន្ទុ"]]],
  },
  {
    id: "customers",
    label: ["Customers", "អតិថិជន"],
    misc: [
      ["deposits", ["Deposits", "ប្រាក់កក់"]],
      ["printCard", ["Print Card", "បោះពុម្ពកាត"]],
    ],
  },
  { id: "suppliers", label: ["Suppliers", "អ្នកផ្គត់ផ្គង់"], misc: [] },
  { id: "users", label: ["Users", "អ្នកប្រើប្រាស់"], misc: [] },
  {
    id: "settings",
    label: ["Settings", "ការកំណត់"],
    misc: [
      ["system", ["System Settings", "ប្រព័ន្ធ"]],
      ["pos", ["POS Settings", "POS"]],
      ["categories", ["Categories", "ប្រភេទ"]],
      ["currencies", ["Currencies", "រូបិយប័ណ្ណ"]],
      ["taxRates", ["Tax Rates", "អត្រាពន្ធ"]],
    ],
  },
  {
    id: "reports",
    label: ["Reports", "របាយការណ៍"],
    misc: [
      ["stockChart", ["Warehouse Stock Chart", "ក្រាហ្វស្តុក"]],
      ["bestSellers", ["Best Sellers", "លក់ដាច់"]],
      ["alerts", ["Quantity Alerts", "ព្រមានបរិមាណ"]],
      ["products", ["Products", "មុខទំនិញ"]],
      ["sales", ["Sales", "ការលក់"]],
    ],
  },
  {
    id: "branches",
    label: ["Branch Access", "សិទ្ធិសាខា"],
    crud: false,
    // Without it, users only see the data of their own branch (People → Users).
    misc: [["all", ["See all branches", "មើលគ្រប់សាខា"]]],
  },
];

const keysOf = (module: (typeof MODULES)[number]) => [
  ...(module.crud === false ? [] : CRUD.map(([id]) => `${module.id}.${id}`)),
  ...module.misc.map(([id]) => `${module.id}.${id}`),
];
const ALL_KEYS = MODULES.flatMap(keysOf);

/** Ticks or clears a set of permissions; shows a dash when only some are on. */
function CheckAll({
  keys,
  values,
  onChange,
  label,
}: {
  keys: string[];
  values: Record<string, boolean>;
  onChange: (keys: string[], on: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const count = keys.filter((key) => values[key]).length;
  const all = count === keys.length;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = count > 0 && !all;
  }, [count, all]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="check-all"
      title={label}
      aria-label={label}
      checked={all}
      onChange={() => onChange(keys, !all)}
    />
  );
}

export function GroupPermissions({ groupId }: { groupId?: string }) {
  const { l, t } = useLanguage();
  const { rows: groups } = useCollection("userGroups");
  const [saved, setSaved] = useStored(PERMISSIONS_KEY, DEFAULT_PERMISSIONS);
  const group = groups.find((row) => row.id === groupId) ?? groups[0];
  const mayManageGroup = useMayManageGroup();
  const { can } = usePermissions();
  const [values, setValues] = useState<Record<string, boolean>>(
    (group && saved[group.id]) ?? {},
  );
  if (!group)
    return (
      <Box icon="lock" title={l(["Group Permissions", "សិទ្ធិក្រុម"])}>
        <p>{t.noDataTable}</p>
      </Box>
    );
  // Only rights the user has can be given; stronger groups are read-only.
  const readOnly = !mayManageGroup(group);
  const setMany = (keys: string[], on: boolean) =>
    !readOnly &&
    setValues((old) => ({
      ...old,
      ...Object.fromEntries(
        keys.filter((key) => !on || can(key)).map((key) => [key, on]),
      ),
    }));
  const selectAll = l(["Select all", "ជ្រើសទាំងអស់"]);
  const box = (key: string) => (
    <input
      type="checkbox"
      aria-label={key}
      checked={!!values[key]}
      disabled={readOnly || (!values[key] && !can(key))}
      onChange={() => setValues((old) => ({ ...old, [key]: !old[key] }))}
    />
  );
  return (
    <Box
      icon="lock"
      title={`${String(group.description)} (${String(group.name)}) ${l(["Group Permissions", "សិទ្ធិក្រុម"])}`}
      intro={
        String(group.name).toLowerCase() === "owner"
          ? l([
              "The Owner group can always do everything; these ticks do not limit it.",
              "ក្រុម Owner អាចធ្វើបានគ្រប់យ៉ាងជានិច្ច។ ការជ្រើសខាងក្រោមមិនកំណត់សិទ្ធិវាទេ។",
            ])
          : l([
              "Tick what members of this group may do.",
              "ជ្រើសរើសអ្វីដែលសមាជិកក្រុមនេះអាចធ្វើបាន។",
            ])
      }
    >
      <div className="table-responsive">
        <table className="data-table permissions">
          <thead>
            <tr>
              <th rowSpan={2}>
                <label className="check-all-label">
                  <CheckAll
                    keys={ALL_KEYS}
                    values={values}
                    onChange={setMany}
                    label={selectAll}
                  />
                  {l(["Check All", "ជ្រើសទាំងអស់"])}
                </label>
              </th>
              <th colSpan={5}>{l(["Permissions", "សិទ្ធិ"])}</th>
            </tr>
            <tr>
              {CRUD.map(([id, label]) => (
                <th key={id} className="align-center">
                  <label className="check-all-label column">
                    {l(label)}
                    <CheckAll
                      keys={MODULES.filter(
                        (module) => module.crud !== false,
                      ).map((module) => `${module.id}.${id}`)}
                      values={values}
                      onChange={setMany}
                      label={`${selectAll}: ${l(label)}`}
                    />
                  </label>
                </th>
              ))}
              <th>{l(["Miscellaneous", "ផ្សេងៗ"])}</th>
            </tr>
          </thead>
          <tbody>
            {MODULES.map((module) => (
              <tr key={module.id}>
                <th scope="row" className="row-head">
                  <label className="check-all-label">
                    <CheckAll
                      keys={keysOf(module)}
                      values={values}
                      onChange={setMany}
                      label={`${selectAll}: ${l(module.label)}`}
                    />
                    {l(module.label)}
                  </label>
                </th>
                {CRUD.map(([id]) => (
                  <td key={id} className="align-center">
                    {module.crud !== false && box(`${module.id}.${id}`)}
                  </td>
                ))}
                <td>
                  <div className="checkbox-row compact">
                    {module.misc.map(([id, label]) => (
                      <label key={id}>
                        {box(`${module.id}.${id}`)}
                        {l(label)}
                      </label>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {readOnly && (
        <p className="text-warning">
          {l([
            "This group has rights you do not have: only the owner can change it.",
            "ក្រុមនេះមានសិទ្ធិដែលអ្នកមិនមាន៖ មានតែ Owner ទេដែលអាចកែបាន។",
          ])}
        </p>
      )}
      <button
        className="btn btn-primary form-actions"
        disabled={readOnly}
        onClick={() => {
          setSaved((old) => ({ ...old, [group.id]: values }));
          notify(t.settingsSaved);
        }}
      >
        {l(["Update", "ធ្វើបច្ចុប្បន្នភាព"])}
      </button>
    </Box>
  );
}
