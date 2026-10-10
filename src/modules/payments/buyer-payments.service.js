'use strict';

const BuyerPaymentsRepository = require('./buyer-payments.repository');
const InvoicesRepository = require('../invoicing/invoices.repository');
const BuyerRepository = require('../buyers/buyers.repository');
const EmployeeRepository = require('../employees/employees.repository');
const { createError } = require('../../utils/response');

const BuyerPaymentsService = {
  async listPayments(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    const { rows, total } = await BuyerPaymentsRepository.findAll({
      limit: pageSize,
      offset,
      buyer_id: query.buyer_id,
      invoice_id: query.invoice_id,
      status: query.status,
    });

    return { data: rows, total, page, pageSize };
  },

  async getPaymentById(paymentId) {
    const payment = await BuyerPaymentsRepository.findById(paymentId);
    if (!payment) {
      throw createError(`Buyer payment with ID ${paymentId} not found`, 404, 'NOT_FOUND');
    }
    return payment;
  },

  async recordPayment(data) {
    // 1. Idempotency Guard check: if client_request_id exists, return existing
    const existingReq = await BuyerPaymentsRepository.findByClientRequestId(data.client_request_id);
    if (existingReq) {
      return BuyerPaymentsRepository.findById(existingReq.payment_id);
    }

    // 2. Validate buyer
    const buyer = await BuyerRepository.findById(data.buyer_id);
    if (!buyer) {
      throw createError(`Buyer with ID ${data.buyer_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // 3. Validate invoice
    const invoice = await InvoicesRepository.findById(data.invoice_id);
    if (!invoice) {
      throw createError(`Invoice with ID ${data.invoice_id} does not exist`, 400, 'INVALID_REFERENCE');
    }
    if (invoice.buyer_id !== data.buyer_id) {
      throw createError(
        `Invoice #${data.invoice_id} is billed to buyer #${invoice.buyer_id} (${invoice.buyer_name}), not payment remitter buyer #${data.buyer_id}`,
        400,
        'INVOICE_BUYER_MISMATCH'
      );
    }

    // 4. Validate employee
    const employee = await EmployeeRepository.findById(data.created_by_employee_id);
    if (!employee) {
      throw createError(`Employee with ID ${data.created_by_employee_id} does not exist`, 400, 'INVALID_REFERENCE');
    }

    // 5. Validate unique payment_ref
    const existingRef = await BuyerPaymentsRepository.findByPaymentRef(data.payment_ref);
    if (existingRef) {
      throw createError(`Payment reference "${data.payment_ref}" already exists`, 409, 'DUPLICATE_PAYMENT_REF');
    }

    const paymentId = await BuyerPaymentsRepository.create(data);
    return this.getPaymentById(paymentId);
  },

  async reversePayment(paymentId) {
    const payment = await this.getPaymentById(paymentId);
    if (payment.status === 'reversed') {
      throw createError(`Payment #${paymentId} is already reversed`, 400, 'ALREADY_REVERSED');
    }

    await BuyerPaymentsRepository.updateStatus(paymentId, 'reversed');
    return this.getPaymentById(paymentId);
  },
};

module.exports = BuyerPaymentsService;
