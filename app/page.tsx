"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import { toJpeg, toPng } from "html-to-image";

type Product = {
  id: string;
  name: string;
  price: number;
  created_at?: string;
};

type SelectedItem = {
  productId: string;
  qty: number;
};

type InvoiceRecord = {
  id: string;
  invoice_no: string;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  invoice_date: string;
  total: number;
  created_at?: string;
};

const BUSINESS = {
  name: "The Sports Land",
  website: "www.sportland.com",
  phone: "+94 72 929 958",
  email: "sportland@gmail.com",
  address: "Negombo, Sri Lanka",
  dueText: "On receipt",
};

// paste your real base64 logo here if you want 100% safest iPhone export
const LOGO_SRC = "/logo.png";
// example:
// const LOGO_SRC = "data:image/png;base64,PASTE_YOUR_BASE64_HERE";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatInvoiceDate(value: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function normalizePhoneForWhatsApp(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "");

  if (cleaned.startsWith("+")) {
    return cleaned.slice(1);
  }

  if (cleaned.startsWith("94")) {
    return cleaned;
  }

  if (cleaned.startsWith("0")) {
    return `94${cleaned.slice(1)}`;
  }

  return cleaned;
}

function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll("img"));
  return Promise.all(
    images.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) resolve(true);
          else img.onload = img.onerror = () => resolve(true);
        })
    )
  );
}

export default function Page() {
  const invoiceRef = useRef<HTMLDivElement | null>(null);

  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductName, setEditingProductName] = useState("");
  const [editingProductPrice, setEditingProductPrice] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerHistory, setCustomerHistory] = useState<InvoiceRecord[]>([]);

  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingCustomerHistory, setLoadingCustomerHistory] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadInitialData();
  }, []);

  async function loadInitialData() {
    await Promise.all([loadProducts(), loadNextInvoiceNumber(), loadCustomerHistory("")]);
  }

  async function loadNextInvoiceNumber() {
    const { data, error } = await supabase
      .from("invoices")
      .select("invoice_no")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      setInvoiceNo("INV0001");
      return;
    }

    const lastInvoice = data?.invoice_no ?? "";
    const lastNumber = Number(lastInvoice.replace(/[^\d]/g, ""));
    const nextNumber = Number.isFinite(lastNumber) && lastNumber > 0 ? lastNumber + 1 : 1;

    setInvoiceNo(`INV${String(nextNumber).padStart(4, "0")}`);
  }

  async function loadProducts() {
    setLoadingProducts(true);
    setMessage("");

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Product load failed: ${error.message}`);
      setLoadingProducts(false);
      return;
    }

    const normalized =
      data?.map((item) => ({
        ...item,
        price: Number(item.price),
      })) ?? [];

    setProducts(normalized);
    setLoadingProducts(false);
  }

  async function loadCustomerHistory(searchValue: string) {
    setLoadingCustomerHistory(true);

    let query = supabase
      .from("invoices")
      .select("id, invoice_no, customer_name, customer_phone, customer_address, invoice_date, total, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    const trimmed = searchValue.trim();

    if (trimmed) {
      query = query.or(
        `customer_name.ilike.%${trimmed}%,customer_phone.ilike.%${trimmed}%`
      );
    }

    const { data } = await query;
    setCustomerHistory((data as InvoiceRecord[]) ?? []);
    setLoadingCustomerHistory(false);
  }

  async function addProduct() {
    setMessage("");

    const name = newProductName.trim();
    const price = Number(newProductPrice);

    if (!name) {
      setMessage("Enter a product name.");
      return;
    }

    if (Number.isNaN(price) || price < 0) {
      setMessage("Enter a valid product price.");
      return;
    }

    const { error } = await supabase.from("products").insert({ name, price });

    if (error) {
      setMessage(`Add product failed: ${error.message}`);
      return;
    }

    setNewProductName("");
    setNewProductPrice("");
    setMessage("Product added.");
    await loadProducts();
  }

  function startEditProduct(product: Product) {
    setEditingProductId(product.id);
    setEditingProductName(product.name);
    setEditingProductPrice(String(product.price));
  }

  async function saveEditProduct() {
    if (!editingProductId) return;

    const name = editingProductName.trim();
    const price = Number(editingProductPrice);

    if (!name) {
      setMessage("Enter a product name.");
      return;
    }

    if (Number.isNaN(price) || price < 0) {
      setMessage("Enter a valid product price.");
      return;
    }

    const { error } = await supabase
      .from("products")
      .update({ name, price })
      .eq("id", editingProductId);

    if (error) {
      setMessage(`Update failed: ${error.message}`);
      return;
    }

    setEditingProductId(null);
    setEditingProductName("");
    setEditingProductPrice("");
    setMessage("Product updated.");
    await loadProducts();
  }

  async function deleteProduct(productId: string) {
    setMessage("");

    const { error } = await supabase.from("products").delete().eq("id", productId);

    if (error) {
      setMessage(`Delete failed: ${error.message}`);
      return;
    }

    setSelectedItems((prev) => prev.filter((item) => item.productId !== productId));
    setMessage("Product deleted.");
    await loadProducts();
  }

  function toggleProduct(productId: string) {
    setSelectedItems((prev) => {
      const exists = prev.find((item) => item.productId === productId);

      if (exists) {
        return prev.filter((item) => item.productId !== productId);
      }

      return [...prev, { productId, qty: 1 }];
    });
  }

  function changeQty(productId: string, qty: number) {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, qty } : item
      )
    );
  }

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;

    return products.filter((product) =>
      product.name.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  const invoiceItems = useMemo(() => {
    return selectedItems
      .map((selected) => {
        const product = products.find((p) => p.id === selected.productId);
        if (!product) return null;

        return {
          productId: product.id,
          name: product.name,
          price: Number(product.price),
          qty: selected.qty,
          total: Number(product.price) * selected.qty,
        };
      })
      .filter(Boolean) as Array<{
      productId: string;
      name: string;
      price: number;
      qty: number;
      total: number;
    }>;
  }, [selectedItems, products]);

  const balanceDue = useMemo(
    () => invoiceItems.reduce((sum, item) => sum + item.total, 0),
    [invoiceItems]
  );

  async function saveInvoiceToDatabase() {
    setMessage("");

    if (!customerName.trim()) {
      setMessage("Enter customer name.");
      return;
    }

    if (invoiceItems.length === 0) {
      setMessage("Select at least one item.");
      return;
    }

    setSavingInvoice(true);

    const { data: invoiceRow, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        invoice_no: invoiceNo,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        invoice_date: invoiceDate,
        subtotal: balanceDue,
        total: balanceDue,
      })
      .select()
      .single();

    if (invoiceError) {
      setSavingInvoice(false);
      setMessage(`Invoice save failed: ${invoiceError.message}`);
      return;
    }

    const itemsPayload = invoiceItems.map((item) => ({
      invoice_id: invoiceRow.id,
      product_name: item.name,
      qty: item.qty,
      price: item.price,
      line_total: item.total,
    }));

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(itemsPayload);

    setSavingInvoice(false);

    if (itemsError) {
      setMessage(`Invoice items save failed: ${itemsError.message}`);
      return;
    }

    setMessage("Invoice saved.");
    await loadCustomerHistory(customerSearch);
    await loadNextInvoiceNumber();
  }

  function fillCustomerFromHistory(row: InvoiceRecord) {
    setCustomerName(row.customer_name ?? "");
    setCustomerPhone(row.customer_phone ?? "");
    setCustomerAddress(row.customer_address ?? "");
  }

  function sendWhatsAppInvoice() {
    if (!customerPhone.trim()) {
      setMessage("Enter customer phone number first.");
      return;
    }

    if (invoiceItems.length === 0) {
      setMessage("Select at least one item first.");
      return;
    }

    const phone = normalizePhoneForWhatsApp(customerPhone);
    const lines = invoiceItems
      .map(
        (item) =>
          `• ${item.name} x${item.qty} - ${formatMoney(item.total)}`
      )
      .join("%0A");

    const text =
      `*${BUSINESS.name}*%0A` +
      `Invoice: ${invoiceNo}%0A` +
      `Date: ${formatInvoiceDate(invoiceDate)}%0A` +
      `Customer: ${customerName || "-"}%0A%0A` +
      `${lines}%0A%0A` +
      `*Balance Due:* ${formatMoney(balanceDue)}`;

    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  }

  async function downloadJPEG() {
    if (!invoiceRef.current) return;

    await waitForImages(invoiceRef.current);

    const dataUrl = await toJpeg(invoiceRef.current, {
      quality: 0.95,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });

    const link = document.createElement("a");
    link.download = `${invoiceNo}.jpeg`;
    link.href = dataUrl;
    link.click();
  }

  async function downloadPDF() {
    if (!invoiceRef.current) return;

    await waitForImages(invoiceRef.current);

    const dataUrl = await toPng(invoiceRef.current, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const imgProps = pdf.getImageProperties(dataUrl);
    const imgHeight = (imgProps.height * pageWidth) / imgProps.width;

    pdf.addImage(dataUrl, "PNG", 0, 0, pageWidth, imgHeight);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS) {
      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      window.location.href = url;
    } else {
      pdf.save(`${invoiceNo}.pdf`);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 p-3 md:p-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="rounded-[28px] bg-white p-4 shadow-lg md:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">Invoice Builder</h1>
            <p className="mt-1 text-sm text-slate-500">
              The Sports Land billing system
            </p>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl bg-slate-50 p-4">
              <h2 className="mb-3 text-lg font-semibold">Invoice Info</h2>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Invoice Number</label>
                  <input
                    value={invoiceNo}
                    readOnly
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Customer</h2>
                <button
                  onClick={() => loadCustomerHistory(customerSearch)}
                  className="rounded-xl border px-3 py-2 text-sm"
                >
                  Refresh
                </button>
              </div>

              <div className="mb-4">
                <input
                  placeholder="Search previous customer by name or phone"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onKeyUp={() => loadCustomerHistory(customerSearch)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none"
                />
              </div>

              <div className="mb-4 max-h-44 space-y-2 overflow-y-auto">
                {loadingCustomerHistory ? (
                  <div className="rounded-xl bg-white p-3 text-sm text-slate-500">
                    Loading customer history...
                  </div>
                ) : customerHistory.length === 0 ? (
                  <div className="rounded-xl bg-white p-3 text-sm text-slate-500">
                    No customer history found.
                  </div>
                ) : (
                  customerHistory.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => fillCustomerFromHistory(row)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
                    >
                      <div className="font-semibold">{row.customer_name}</div>
                      <div className="text-sm text-slate-500">
                        {row.customer_phone || "-"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {row.invoice_no} • {formatInvoiceDate(row.invoice_date)}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Customer Name</label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Customer Phone</label>
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Customer Address</label>
                  <textarea
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <h2 className="mb-3 text-lg font-semibold">Add Product</h2>

              <div className="space-y-3">
                <input
                  placeholder="Product name"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none"
                />

                <input
                  type="number"
                  placeholder="Price"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none"
                />

                <button
                  onClick={addProduct}
                  className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-white"
                >
                  Add Product
                </button>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Products</h2>
                <button
                  onClick={loadProducts}
                  className="rounded-xl border px-3 py-2 text-sm"
                >
                  Refresh
                </button>
              </div>

              <input
                placeholder="Search product"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="mb-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none"
              />

              <div className="max-h-[340px] space-y-3 overflow-y-auto">
                {loadingProducts ? (
                  <div className="rounded-xl bg-white p-3 text-sm text-slate-600">
                    Loading products...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="rounded-xl bg-white p-3 text-sm text-slate-600">
                    No products found.
                  </div>
                ) : (
                  filteredProducts.map((product) => {
                    const selected = selectedItems.find(
                      (item) => item.productId === product.id
                    );

                    return (
                      <div
                        key={product.id}
                        className="rounded-2xl border border-slate-200 bg-white p-3"
                      >
                        {editingProductId === product.id ? (
                          <div className="space-y-2">
                            <input
                              value={editingProductName}
                              onChange={(e) => setEditingProductName(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 px-4 py-2"
                            />
                            <input
                              type="number"
                              value={editingProductPrice}
                              onChange={(e) => setEditingProductPrice(e.target.value)}
                              className="w-full rounded-xl border border-slate-300 px-4 py-2"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={saveEditProduct}
                                className="flex-1 rounded-xl bg-black px-3 py-2 text-white"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingProductId(null)}
                                className="flex-1 rounded-xl border px-3 py-2"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <label className="flex flex-1 items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={!!selected}
                                  onChange={() => toggleProduct(product.id)}
                                  className="mt-1 h-4 w-4"
                                />
                                <div>
                                  <div className="font-semibold text-slate-900">
                                    {product.name}
                                  </div>
                                  <div className="text-sm text-slate-600">
                                    {formatMoney(product.price)}
                                  </div>
                                </div>
                              </label>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => startEditProduct(product)}
                                  className="rounded-xl border px-3 py-2 text-sm"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteProduct(product.id)}
                                  className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            {selected && (
                              <div className="mt-3">
                                <label className="mb-1 block text-sm font-medium">
                                  Quantity
                                </label>

                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={selected.qty === 0 ? "" : selected.qty}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, "");

                                    if (value === "") {
                                      changeQty(selected.productId, 0);
                                      return;
                                    }

                                    changeQty(selected.productId, Number(value));
                                  }}
                                  className="w-full rounded-xl border border-slate-300 px-4 py-2"
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {message && (
              <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                {message}
              </div>
            )}

            <div className="grid gap-2">
              <button
                onClick={saveInvoiceToDatabase}
                disabled={savingInvoice}
                className="rounded-xl bg-[#191970] px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {savingInvoice ? "Saving Invoice..." : "Save Invoice"}
              </button>

              <button
                onClick={sendWhatsAppInvoice}
                className="rounded-xl bg-green-600 px-4 py-3 font-semibold text-white"
              >
                Send by WhatsApp
              </button>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  onClick={downloadPDF}
                  className="rounded-xl bg-black px-4 py-3 font-semibold text-white"
                >
                  Download PDF
                </button>

                <button
                  onClick={downloadJPEG}
                  className="rounded-xl bg-slate-200 px-4 py-3 font-semibold text-slate-900"
                >
                  Download JPEG
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] bg-[#dfe7f2] p-3 shadow-lg md:p-6">
          <div className="overflow-x-auto">
            <div
              ref={invoiceRef}
              style={{ backgroundColor: "#ffffff", color: "#111827" }}
              className="mx-auto w-full max-w-[794px] bg-white p-5 md:p-8"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-300 pb-5">
                <div className="flex items-center gap-3">
                  <img
                    src={LOGO_SRC}
                    alt="The Sports Land Logo"
                    className="h-10 w-10 object-contain"
                  />

                  <div>
                    <h1 className="text-2xl font-semibold text-slate-900">
                      {BUSINESS.name}
                    </h1>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      Quality you need
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <h2 className="text-3xl font-bold tracking-[0.2em] text-[#191970]">
                    INVOICE
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{BUSINESS.website}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 py-6 text-sm">
                <div>
                  <p className="mb-2 font-medium text-slate-500">BILL TO:</p>
                  <p className="text-xl font-semibold text-slate-900">
                    {customerName || "Customer Name"}
                  </p>
                  <p className="mt-1 text-slate-600">{customerAddress || "-"}</p>
                  <p className="text-slate-600">{customerPhone || "-"}</p>
                </div>

                <div className="text-right text-slate-700">
                  <p>
                    <span className="font-semibold">NUMBER:</span> {invoiceNo}
                  </p>
                  <p>
                    <span className="font-semibold">DATE:</span>{" "}
                    {formatInvoiceDate(invoiceDate)}
                  </p>
                  <p>
                    <span className="font-semibold">DUE DATE:</span> {BUSINESS.dueText}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gradient-to-r from-[#191970] to-[#27408b] text-white">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Description</th>
                      <th className="px-4 py-3 text-center font-semibold">Quantity</th>
                      <th className="px-4 py-3 text-right font-semibold">Unit price</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>

                  <tbody>
                    {invoiceItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-slate-500"
                        >
                          No items selected
                        </td>
                      </tr>
                    ) : (
                      invoiceItems.map((item, index) => (
                        <tr
                          key={item.productId}
                          className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                        >
                          <td className="px-4 py-4">{item.name}</td>
                          <td className="px-4 py-4 text-center">{item.qty}</td>
                          <td className="px-4 py-4 text-right">
                            {formatMoney(item.price)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {formatMoney(item.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-8 flex justify-end">
                <div className="w-full max-w-sm bg-gradient-to-r from-black via-slate-800 to-white px-5 py-4 text-xl font-bold text-white">
                  <div className="flex items-center justify-between">
                    <span>BALANCE DUE</span>
                    <span>{formatMoney(balanceDue)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-12 grid grid-cols-3 gap-6 border-t border-slate-300 pt-5 text-sm">
                <div>
                  <p className="font-semibold uppercase tracking-wide text-slate-500">
                    Phone
                  </p>
                  <p className="mt-2 text-slate-700">{BUSINESS.phone}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </p>
                  <p className="mt-2 text-slate-700">{BUSINESS.email}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wide text-slate-500">
                    Address
                  </p>
                  <p className="mt-2 text-slate-700">{BUSINESS.address}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}