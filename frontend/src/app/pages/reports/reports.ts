import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ManagementService } from '../../services/management';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class Reports implements OnInit {
  to = new Date().toISOString().slice(0, 10);
  from = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  loading = false;
  errorMessage = '';
  report: any = null;

  constructor(private readonly management: ManagementService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.management.getReport(this.from, this.to)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: response => this.report = response,
        error: error => {
          console.error('Report loading error:', error);
          this.report = null;
          this.errorMessage = error.error?.message || 'Unable to generate report.';
        }
      });
  }
}
