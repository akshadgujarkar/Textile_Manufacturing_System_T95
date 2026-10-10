import React from 'react';
import { Modal } from './Modal';
import { Printer, Download, CheckCircle2 } from 'lucide-react';

export interface ZplPayload {
  lotCode?: string;
  lotNumber?: string;
  receiptNo?: string;
  receivedAt?: string;
  receivedDate?: string;
  supplierName?: string;
  supplier?: string;
  materialName?: string;
  yarnTypeName?: string;
  colourName?: string;
  quantityReceived?: number;
  quantity?: string | number;
  unitCode?: string;
  barcodeData?: string;
  qrData?: string;
  zplCode?: string;
}

interface ZplThermalLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  payload?: ZplPayload | null;
  lotDetails?: ZplPayload | null;
}

export const ZplThermalLabelModal: React.FC<ZplThermalLabelModalProps> = ({
  isOpen,
  onClose,
  title = 'Thermal Barcode Label (ZPL II)',
  payload,
  lotDetails,
}) => {
  const data = payload || lotDetails;
  if (!data) return null;

  const lotTag = data.lotCode || data.lotNumber || 'TAG-2026-001';
  const supplierDisplay = data.supplierName || data.supplier || 'Vardhman Yarns Ltd.';
  const materialDisplay = data.yarnTypeName || data.materialName || 'Cotton 30s Combed';
  const qtyDisplay = data.quantityReceived
    ? `${data.quantityReceived} ${data.unitCode || 'kg'}`
    : data.quantity || '250.0 kg';
  const dateDisplay = data.receivedAt ? data.receivedAt.split('T')[0] : data.receivedDate || '2026-10-10';

  const handleDownloadZpl = () => {
    const zplText = data.zplCode || `^XA\n^FO50,50^ADN,36,20^FD${lotTag}^FS\n^XZ`;
    const blob = new Blob([zplText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${lotTag}.zpl`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={`Lot Tag: ${lotTag}`}
      footer={
        <>
          <button onClick={onClose} className="m3-btn m3-btn-text">
            Close
          </button>
          <button onClick={handleDownloadZpl} className="m3-btn m3-btn-tonal">
            <Download size={16} /> Download .ZPL
          </button>
          <button
            onClick={() => {
              window.print();
            }}
            className="m3-btn m3-btn-primary"
          >
            <Printer size={16} /> Print 4" x 3" Tag
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Physical 4" x 3" Thermal Label Simulation */}
        <div className="bg-white border-2 border-dashed border-black rounded-xl p-6 text-black font-mono shadow-md">
          {/* Header */}
          <div className="flex justify-between border-b-2 border-black pb-2 mb-3">
            <div>
              <div className="text-xl font-black">EVEREST TEXTILE MILLS</div>
              <div className="text-xs">RAW MATERIAL LOT PASSPORT</div>
            </div>
            <div className="text-right text-xs">
              <div>GRN: {data.receiptNo || 'GRN-26-0001'}</div>
              <div>DATE: {dateDisplay}</div>
            </div>
          </div>

          {/* Core Specs */}
          <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
            <div>
              <div className="text-[11px] text-zinc-500">SPECIFICATION</div>
              <div className="font-bold text-base">{materialDisplay}</div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-500">COLOUR / SHADE</div>
              <div className="font-bold text-base">{data.colourName || 'Natural Greige'}</div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-500">SOURCE / SUPPLIER</div>
              <div className="font-bold truncate">{supplierDisplay}</div>
            </div>
            <div>
              <div className="text-[11px] text-zinc-500">NET QUANTITY</div>
              <div className="font-black text-lg text-[var(--color-primary)]">{qtyDisplay}</div>
            </div>
          </div>

          {/* Barcode & QR Simulation */}
          <div className="bg-zinc-50 border border-zinc-300 p-4 rounded-lg text-center flex flex-col items-center gap-1.5">
            <div
              className="h-12 w-4/5 rounded-sm"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, #000 0px, #000 3px, #fff 3px, #fff 5px, #000 5px, #000 9px, #fff 9px, #fff 11px)',
              }}
            />
            <div className="text-base font-black tracking-widest">*{lotTag}*</div>
          </div>
        </div>

        {/* ZPL Raw Stream Preview */}
        <div className="bg-[var(--color-surface-container)] p-3.5 rounded-xl">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-on-surface-variant)] mb-1.5">
            <CheckCircle2 size={16} className="text-emerald-600" /> Zebra ZPL-II Direct Command Code Generated
          </div>
          <pre className="text-xs max-h-24 overflow-y-auto bg-white p-2 rounded border border-[var(--color-surface-container-high)] font-mono">
            {data.zplCode || `^XA\n^FO50,50^ADN,36,20^FD${lotTag}^FS\n^XZ`}
          </pre>
        </div>
      </div>
    </Modal>
  );
};
