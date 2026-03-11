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
  src="data:image/png;base64,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kslkZGdnR3Z2diSXy0kUxTzn7FcoFDRw4ECaNWsWBQQEUP369en777+noKAgkslkettnJ0EQSCaTkb29Pbm7u1PNmjWpR48etHr1akpLS5N+BWVOVlYWzZo1i+zs7PS+G2OSIAhUoUIFat26NY0aNYqeP38ufSuzM2UufXMn6RzxWq2WVqxYobddYcnDw4OuXLmSa1/msnnzZpLL5XrvWVBydXWl48ePS3dFZKG59Atz6NAh8vb21tuvqckSc+kXR5LL5fTaa68Vec5+VnZYpElfp9Ph6NGjGDt2LK5evZrv7HpEhH///Rfvv/8++vbti4oVK0IulxvUMSy7hmhnZwcXFxcEBgaicePGaN++PTp27IjmzZujRo0acHd3h0KhgEwmgyiKEAQBKpUK//33H7p27Yp3330XqampSEtLw9SpU1GxYkXIZDIIggBRFHPew9HREZUqVULjxo3RrVs3DB06FPPnz8fmzZvx3nvv2cTds0KhQLdu3Yq8jradnR1eeeUVrF27FsuXLzf7Y4LSIjExEdu2bZNmF6pNmzaoUaOGNNss2rdvj4CAAGl2gZRKJXbt2gW1Wi0tKhFdunTB6NGjjX48UZbIZDK0aNEC33zzjcFLJjMbIL0DMIenT59S/fr1C6wtv5wGDx5MERERtGDBAmratCk5OzvnWTsXBIFEUSS5XE5eXl7UqFEjeuWVV+jtt9+mH3/8kS5dukTR0dEUGxtLYWFhtH37dho7dix1796dWrVqRVWrViUXFxeSy+Xk6OhIb775Jj179ozmz59PHTp0oLt379K8efPI19eXfHx8qHbt2tSqVSt69dVX6Y033qCvvvqKLly4QAkJCaRSqQxeMawsSUxMpD59+uj9NsYkmUxGXbp0oXv37pFWq5W+hUVYYw3/4MGDRreWyGQy2rRpU679mJNGo6Hx48frvW9hqUqVKnTv3j3p7kqkhk9EFBkZSc2aNdPbtymptNXwFQoFtWrVim7evCk9VGbjzB7wdTodbd++nRwcHPROxPySk5MT7dmzh5RKJZ05c4b69etHtWrVygn82cnd3Z3q1KlD7du3p2nTptF///1HT58+JZVKJT2MHFqtlp4/f0537tyhtWvX0ttvv00dO3akli1bUseOHenBgweUkZFBn3/+Oe3YsYMSExPpww8/pI8++oh27dpFd+7coWfPnlFWVpZ0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"
  alt="The Sports Land Logo"
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