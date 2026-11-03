import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ManagementService } from '../../services/management';

interface TrainerStaffRecord {
  _id: string;
  name: string;
  phone: string;
  email: string;
  role: 'Trainer' | 'Staff';
  specialization: string;
  status: 'Active' | 'Inactive';
}

@Component({
  selector: 'app-trainers-staff',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trainers-staff.html',
  styleUrl: './trainers-staff.scss'
})
export class TrainersStaff implements OnInit {
  records: TrainerStaffRecord[] = [];
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';
  editingId = '';
  form = this.emptyForm();

  constructor(private readonly management: ManagementService) {}

  ngOnInit(): void {
    this.load();
  }

  private emptyForm() {
    return {
      name: '',
      phone: '',
      email: '',
      role: 'Trainer' as 'Trainer' | 'Staff',
      specialization: '',
      status: 'Active' as 'Active' | 'Inactive'
    };
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.management.getStaff()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: response => this.records = response.staff || [],
        error: error => {
          console.error('Trainer/staff loading error:', error);
          this.errorMessage = error.error?.message || 'Unable to load records.';
        }
      });
  }

  edit(record: TrainerStaffRecord): void {
    this.editingId = record._id;
    this.form = {
      name: record.name,
      phone: record.phone,
      email: record.email || '',
      role: record.role,
      specialization: record.specialization || '',
      status: record.status
    };
    this.successMessage = '';
    this.errorMessage = '';
  }

  resetForm(): void {
    this.editingId = '';
    this.form = this.emptyForm();
  }

  save(): void {
    if (this.saving) return;
    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';
    const request = this.editingId
      ? this.management.updateStaff(this.editingId, this.form)
      : this.management.createStaff(this.form);

    request.pipe(finalize(() => this.saving = false)).subscribe({
      next: () => {
        this.successMessage = this.editingId ? 'Record updated.' : 'Record added.';
        this.resetForm();
        this.load();
      },
      error: error => {
        console.error('Trainer/staff save error:', error);
        this.errorMessage = error.error?.message || 'Unable to save record.';
      }
    });
  }

  remove(record: TrainerStaffRecord): void {
    if (!confirm(`Permanently remove ${record.name} from this business?`)) return;
    this.management.deleteStaff(record._id).subscribe({
      next: () => {
        this.records = this.records.filter(item => item._id !== record._id);
        this.successMessage = 'Record deleted.';
      },
      error: error => {
        console.error('Trainer/staff deletion error:', error);
        this.errorMessage = error.error?.message || 'Unable to delete record.';
      }
    });
  }
}
