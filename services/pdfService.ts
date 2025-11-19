import { jsPDF } from "jspdf";
import { Order, PaymentStatus } from "../types";

export const generateTicketPDF = (order: Order) => {
  // Configuración para impresora térmica (80mm ancho)
  // Altura dinámica estimada (200mm sobra para la mayoría de tickets, el driver corta)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, 200] 
  });

  doc.setFont("courier", "bold");
  
  let y = 8;
  const margin = 4;
  const width = 72; // 80 - 2*margin

  // --- CABECERA ---
  doc.setFontSize(14);
  doc.text("SÁNDWICH MANAGER", 40, y, { align: "center" });
  y += 6;
  
  doc.setFontSize(12);
  doc.text(`Comanda #: ${order.id}`, 40, y, { align: "center" });
  y += 8;

  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + width, y);
  y += 5;

  // --- DATOS CLIENTE ---
  doc.setFontSize(10);
  
  // Fecha y Hora
  doc.text(`Fecha: ${order.pickupDate}`, margin, y);
  y += 5;
  doc.text(`Hora: ${order.pickupTime || '--:--'}`, margin, y);
  y += 7;

  // Cliente (con wrap)
  const splitName = doc.splitTextToSize(`Cliente: ${order.customerName}`, width);
  doc.text(splitName, margin, y);
  y += splitName.length * 5;

  // Teléfono
  doc.text(`Tel: ${order.phone}`, margin, y);
  y += 5;

  // Dirección (con wrap)
  if (order.address) {
      const splitAddress = doc.splitTextToSize(`Dir: ${order.address}`, width);
      doc.text(splitAddress, margin, y);
      y += splitAddress.length * 5;
  }

  // Sucursal Retiro
  doc.text(`Retira: ${order.pickupBranch}`, margin, y);
  y += 5;

  doc.line(margin, y, margin + width, y);
  y += 6;

  // --- DETALLE ---
  doc.setFontSize(14);
  doc.text(`TRIPLES: ${order.qtyTriples}`, margin, y);
  y += 6;
  doc.text(`SIMPLES: ${order.qtySimples}`, margin, y);
  y += 6;
  // Agregamos la cantidad de paquetes aquí
  doc.text(`BULTOS:  ${order.packageCount || 0}`, margin, y);
  y += 8;

  doc.line(margin, y, margin + width, y);
  y += 6;

  // --- ESTADO DE PAGO ---
  doc.setFontSize(12);
  let paymentText = "FALTA ABONAR";
  if (order.paymentStatus === PaymentStatus.PAID) paymentText = "TOTALMENTE PAGADO";
  if (order.paymentStatus === PaymentStatus.PARTIAL) paymentText = "CON SEÑA";
  
  doc.text(`ESTADO: ${paymentText}`, margin, y);
  y += 6;

  // --- NOTAS ---
  doc.setFontSize(10);
  doc.text("Observaciones:", margin, y);
  y += 5;
  
  const notesText = order.notes || "Ninguna";
  const splitNotes = doc.splitTextToSize(notesText, width);
  doc.setFont("courier", "normal"); // Normal para notas
  doc.text(splitNotes, margin, y);
  y += splitNotes.length * 5 + 3;

  // --- SEÑA ---
  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text(`Seña: $${order.deposit}`, margin, y);
  y += 8;

  // --- UBICACION (Gigante) ---
  y += 5;
  doc.setLineWidth(0.5);
  doc.rect(margin, y, width, 20); // Caja
  
  doc.setFontSize(10);
  doc.text("UBICACIÓN EN FÁBRICA", 40, y + 5, { align: "center" });
  
  doc.setFontSize(22);
  doc.text(order.location || "---", 40, y + 16, { align: "center" });
  y += 25;

  // Pie
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  doc.text("Gracias por su compra", 40, y, { align: "center" });
  y += 4;
  doc.text(new Date().toLocaleString(), 40, y, { align: "center" });

  // Abrir PDF en nueva pestaña (móvil compatible)
  const pdfUrl = doc.output("bloburl");
  window.open(pdfUrl, "_blank");
};