
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MemberService } from '../../services/member';
import { MembershipPlanService } from '../../services/membership-plan';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './members.html',
  styleUrl: './members.scss'
})
export class Members implements OnInit {

  members: any[] = [];
  plans: any[] = [];

  search = '';
  status = '';

  currentPage = 1;
  limit = 10;

  totalMembers = 0;
  totalPages = 0;

  loading = false;
  errorMessage = '';

  saving = false;
  showForm = false;
  isEditMode = false;
  selectedMemberId = '';

  memberForm: any = this.getEmptyForm();

  // Membership History
showHistory = false;
historyLoading = false;
historyError = '';
selectedHistoryMember: any = null;
membershipHistory: any[] = [];

// QR Code
showQRModal = false;
qrLoading = false;
qrError = '';
qrImage = '';
qrMemberName = '';
qrMemberPhone = '';

  constructor(
    private memberService: MemberService,
    private planService: MembershipPlanService
  ) {}

  ngOnInit(): void {
    this.loadMembers();
    this.loadPlans();
  }

  getEmptyForm(): any {
    return {
      fullName: '',
      phone: '',
      email: '',
      gender: 'Male',
      dateOfBirth: '',
      address: '',
      emergencyContact: '',
      joiningDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      notes: '',

      // Membership details
      planId: '',
      membershipStartDate: new Date().toISOString().split('T')[0],
      paidAmount: 0
    };
  }

  // Load members
  loadMembers(): void {
    this.loading = true;
    this.errorMessage = '';

    this.memberService.getMembers(
      this.search,
      this.status,
      this.currentPage,
      this.limit
    ).subscribe({
      next: (response) => {
        this.members = response.members || [];
        this.totalMembers = response.pagination?.totalMembers || 0;
        this.totalPages = response.pagination?.totalPages || 0;
        this.loading = false;
      },
      error: (error) => {
        console.error('Members loading error:', error);
        this.errorMessage =
          error.error?.message || 'Unable to load members';
        this.loading = false;
      }
    });
  }

  // Load active membership plans
  loadPlans(): void {
    this.planService.getPlans().subscribe({
      next: (response) => {
        const allPlans = response.plans || response.membershipPlans || [];
        this.plans = allPlans.filter(
          (plan: any) => plan.status === 'Active'
        );
      },
      error: (error) => {
        console.error('Plans loading error:', error);
        this.plans = [];
      }
    });
  }

  // Selected plan
  get selectedPlan(): any {
    return this.plans.find(
      (plan: any) => plan._id === this.memberForm.planId
    );
  }

  // Calculate expiry date preview
  get membershipEndDate(): string {
    const plan = this.selectedPlan;
    const startDate = this.memberForm.membershipStartDate;

    if (!plan || !startDate) return '';

    const endDate = new Date(`${startDate}T00:00:00`);

    if (plan.durationType === 'Days') {
      endDate.setDate(endDate.getDate() + Number(plan.duration));
    } else if (plan.durationType === 'Months') {
      endDate.setMonth(endDate.getMonth() + Number(plan.duration));
    } else if (plan.durationType === 'Years') {
      endDate.setFullYear(
        endDate.getFullYear() + Number(plan.duration)
      );
    }

    return endDate.toISOString().split('T')[0];
  }

  // Search
  searchMembers(): void {
    this.currentPage = 1;
    this.loadMembers();
  }

  // Open Add Form
  openAddForm(): void {
    this.isEditMode = false;
    this.selectedMemberId = '';
    this.memberForm = this.getEmptyForm();
    this.showForm = true;
    this.loadPlans();
  }

  // Open Edit Form
  openEditForm(member: any): void {
    this.isEditMode = true;
    this.selectedMemberId = member._id;

    this.memberForm = {
      fullName: member.fullName,
      phone: member.phone,
      email: member.email || '',
      gender: member.gender,
      dateOfBirth: member.dateOfBirth
        ? new Date(member.dateOfBirth).toISOString().split('T')[0]
        : '',
      address: member.address || '',
      emergencyContact: member.emergencyContact || '',
      joiningDate: member.joiningDate
        ? new Date(member.joiningDate).toISOString().split('T')[0]
        : '',
      status: member.status,
      notes: member.notes || '',

      // Existing member edit does not change membership
      planId: '',
      membershipStartDate: new Date().toISOString().split('T')[0],
      paidAmount: 0
    };

    this.showForm = true;
    this.loadPlans();
  }

  closeForm(): void {
    this.showForm = false;
  }

  // Save member and optionally assign membership
  saveMember(): void {
    if (
      !this.memberForm.fullName.trim() ||
      !this.memberForm.phone.trim()
    ) {
      alert('Please enter member name and phone number');
      return;
    }

    if (this.saving) return;

    if (!this.isEditMode && this.memberForm.planId) {
      if (!this.memberForm.membershipStartDate) {
        alert('Please select membership start date');
        return;
      }

      const amount = Number(this.memberForm.paidAmount);

      if (
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > Number(this.selectedPlan?.price)
      ) {
        alert('Please enter a valid paid amount');
        return;
      }
    }

    this.saving = true;

    const request = this.isEditMode
      ? this.memberService.updateMember(
          this.selectedMemberId,
          this.memberForm
        )
      : this.memberService.addMember(this.memberForm);

    request.subscribe({
      next: (response) => {
        const memberId = this.isEditMode
          ? this.selectedMemberId
          : response.member?._id || response.data?._id;

        if (
          !this.isEditMode &&
          this.memberForm.planId &&
          memberId
        ) {
          this.assignMembership(memberId);
          return;
        }

        if (!this.isEditMode && this.memberForm.planId && !memberId) {
          this.saving = false;
          alert(
            'Member was created, but member ID was not returned. Please assign membership from the member record.'
          );
          this.closeForm();
          this.loadMembers();
          return;
        }

        this.saving = false;
        alert(response.message || 'Member saved successfully');
        this.closeForm();
        this.loadMembers();
      },
      error: (error) => {
        this.saving = false;
        alert(error.error?.message || 'Unable to save member');
      }
    });
  }

  // Assign membership after member creation
  assignMembership(memberId: string): void {
    const membershipData = {
      memberId,
      planId: this.memberForm.planId,
      startDate: this.memberForm.membershipStartDate,
      paidAmount: Number(this.memberForm.paidAmount || 0)
    };

    this.planService.assignMembership(membershipData).subscribe({
      next: (response) => {
        this.saving = false;
        alert('Member and membership saved successfully!');
        this.closeForm();
        this.loadMembers();
      },
      error: (error) => {
        this.saving = false;
        alert(
          'Member created, but membership assignment failed: ' +
          (error.error?.message || 'Please try assigning membership again.')
        );
        this.closeForm();
        this.loadMembers();
      }
    });
  }

  // Delete member
  deleteMember(member: any): void {
    const confirmed = confirm(
      `Are you sure you want to delete ${member.fullName}?`
    );

    if (!confirmed) return;

    this.memberService.deleteMember(member._id).subscribe({
      next: (response) => {
        alert(response.message);

        if (this.members.length === 1 && this.currentPage > 1) {
          this.currentPage--;
        }

        this.loadMembers();
      },
      error: (error) => {
        alert(error.error?.message || 'Unable to delete member');
      }
    });
  }

  // Pagination
  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;

    this.currentPage = page;
    this.loadMembers();
  }

  // Open Membership History
openMembershipHistory(member: any): void {
  this.selectedHistoryMember = member;
  this.showHistory = true;
  this.historyLoading = true;
  this.historyError = '';
  this.membershipHistory = [];

  this.planService.getMemberMemberships(member._id).subscribe({
    next: (response) => {
      this.membershipHistory = response.memberships || response.data || [];
      this.historyLoading = false;
    },
    error: (error) => {
      console.error('Membership history error:', error);
      this.historyError =
        error.error?.message || 'Unable to load membership history';
      this.historyLoading = false;
    }
  });
}

// Close Membership History
closeMembershipHistory(): void {
  this.showHistory = false;
  this.selectedHistoryMember = null;
  this.membershipHistory = [];
  this.historyError = '';
}

// Generate Member QR Code
async generateQR(member: any): Promise<void> {
  this.qrLoading = true;
  this.qrError = '';
  this.qrImage = '';
  this.qrMemberName = member.fullName;
  this.qrMemberPhone = member.phone;
  this.showQRModal = true;

  this.memberService.generateMemberQR(member._id).subscribe({
    next: async (response: any) => {
      try {
        const qrToken = response.qrToken;

        if (!qrToken) {
          throw new Error('QR token not received');
        }

        this.qrImage = await QRCode.toDataURL(qrToken, {
          width: 300,
          margin: 2,
          errorCorrectionLevel: 'H'
        });

        this.qrLoading = false;
      } catch (error) {
        console.error('QR generation error:', error);
        this.qrError = 'Unable to generate QR image.';
        this.qrLoading = false;
      }
    },
    error: (error: any) => {
      console.error('QR API error:', error);
      this.qrError =
        error.error?.message || 'Unable to generate QR Code.';
      this.qrLoading = false;
    }
  });
}

// Close QR Modal
closeQRModal(): void {
  this.showQRModal = false;
  this.qrImage = '';
  this.qrError = '';
}

// Download QR Code
downloadQR(): void {
  if (!this.qrImage) return;

  const link = document.createElement('a');
  link.href = this.qrImage;
  link.download = `${this.qrMemberName}-QR.png`;
  link.click();
}

}
