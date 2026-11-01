
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PaymentService } from '../../services/payment';
import { MemberService } from '../../services/member';
import { MembershipPlanService } from '../../services/membership-plan';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payments.html',
  styleUrl: './payments.scss'
})
export class Payments implements OnInit {
  readonly appName = environment.appName;

  payments: any[] = [];
  members: any[] = [];
  memberships: any[] = [];

  loading = false;
  membersLoading = false;
  membershipsLoading = false;
  savingPayment = false;

  errorMessage = '';
  successMessage = '';

  showPaymentForm = false;

  selectedMemberId = '';
  selectedMembershipId = '';

  paymentForm: any = {
    amount: null,
    paymentMethod: 'Cash',
    paymentType: 'Membership Fee',
    transactionId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: ''
  };

  constructor(
    private paymentService: PaymentService,
    private memberService: MemberService,
    private membershipPlanService: MembershipPlanService
  ) {}

  ngOnInit(): void {
    this.loadPayments();
    this.loadMembers();
  }

  // Load payment history
  loadPayments(): void {
    this.loading = true;
    this.errorMessage = '';

    this.paymentService.getPayments().subscribe({
      next: (response) => {
        this.payments = response.payments || [];
        this.loading = false;
      },
      error: (error) => {
        console.error('Payments loading error:', error);
        this.errorMessage = error.error?.message || 'Unable to load payments.';
        this.loading = false;
      }
    });
  }

  // Load active members
  loadMembers(): void {
    this.membersLoading = true;

    this.memberService.getMembers('', 'Active', 1, 1000).subscribe({
      next: (response) => {
        this.members = response.members || [];
        this.membersLoading = false;
      },
      error: (error) => {
        console.error('Members loading error:', error);
        this.membersLoading = false;
        this.errorMessage = 'Unable to load members.';
      }
    });
  }

  // Open payment form
  openPaymentForm(): void {
    this.showPaymentForm = true;
    this.successMessage = '';
    this.errorMessage = '';
  }

  // Close payment form
  closePaymentForm(): void {
    this.showPaymentForm = false;
    this.selectedMemberId = '';
    this.selectedMembershipId = '';
    this.memberships = [];
    this.resetPaymentForm();
  }

  // When member changes
  onMemberChange(): void {
    this.selectedMembershipId = '';
    this.memberships = [];
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.selectedMemberId) {
      return;
    }

    this.membershipsLoading = true;

    this.membershipPlanService
      .getMemberMemberships(this.selectedMemberId)
      .subscribe({
        next: (response) => {
          const allMemberships = response.memberships || [];

          this.memberships = allMemberships.filter((membership: any) => {
            const pending =
              Number(membership.planPrice) -
              Number(membership.paidAmount || 0);

            return membership.status !== 'Cancelled' && pending > 0;
          });

          this.membershipsLoading = false;
        },
        error: (error) => {
          console.error('Membership loading error:', error);
          this.errorMessage =
            error.error?.message || 'Unable to load memberships.';
          this.membershipsLoading = false;
        }
      });
  }

  // Selected membership
  get selectedMembership(): any {
    return this.memberships.find(
      membership => membership._id === this.selectedMembershipId
    ) || null;
  }

  // Remaining membership fees
  get pendingAmount(): number {
    if (!this.selectedMembership) {
      return 0;
    }

    return Math.max(
      0,
      Number(this.selectedMembership.planPrice) -
      Number(this.selectedMembership.paidAmount || 0)
    );
  }

  // Select membership
  onMembershipChange(): void {
    this.paymentForm.amount = this.pendingAmount || null;
  }

  // Save payment
  submitPayment(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.selectedMemberId || !this.selectedMembershipId) {
      this.errorMessage = 'Please select a member and membership.';
      return;
    }

    const amount = Number(this.paymentForm.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      this.errorMessage = 'Please enter a valid payment amount.';
      return;
    }

    if (amount > this.pendingAmount) {
      this.errorMessage = 'Payment cannot exceed the pending amount.';
      return;
    }

    if (!this.paymentForm.paymentMethod) {
      this.errorMessage = 'Please select a payment method.';
      return;
    }

    const paymentData = {
      memberId: this.selectedMemberId,
      membershipId: this.selectedMembershipId,
      amount,
      paymentMethod: this.paymentForm.paymentMethod,
      paymentType: this.paymentForm.paymentType,
      transactionId: this.paymentForm.transactionId,
      paymentDate: this.paymentForm.paymentDate,
      notes: this.paymentForm.notes
    };

    this.savingPayment = true;

    this.paymentService.createPayment(paymentData).subscribe({
      next: (response) => {
        this.savingPayment = false;

        if (response.success) {
          this.successMessage = 'Payment recorded successfully!';

          this.closePaymentForm();
          this.loadPayments();

          // Refresh membership balance
          this.onMemberRefresh(this.selectedMemberId);
        }
      },
      error: (error) => {
        console.error('Create payment error:', error);

        this.savingPayment = false;
        this.errorMessage =
          error.error?.message || 'Unable to record payment.';
      }
    });
  }

  // Reset form fields
  resetPaymentForm(): void {
    this.paymentForm = {
      amount: null,
      paymentMethod: 'Cash',
      paymentType: 'Membership Fee',
      transactionId: '',
      paymentDate: new Date().toISOString().slice(0, 10),
      notes: ''
    };
  }

  // Refresh membership list after payment
  onMemberRefresh(memberId: string): void {
    if (!memberId) {
      return;
    }

    this.membershipPlanService
      .getMemberMemberships(memberId)
      .subscribe({
        next: () => {
          // Membership data will refresh next time form is opened.
        },
        error: (error) => {
          console.error('Membership refresh error:', error);
        }
      });
  }

  get totalCollection(): number {
    return this.payments
      .filter(payment => payment.status === 'Success')
      .reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0
      );
  }

  get totalTransactions(): number {
    return this.payments.length;
  }

  get pendingTransactions(): number {
    return this.payments.filter(
      payment => payment.status === 'Pending'
    ).length;
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-IN');
  }

  
  // Escape dynamic values before inserting them into receipt HTML
  escapeHtml(value: any): string {
    return String(value ?? '').replace(/[&<>"']/g, (char) => {
      const entities: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      };

      return entities[char];
    });
  }

  // Print Payment Receipt
  printReceipt(payment: any): void {

    if (!payment || payment.status !== 'Success') {
      return;
    }

    const business = JSON.parse(
      localStorage.getItem('business') || '{}'
    );

    const businessName = this.escapeHtml(
      business.businessName || 'SS FITNESS'
    );

    const memberName = this.escapeHtml(
      payment.memberId?.fullName || 'Member'
    );

    const memberPhone = this.escapeHtml(
      payment.memberId?.phone || '-'
    );

    const receiptNumber = this.escapeHtml(
      payment.receiptNumber || '-'
    );

    const paymentMethod = this.escapeHtml(
      payment.paymentMethod || '-'
    );

    const paymentType = this.escapeHtml(
      payment.paymentType || 'Membership Fee'
    );

    const transactionId = this.escapeHtml(
      payment.transactionId || '-'
    );

    const notes = this.escapeHtml(payment.notes || '-');

    const amount = Number(payment.amount || 0);

    const formattedAmount = amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    const formattedDate = this.escapeHtml(
      this.formatDate(payment.paymentDate)
    );

    const popup = window.open('', '_blank', 'width=800,height=900');

    if (!popup) {
      alert('Please allow pop-ups to print your receipt.');
      return;
    }

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Receipt - ${receiptNumber}</title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, sans-serif;
            background: #f4f4f4;
            padding: 30px;
            color: #222;
          }

          .receipt {
            max-width: 650px;
            margin: auto;
            background: #fff;
            padding: 40px;
            border: 1px solid #ddd;
          }

          .header {
            text-align: center;
            border-bottom: 3px solid #e53935;
            padding-bottom: 20px;
          }

          .logo {
            display: inline-block;
            background: #e53935;
            color: #fff;
            font-size: 25px;
            font-weight: bold;
            padding: 12px 18px;
            border-radius: 10px;
          }

          h1 {
            margin: 12px 0 5px;
            font-size: 25px;
          }

          .subtitle {
            color: #777;
            font-size: 12px;
          }

          .paid {
            display: inline-block;
            background: #e8f7ef;
            color: #16834b;
            padding: 7px 18px;
            border-radius: 20px;
            font-weight: bold;
            margin-top: 15px;
          }

          .section {
            margin-top: 25px;
          }

          .section h3 {
            font-size: 14px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
          }

          .row {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            padding: 11px 0;
            border-bottom: 1px solid #eee;
            font-size: 13px;
          }

          .row span:first-child {
            color: #777;
          }

          .amount {
            margin-top: 25px;
            background: #fff5f5;
            padding: 20px;
            text-align: center;
            border-radius: 8px;
          }

          .amount strong {
            display: block;
            font-size: 30px;
            color: #e53935;
            margin-top: 8px;
          }

          .footer {
            text-align: center;
            margin-top: 35px;
            color: #777;
            font-size: 12px;
          }

          .print-btn {
            display: block;
            margin: 25px auto;
            background: #e53935;
            color: white;
            padding: 12px 25px;
            border: none;
            border-radius: 7px;
            cursor: pointer;
          }

          @media print {
            body {
              background: #fff;
              padding: 0;
            }

            .receipt {
              border: none;
            }

            .print-btn {
              display: none;
            }

            @page {
              size: A4;
              margin: 15mm;
            }
          }
        </style>
      </head>

      <body>

        <div class="receipt">

          <div class="header">
            <div class="logo">SS</div>
            <h1>${businessName}</h1>
            <div class="subtitle">
              ${this.appName.toUpperCase()} · PAYMENT RECEIPT
            </div>
            <span class="paid">PAYMENT SUCCESSFUL</span>
          </div>

          <div class="section">
            <h3>Receipt Details</h3>

            <div class="row">
              <span>Receipt Number</span>
              <strong>${receiptNumber}</strong>
            </div>

            <div class="row">
              <span>Payment Date</span>
              <strong>${formattedDate}</strong>
            </div>
          </div>

          <div class="section">
            <h3>Member Details</h3>

            <div class="row">
              <span>Member Name</span>
              <strong>${memberName}</strong>
            </div>

            <div class="row">
              <span>Phone Number</span>
              <strong>${memberPhone}</strong>
            </div>
          </div>

          <div class="section">
            <h3>Payment Details</h3>

            <div class="row">
              <span>Payment Type</span>
              <strong>${paymentType}</strong>
            </div>

            <div class="row">
              <span>Payment Method</span>
              <strong>${paymentMethod}</strong>
            </div>

            <div class="row">
              <span>Transaction ID</span>
              <strong>${transactionId}</strong>
            </div>

            <div class="row">
              <span>Notes</span>
              <strong>${notes}</strong>
            </div>
          </div>

          <div class="amount">
            Amount Received
            <strong>₹${formattedAmount}</strong>
          </div>

          <div class="footer">
            <h3>Thank You!</h3>
            <p>Thank you for choosing ${businessName}.</p>
            <p>Computer generated payment receipt.</p>
            <p>Powered by SS Builds365</p>
          </div>

        </div>

        <button class="print-btn" onclick="window.print()">
          Print / Save as PDF
        </button>

      </body>
      </html>
    `;

    popup.document.open();
    popup.document.write(receiptHTML);
    popup.document.close();
  }

}
