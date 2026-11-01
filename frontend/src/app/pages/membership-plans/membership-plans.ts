import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MembershipPlanService } from '../../services/membership-plan';

@Component({
  selector: 'app-membership-plans',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './membership-plans.html',
  styleUrl: './membership-plans.scss'
})
export class MembershipPlans implements OnInit {

  plans: any[] = [];
  filteredPlans: any[] = [];

  searchText = '';
  statusFilter = '';

  loading = false;
  showForm = false;
  isEditMode = false;

  selectedPlanId = '';

  planForm: any = this.getEmptyForm();

  constructor(private planService: MembershipPlanService) {}

  ngOnInit(): void {
    this.loadPlans();
  }

  getEmptyForm(): any {
    return {
      planName: '',
      duration: 1,
      durationType: 'Months',
      price: 0,
      description: '',
      benefits: [],
      status: 'Active'
    };
  }

  loadPlans(): void {
    this.loading = true;

    this.planService.getPlans().subscribe({
      next: (response) => {
        this.plans = response.plans || [];
        this.filterPlans();
        this.loading = false;
      },
      error: (error) => {
        console.error('Plans loading error:', error);
        alert(error.error?.message || 'Unable to load plans');
        this.loading = false;
      }
    });
  }

  filterPlans(): void {
    this.filteredPlans = this.plans.filter(plan => {
      const matchesSearch = plan.planName
        .toLowerCase()
        .includes(this.searchText.toLowerCase());

      const matchesStatus = !this.statusFilter ||
        plan.status === this.statusFilter;

      return matchesSearch && matchesStatus;
    });
  }

  openAddForm(): void {
    this.isEditMode = false;
    this.selectedPlanId = '';
    this.planForm = this.getEmptyForm();
    this.showForm = true;
  }

  openEditForm(plan: any): void {
    this.isEditMode = true;
    this.selectedPlanId = plan._id;

    this.planForm = {
      planName: plan.planName,
      duration: plan.duration,
      durationType: plan.durationType,
      price: plan.price,
      description: plan.description || '',
      benefits: [...(plan.benefits || [])],
      status: plan.status
    };

    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
  }

  addBenefit(): void {
    this.planForm.benefits.push('');
  }

  removeBenefit(index: number): void {
    this.planForm.benefits.splice(index, 1);
  }

  savePlan(): void {
    if (
      !this.planForm.planName.trim() ||
      !this.planForm.duration ||
      this.planForm.duration < 1 ||
      this.planForm.price < 0
    ) {
      alert('Please enter valid plan details');
      return;
    }

    this.planForm.benefits = this.planForm.benefits
      .map((benefit: string) => benefit.trim())
      .filter((benefit: string) => benefit !== '');

    const request = this.isEditMode
      ? this.planService.updatePlan(this.selectedPlanId, this.planForm)
      : this.planService.addPlan(this.planForm);

    request.subscribe({
      next: (response) => {
        alert(response.message);
        this.closeForm();
        this.loadPlans();
      },
      error: (error) => {
        alert(error.error?.message || 'Unable to save membership plan');
      }
    });
  }

  deletePlan(plan: any): void {
    const confirmed = confirm(
      `Are you sure you want to delete ${plan.planName}?`
    );

    if (!confirmed) return;

    this.planService.deletePlan(plan._id).subscribe({
      next: (response) => {
        alert(response.message);
        this.loadPlans();
      },
      error: (error) => {
        alert(error.error?.message || 'Unable to delete plan');
      }
    });
  }

  get activePlans(): number {
    return this.plans.filter(plan => plan.status === 'Active').length;
  }

  get inactivePlans(): number {
    return this.plans.filter(plan => plan.status === 'Inactive').length;
  }
}