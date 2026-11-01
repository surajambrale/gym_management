import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth';
import { DashboardService } from './services/dashboard';

import { Members } from './pages/members/members';
import { MembershipPlans } from './pages/membership-plans/membership-plans';
import { Attendance } from './pages/attendance/attendance';
import { Payments } from './pages/payments/payments';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    Members,
    MembershipPlans,
    Attendance,
    Payments
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  constructor(
    private router: Router,
    private authService: AuthService,
    private dashboardService: DashboardService
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
          this.loadDashboardData();

          this.ownerName = response.owner.name || 'Owner';
          this.businessName =
            response.business.businessName || 'SS Fitness Manager';

          localStorage.setItem('owner', JSON.stringify(response.owner));
          localStorage.setItem('business', JSON.stringify(response.business));

          // Direct URL /members par page refresh hone par bhi
          // Members module dashboard ke andar open hoga.
          if (currentUrl.startsWith('/members')) {
            this.selectedMenu = 'Members';
          } else if (currentUrl.startsWith('/dashboard')) {
            this.selectedMenu = 'Dashboard';
          }
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
    this.selectedMenu = 'Dashboard';
    this.router.navigate(['/login']);
  }

  get isAuthRoute(): boolean {
    return this.router.url.startsWith('/register') ||
      this.router.url.startsWith('/login');
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

  stats: any[] = [];
  recentMembers: any[] = [];

  dashboardLoading = false;
  dashboardError = '';
  todayAttendance = 0;

  selectMenu(name: string): void {
    this.selectedMenu = name;
    this.mobileMenuOpen = false;

    // Dashboard modules are displayed inline.
    // Only authentication pages use router navigation.
    if (name === 'Dashboard' || name === 'Members') {
      return;
    }

    if (
      name === 'Membership Plans' ||
      name === 'Attendance' ||
      name === 'Payments & Fees'
    ) {
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

  loadDashboardData(): void {
    this.dashboardLoading = true;
    this.dashboardError = '';

    this.dashboardService.getDashboardStats().subscribe({
      next: (response) => {
        if (response.success) {
          const data = response.stats;
          this.todayAttendance = data.todayAttendance;

          this.stats = [
            {
              title: 'Total Members',
              value: data.totalMembers.toLocaleString('en-IN'),
              change: '',
              description: 'All registered members',
              icon: '♙',
              color: 'blue'
            },
            {
              title: 'Active Members',
              value: data.activeMembers.toLocaleString('en-IN'),
              change: '',
              description: 'Currently active',
              icon: '✓',
              color: 'green'
            },
            {
              title: 'Total Collected',
              value: '₹' + data.totalCollected.toLocaleString('en-IN'),
              change: '',
              description: 'Membership collection',
              icon: '₹',
              color: 'orange'
            },
            {
              title: 'Pending Fees',
              value: '₹' + data.totalPending.toLocaleString('en-IN'),
              change: '',
              description: 'Remaining membership fees',
              icon: '◷',
              color: 'red'
            }
          ];

          this.recentMembers = (response.recentMembers || []).map((member: any) => ({
            id: member._id.slice(-6).toUpperCase(),
            name: member.fullName,
            phone: member.phone,
            plan: '-',
            joining: new Date(member.joiningDate || member.createdAt)
              .toLocaleDateString('en-IN'),
            status: member.status
          }));
        }

        this.dashboardLoading = false;
      },

      error: (error) => {
        console.error('Dashboard API Error:', error);
        this.dashboardError = 'Unable to load dashboard data.';
        this.dashboardLoading = false;
      }
    });
  }
}
