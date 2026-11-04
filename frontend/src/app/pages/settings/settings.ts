import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ManagementService } from '../../services/management';
import { GST_STATES } from '../../utils/gst-states';

@Component({
  selector: 'app-business-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class BusinessSettings implements OnInit {
  @Output() businessUpdated = new EventEmitter<string>();

  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';
  form = {
    businessName: '',
    businessType: 'Gym',
    phone: '',
    email: '',
    address: '',
    logoUrl: '',
    gstEnabled: false,
    gstinNumber: '',
    legalBusinessName: '',
    registeredBusinessAddress: '',
    state: '',
    stateCode: '',
    gstPercentage: 0,
    taxInclusive: true
  };
  readonly businessTypes = ['Gym', 'Yoga Studio', 'Fitness Studio', 'Other'];
  readonly gstStates = GST_STATES;

  constructor(private readonly management: ManagementService) {}

  ngOnInit(): void {
    this.load();
  }

  onStateCodeChange(stateCode: string): void {
    this.form.state = this.gstStates.find(item => item.code === stateCode)?.name || '';
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.management.getSettings()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: response => {
          const business = response.business;
          this.form = {
            businessName: business.businessName || '',
            businessType: business.businessType || 'Other',
            phone: business.phone || '',
            email: business.email || '',
            address: business.address || '',
            logoUrl: business.logoUrl || '',
            gstEnabled: business.gstEnabled === true,
            gstinNumber: business.gstinNumber || '',
            legalBusinessName: business.legalBusinessName || '',
            registeredBusinessAddress: business.registeredBusinessAddress || '',
            state: business.state || '',
            stateCode: business.stateCode || '',
            gstPercentage: Number(business.gstPercentage || 0),
            taxInclusive: business.taxInclusive !== false
          };
        },
        error: error => {
          console.error('Business settings loading error:', error);
          this.errorMessage = error.error?.message || 'Unable to load settings.';
        }
      });
  }

  save(): void {
    if (this.saving) return;
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.management.updateSettings(this.form)
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: response => {
          const business = response.business;
          this.form = {
            businessName: business.businessName,
            businessType: business.businessType,
            phone: business.phone || '',
            email: business.email || '',
            address: business.address || '',
            logoUrl: business.logoUrl || '',
            gstEnabled: business.gstEnabled === true,
            gstinNumber: business.gstinNumber || '',
            legalBusinessName: business.legalBusinessName || '',
            registeredBusinessAddress: business.registeredBusinessAddress || '',
            state: business.state || '',
            stateCode: business.stateCode || '',
            gstPercentage: Number(business.gstPercentage || 0),
            taxInclusive: business.taxInclusive !== false
          };
          localStorage.setItem('business', JSON.stringify(business));
          this.businessUpdated.emit(business.businessName);
          this.successMessage = 'Business settings saved.';
        },
        error: error => {
          console.error('Business settings save error:', error);
          this.errorMessage = error.error?.message || 'Unable to save settings.';
        }
      });
  }
}
