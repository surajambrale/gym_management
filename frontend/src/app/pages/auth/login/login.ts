import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {

  loginForm: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason === 'inactive') {
      this.successMessage = 'You have been logged out due to inactivity.';
    } else if (reason === 'expired') {
      this.successMessage = 'Your session has expired. Please log in again.';
    } else if (reason === 'revoked') {
      this.successMessage = 'This session is no longer active. Please log in again.';
    }
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {

    this.errorMessage = '';
    this.successMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;

    this.authService.login(this.loginForm.value).subscribe({

      next: (response) => {

        this.loading = false;

        if (response.success && response.session?.id) {
          this.successMessage = 'Login successful!';
          this.router.navigate(['/dashboard']);
        } else {
          this.errorMessage = response.message || 'Login failed.';
        }

      },

      error: (error) => {

        this.loading = false;

        this.errorMessage =
          error.error?.message || 'Invalid email or password.';

      }

    });

  }

}