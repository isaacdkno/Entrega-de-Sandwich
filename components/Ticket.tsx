import React from 'react';
import { Order } from '../types';

interface TicketProps {
  order: Order | null;
}

export const Ticket: React.FC<TicketProps> = ({ order }) => {
  // ESTRATEGIA DE IMPRESIÓN ROBUSTA:
  // 1. Usamos 'fixed' y 'left-[-10000px]' para ocultarlo de la vista normal pero MANTENERLO en el DOM.
  //    Esto asegura que React renderice el contenido antes de llamar a window.print().
  //    Si usáramos 'hidden' (display: none), el navegador podría no renderizarlo a tiempo.
  // 2. En modo impresión (definido en index.html), el CSS lo posiciona en absolute top:0 left:0.
  return (
    <div 
      id="printable-area" 
      className="fixed top-0 left-[-10000px] bg-white text-black font-mono text-sm w-full print:w-full"
    >
      {order ? (
        // Contenedor interno centrado con ancho de ticket (80mm) para que se vea bien tanto en térmica como en A4 (centrado)
        <div className="max-w-[80mm] mx-auto p-4 border border-black print:border-0">
          <div className="text-center border-b-2 border-black pb-2 mb-4">
            <h1 className="text-2xl font-bold">TICKET DE ENTREGA</h1>
            <h2 className="text-xl">Comanda #: {order.id}</h2>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between font-bold text-lg border-b border-dashed border-black pb-1">
              <span>Fecha: {order.pickupDate}</span>
              <span>Hora: {order.pickupTime || '--:--'}</span>
            </div>
            <p className="break-words"><strong>Cliente:</strong> {order.customerName}</p>
            <p><strong>Teléfono:</strong> {order.phone}</p>
            <p className="break-words"><strong>Dirección:</strong> {order.address}</p>
            <p><strong>Retira en:</strong> {order.pickupBranch}</p>
          </div>

          <div className="border-t border-b border-black py-2 mb-4">
            <div className="flex justify-between text-lg font-bold">
              <span>TRIPLES:</span>
              <span>{order.qtyTriples}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>SIMPLES:</span>
              <span>{order.qtySimples}</span>
            </div>
          </div>

          <div className="mb-4">
            <p><strong>Observaciones:</strong></p>
            <p className="italic break-words">{order.notes || 'Ninguna'}</p>
          </div>

          <div className="mb-6">
            <p><strong>Seña:</strong> ${order.deposit}</p>
          </div>

          <div className="border-4 border-black p-4 text-center">
            <p className="text-sm uppercase">Ubicación</p>
            <p className="text-4xl font-black">{order.location || 'SIN UBICACIÓN'}</p>
          </div>
          
          <div className="mt-8 text-center text-xs">
            <p>Impreso: {new Date().toLocaleString()}</p>
          </div>
        </div>
      ) : (
        <div className="text-center p-10">Cargando ticket...</div>
      )}
    </div>
  );
};
