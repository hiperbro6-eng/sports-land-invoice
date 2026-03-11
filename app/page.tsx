"use client";

import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@/components/ui";
import {
  Download,
  FileImage,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";

type Item = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

const starterItems: Item[] = [
  { id: "1", name: "Brand Design", price: 150, qty: 1 },
  { id: "2", name: "Web Development", price: 500, qty: 1 },
  { id: "3", name: "Marketing Service", price: 75, qty: 2 },
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 2,
  }).format(value);

const randomInvoiceNo = () => `INV-${Math.floor(100000 + Math.random() * 900000)}`;

export default function InvoiceMakerApp() {
  const invoiceRef = useRef<HTMLDivElement | null>(null);

  const [logo, setLogo] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("YOUR COMPANY NAME");
  const [companyWebsite, setCompanyWebsite] = useState("www.yourcompany.com");
  const [companyPhone, setCompanyPhone] = useState("+94 77 123 4567");
  const [companyEmail, setCompanyEmail] = useState("hello@yourcompany.com");
  const [companyAddress, setCompanyAddress] = useState("Negombo, Sri Lanka");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [invoiceNo, setInvoiceNo] = useState(randomInvoiceNo());
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));

  const [items, setItems] = useState<Item[]>(starterItems);
  const [draftName, setDraftName] = useState("");
  const [draftPrice, setDraftPrice] = useState(0);
  const [draftQty, setDraftQty] = useState(1);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * item.qty, 0), [items]);
  const grandTotal = subtotal;

  const onLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
    reader.readAsDataURL(file);
  };

  const addItem = () => {
    if (!draftName.trim()) return;
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: draftName.trim(),
        price: Number(draftPrice),
        qty: Number(draftQty),
      },
    ]);
    setDraftName("");
    setDraftPrice(0);
    setDraftQty(1);
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const saveEdit = () => {
    if (!editingItem) return;
    setItems((prev) => prev.map((item) => (item.id === editingItem.id ? editingItem : item)));
    setEditingItem(null);
  };

  const exportJPEG = async () => {
    if (!invoiceRef.current) return;
    const canvas = await html2canvas(invoiceRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/jpeg", 1);
    link.download = `${invoiceNo}.jpeg`;
    link.click();
  };

  const exportPDF = async () => {
    if (!invoiceRef.current) return;
    const canvas = await html2canvas(invoiceRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const image = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(image, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(image, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${invoiceNo}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="rounded-[28px] border-0 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Invoice Maker</CardTitle>
            <p className="text-sm text-slate-500">
              Exact invoice-style layout with no payment method and no terms section.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Company Name</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Website</Label>
                <Input value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Address</Label>
                <Textarea value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Logo</Label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed p-3 text-sm text-slate-600 hover:bg-slate-50">
                  <Upload className="h-4 w-4" /> Upload Logo
                  <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Invoice Info</h3>
                <Button variant="outline" size="sm" onClick={() => setInvoiceNo(randomInvoiceNo())}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Random No
                </Button>
              </div>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label>Invoice Number</Label>
                  <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Date</Label>
                  <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <h3 className="mb-3 font-semibold">Customer</h3>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label>Customer Name</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Customer Phone</Label>
                  <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Customer Email</Label>
                  <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Customer Address</Label>
                  <Textarea value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Items</h3>
                <Badge variant="secondary">{items.length} total</Badge>
              </div>

              <div className="rounded-2xl border bg-white p-3">
                <div className="grid gap-2">
                  <Label>Add Item</Label>
                  <Input placeholder="Item name" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" placeholder="Price" value={draftPrice} onChange={(e) => setDraftPrice(Number(e.target.value))} />
                    <Input type="number" placeholder="Qty" value={draftQty} onChange={(e) => setDraftQty(Number(e.target.value))} />
                  </div>
                  <Button onClick={addItem}>
                    <Plus className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl border bg-white p-3">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-slate-500">
                        {item.qty} × {formatMoney(item.price)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="outline" onClick={() => setEditingItem(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="destructive" onClick={() => deleteItem(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="rounded-2xl" onClick={exportPDF}>
                <Download className="mr-2 h-4 w-4" /> PDF
              </Button>
              <Button className="rounded-2xl" variant="secondary" onClick={exportJPEG}>
                <FileImage className="mr-2 h-4 w-4" /> JPEG
              </Button>
            </div>
          </CardContent>
        </Card>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Card className="overflow-hidden rounded-[28px] border-0 shadow-xl">
            <CardContent className="overflow-auto bg-slate-200 p-4 md:p-8">
              <div ref={invoiceRef} className="mx-auto w-full max-w-[860px] bg-white p-6 md:p-10">
                <div className="flex items-start justify-between border-b border-slate-300 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-blue-50 ring-1 ring-blue-100">
                      {logo ? <img src={logo} alt="Logo" className="h-full w-full object-cover" /> : <span className="text-sm font-bold text-blue-600">LOGO</span>}
                    </div>
                    <div>
                      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">{companyName}</h1>
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="text-4xl font-extrabold tracking-[0.18em] text-blue-600 md:text-5xl">INVOICE</h2>
                    <p className="mt-2 text-sm text-slate-500">{companyWebsite}</p>
                  </div>
                </div>

                <div className="grid gap-8 py-8 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-slate-500">Invoice to :</p>
                    <h3 className="text-3xl font-bold text-slate-900">{customerName || "Customer Name"}</h3>
                    <div className="mt-4 space-y-1 text-slate-500">
                      <p>{customerPhone || "+94 70 000 0000"}</p>
                      <p>{customerEmail || "customer@email.com"}</p>
                      <p>{customerAddress || "Customer address"}</p>
                    </div>
                  </div>
                  <div className="md:text-right">
                    <p className="text-2xl font-bold text-slate-900">Invoice no : {invoiceNo}</p>
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
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-blue-600 hover:bg-blue-600">
                        <TableHead className="text-white">NO</TableHead>
                        <TableHead className="text-white">DESCRIPTION</TableHead>
                        <TableHead className="text-center text-white">QTY</TableHead>
                        <TableHead className="text-right text-white">PRICE</TableHead>
                        <TableHead className="text-right text-white">TOTAL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => (
                        <TableRow key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-blue-50"}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell className="text-center">{item.qty}</TableCell>
                          <TableCell className="text-right">{formatMoney(item.price)}</TableCell>
                          <TableCell className="text-right">{formatMoney(item.price * item.qty)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-8 flex justify-end">
                  <div className="w-full max-w-sm space-y-3">
                    <div className="flex items-center justify-between text-lg">
                      <span className="text-slate-600">Sub Total :</span>
                      <span className="font-semibold text-slate-900">{formatMoney(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-blue-600 px-4 py-3 text-xl font-bold text-white">
                      <span>GRAND TOTAL :</span>
                      <span>{formatMoney(grandTotal)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-16 grid gap-8 border-t border-slate-300 pt-6 md:grid-cols-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Phone</p>
                    <p className="mt-2 text-slate-700">{companyPhone}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Email</p>
                    <p className="mt-2 text-slate-700">{companyEmail}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Address</p>
                    <p className="mt-2 text-slate-700">{companyAddress}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={editingItem.name} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Price</Label>
                  <Input type="number" value={editingItem.price} onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value) })} />
                </div>
                <div className="grid gap-2">
                  <Label>Qty</Label>
                  <Input type="number" value={editingItem.qty} onChange={(e) => setEditingItem({ ...editingItem, qty: Number(e.target.value) })} />
                </div>
              </div>
              <Button className="w-full" onClick={saveEdit}>Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
