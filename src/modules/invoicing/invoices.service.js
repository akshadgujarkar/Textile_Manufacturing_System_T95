'use strict';

const InvoicesRepository = require('./invoices.repository');
const BuyerRepository = require('../buyers/buyers.repository');
const { withTransaction } = require('../../config/database');
const { createError } = require('../../utils/response');

const InvoicesService = {
  async listInvoices(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await InvoicesRepository.findAll({
      limit: pageSize,
      offset,
      search: query.search,
      buyer_id: query.buyer_id,
      status: query.status,
    });

    return { data: rows, total, page, pageSize };
  },

  async getInvoiceById(invoiceId) {
    const invoice = await InvoicesRepository.findById(invoiceId);
    if (!invoice) {
      throw createError(`Invoice with ID ${invoiceId} not found`, 404, 'NOT_FOUND');
    }
    return invoice;
  },

  async createInvoice(data) {
    // Validate buyer
    const buyer = await BuyerRepository.findById(data.buyer_id);
    if (!buyer) {
      throw createError(`Buyer with ID ${data.buyer_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // Check unique invoice_no
    const existing = await InvoicesRepository.findByInvoiceNo(data.invoice_no);
    if (existing) {
      throw createError(`Invoice number "${data.invoice_no}" already exists`, 409, 'DUPLICATE_INVOICE_NO');
    }

    const taxRate = data.tax_rate !== undefined ? Number(data.tax_rate) : 5.00;

    return withTransaction(async (conn) => {
      let subtotal = 0;
      const itemsToInsert = data.items.map((it) => {
        const amount = Number((Number(it.quantity) * Number(it.rate)).toFixed(2));
        subtotal += amount;
        return {
          order_item_id: it.order_item_id,
          hsn_code: it.hsn_code || '5208',
          quantity: it.quantity,
          rate: it.rate,
          amount,
        };
      });

      subtotal = Number(subtotal.toFixed(2));
      const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
      const totalAmount = Number((subtotal + taxAmount).toFixed(2));

      const invoiceId = await InvoicesRepository.createHeader({
        invoice_no: data.invoice_no,
        buyer_id: data.buyer_id,
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      }, conn);

      for (const item of itemsToInsert) {
        await InvoicesRepository.createItem({
          invoice_id: invoiceId,
          order_item_id: item.order_item_id,
          hsn_code: item.hsn_code,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
        }, conn);
      }

      return InvoicesRepository.findById(invoiceId);
    });
  },

  async issueInvoice(invoiceId, { version }) {
    const invoice = await this.getInvoiceById(invoiceId);
    if (invoice.status !== 'draft') {
      throw createError(`Cannot issue invoice #${invoiceId} from "${invoice.status}" status (must be draft)`, 400, 'INVALID_STATUS_TRANSITION');
    }

    const updated = await InvoicesRepository.updateStatusWithVersion(invoiceId, 'issued', version);
    if (!updated) {
      throw createError(`Optimistic lock failure on invoice #${invoiceId} (version mismatch)`, 409, 'CONCURRENCY_CONFLICT');
    }

    return this.getInvoiceById(invoiceId);
  },

  async voidInvoice(invoiceId, { version }) {
    const invoice = await this.getInvoiceById(invoiceId);
    if (invoice.status === 'void') {
      throw createError(`Invoice #${invoiceId} is already void`, 400, 'INVALID_STATUS_TRANSITION');
    }

    const updated = await InvoicesRepository.updateStatusWithVersion(invoiceId, 'void', version);
    if (!updated) {
      throw createError(`Optimistic lock failure on invoice #${invoiceId} (version mismatch)`, 409, 'CONCURRENCY_CONFLICT');
    }

    return this.getInvoiceById(invoiceId);
  },
};

module.exports = InvoicesService;
