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

type InvoiceSelectedItem = {
  productId: string;
  qty: number;
};

const BUSINESS = {
  name: "THE SPORTS LAND",
  tagline: "QUALITY YOU NEED",
  website: "www.sportland.com",
  phone: "+94 72 929 958",
  email: "sportland@gmail.com",
  address: "Negombo, Sri Lanka",
};

function generateInvoiceNo() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `INV-${random}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(value);
}

export default function Page() {
  const invoiceRef = useRef<HTMLDivElement | null>(null);

  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selectedItems, setSelectedItems] = useState<InvoiceSelectedItem[]>([]);

  const [newProductName, setNewProductName] = useState("");
  const [newProductPrice, setNewProductPrice] = useState("");

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductName, setEditingProductName] = useState("");
  const [editingProductPrice, setEditingProductPrice] = useState("");

  const [loadingProducts, setLoadingProducts] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setInvoiceNo(generateInvoiceNo());
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoadingProducts(true);
    setMessage("");

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(`Database load failed: ${error.message}`);
    } else {
      const normalized =
        data?.map((item) => ({
          ...item,
          price: Number(item.price),
        })) ?? [];
      setProducts(normalized);
    }

    setLoadingProducts(false);
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

    const { error } = await supabase.from("products").insert({
      name,
      price,
    });

    if (error) {
      setMessage(`Add product failed: ${error.message}`);
      return;
    }

    setNewProductName("");
    setNewProductPrice("");
    setMessage("Product added.");
    loadProducts();
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
    loadProducts();
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
    loadProducts();
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
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) =>
      product.name.toLowerCase().includes(q)
    );
  }, [products, search]);

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

  const subtotal = useMemo(
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
        customer_email: customerEmail,
        customer_address: customerAddress,
        invoice_date: invoiceDate,
        subtotal,
        total: subtotal,
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

    setMessage("Invoice saved to database.");
  }

  async function downloadJPEG() {
    if (!invoiceRef.current) return;

    const dataUrl = await toJpeg(invoiceRef.current, {
  quality: 0.95,
  pixelRatio: 3,
  backgroundColor: "#ffffff",
  cacheBust: true,
});

    const link = document.createElement("a");
    link.download = `${invoiceNo}.jpeg`;
    link.href = dataUrl;
    link.click();
  }

function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll("img"));
  return Promise.all(
    images.map(
      img =>
        new Promise(resolve => {
          if (img.complete) resolve(true);
          else img.onload = img.onerror = () => resolve(true);
        })
    )
  );
}

async function downloadPDF() {
  if (!invoiceRef.current) return;

  await waitForImages(invoiceRef.current);

  const dataUrl = await toPng(invoiceRef.current, {
    pixelRatio: 3,
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
    <div className="min-h-screen bg-[#eef2f7] p-4 md:p-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="rounded-[28px] bg-white p-5 shadow-lg">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">THE SPORTS LAND</h1>
            <p className="mt-1 text-sm text-slate-600">Invoice Maker</p>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl bg-slate-50 p-4">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Invoice Info
              </h2>

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
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Customer
              </h2>

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
                  <label className="mb-1 block text-sm font-medium">Customer Email</label>
                  <input
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
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
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Add Product To Database
              </h2>

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
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Products Database
                </h2>
                <button
                  onClick={loadProducts}
                  className="rounded-xl border px-3 py-2 text-sm"
                >
                  Refresh
                </button>
              </div>

              <input
                placeholder="Search product"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none"
              />

              <div className="max-h-[320px] space-y-3 overflow-y-auto">
                {loadingProducts && (
                  <div className="rounded-xl bg-white p-3 text-sm text-slate-600">
                    Loading products...
                  </div>
                )}

                {!loadingProducts && filteredProducts.length === 0 && (
                  <div className="rounded-xl bg-white p-3 text-sm text-slate-600">
                    No products found.
                  </div>
                )}

                {filteredProducts.map((product) => {
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
                })}
              </div>
            </div>

            {message && (
              <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                {message}
              </div>
            )}

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

              <button
                onClick={saveInvoiceToDatabase}
                disabled={savingInvoice}
                className="sm:col-span-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {savingInvoice ? "Saving Invoice..." : "Save Invoice To Database"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] bg-[#dfe7f2] p-4 shadow-lg md:p-8">
          <div
            ref={invoiceRef}
            style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
            className="mx-auto w-[794px] bg-white p-8"
          >
            <div className="flex items-start justify-between border-b border-slate-300 pb-6 gap-6">
              <div className="flex items-center gap-4">
                <img
  src={typeof window !== "undefined"
    ? window.location.origin + "/logo.png"
    : "/logo.png"}
  alt="The Sports Land Logo"
  crossOrigin="anonymous"
  style={{ display: "block" }}
  className="h-20 w-20 object-contain"
/>
                <div>
                  <h1 className="text-3xl font-extrabold text-slate-900">
                    {BUSINESS.name}
                  </h1>
                  <p className="text-sm tracking-[0.22em] text-slate-600">
                    {BUSINESS.tagline}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <h2 className="text-3xl font-extrabold tracking-[0.2em] text-blue-600">
                  INVOICE
                </h2>
                <p className="mt-2 text-sm text-slate-500">{BUSINESS.website}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 py-8">
              <div>
                <p className="mb-2 text-slate-500">Invoice to :</p>
                <h3 className="text-1xl font-bold text-slate-900">
                  {customerName || "Customer Name"}
                </h3>
                <div className="mt-4 space-y-1 text-slate-600">
                  <p>{customerPhone || "-"}</p>
                  <p>{customerEmail || "-"}</p>
                  <p>{customerAddress || "-"}</p>
                </div>
              </div>

              <div className="text-left md:text-right">
                <p className="text-2xl font-bold text-slate-900">
                  Invoice no : {invoiceNo}
                </p>
                <p className="mt-2 text-xl text-slate-600">
                  {new Date(invoiceDate).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-blue-100">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="px-3 py-3 text-left">NO</th>
                    <th className="px-3 py-3 text-left">DESCRIPTION</th>
                    <th className="px-3 py-3 text-center">QTY</th>
                    <th className="px-3 py-3 text-right">PRICE</th>
                    <th className="px-3 py-3 text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-slate-500"
                      >
                        No items selected
                      </td>
                    </tr>
                  ) : (
                    invoiceItems.map((item, index) => (
                      <tr
                        key={item.productId}
                        className={index % 2 === 0 ? "bg-white" : "bg-[#eff6ff]"}
                      >
                        <td className="px-3 py-3">{index + 1}</td>
                        <td className="px-3 py-3">{item.name}</td>
                        <td className="px-3 py-3 text-center">{item.qty}</td>
                        <td className="px-3 py-3 text-right">
                          {formatMoney(item.price)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          {formatMoney(item.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex justify-end">
              <div className="w-full max-w-sm space-y-3">
                <div className="flex items-center justify-between text-xl">
                  <span className="text-slate-600">Sub Total :</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-blue-600 px-4 py-4 text-2xl font-bold text-white">
                  <span>GRAND TOTAL :</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
              </div>
            </div>

            <div className="mt-16 grid grid-cols-3 gap-8 border-t border-slate-300 pt-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Phone
                </p>
                <p className="mt-2 text-slate-700">{BUSINESS.phone}</p>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </p>
                <p className="mt-2 text-slate-700">{BUSINESS.email}</p>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Address
                </p>
                <p className="mt-2 text-slate-700">{BUSINESS.address}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}