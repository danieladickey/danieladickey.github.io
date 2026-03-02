import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Download,
  Upload,
  RotateCcw,
  Plus,
  Trash2,
  Shuffle,
  MoreVertical,
} from "lucide-react";

/**
 * BevMax 45-Slot Planogram App
 * - 45 "selections" arranged in a 9x5 grid (configurable)
 * - Create/manage products
 * - Drag product onto a selection
 * - Drag between selections to swap
 * - Search + filter by category
 * - Export/Import JSON (simple, reliable)
 * - Optional CSV export (for copy/paste)
 * - Auto-saves to localStorage
 */

const STORAGE_KEY = "bevmax_planogram_v1";

const CATEGORIES = [
  "Energy",
  "Soda",
  "Water",
  "Sports",
  "Juice",
  "Tea",
  "Coffee",
  "Other",
];

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function toCSV(rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (/[\n\r,\"]/g.test(s)) return `"${s.replace(/\"/g, '""')}"`;
    return s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

function clampInt(value, min, max, fallback) {
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function buildGridOrder(cols, rows) {
  // Row-major order: top row left->right, then next row...
  const order = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      order.push(r * cols + c);
    }
  }
  return order;
}

function getSelectionCode(index, cols) {
  // Produces something like A1..I5 (for 9x5)
  const colLetter = String.fromCharCode("A".charCodeAt(0) + (index % cols));
  const rowNum = Math.floor(index / cols) + 1;
  return `${colLetter}${rowNum}`;
}

function categoryColor(category) {
  // Placeholder for future per-category styling.
  switch (category) {
    case "Energy":
    case "Soda":
    case "Water":
    case "Sports":
    case "Juice":
    case "Tea":
    case "Coffee":
    default:
      return "bg-muted";
  }
}

function defaultState() {
  const products = [
    {
      id: uid("p"),
      name: "Monster (16oz)",
      category: "Energy",
      sizeOz: 16,
      color: "#16a34a", // green
      notes: "",
    },
    {
      id: uid("p"),
      name: "Red Bull (12oz)",
      category: "Energy",
      sizeOz: 12,
      color: "#dc2626", // red
      notes: "",
    },
    {
      id: uid("p"),
      name: "Celsius (12oz)",
      category: "Energy",
      sizeOz: 12,
      color: "#0ea5e9", // sky
      notes: "",
    },
    {
      id: uid("p"),
      name: "Diet Coke (12oz)",
      category: "Soda",
      sizeOz: 12,
      color: "#111827", // near-black
      notes: "",
    },
    {
      id: uid("p"),
      name: "Water (16.9oz)",
      category: "Water",
      sizeOz: 16.9,
      color: "#2563eb", // blue
      notes: "Single water SKU",
    },
  ];

  // 9 columns x 5 rows = 45
  const cols = 9;
  const rows = 5;
  const selections = Array.from({ length: cols * rows }, (_, i) => ({
    id: `s_${i + 1}`,
    label: `S${i + 1}`,
    productId: null,
    price: "",
    par: "",
    notes: "",
  }));

  return {
    version: 1,
    machine: {
      name: "Dixie Narco BevMax (45 selections)",
      cols,
      rows,
    },
    products,
    selections,
    ui: {
      categoryFilter: "All",
      search: "",
      showIds: false,
      cellTitleColor: "#0f172a", // default slate-900
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultState();

    // Minimal migrations
    if (!parsed.version) parsed.version = 1;

    if (!parsed.machine?.cols || !parsed.machine?.rows) {
      parsed.machine = {
        ...(parsed.machine || {}),
        cols: 9,
        rows: 5,
        name: parsed.machine?.name || "BevMax",
      };
    }

    if (!Array.isArray(parsed.products)) parsed.products = [];
    parsed.products = parsed.products.map((p) => ({
      ...p,
      color:
        typeof p?.color === "string" && /^#[0-9a-fA-F]{6}$/.test(p.color)
          ? p.color
          : "#0f172a",
    }));
    if (!Array.isArray(parsed.selections)) parsed.selections = [];

    if (!parsed.ui) {
      parsed.ui = {
        categoryFilter: "All",
        search: "",
        showIds: false,
        cellTitleColor: "#0f172a",
      };
    }

    if (!parsed.ui.cellTitleColor) parsed.ui.cellTitleColor = "#0f172a";

    return parsed;
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

// Lightweight self-tests (no external runner). Keeps helpers from regressing.
function runSelfTests() {
  console.assert(clampInt("9", 1, 20, 5) === 9, "clampInt parses strings");
  console.assert(clampInt("", 1, 20, 5) === 5, "clampInt fallback on empty");
  console.assert(clampInt("999", 1, 20, 5) === 20, "clampInt clamps high");
  console.assert(getSelectionCode(0, 9) === "A1", "getSelectionCode A1");
  console.assert(getSelectionCode(8, 9) === "I1", "getSelectionCode I1");
  console.assert(getSelectionCode(9, 9) === "A2", "getSelectionCode A2");
  const csv = toCSV([["a,b", 'c"d']]);
  console.assert(csv.includes('"a,b"') && csv.includes('"c""d"'), "toCSV escapes");
}

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null); // product
  const [drag, setDrag] = useState(null); // {type:'product'|'selection', id}

  useEffect(() => {
    // Run once per mount.
    runSelfTests();
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const productById = useMemo(() => {
    const m = new Map();
    for (const p of state.products) m.set(p.id, p);
    return m;
  }, [state.products]);

  const filteredProducts = useMemo(() => {
    const q = (state.ui.search || "").trim().toLowerCase();
    return state.products
      .filter((p) =>
        state.ui.categoryFilter === "All" ? true : p.category === state.ui.categoryFilter
      )
      .filter((p) =>
        q
          ? (p.name || "").toLowerCase().includes(q) ||
            (p.notes || "").toLowerCase().includes(q)
          : true
      )
      .sort((a, b) => (a.category + a.name).localeCompare(b.category + b.name));
  }, [state.products, state.ui.categoryFilter, state.ui.search]);

  const gridOrder = useMemo(
    () => buildGridOrder(state.machine.cols, state.machine.rows),
    [state.machine.cols, state.machine.rows]
  );

  function setUI(patch) {
    setState((s) => ({ ...s, ui: { ...s.ui, ...patch } }));
  }

  function upsertProduct(p) {
    setState((s) => {
      const exists = s.products.some((x) => x.id === p.id);
      const products = exists
        ? s.products.map((x) => (x.id === p.id ? p : x))
        : [p, ...s.products];
      return { ...s, products };
    });
  }

  function deleteProduct(productId) {
    setState((s) => {
      const products = s.products.filter((p) => p.id !== productId);
      const selections = s.selections.map((sel) =>
        sel.productId === productId ? { ...sel, productId: null } : sel
      );
      return { ...s, products, selections };
    });
  }

  function setSelection(selId, patch) {
    setState((s) => ({
      ...s,
      selections: s.selections.map((x) =>
        x.id === selId ? { ...x, ...patch } : x
      ),
    }));
  }

  function resizeGrid(cols, rows) {
    setState((s) => {
      const newCols = clampInt(cols, 1, 20, s.machine.cols);
      const newRows = clampInt(rows, 1, 20, s.machine.rows);
      const target = newCols * newRows;
      const current = s.selections.length;
      let selections = [...s.selections];

      if (target > current) {
        for (let i = current; i < target; i++) {
          selections.push({
            id: `s_${i + 1}`,
            label: `S${i + 1}`,
            productId: null,
            price: "",
            par: "",
            notes: "",
          });
        }
      } else if (target < current) {
        selections = selections.slice(0, target);
      }

      return {
        ...s,
        machine: { ...s.machine, cols: newCols, rows: newRows },
        selections,
      };
    });
  }

  function resetAll() {
    setState(defaultState());
  }

  function exportJSON() {
    const out = JSON.stringify(state, null, 2);
    downloadText("bevmax-planogram.json", out);
  }

  function exportCSV() {
    const cols = state.machine.cols;
    const header = [
      "Cell",
      "SelectionLabel",
      "Product",
      "Category",
      "ProductColor",
      "SizeOz",
      "Price",
      "Par",
      "Notes",
    ];

    const body = state.selections.map((sel, i) => {
      const p = sel.productId ? productById.get(sel.productId) : null;
      return [
        getSelectionCode(i, cols),
        sel.label,
        p?.name || "",
        p?.category || "",
        p?.color || "",
        p?.sizeOz ?? "",
        sel.price,
        sel.par,
        sel.notes,
      ];
    });

    downloadText("bevmax-planogram.csv", toCSV([header, ...body]));
  }

  function openNewProduct() {
    setEditing({ id: uid("p"), name: "", category: "Energy", sizeOz: "", color: "#0f172a", notes: "" });
    setEditOpen(true);
  }

  function openEditProduct(p) {
    setEditing({ ...p });
    setEditOpen(true);
  }

  function applyImport(text) {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON");
      if (!Array.isArray(parsed.products) || !Array.isArray(parsed.selections)) {
        throw new Error("Missing products/selections");
      }
      if (!parsed.machine?.cols || !parsed.machine?.rows) {
        throw new Error("Missing machine config");
      }

      setState({
        version: 1,
        machine: {
          name: parsed.machine.name || "BevMax",
          cols: clampInt(parsed.machine.cols, 1, 20, 9),
          rows: clampInt(parsed.machine.rows, 1, 20, 5),
        },
        products: parsed.products,
        selections: parsed.selections,
        ui: {
          categoryFilter: "All",
          search: "",
          showIds: false,
          cellTitleColor: parsed.ui?.cellTitleColor || "#0f172a",
        },
      });

      setImportOpen(false);
      setImportText("");
    } catch (e) {
      alert(`Import failed: ${e?.message || e}`);
    }
  }

  function onDragStartProduct(productId) {
    setDrag({ type: "product", id: productId });
  }

  function onDragStartSelection(selectionId) {
    setDrag({ type: "selection", id: selectionId });
  }

  function onDropOnSelection(targetSelectionId) {
    if (!drag) return;

    if (drag.type === "product") {
      setSelection(targetSelectionId, { productId: drag.id });
    } else if (drag.type === "selection") {
      if (drag.id === targetSelectionId) return;

      setState((s) => {
        const a = s.selections.find((x) => x.id === drag.id);
        const b = s.selections.find((x) => x.id === targetSelectionId);
        if (!a || !b) return s;

        const selections = s.selections.map((x) => {
          if (x.id === a.id) return { ...x, productId: b.productId };
          if (x.id === b.id) return { ...x, productId: a.productId };
          return x;
        });

        return { ...s, selections };
      });
    }

    setDrag(null);
  }

  function clearSelectionProduct(selId) {
    setSelection(selId, { productId: null });
  }

  function shuffleFill() {
    setState((s) => {
      if (s.products.length === 0) return s;
      const selections = s.selections.map((sel, i) => ({
        ...sel,
        productId: s.products[i % s.products.length].id,
      }));
      return { ...s, selections };
    });
  }

  function isHexColor(v) {
    return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
  }

  const safeTitleColor = isHexColor(state.ui.cellTitleColor) ? state.ui.cellTitleColor : "#0f172a";

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <div className="text-2xl font-semibold">BevMax Planogram</div>
            <div className="text-sm text-muted-foreground">
              Arrange products across {state.machine.cols}×{state.machine.rows} selections ({state.machine.cols * state.machine.rows}). Drag a product onto a slot.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <MoreVertical className="h-4 w-4" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Data</DropdownMenuLabel>
                <DropdownMenuItem onClick={exportJSON} className="gap-2">
                  <Download className="h-4 w-4" /> Export JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportCSV} className="gap-2">
                  <Download className="h-4 w-4" /> Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportOpen(true)} className="gap-2">
                  <Upload className="h-4 w-4" /> Import JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Utilities</DropdownMenuLabel>
                <DropdownMenuItem onClick={shuffleFill} className="gap-2">
                  <Shuffle className="h-4 w-4" /> Quick fill
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={resetAll}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <RotateCcw className="h-4 w-4" /> Reset to defaults
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left: Product Library */}
          <Card className="lg:col-span-1 rounded-2xl">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">Products</div>
                <Button size="sm" className="gap-2" onClick={openNewProduct}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Filter</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={state.ui.categoryFilter}
                      onValueChange={(v) => setUI({ categoryFilter: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All</SelectItem>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 relative">
                    <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                    <Input
                      value={state.ui.search}
                      onChange={(e) => setUI({ search: e.target.value })}
                      placeholder="Search…"
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-2">
                <Label>Grid Title Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={safeTitleColor}
                    onChange={(e) => setUI({ cellTitleColor: e.target.value })}
                    className="h-10 w-14 p-1"
                  />
                  <Input
                    value={safeTitleColor}
                    onChange={(e) => setUI({ cellTitleColor: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                {filteredProducts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No products match your filters.
                  </div>
                ) : (
                  filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => onDragStartProduct(p.id)}
                      onDragEnd={() => setDrag(null)}
                      className="rounded-xl border p-3 hover:bg-accent/40 transition cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="font-medium truncate">
                            {p.name || "(Unnamed product)"}
                          </div>
                          <div className="flex flex-wrap gap-2 items-center">
                            <span
                              className="inline-block h-3 w-3 rounded-full border"
                              style={{ backgroundColor: isHexColor(p.color) ? p.color : safeTitleColor }}
                              title={isHexColor(p.color) ? p.color : safeTitleColor}
                            />
                            <Badge
                              variant="secondary"
                              className={categoryColor(p.category)}
                            >
                              {p.category}
                            </Badge>
                            {p.sizeOz !== "" && p.sizeOz != null ? (
                              <Badge variant="outline">{p.sizeOz}oz</Badge>
                            ) : null}
                          </div>
                          {p.notes ? (
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {p.notes}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEditProduct(p)}
                            title="Edit"
                          >
                            <span className="text-xs font-semibold">E</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              if (
                                confirm(
                                  `Delete product "${p.name}"? This will clear it from any selections.`
                                )
                              )
                                deleteProduct(p.id);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: Grid */}
          <Card className="lg:col-span-2 rounded-2xl">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-lg font-semibold">Selections</div>
                  <div className="text-sm text-muted-foreground">
                    Drag a product onto any slot. Drag a slot to another to swap.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-end">
                  <div className="grid gap-1">
                    <Label>Columns</Label>
                    <Input
                      type="number"
                      value={state.machine.cols}
                      onChange={(e) =>
                        resizeGrid(e.target.value, state.machine.rows)
                      }
                      className="w-24"
                      min={1}
                      max={20}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Rows</Label>
                    <Input
                      type="number"
                      value={state.machine.rows}
                      onChange={(e) =>
                        resizeGrid(state.machine.cols, e.target.value)
                      }
                      className="w-24"
                      min={1}
                      max={20}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label>Show IDs</Label>
                    <Button
                      variant={state.ui.showIds ? "default" : "outline"}
                      onClick={() => setUI({ showIds: !state.ui.showIds })}
                      className="w-24"
                    >
                      {state.ui.showIds ? "On" : "Off"}
                    </Button>
                  </div>
                </div>
              </div>

              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${state.machine.cols}, minmax(0, 1fr))`,
                }}
              >
                {gridOrder.map((idx) => {
                  const sel = state.selections[idx];
                  const p = sel?.productId
                    ? productById.get(sel.productId)
                    : null;
                  const cellCode = getSelectionCode(idx, state.machine.cols);
                  if (!sel) return null;

                  return (
                    <div
                      key={sel.id}
                      className={`rounded-2xl border p-3 min-h-[110px] transition ${drag ? "ring-0" : ""}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDropOnSelection(sel.id)}
                      draggable
                      onDragStart={() => onDragStartSelection(sel.id)}
                      onDragEnd={() => setDrag(null)}
                      title="Drop product here. Drag this slot to another slot to swap."
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              style={{
                                backgroundColor: isHexColor(p?.color) ? p.color : safeTitleColor,
                                color: "white",
                                borderColor: isHexColor(p?.color) ? p.color : safeTitleColor,
                              }}
                            >
                              {cellCode}
                            </Badge>
                            <div className="text-xs text-muted-foreground truncate">
                              {state.ui.showIds ? sel.id : sel.label}
                            </div>
                          </div>
                          <div className="font-medium truncate">
                            {p ? (
                              p.name
                            ) : (
                              <span className="text-muted-foreground">(Empty)</span>
                            )}
                          </div>
                          {p ? (
                            <div className="flex flex-wrap gap-2 items-center">
                              <Badge
                                variant="secondary"
                                className={categoryColor(p.category)}
                              >
                                {p.category}
                              </Badge>
                              {p.sizeOz !== "" && p.sizeOz != null ? (
                                <Badge variant="outline">{p.sizeOz}oz</Badge>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        <div className="shrink-0 flex gap-1">
                          {sel.productId ? (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => clearSelectionProduct(sel.id)}
                              title="Clear product"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="grid gap-1">
                          <Label className="text-xs">Price</Label>
                          <Input
                            value={sel.price}
                            onChange={(e) =>
                              setSelection(sel.id, { price: e.target.value })
                            }
                            placeholder="$"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">Par</Label>
                          <Input
                            value={sel.par}
                            onChange={(e) =>
                              setSelection(sel.id, { par: e.target.value })
                            }
                            placeholder="#"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">Notes</Label>
                          <Input
                            value={sel.notes}
                            onChange={(e) =>
                              setSelection(sel.id, { notes: e.target.value })
                            }
                            placeholder="…"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator />

              <div className="text-sm text-muted-foreground">
                Tip: Export JSON for backup. If you want the grid to match your machine labels exactly, change the slot labels (S1…)
                by editing the exported JSON and importing it back.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Import Dialog */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import Planogram JSON</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Paste JSON previously exported from this app. Import replaces your current data.
              </div>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="min-h-[280px]"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => applyImport(importText)}>Import</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Product Editor */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editing?.name ? "Edit Product" : "Add Product"}</DialogTitle>
            </DialogHeader>
            {editing ? (
              <div className="grid gap-4">
                <div className="grid gap-1">
                  <Label>Name</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) =>
                      setEditing((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="e.g., Reign (16oz)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label>Category</Label>
                    <Select
                      value={editing.category}
                      onValueChange={(v) =>
                        setEditing((p) => ({ ...p, category: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1">
                    <Label>Size (oz)</Label>
                    <Input
                      value={editing.sizeOz}
                      onChange={(e) =>
                        setEditing((p) => ({ ...p, sizeOz: e.target.value }))
                      }
                      placeholder="12"
                    />
                  </div>
                </div>

                <div className="grid gap-1">
                  <Label>Color</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={
                        typeof editing.color === "string" && /^#[0-9a-fA-F]{6}$/.test(editing.color)
                          ? editing.color
                          : "#0f172a"
                      }
                      onChange={(e) =>
                        setEditing((p) => ({ ...p, color: e.target.value }))
                      }
                      className="h-10 w-14 p-1"
                    />
                    <Input
                      value={editing.color ?? ""}
                      onChange={(e) =>
                        setEditing((p) => ({ ...p, color: e.target.value }))
                      }
                      placeholder="#RRGGBB"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="grid gap-1">
                  <Label>Notes</Label>
                  <Textarea
                    value={editing.notes}
                    onChange={(e) =>
                      setEditing((p) => ({ ...p, notes: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!editing) return;
                  if (!String(editing.name || "").trim()) {
                    alert("Name is required.");
                    return;
                  }
                  const normalized = {
                    ...editing,
                    name: String(editing.name).trim(),
                    sizeOz:
                      editing.sizeOz === ""
                        ? ""
                        : Number.isNaN(Number(editing.sizeOz))
                          ? editing.sizeOz
                          : Number(editing.sizeOz),
                    color:
                      typeof editing.color === "string" && /^#[0-9a-fA-F]{6}$/.test(editing.color)
                        ? editing.color
                        : "#0f172a",
                    notes: String(editing.notes || ""),
                  };
                  upsertProduct(normalized);
                  setEditOpen(false);
                  setEditing(null);
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
