import { MembershipPlans } from './pages/membership-plans/membership-plans';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './services/auth';
import { Attendance } from './pages/attendance/attendance';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet , MembershipPlans, Attendance],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  constructor(
  private router: Router,
  private authService: AuthService
) {}

ngOnInit(): void {
  this.verifySession();
}

verifySession(): void {
  const currentUrl = this.router.url;

  // Login/Register pages par profile verification nahi karni
  if (
    currentUrl.startsWith('/login') ||
    currentUrl.startsWith('/register')
  ) {
    this.sessionChecking = false;
    this.isAuthenticated = false;
    return;
  }

  if (!this.authService.isLoggedIn()) {
    this.sessionChecking = false;
    this.isAuthenticated = false;
    this.router.navigate(['/login']);
    return;
  }

  this.sessionChecking = true;

  this.authService.getProfile().subscribe({
    next: (response) => {
      if (response.success && response.owner && response.business) {
        this.isAuthenticated = true;

        this.ownerName = response.owner.name || 'Owner';
        this.businessName =
          response.business.businessName || 'SS Fitness Manager';

        localStorage.setItem(
          'owner',
          JSON.stringify(response.owner)
        );

        localStorage.setItem(
          'business',
          JSON.stringify(response.business)
        );
      } else {
        this.authService.logout();
        this.isAuthenticated = false;
        this.router.navigate(['/login']);
      }

      this.sessionChecking = false;
    },

    error: (error) => {
      console.error('Session verification failed:', error);

      this.authService.logout();
      this.isAuthenticated = false;
      this.sessionChecking = false;

      this.router.navigate(['/login']);
    }
  });
}

logout(): void {
  this.authService.logout();
  this.isAuthenticated = false;
  this.ownerName = 'Admin';
  this.router.navigate(['/login']);
}


  get isAuthRoute(): boolean {
    return this.router.url.startsWith('/register') ||
      this.router.url.startsWith('/login');
  }

  get isMembersRoute(): boolean {
  return this.router.url.startsWith('/members');
}

  selectedMenu = 'Dashboard';
  mobileMenuOpen = false;
  isAuthenticated = false;
  sessionChecking = true;
  businessName = 'SS Fitness Manager';
  ownerName = 'Admin';

  menuGroups = [
    {
      title: 'MAIN MENU',
      items: [
        { name: 'Dashboard', icon: '▦' },
        { name: 'Members', icon: '♙' },
        { name: 'Membership Plans', icon: '▤' },
        { name: 'Attendance', icon: '◷' },
        { name: 'Payments & Fees', icon: '₹' }
      ]
    },
    {
      title: 'MANAGEMENT',
      items: [
        { name: 'Trainers & Staff', icon: '♧' },
        { name: 'Dance Batches', icon: '♫' },
        { name: 'Reports & Analytics', icon: '▥' }
      ]
    },
    {
      title: 'SYSTEM',
      items: [
        { name: 'Settings', icon: '⚙' },
        { name: 'Subscription', icon: '◇' },
        { name: 'Help & Support', icon: '?' }
      ]
    }
  ];

  stats = [
    {
      title: 'Total Members',
      value: '1,248',
      change: '+12.5%',
      description: 'Compared to last month',
      icon: '♙',
      color: 'blue'
    },
    {
      title: 'Active Members',
      value: '986',
      change: '+8.2%',
      description: 'Currently active',
      icon: '✓',
      color: 'green'
    },
    {
      title: 'Monthly Revenue',
      value: '₹2,45,800',
      change: '+15.8%',
      description: 'Compared to last month',
      icon: '₹',
      color: 'orange'
    },
    {
      title: 'Pending Fees',
      value: '₹38,500',
      change: '24 members',
      description: 'Payment pending',
      icon: '◷',
      color: 'red'
    }
  ];

  recentMembers = [
    {
      id: 'GYM001',
      name: 'Rahul Sharma',
      phone: '9876543210',
      plan: 'Quarterly',
      joining: '28 Oct 2026',
      status: 'Active'
    },
    {
      id: 'GYM002',
      name: 'Priya Patil',
      phone: '9876543211',
      plan: 'Monthly',
      joining: '27 Oct 2026',
      status: 'Active'
    },
    {
      id: 'GYM003',
      name: 'Amit Kumar',
      phone: '9876543212',
      plan: 'Yearly',
      joining: '25 Oct 2026',
      status: 'Active'
    },
    {
      id: 'GYM004',
      name: 'Sneha Joshi',
      phone: '9876543213',
      plan: 'Monthly',
      joining: '24 Oct 2026',
      status: 'Expired'
    }
  ];

selectMenu(name: string): void {
  this.selectedMenu = name;
  this.mobileMenuOpen = false;

  if (name === 'Members') {
    this.router.navigate(['/members']);
    return;
  }

  if (name === 'Dashboard') {
    this.router.navigate(['/dashboard']);
    return;
  }

  if (name === 'Attendance') {
    this.router.navigate(['/attendance']);
    return;
  }
}

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  get currentDate(): string {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date());
  }

}
